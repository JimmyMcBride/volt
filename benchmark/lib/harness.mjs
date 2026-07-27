import { compileCondition } from "./conditions.mjs";
import { publicTaskContext, runHiddenTests } from "./corpus.mjs";
import { ArtifactStore } from "./artifacts.mjs";
import { contentHash, deterministicShuffle, stableJson } from "./stable.mjs";
import { validateTrajectoryRecord } from "./validation.mjs";

const LIMITS = Object.freeze({
  repairTurns: 3,
  maxOutputTokensPerTurn: 4_000,
  maxOutputTokensPerTrajectory: 16_000,
  wallClockMilliseconds: 15 * 60 * 1_000
});
const FIRST_SUBMISSION_TOOLS = new Set(["inspect", "edit", "submit"]);

class TrajectoryTimeoutError extends Error {
  constructor() {
    super("trajectory wall-clock budget exhausted");
    this.name = "TrajectoryTimeoutError";
  }
}

function clone(value) {
  return structuredClone(value);
}

async function completeWithin(model, request, milliseconds) {
  if (milliseconds <= 0) throw new TrajectoryTimeoutError();
  let timer;
  try {
    return await Promise.race([
      model.complete(request),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new TrajectoryTimeoutError()), milliseconds);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export class FakeModel {
  #responses;

  constructor({ id = "fake-model", responses = [], seedSupported = true } = {}) {
    this.id = id;
    this.seedSupported = seedSupported;
    this.#responses = clone(responses);
  }

  async complete(request) {
    const response = this.#responses.shift();
    if (response === undefined) throw new Error(`fake model ${this.id} has no response for turn ${request.turn}`);
    if (response.throw !== undefined) throw new Error(response.throw);
    return clone(response);
  }

  fork() {
    return new FakeModel({ id: this.id, responses: this.#responses, seedSupported: this.seedSupported });
  }
}

export class ReplayModel {
  constructor({ id = "replay-model", records = new Map() } = {}) {
    this.id = id;
    this.seedSupported = true;
    this.records = new Map(records);
  }

  async complete(request) {
    const key = contentHash({
      taskId: request.task.id,
      condition: request.condition,
      turn: request.turn,
      prompt: request.prompt
    });
    const response = this.records.get(key);
    if (response === undefined) throw new Error(`replay miss: ${key}`);
    return clone(response);
  }
}

function validateResponse(response, turn) {
  if (response === null || typeof response !== "object") throw new TypeError("model response must be an object");
  if (response.files === null || typeof response.files !== "object" || Array.isArray(response.files)) {
    throw new TypeError("model response files must be an object");
  }
  const tokens = response.generatedTokens ?? 0;
  if (!Number.isInteger(tokens) || tokens < 0) throw new TypeError("generatedTokens must be a non-negative integer");
  if (tokens > LIMITS.maxOutputTokensPerTurn) return { budgetExceeded: true, tokens };
  const toolCalls = response.toolCalls ?? [];
  if (!Array.isArray(toolCalls)) throw new TypeError("toolCalls must be an array");
  if (turn === 0) {
    const forbidden = toolCalls.filter((tool) => !FIRST_SUBMISSION_TOOLS.has(tool));
    if (forbidden.length > 0) throw new TypeError(`forbidden first-submission tools: ${forbidden.join(", ")}`);
  }
  return { budgetExceeded: false, tokens, toolCalls };
}

function mergeFiles(seed, responseFiles) {
  return Object.fromEntries(
    Object.entries({ ...seed, ...responseFiles }).sort(([left], [right]) => left.localeCompare(right))
  );
}

function changedFiles(before, after) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((path) => before[path] !== after[path])
    .sort();
}

function maintenanceEvaluation(task, files, hidden, compilation) {
  const actualFiles = changedFiles(task.seed.files, files);
  const expectedFiles = task.expectedImpact.files;
  const missingFiles = expectedFiles.filter((path) => !actualFiles.includes(path));
  const unexpectedFiles = actualFiles.filter((path) => !expectedFiles.includes(path));
  const codes = new Set(compilation.compilation.diagnostics.map((diagnostic) => diagnostic.code));
  const effectDeclarationsAccurate = !codes.has("K_EFFECT_MISSING") && !codes.has("K_EFFECT_UNUSED");
  const matchesExhaustive = !codes.has("K_MATCH_NON_EXHAUSTIVE");
  const staleContractCount = hidden.results.filter(
    (result) => !result.passed && result.id.includes("contract")
  ).length;
  const unrelatedRegressionCount = hidden.results.filter(
    (result) => !result.passed && result.id.includes("preservation")
  ).length;
  const requestedBehaviorImplemented = hidden.results
    .filter((result) => result.id.includes("requested"))
    .every((result) => result.passed);
  const contractPropagationComplete = missingFiles.length === 0 && staleContractCount === 0;
  const guaranteesNotBypassed = !codes.has("K_TYPE_EXACT") && !codes.has("K_EFFECT_MISSING");
  const success = [
    requestedBehaviorImplemented,
    contractPropagationComplete,
    hidden.passed,
    effectDeclarationsAccurate,
    matchesExhaustive,
    guaranteesNotBypassed,
    unrelatedRegressionCount === 0,
    staleContractCount === 0,
    unexpectedFiles.length === 0
  ].every(Boolean);
  return {
    repositoryChangeSuccess: success,
    requestedBehaviorImplemented,
    contractPropagationComplete,
    hiddenTestsPass: hidden.passed,
    effectDeclarationsAccurate,
    matchesExhaustive,
    guaranteesNotBypassed,
    unrelatedRegressionCount,
    staleContractCount,
    unrequestedBehaviorChangeCount: unexpectedFiles.length,
    expectedImpactSiteIds: [...task.expectedImpact.symbols, ...task.expectedImpact.contracts].sort(),
    actualRequiredImpactSiteIds: [...task.expectedImpact.symbols, ...task.expectedImpact.contracts].sort(),
    predictedImpactSiteIds: compilation.compilation.diagnostics
      .flatMap((diagnostic) => diagnostic.repository?.affectedSites ?? [])
      .sort(),
    changedSiteIds: actualFiles,
    semanticBlastRadius: {
      expectedFiles,
      actualFiles,
      missingFiles,
      unexpectedFiles
    }
  };
}

function schemaMaintenance(evaluation, semanticBlastRadiusArtifactHash) {
  const { semanticBlastRadius: _semanticBlastRadius, ...rest } = evaluation;
  return {
    ...rest,
    semanticBlastRadiusArtifactHash
  };
}

function failedMaintenance(semanticBlastRadiusArtifactHash) {
  return {
    repositoryChangeSuccess: false,
    requestedBehaviorImplemented: false,
    contractPropagationComplete: false,
    hiddenTestsPass: false,
    effectDeclarationsAccurate: false,
    matchesExhaustive: false,
    guaranteesNotBypassed: false,
    unrelatedRegressionCount: 0,
    staleContractCount: 0,
    unrequestedBehaviorChangeCount: 0,
    expectedImpactSiteIds: [],
    actualRequiredImpactSiteIds: [],
    predictedImpactSiteIds: [],
    changedSiteIds: [],
    semanticBlastRadiusArtifactHash
  };
}

function artifactHashMap(artifacts, runId) {
  return Object.fromEntries(
    artifacts.index(runId).artifacts.map((artifact) => [artifact.path, artifact.hash])
  );
}

function trajectoryRunManifestHash(task, condition, modelId, replicate) {
  return contentHash({
    schemaVersion: 1,
    protocolId: "volt-v0-evidence-ready",
    protocolVersion: "1.1.0",
    taskId: task.id,
    condition,
    modelId,
    replicate
  });
}

function statusFailure(
  task,
  condition,
  modelId,
  replicate,
  status,
  artifacts,
  startedAt,
  endedAt,
  { tokens = 0, outputBytes = 0, attempts = [] } = {}
) {
  const emptyHash = contentHash("");
  const runId = `${task.id}:${condition}:${replicate}`;
  let fallbackMaintenance;
  if (attempts.length === 0) {
    const blastRadiusHash = artifacts.put("private/failure-semantic-blast-radius.json", {
      expectedFiles: task.expectedImpact.files,
      actualFiles: [],
      missingFiles: task.expectedImpact.files,
      unexpectedFiles: []
    }, { privateArtifact: true });
    fallbackMaintenance = failedMaintenance(blastRadiusHash);
  }
  const first = attempts[0];
  const final = attempts.at(-1);
  const repairs = attempts.slice(1).map((attempt) => ({
    turn: attempt.turn,
    sourceHash: attempt.sourceHash,
    feedbackHash: attempt.feedbackHash,
    hiddenTestPass: attempt.hiddenTestPass
  }));
  return validateTrajectoryRecord({
    schemaVersion: 1,
    trajectoryId: `${task.id}:${modelId}:${condition}:${replicate}`,
    runManifestHash: trajectoryRunManifestHash(task, condition, modelId, replicate),
    task: { id: task.id, family: task.family, corpus: task.corpus },
    modelId,
    condition,
    replicate,
    status,
    firstSubmission: first === undefined ? {
      sourceHash: emptyHash,
      parseSuccess: false,
      typecheckSuccess: false,
      hiddenTestPass: false,
      diagnosticsHash: null
    } : {
      sourceHash: first.sourceHash,
      parseSuccess: first.parseSuccess,
      typecheckSuccess: first.typecheckSuccess,
      hiddenTestPass: first.hiddenTestPass,
      diagnosticsHash: first.diagnosticsHash
    },
    repairs,
    maintenanceEvaluations: {
      firstSubmission: first?.maintenance ?? fallbackMaintenance,
      finalSubmission: final?.maintenance ?? fallbackMaintenance
    },
    finalHiddenTestPass: false,
    generatedTokens: tokens,
    utf8OutputBytes: outputBytes,
    wallClockMilliseconds: Math.max(0, endedAt - startedAt),
    failureCategory: status,
    artifacts: artifactHashMap(artifacts, runId)
  });
}

export async function runTrajectory({
  task,
  condition,
  model,
  replicate = 1,
  aliasManifest,
  frozenFirstSubmission,
  now = () => Date.now(),
  artifactStore = new ArtifactStore()
}) {
  const startedAt = now();
  const context = publicTaskContext(task);
  let files = clone(task.seed.files);
  let tokens = 0;
  let outputBytes = 0;
  const attempts = [];
  let firstSubmission = frozenFirstSubmission === undefined ? null : clone(frozenFirstSubmission);
  let feedback = null;

  artifactStore.put("context/public-task.json", context);

  for (let turn = 0; turn <= LIMITS.repairTurns; turn += 1) {
    const prompt = turn === 0
      ? { task: context, instruction: "Submit the requested repository change without running checks." }
      : {
          task: { id: task.id, wording: task.publicTask.wording },
          instruction: "Repair the submission using only the supplied compiler feedback.",
          feedback
        };
    artifactStore.put(`attempts/${turn}/prompt.json`, prompt);

    let response;
    try {
      const elapsed = Math.max(0, now() - startedAt);
      if (elapsed >= LIMITS.wallClockMilliseconds) throw new TrajectoryTimeoutError();
      if (turn === 0 && firstSubmission !== null) response = firstSubmission;
      else {
        response = await completeWithin(
          model,
          { task: context, condition, turn, prompt: stableJson(prompt) },
          LIMITS.wallClockMilliseconds - elapsed
        );
      }
      const validated = validateResponse(response, turn);
      tokens += validated.tokens;
      if (validated.budgetExceeded || tokens > LIMITS.maxOutputTokensPerTrajectory) {
        return statusFailure(
          task, condition, model.id, replicate, "budget_exhausted",
          artifactStore, startedAt, now(), { tokens, outputBytes, attempts }
        );
      }
    } catch (error) {
      artifactStore.put(`attempts/${turn}/failure.json`, { name: error.name, message: error.message });
      return statusFailure(
        task,
        condition,
        model.id,
        replicate,
        error instanceof TrajectoryTimeoutError ? "timed_out" : "crashed",
        artifactStore, startedAt, now(), { tokens, outputBytes, attempts }
      );
    }

    if (turn === 0) firstSubmission = clone(response);
    files = mergeFiles(files, response.files);
    const responseText = stableJson(response);
    outputBytes += Buffer.byteLength(responseText, "utf8");
    artifactStore.put(`attempts/${turn}/model-output.json`, response);
    artifactStore.put(`attempts/${turn}/source-snapshot.json`, files);
    artifactStore.put(`attempts/${turn}/tool-calls.json`, response.toolCalls ?? []);

    const compilation = compileCondition(condition, files, { aliasManifest });
    const hidden = runHiddenTests(task, files);
    const maintenanceWithArtifact = maintenanceEvaluation(task, files, hidden, compilation);
    const semanticBlastRadiusArtifactHash = artifactStore.put(
      `private/attempts/${turn}/semantic-blast-radius.json`,
      maintenanceWithArtifact.semanticBlastRadius,
      { privateArtifact: true }
    );
    const maintenance = schemaMaintenance(
      maintenanceWithArtifact,
      semanticBlastRadiusArtifactHash
    );
    artifactStore.put(`attempts/${turn}/diagnostics.txt`, compilation.renderedDiagnostics);
    artifactStore.put(`private/attempts/${turn}/hidden-outcome.json`, hidden, { privateArtifact: true });

    const attempt = {
      turn,
      sourceHash: contentHash(files),
      parseSuccess: !compilation.compilation.diagnostics.some((item) => item.phase === "lex" || item.phase === "parse"),
      typecheckSuccess: compilation.compilation.diagnostics.length === 0,
      hiddenTestPass: hidden.passed,
      diagnosticsHash: contentHash(compilation.compilation.diagnostics),
      feedbackHash: contentHash(compilation.renderedDiagnostics),
      maintenance
    };
    attempts.push(attempt);

    if (hidden.passed && compilation.compilation.diagnostics.length === 0) break;
    feedback = compilation.renderedDiagnostics;
  }

  const endedAt = now();
  if (endedAt - startedAt > LIMITS.wallClockMilliseconds) {
    return statusFailure(
      task, condition, model.id, replicate, "timed_out",
      artifactStore, startedAt, endedAt, { tokens, outputBytes, attempts }
    );
  }

  const first = attempts[0];
  const final = attempts.at(-1);
  if (first === undefined || final === undefined) {
    return statusFailure(
      task,
      condition,
      model.id,
      replicate,
      "missing",
      artifactStore,
      startedAt,
      endedAt,
      { tokens, outputBytes, attempts }
    );
  }
  const repairs = attempts.slice(1).map((attempt) => ({
    turn: attempt.turn,
    sourceHash: attempt.sourceHash,
    feedbackHash: attempt.feedbackHash,
    hiddenTestPass: attempt.hiddenTestPass
  }));
  const runId = `${task.id}:${condition}:${replicate}`;
  const record = validateTrajectoryRecord({
    schemaVersion: 1,
    trajectoryId: `${task.id}:${model.id}:${condition}:${replicate}`,
    runManifestHash: trajectoryRunManifestHash(task, condition, model.id, replicate),
    task: { id: task.id, family: task.family, corpus: task.corpus },
    modelId: model.id,
    condition,
    replicate,
    status: "completed",
    firstSubmission: {
      sourceHash: first.sourceHash,
      parseSuccess: first.parseSuccess,
      typecheckSuccess: first.typecheckSuccess,
      hiddenTestPass: first.hiddenTestPass,
      diagnosticsHash: first.diagnosticsHash
    },
    repairs,
    finalHiddenTestPass: final.hiddenTestPass,
    generatedTokens: tokens,
    utf8OutputBytes: outputBytes,
    wallClockMilliseconds: Math.max(0, endedAt - startedAt),
    failureCategory: final.hiddenTestPass ? null : "hidden_test_failure",
    maintenanceEvaluations: {
      firstSubmission: first.maintenance,
      finalSubmission: final.maintenance
    },
    artifacts: artifactHashMap(artifactStore, runId)
  });
  return record;
}

export function randomizedSchedule({ tasks, models, conditions, replicates, seed }) {
  const schedule = [];
  for (const task of tasks) {
    for (const model of models) {
      const blockSeed = (seed + Number.parseInt(contentHash(`${task.id}:${model.id}`).slice(7, 15), 16)) >>> 0;
      const orderedConditions = deterministicShuffle(conditions, blockSeed);
      for (let replicate = 1; replicate <= replicates; replicate += 1) {
        for (const condition of orderedConditions) {
          schedule.push({
            taskId: task.id,
            modelId: model.id,
            condition,
            replicate,
            seed: model.seedSupported ? seed : null,
            seedSupported: model.seedSupported
          });
        }
      }
    }
  }
  return schedule;
}

export function sameFrozenFirstFailure(left, right) {
  return (
    left.firstSubmission !== null &&
    right.firstSubmission !== null &&
    left.firstSubmission.sourceHash === right.firstSubmission.sourceHash
  );
}

export const trajectoryLimits = LIMITS;
