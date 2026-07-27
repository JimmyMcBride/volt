import assert from "node:assert/strict";
import { contentHash } from "./stable.mjs";

const HASH = /^sha256:[a-f0-9]{64}$/u;
const FAMILIES = new Set([
  "state_extension",
  "invariant_change",
  "effect_addition",
  "cross_module_contract_change"
]);
const CORPORA = new Set(["calibration", "confirmatory"]);
const CONDITIONS = new Set([
  "volt_full",
  "static_obligations_erased",
  "alias_permissive",
  "diagnostics_plain",
  "typescript_strict",
  "rust",
  "gleam"
]);
const MUTATION_CATEGORIES = new Set([
  "incomplete_propagation",
  "stale_contract",
  "weakened_invariant",
  "duplicated_invariant",
  "effect_bypass",
  "non_exhaustive_change",
  "unnecessary_capability",
  "unrelated_regression",
  "output_drift"
]);

function object(value, name) {
  assert(value !== null && typeof value === "object" && !Array.isArray(value), `${name} must be an object`);
}

function nonEmpty(value, name) {
  assert.equal(typeof value, "string", `${name} must be a string`);
  assert(value.length > 0, `${name} must not be empty`);
}

function hash(value, name) {
  assert.match(value, HASH, `${name} must be a sha256 content hash`);
}

function uniqueStrings(values, name, { allowEmpty = true } = {}) {
  assert(Array.isArray(values), `${name} must be an array`);
  if (!allowEmpty) assert(values.length > 0, `${name} must not be empty`);
  values.forEach((value, index) => nonEmpty(value, `${name}[${index}]`));
  assert.equal(new Set(values).size, values.length, `${name} must be unique`);
}

export function validateTaskManifest(task) {
  object(task, "task");
  assert.equal(task.schemaVersion, 1);
  nonEmpty(task.id, "task.id");
  assert(CORPORA.has(task.corpus), `invalid corpus: ${task.corpus}`);
  assert(FAMILIES.has(task.family), `invalid family: ${task.family}`);
  nonEmpty(task.publicChangeCategory, "task.publicChangeCategory");
  assert(Number.isInteger(task.mutationSeed) && task.mutationSeed >= 0, "task.mutationSeed must be a non-negative integer");
  hash(task.seedHash, "task.seedHash");
  hash(task.expectedSolutionHash, "task.expectedSolutionHash");
  object(task.publicTask, "task.publicTask");
  nonEmpty(task.publicTask.wording, "task.publicTask.wording");
  uniqueStrings(task.publicTask.visibleFiles, "task.publicTask.visibleFiles", { allowEmpty: false });
  uniqueStrings(task.publicTask.publicTests, "task.publicTask.publicTests", { allowEmpty: false });
  assert.deepEqual(task.publicTask.allowedTools, ["inspect", "edit", "submit"]);
  uniqueStrings(task.publicTask.nonGoals, "task.publicTask.nonGoals", { allowEmpty: false });
  object(task.expectedImpact, "task.expectedImpact");
  for (const key of ["files", "symbols", "contracts", "effects", "astObligations", "relatedTests"]) {
    uniqueStrings(task.expectedImpact[key], `task.expectedImpact.${key}`, { allowEmpty: key === "effects" });
  }
  assert(Array.isArray(task.preservationAssertions) && task.preservationAssertions.length > 0);
  assert(Array.isArray(task.invariants) && task.invariants.length > 0);
  assert(Array.isArray(task.mutations) && task.mutations.length > 0);
  const invariantIds = new Set();
  for (const invariant of task.invariants) {
    nonEmpty(invariant.id, "invariant.id");
    assert(!invariantIds.has(invariant.id), `duplicate invariant: ${invariant.id}`);
    invariantIds.add(invariant.id);
    assert(["static", "runtime"].includes(invariant.kind));
    assert.equal(typeof invariant.hidden, "boolean");
    nonEmpty(invariant.assertion.type, "invariant.assertion.type");
  }
  const mutationIds = new Set();
  for (const mutation of task.mutations) {
    nonEmpty(mutation.id, "mutation.id");
    assert(!mutationIds.has(mutation.id), `duplicate mutation: ${mutation.id}`);
    mutationIds.add(mutation.id);
    assert(MUTATION_CATEGORIES.has(mutation.category), `invalid mutation category: ${mutation.category}`);
    assert.equal(mutation.retained, true);
    assert(invariantIds.has(mutation.killedBy), `mutation ${mutation.id} has no killing invariant`);
    object(mutation.sourceOverrides, `mutation ${mutation.id}.sourceOverrides`);
  }
  assert(Array.isArray(task.excludedMutations) && task.excludedMutations.length > 0);
  for (const mutation of task.excludedMutations) {
    nonEmpty(mutation.id, "excluded mutation.id");
    assert(MUTATION_CATEGORIES.has(mutation.category), `invalid excluded mutation category: ${mutation.category}`);
    assert.equal(mutation.retained, false);
    nonEmpty(mutation.removedReason, "excluded mutation.removedReason");
    hash(mutation.candidateHash, "excluded mutation.candidateHash");
  }
  object(task.expectedSolution, "task.expectedSolution");
  object(task.expectedSolution.files, "task.expectedSolution.files");
  return task;
}

export function validateCorpusManifest(corpus, tasks) {
  object(corpus, "corpus");
  assert.equal(corpus.schemaVersion, 1);
  nonEmpty(corpus.corpusId, "corpus.corpusId");
  hash(corpus.protocolHash, "corpus.protocolHash");
  hash(corpus.kernelHash, "corpus.kernelHash");
  hash(corpus.checkerProfileHash, "corpus.checkerProfileHash");
  hash(corpus.aliasManifestHash, "corpus.aliasManifestHash");
  assert.equal(corpus.calibrationTaskCount, 4);
  assert.equal(corpus.confirmatoryTaskCount, 12);
  assert.equal(tasks.length, 16);
  const counts = new Map();
  for (const task of tasks.map(validateTaskManifest)) {
    const key = `${task.corpus}:${task.family}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const family of FAMILIES) {
    assert.equal(counts.get(`calibration:${family}`), 1, `calibration count for ${family}`);
    assert.equal(counts.get(`confirmatory:${family}`), 3, `confirmatory count for ${family}`);
  }
  assert.deepEqual(corpus.taskIds, tasks.map((task) => task.id).sort());
  assert.deepEqual(
    corpus.tasks,
    tasks
      .map((task) => ({
        id: task.id,
        corpus: task.corpus,
        family: task.family,
        manifestHash: contentHash(task)
      }))
      .sort((left, right) => left.id.localeCompare(right.id))
  );
  return corpus;
}

export function validateAliasManifest(manifest) {
  object(manifest, "alias manifest");
  assert.equal(manifest.schemaVersion, 1);
  nonEmpty(manifest.id, "alias manifest id");
  assert(Array.isArray(manifest.aliases) && manifest.aliases.length > 0);
  const aliases = new Set();
  for (const alias of manifest.aliases) {
    nonEmpty(alias.alias, "alias");
    nonEmpty(alias.canonical, "canonical");
    assert(!aliases.has(alias.alias), `duplicate alias: ${alias.alias}`);
    aliases.add(alias.alias);
    assert.equal(alias.documentationProminence, "equal");
  }
  return manifest;
}

export function validateModelManifest(manifest) {
  object(manifest, "model manifest");
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.models.length, 2);
  assert.deepEqual(
    new Set(manifest.models.map((model) => model.family)),
    new Set(["frontier_hosted", "open_weight_code"])
  );
  for (const model of manifest.models) {
    for (const key of ["id", "family", "provider", "revision", "tokenizer"]) nonEmpty(model[key], `model.${key}`);
    assert.equal(typeof model.seedSupported, "boolean");
  }
  return manifest;
}

export function validateAuthorizationManifest(manifest) {
  object(manifest, "authorization manifest");
  assert.equal(manifest.schemaVersion, 1);
  assert(["calibration", "confirmatory"].includes(manifest.phase));
  assert.equal(typeof manifest.approved, "boolean");
  nonEmpty(manifest.owner, "authorization owner");
  nonEmpty(manifest.approvalId, "authorization approvalId");
  assert(Number.isFinite(manifest.maximumSpendUsd) && manifest.maximumSpendUsd >= 0);
  for (const key of [
    "protocolHash",
    "corpusManifestHash",
    "modelManifestHash",
    "systemPromptHash",
    "taskContextManifestHash",
    "toolVersionsHash",
    "conditionAdaptersHash",
    "aliasManifestHash"
  ]) hash(manifest[key], `authorization.${key}`);
  nonEmpty(manifest.credentialsBoundary, "authorization.credentialsBoundary");
  nonEmpty(manifest.storagePrivacyPolicy, "authorization.storagePrivacyPolicy");
  return manifest;
}

export function validateArtifactIndex(index) {
  object(index, "artifact index");
  assert.equal(index.schemaVersion, 1);
  nonEmpty(index.runId, "artifact index runId");
  assert(Array.isArray(index.artifacts) && index.artifacts.length > 0);
  const paths = index.artifacts.map((artifact) => artifact.path);
  assert.deepEqual(paths, [...paths].sort(), "artifacts must use stable path ordering");
  assert.equal(new Set(paths).size, paths.length, "artifact paths must be unique");
  index.artifacts.forEach((artifact) => hash(artifact.hash, `artifact ${artifact.path}`));
  return index;
}

export function validateTrajectoryRecord(record) {
  object(record, "trajectory");
  assert.deepEqual(Object.keys(record).sort(), [
    "artifacts",
    "condition",
    "failureCategory",
    "finalHiddenTestPass",
    "firstSubmission",
    "generatedTokens",
    "maintenanceEvaluations",
    "modelId",
    "repairs",
    "replicate",
    "runManifestHash",
    "schemaVersion",
    "status",
    "task",
    "trajectoryId",
    "utf8OutputBytes",
    "wallClockMilliseconds"
  ]);
  assert.equal(record.schemaVersion, 1);
  nonEmpty(record.trajectoryId, "trajectoryId");
  hash(record.runManifestHash, "trajectory.runManifestHash");
  assert(CONDITIONS.has(record.condition), `invalid condition: ${record.condition}`);
  assert(["completed", "crashed", "timed_out", "budget_exhausted", "missing"].includes(record.status));
  assert.deepEqual(Object.keys(record.task).sort(), ["corpus", "family", "id"]);
  assert(FAMILIES.has(record.task.family));
  assert(CORPORA.has(record.task.corpus));
  assert.deepEqual(Object.keys(record.firstSubmission).sort(), [
    "diagnosticsHash",
    "hiddenTestPass",
    "parseSuccess",
    "sourceHash",
    "typecheckSuccess"
  ]);
  hash(record.firstSubmission.sourceHash, "trajectory.firstSubmission.sourceHash");
  if (record.firstSubmission.diagnosticsHash !== null) {
    hash(record.firstSubmission.diagnosticsHash, "trajectory.firstSubmission.diagnosticsHash");
  }
  assert(record.repairs.length <= 3);
  record.repairs.forEach((repair) => {
    assert.deepEqual(Object.keys(repair).sort(), [
      "feedbackHash",
      "hiddenTestPass",
      "sourceHash",
      "turn"
    ]);
    hash(repair.sourceHash, "repair.sourceHash");
    hash(repair.feedbackHash, "repair.feedbackHash");
  });
  assert.deepEqual(Object.keys(record.maintenanceEvaluations).sort(), [
    "finalSubmission",
    "firstSubmission"
  ]);
  const maintenanceKeys = [
    "actualRequiredImpactSiteIds",
    "changedSiteIds",
    "contractPropagationComplete",
    "effectDeclarationsAccurate",
    "expectedImpactSiteIds",
    "guaranteesNotBypassed",
    "hiddenTestsPass",
    "matchesExhaustive",
    "predictedImpactSiteIds",
    "repositoryChangeSuccess",
    "requestedBehaviorImplemented",
    "semanticBlastRadiusArtifactHash",
    "staleContractCount",
    "unrelatedRegressionCount",
    "unrequestedBehaviorChangeCount"
  ];
  for (const evaluation of Object.values(record.maintenanceEvaluations)) {
    assert.deepEqual(Object.keys(evaluation).sort(), maintenanceKeys);
    hash(evaluation.semanticBlastRadiusArtifactHash, "maintenance.semanticBlastRadiusArtifactHash");
  }
  assert(record.generatedTokens <= 16_000);
  assert(record.utf8OutputBytes >= 0);
  object(record.artifacts, "trajectory.artifacts");
  assert(Object.keys(record.artifacts).length > 0);
  Object.entries(record.artifacts).forEach(([path, artifactHash]) => {
    nonEmpty(path, "artifact path");
    hash(artifactHash, `artifact ${path}`);
  });
  return record;
}

export const benchmarkEnums = {
  conditions: [...CONDITIONS],
  corpora: [...CORPORA],
  families: [...FAMILIES],
  mutationCategories: [...MUTATION_CATEGORIES]
};
