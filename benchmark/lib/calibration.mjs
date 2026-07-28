import { contentHash, deterministicShuffle } from "./stable.mjs";
import { publicTaskContext } from "./corpus.mjs";

export const CALIBRATION_SEED = 20_260_727;
export const CALIBRATION_REPLICATES = 5;
export const CALIBRATION_CONDITIONS = Object.freeze([
  "volt_full",
  "static_obligations_erased",
  "alias_permissive",
  "diagnostics_plain"
]);
export const CALIBRATION_TRAJECTORY_COUNT = 160;
export const CALIBRATION_REQUEST_CEILING = 640;

function nonce(seed, taskId, modelId, replicate, unit, turn) {
  return contentHash({
    schemaVersion: 1,
    kind: "blinded_calibration_nonce",
    seed,
    taskId,
    modelId,
    replicate,
    unit,
    turn
  }).slice("sha256:".length);
}

function turnNonces(seed, taskId, modelId, replicate, condition) {
  const paired = condition === "volt_full" || condition === "diagnostics_plain";
  return Array.from({ length: 4 }, (_, turn) => {
    if (condition === "diagnostics_plain" && turn === 0) return null;
    return nonce(
      seed,
      taskId,
      modelId,
      replicate,
      paired && turn > 0 ? "diagnostic_pair" : condition,
      turn
    );
  });
}

export function buildCalibrationSchedule({
  tasks,
  models,
  seed = CALIBRATION_SEED,
  replicates = CALIBRATION_REPLICATES
}) {
  const calibrationTasks = tasks
    .filter((task) => task.corpus === "calibration")
    .sort((left, right) => left.id.localeCompare(right.id));
  const orderedModels = [...models].sort((left, right) => left.id.localeCompare(right.id));
  if (calibrationTasks.length !== 4) throw new TypeError("calibration schedule requires exactly four tasks");
  if (orderedModels.length !== 2) throw new TypeError("calibration schedule requires exactly two models");
  if (replicates !== 5) throw new TypeError("calibration schedule requires exactly five replicate blocks");

  const schedule = [];
  for (const task of calibrationTasks) {
    for (const model of orderedModels) {
      for (let replicate = 1; replicate <= replicates; replicate += 1) {
        const blockSeed = Number.parseInt(
          contentHash(`${seed}:${task.id}:${model.id}:${replicate}`).slice(7, 15),
          16
        );
        const roots = deterministicShuffle(
          ["volt_full", "static_obligations_erased", "alias_permissive"],
          blockSeed
        );
        for (const root of roots) {
          const conditions = root === "volt_full"
            ? ["volt_full", "diagnostics_plain"]
            : [root];
          for (const condition of conditions) {
            const trajectoryId = `${task.id}:${model.id}:${condition}:${replicate}`;
            schedule.push({
              schemaVersion: 1,
              trajectoryId,
              taskId: task.id,
              modelId: model.id,
              condition,
              replicate,
              seed: model.seedSupported ? seed : null,
              seedSupported: model.seedSupported,
              frozenFirstSubmissionFrom: condition === "diagnostics_plain"
                ? `${task.id}:${model.id}:volt_full:${replicate}`
                : null,
              turnNonces: turnNonces(seed, task.id, model.id, replicate, condition)
            });
          }
        }
      }
    }
  }
  return validateCalibrationSchedule(schedule);
}

export function validateCalibrationSchedule(schedule) {
  if (!Array.isArray(schedule) || schedule.length !== CALIBRATION_TRAJECTORY_COUNT) {
    throw new TypeError(`calibration schedule must contain ${CALIBRATION_TRAJECTORY_COUNT} trajectories`);
  }
  const ids = new Set();
  const independentNonces = new Set();
  for (const item of schedule) {
    if (ids.has(item.trajectoryId)) throw new TypeError(`duplicate trajectory: ${item.trajectoryId}`);
    ids.add(item.trajectoryId);
    if (item.turnNonces.length !== 4) throw new TypeError("each trajectory must freeze four turn nonce slots");
    for (const [turn, value] of item.turnNonces.entries()) {
      if (item.condition === "diagnostics_plain" && turn === 0) {
        if (value !== null) throw new TypeError("plain diagnostic fork must not issue a first-submission request");
        continue;
      }
      const isPairedRepair =
        turn > 0 && (item.condition === "volt_full" || item.condition === "diagnostics_plain");
      if (!isPairedRepair) {
        if (independentNonces.has(value)) throw new TypeError(`reused independent nonce: ${value}`);
        independentNonces.add(value);
      }
    }
    if (item.condition === "diagnostics_plain") {
      const parent = schedule.find((candidate) => candidate.trajectoryId === item.frozenFirstSubmissionFrom);
      if (parent === undefined) throw new TypeError(`missing diagnostic fork parent: ${item.trajectoryId}`);
      if (schedule.indexOf(parent) >= schedule.indexOf(item)) {
        throw new TypeError(`diagnostic fork appears before its parent: ${item.trajectoryId}`);
      }
      for (let turn = 1; turn <= 3; turn += 1) {
        if (parent.turnNonces[turn] !== item.turnNonces[turn]) {
          throw new TypeError(`diagnostic pair nonce mismatch: ${item.trajectoryId} turn ${turn}`);
        }
      }
    }
  }
  return schedule;
}

export function buildCalibrationContextManifest(tasks, retirementManifest) {
  const calibration = tasks
    .filter((task) => task.corpus === "calibration")
    .map((task) => ({
      id: task.id,
      family: task.family,
      manifestHash: contentHash(task),
      publicContextHash: contentHash(publicTaskContext(task))
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  if (calibration.length !== 4) throw new TypeError("provider context allowlist requires four calibration tasks");
  return {
    schemaVersion: 1,
    id: "volt-live-calibration-context-v1",
    allowedCorpus: "calibration",
    allowedTaskIds: calibration.map((task) => task.id),
    tasks: calibration,
    deniedRetirementManifestHash: contentHash(retirementManifest),
    deniedTaskIds: retirementManifest.tasks.map((task) => task.id).sort()
  };
}

export function buildRetirementManifest(tasks) {
  const retired = tasks
    .filter((task) => task.corpus === "confirmatory")
    .map((task) => ({
      id: task.id,
      family: task.family,
      manifestHash: contentHash(task)
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  if (retired.length !== 12) throw new TypeError("retirement manifest requires twelve exposed tasks");
  return {
    schemaVersion: 1,
    id: "volt-exposed-confirmatory-retirement-v1",
    status: "retired_from_confirmatory_evidence",
    reason: "Task manifests and hidden assertions were tracked in public Git history.",
    publicGitExposureObserved: true,
    makingRepositoryPrivateRestoresEligibility: false,
    confirmatoryEligible: false,
    retainedUse: "public_development_fixtures_only",
    tasks: retired
  };
}
