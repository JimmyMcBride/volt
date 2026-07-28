import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { selectCalibrationPowerRecommendation } from "./analysis.mjs";
import { ArtifactStore } from "./artifacts.mjs";
import {
  buildCalibrationSchedule,
  CALIBRATION_REQUEST_CEILING,
  CALIBRATION_TRAJECTORY_COUNT
} from "./calibration.mjs";
import { publicTaskContext } from "./corpus.mjs";
import { runTrajectory, sameFrozenFirstFailure } from "./harness.mjs";
import { auditActionsForTurn } from "./live-contract.mjs";
import { ProviderError } from "./providers.mjs";
import { CheckpointJournal, SpendLedger } from "./spend.mjs";
import { contentHash } from "./stable.mjs";

export class MeteredProviderModel {
  #provider;
  #ledger;
  #journal;
  #usage = new Map();

  constructor({ provider, ledger, journal }) {
    this.id = provider.id;
    this.seedSupported = provider.seedSupported;
    this.model = provider.model;
    this.#provider = provider;
    this.#ledger = ledger;
    this.#journal = journal;
  }

  requestIdentity(request) {
    return contentHash({
      schemaVersion: 1,
      trajectoryId: request.trajectoryId,
      turn: request.turn,
      nonce: request.nonce,
      authorizationHash: request.authorizationHash
    });
  }

  hasRequest(request) {
    return this.#ledger.hasRequest(this.requestIdentity(request));
  }

  bindFingerprint(fingerprint) {
    this.#provider.bindFingerprint(fingerprint);
  }

  bindResponseIdentity(responseId) {
    this.#provider.bindResponseIdentity(responseId);
  }

  async complete(request) {
    const usage = this.#usage.get(request.trajectoryId) ?? { inputTokens: 0, outputTokens: 0 };
    const requestId = this.requestIdentity(request);
    const reservation = this.#ledger.reserve({
      requestId,
      trajectoryId: request.trajectoryId,
      provider: this.model.provider,
      remainingInputTokens: 64_000 - usage.inputTokens,
      remainingOutputTokens: Math.min(4_000, 16_000 - usage.outputTokens),
      phase: request.phase ?? "scheduled"
    });
    await this.#journal.append("request_reserved", {
      ...reservation,
      requestId,
      trajectoryId: request.trajectoryId,
      turn: request.turn,
      provider: this.model.provider,
      ledger: this.#ledger.snapshot()
    });
    try {
      const response = await this.#provider.complete(request);
      const entry = this.#ledger.recordSuccess(requestId, response.providerMetadata);
      this.#usage.set(request.trajectoryId, {
        inputTokens: usage.inputTokens + response.providerMetadata.inputTokens,
        outputTokens: usage.outputTokens + response.providerMetadata.outputTokens
      });
      await this.#journal.append("request_completed", {
        entry,
        providerMetadata: response.providerMetadata,
        ledger: this.#ledger.snapshot()
      });
      return response;
    } catch (error) {
      const ambiguous = error instanceof ProviderError && error.billingAmbiguous;
      const entry = ambiguous
        ? this.#ledger.recordAmbiguous(requestId, error.message)
        : this.#ledger.recordUnbilledFailure(requestId, error.message);
      await this.#journal.append("request_failed", {
        entry,
        error: {
          name: error.name,
          message: error.message,
          status: error.status ?? null,
          billingAmbiguous: ambiguous
        },
        ledger: this.#ledger.snapshot()
      });
      throw error;
    }
  }
}

function outcome(record, estimand) {
  if (estimand.outcome === "first_submission_hidden_test_pass") {
    return record.firstSubmission.hiddenTestPass ? 1 : 0;
  }
  if (estimand.outcome === "hidden_test_repair_within_three_turns") {
    if (record.firstSubmission.hiddenTestPass) return null;
    return record.repairs.some((repair) => repair.turn <= 3 && repair.hiddenTestPass) ? 1 : 0;
  }
  if (estimand.outcome === "repository_change_success_rate") {
    return record.maintenanceEvaluations.finalSubmission.repositoryChangeSuccess ? 1 : 0;
  }
  if (estimand.outcome === "repository_change_success_within_three_turns") {
    if (record.firstSubmission.hiddenTestPass) return null;
    return record.maintenanceEvaluations.finalSubmission.repositoryChangeSuccess ? 1 : 0;
  }
  throw new TypeError(`unknown calibration outcome: ${estimand.outcome}`);
}

function variance(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
}

export function calibrationPowerInputs(records, protocol) {
  return protocol.primaryEstimands.map((estimand) => {
    const eligible = records.filter((record) => record.condition === estimand.control)
      .map((record) => ({ record, value: outcome(record, estimand) }))
      .filter(({ value }) => value !== null);
    const strata = new Map();
    for (const item of eligible) {
      const key = `${item.record.task.id}:${item.record.modelId}`;
      const values = strata.get(key) ?? [];
      values.push(item.value);
      strata.set(key, values);
    }
    const rates = [...strata.values()].map(
      (values) => values.reduce((sum, value) => sum + value, 0) / values.length
    );
    return {
      id: estimand.id,
      eligibleCount: eligible.length,
      baselineRate: eligible.length === 0
        ? null
        : eligible.reduce((sum, item) => sum + item.value, 0) / eligible.length,
      taskVariance: variance(rates)
    };
  });
}

export function confirmatoryCostEstimate(recommendation, models) {
  if (!recommendation.feasible) return null;
  const trajectoriesPerModel = 12 * 4 * recommendation.trajectoriesPerTaskModelCondition;
  const byProvider = models.map((model) => {
    const rate = model.priceUsdPerMillion;
    const perTrajectory =
      64_000 / 1_000_000 * rate.input +
      16_000 / 1_000_000 * rate.output;
    return {
      provider: model.provider,
      trajectories: trajectoriesPerModel,
      worstCaseUsd: trajectoriesPerModel * perTrajectory
    };
  });
  return {
    trajectories: trajectoriesPerModel * models.length,
    byProvider,
    worstCaseUsd: byProvider.reduce((sum, provider) => sum + provider.worstCaseUsd, 0)
  };
}

export function rehydrateFirstSubmissions(checkpointRecords) {
  const submissions = new Map();
  for (const checkpoint of checkpointRecords) {
    if (checkpoint.kind !== "trajectory_completed" ||
        checkpoint.value?.record?.condition !== "volt_full" ||
        checkpoint.value.frozenFirstSubmission === null ||
        checkpoint.value.frozenFirstSubmission === undefined) {
      continue;
    }
    submissions.set(
      checkpoint.value.record.trajectoryId,
      structuredClone(checkpoint.value.frozenFirstSubmission)
    );
  }
  return submissions;
}

export async function executeCalibration({
  tasks,
  models,
  providerModels,
  aliasManifest,
  protocol,
  authorization,
  artifactRoot,
  checkpointPath
}) {
  if (authorization.phase !== "calibration" || authorization.approved !== true) {
    throw new TypeError("executeCalibration requires an owner-approved calibration authorization");
  }
  const schedule = buildCalibrationSchedule({ tasks, models });
  const { journal, records: checkpointRecords } = await CheckpointJournal.load(checkpointPath);
  if (checkpointRecords.some((record) => record.kind === "calibration_completed")) {
    throw new TypeError("calibration checkpoint is already complete");
  }
  const latestLedgerSnapshot = checkpointRecords
    .map((record) => record.value?.ledger)
    .filter((snapshot) => snapshot !== undefined)
    .at(-1);
  const ledger = latestLedgerSnapshot === undefined
    ? new SpendLedger({
        maximumSpendUsd: authorization.maximumSpendUsd,
        models,
        requestCeiling: CALIBRATION_REQUEST_CEILING
      })
    : SpendLedger.restore({ snapshot: latestLedgerSnapshot, models });
  for (const entry of ledger.settleInterruptedReservations()) {
    await journal.append("interrupted_request_settled", {
      entry,
      ledger: ledger.snapshot()
    });
  }
  const meteredModels = new Map(
    providerModels.map((provider) => [
      provider.id,
      new MeteredProviderModel({ provider, ledger, journal })
    ])
  );
  for (const record of checkpointRecords) {
    const metadata = record.value?.providerMetadata;
    const model = meteredModels.get(metadata?.modelId);
    if (model !== undefined) {
      model.bindResponseIdentity(metadata.responseId);
      if (metadata.systemFingerprint !== null && metadata.systemFingerprint !== undefined) {
        model.bindFingerprint(metadata.systemFingerprint);
      }
    }
  }
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const firstSubmissions = rehydrateFirstSubmissions(checkpointRecords);
  const trajectoryRecords = checkpointRecords
    .filter((record) => record.kind === "trajectory_completed")
    .map((record) => record.value.record);
  const completedTrajectoryIds = new Set(
    trajectoryRecords.map((record) => record.trajectoryId)
  );
  const pairingFailures = [];
  await mkdir(artifactRoot, { recursive: true, mode: 0o700 });

  const probeTask = tasks
    .filter((task) => task.corpus === "calibration")
    .sort((left, right) => left.id.localeCompare(right.id))[0];
  if (probeTask === undefined) throw new TypeError("phase-zero identity probe requires a calibration task");
  for (const model of meteredModels.values()) {
    const request = {
      task: publicTaskContext(probeTask),
      condition: "volt_full",
      turn: 0,
      feedback: null,
      trajectoryId: `phase-zero:${model.id}`,
      authorizationHash: contentHash(authorization),
      nonce: contentHash(`phase-zero:${model.id}:${contentHash(authorization)}`).slice(7),
      seed: null,
      phase: "phase_zero"
    };
    if (model.hasRequest(request)) {
      const completed = checkpointRecords.some(
        (record) =>
          record.kind === "request_completed" &&
          record.value?.entry?.trajectoryId === request.trajectoryId
      );
      if (!completed) {
        throw new TypeError(`phase-zero identity probe is ambiguous and cannot be replayed: ${model.id}`);
      }
      continue;
    }
    await model.complete(request);
  }

  for (const item of schedule) {
    if (completedTrajectoryIds.has(item.trajectoryId)) continue;
    const task = taskById.get(item.taskId);
    const model = meteredModels.get(item.modelId);
    if (task === undefined || model === undefined) throw new TypeError(`invalid schedule item: ${item.trajectoryId}`);
    const artifactStore = new ArtifactStore();
    let capturedFirst = null;
    const record = await runTrajectory({
      task,
      condition: item.condition,
      model,
      replicate: item.replicate,
      aliasManifest,
      frozenFirstSubmission: item.frozenFirstSubmissionFrom === null
        ? undefined
        : firstSubmissions.get(item.frozenFirstSubmissionFrom),
      requireFrozenFirstSubmission: item.frozenFirstSubmissionFrom !== null,
      onFirstSubmission: (submission) => {
        capturedFirst = submission;
      },
      authorizationHash: contentHash(authorization),
      turnNonces: item.turnNonces,
      requestSeed: item.seed,
      artifactStore
    });
    if (item.condition === "volt_full") firstSubmissions.set(item.trajectoryId, capturedFirst);
    if (item.condition === "diagnostics_plain") {
      const parent = trajectoryRecords.find(
        (candidate) => candidate.trajectoryId === item.frozenFirstSubmissionFrom
      );
      if (parent === undefined || !sameFrozenFirstFailure(parent, record) ||
          parent.firstSubmission.diagnosticsHash !== record.firstSubmission.diagnosticsHash) {
        pairingFailures.push(item.trajectoryId);
      }
    }
    await artifactStore.write(
      resolve(artifactRoot, item.taskId, item.modelId.replaceAll("/", "_"), item.condition, String(item.replicate)),
      item.trajectoryId
    );
    trajectoryRecords.push(record);
    await journal.append("trajectory_completed", {
      record,
      recordHash: contentHash(record),
      frozenFirstSubmission: item.condition === "volt_full" ? capturedFirst : null,
      ledger: ledger.snapshot()
    });
  }
  if (trajectoryRecords.length !== CALIBRATION_TRAJECTORY_COUNT) {
    throw new TypeError("calibration did not produce exactly 160 trajectory records");
  }
  const endpointInputs = calibrationPowerInputs(trajectoryRecords, protocol);
  const recommendation = pairingFailures.length === 0
    ? selectCalibrationPowerRecommendation(endpointInputs)
    : {
        feasible: false,
        decision: "infeasible",
        reason: "diagnostic_fork_parity_failure",
        failedTrajectoryIds: pairingFailures
      };
  const report = {
    schemaVersion: 1,
    kind: "non_scored_calibration",
    calibrationEffectsAreEvidence: false,
    trajectoryCount: trajectoryRecords.length,
    failureCount: trajectoryRecords.filter((record) => record.status !== "completed").length,
    missingCount: trajectoryRecords.filter((record) => record.status === "missing").length,
    pairingValid: pairingFailures.length === 0,
    pairingFailures,
    powerInputs: endpointInputs,
    recommendation,
    confirmatoryCostEstimate: confirmatoryCostEstimate(recommendation, models),
    spend: ledger.snapshot(),
    phaseZeroIdentityProbeCount: meteredModels.size,
    confirmatoryAuthorized: false
  };
  await journal.append("calibration_completed", {
    scheduleHash: contentHash(schedule),
    recordsHash: contentHash(trajectoryRecords),
    reportHash: contentHash(report),
    report
  });
  return { schedule, records: trajectoryRecords, report };
}

export async function executeFakeCalibration({
  tasks,
  models,
  aliasManifest,
  artifactRoot = null
}) {
  const schedule = buildCalibrationSchedule({ tasks, models });
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const firstSubmissions = new Map();
  const records = [];
  const requests = [];
  let tick = 0;

  for (const item of schedule) {
    const task = taskById.get(item.taskId);
    if (task === undefined) throw new TypeError(`missing fake calibration task: ${item.taskId}`);
    const modelDefinition = models.find((model) => model.id === item.modelId);
    const model = {
      id: item.modelId,
      seedSupported: modelDefinition.seedSupported,
      async complete(request) {
        requests.push({
          trajectoryId: request.trajectoryId,
          turn: request.turn,
          nonce: request.nonce,
          seed: request.seed,
          modelId: item.modelId
        });
        return {
          files: task.expectedSolution.files,
          generatedTokens: 100,
          auditActions: auditActionsForTurn(request.turn)
        };
      }
    };
    const artifactStore = new ArtifactStore();
    let capturedFirst = null;
    const record = await runTrajectory({
      task,
      condition: item.condition,
      model,
      replicate: item.replicate,
      aliasManifest,
      frozenFirstSubmission: item.frozenFirstSubmissionFrom === null
        ? undefined
        : firstSubmissions.get(item.frozenFirstSubmissionFrom),
      requireFrozenFirstSubmission: item.frozenFirstSubmissionFrom !== null,
      onFirstSubmission: (submission) => {
        capturedFirst = submission;
      },
      authorizationHash: contentHash("fake-zero-spend-authorization"),
      turnNonces: item.turnNonces,
      requestSeed: item.seed,
      now: () => tick++,
      artifactStore
    });
    if (item.condition === "volt_full") firstSubmissions.set(item.trajectoryId, capturedFirst);
    if (item.condition === "diagnostics_plain") {
      const parent = records.find((candidate) => candidate.trajectoryId === item.frozenFirstSubmissionFrom);
      if (parent === undefined || !sameFrozenFirstFailure(parent, record)) {
        throw new TypeError(`fake diagnostic fork parity failed: ${item.trajectoryId}`);
      }
    }
    if (artifactRoot !== null) {
      await artifactStore.write(
        resolve(artifactRoot, item.taskId, item.modelId.replaceAll("/", "_"), item.condition, String(item.replicate)),
        item.trajectoryId
      );
    }
    records.push(record);
  }
  return {
    schemaVersion: 1,
    kind: "zero_spend_fake_calibration",
    schedule,
    records,
    requests,
    scheduleHash: contentHash(schedule),
    recordsHash: contentHash(records),
    requestHash: contentHash(requests),
    trajectoryCount: records.length,
    inferenceRequestCount: requests.length,
    requestCeiling: CALIBRATION_REQUEST_CEILING,
    networkCalls: 0,
    providerSpendUsd: 0
  };
}
