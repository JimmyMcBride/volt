import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import {
  ABLATION_PROFILE_HASH,
  clockAdapter,
  compileSources,
  databaseAdapter,
  run
} from "../../dist/toolchain/src/index.js";
import {
  compileCondition,
  diagnosticParity,
  expandAliases,
  treatmentParity
} from "../lib/conditions.mjs";
import {
  runHiddenTests,
  sourceArray,
  verifyMutationCatalog,
  verifyTaskContentHashes
} from "../lib/corpus.mjs";
import { AuthorizationError, assertAuthorized } from "../lib/authorization.mjs";
import { contentHash } from "../lib/stable.mjs";
import {
  validateAliasManifest,
  validateAuthorizationManifest,
  validateCalibrationContextManifest,
  validateCorpusManifest,
  validateLiveModelManifest,
  validateModelManifest,
  validateRetirementManifest
} from "../lib/validation.mjs";

const root = resolve(import.meta.dirname, "../..");
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const taskFiles = async (directory) => {
  const names = (await readdir(resolve(root, directory))).filter((name) => name.endsWith(".json")).sort();
  return Promise.all(names.map((name) => readJson(`${directory}/${name}`)));
};

const [
  protocol,
  kernel,
  profile,
  coverage,
  corpus,
  aliases,
  baselines,
  models,
  authorization,
  liveModels,
  liveCalibration,
  calibrationContext,
  retirement,
  systemPrompt,
  toolVersions,
  conditionAdapters,
  schemaIndex,
  calibrationTasks,
  confirmatoryTasks
] = await Promise.all([
  readJson("research/protocol/protocol-v1.json"),
  readJson("language/kernel/kernel-v0.json"),
  readJson("toolchain/profile/static-obligations-v1.json"),
  readJson("language/benchmark/coverage.json"),
  readJson("benchmark/corpus/corpus-manifest-v1.json"),
  readJson("benchmark/corpus/alias-manifest-v1.json"),
  readJson("benchmark/corpus/baseline-manifest-v1.json"),
  readJson("benchmark/corpus/model-manifest.template.json"),
  readJson("benchmark/corpus/authorization.template.json"),
  readJson("benchmark/corpus/live-model-manifest-v1.json"),
  readJson("benchmark/corpus/live-calibration-manifest-v1.json"),
  readJson("benchmark/corpus/calibration-context-manifest-v1.json"),
  readJson("benchmark/corpus/confirmatory-retirement-v1.json"),
  readJson("benchmark/corpus/system-prompt-v1.json"),
  readJson("benchmark/corpus/tool-versions-v1.json"),
  readJson("benchmark/corpus/condition-adapters-v1.json"),
  readJson("benchmark/schema/index.json"),
  taskFiles("benchmark/corpus/generated/calibration"),
  taskFiles("benchmark/corpus/generated/private")
]);
const tasks = [...calibrationTasks, ...confirmatoryTasks].sort((left, right) => left.id.localeCompare(right.id));

validateAliasManifest(aliases);
validateModelManifest(models);
validateAuthorizationManifest(authorization);
validateLiveModelManifest(liveModels);
validateRetirementManifest(retirement);
validateCalibrationContextManifest(calibrationContext, retirement);
validateCorpusManifest(corpus, tasks);
assert.equal(corpus.protocolHash, contentHash(protocol));
assert.equal(corpus.kernelHash, contentHash(kernel));
assert.equal(corpus.checkerProfileHash, `sha256:${ABLATION_PROFILE_HASH}`);
assert.equal(corpus.aliasManifestHash, contentHash(aliases));
assert.equal(corpus.confirmatoryPrivateUntilStudyComplete, false);
assert.equal(corpus.confirmatoryEligibleForEvidence, false);
assert.equal(corpus.retirementManifestHash, contentHash(retirement));
assert.equal(liveCalibration.protocolHash, corpus.protocolHash);
assert.equal(liveCalibration.corpusManifestHash, contentHash(corpus));
assert.equal(liveCalibration.modelManifestHash, contentHash(liveModels));
assert.equal(liveCalibration.systemPromptHash, contentHash(systemPrompt));
assert.equal(liveCalibration.taskContextManifestHash, contentHash(calibrationContext));
assert.equal(liveCalibration.toolVersionsHash, contentHash(toolVersions));
assert.equal(liveCalibration.conditionAdaptersHash, contentHash(conditionAdapters));
assert.equal(liveCalibration.retirementManifestHash, contentHash(retirement));
assert.equal(liveCalibration.design.trajectories, 160);
assert.equal(liveCalibration.design.requestCeiling, 640);
assert.equal(liveCalibration.runApprovalRequired, true);
assert.equal(liveCalibration.providerInferenceAuthorized, false);
assert.equal(authorization.modelManifestHash, contentHash(liveModels));
assert.equal(authorization.retirementManifestHash, contentHash(retirement));
assert.equal(
  new Set([...profile.retained, ...profile.disabled]).size,
  profile.retained.length + profile.disabled.length
);
assert.deepEqual(
  confirmatoryTasks.map((task) => ({
    id: task.id,
    family: task.family,
    publicChangeCategory: task.publicChangeCategory
  })).sort((left, right) => left.id.localeCompare(right.id)),
  coverage.cases.map(({ id, family, publicChangeCategory }) => ({
    id,
    family,
    publicChangeCategory
  })).sort((left, right) => left.id.localeCompare(right.id))
);

for (const task of tasks) {
  const hashes = verifyTaskContentHashes(task);
  assert.deepEqual(hashes, { seed: true, expectedSolution: true }, `${task.id} content hashes`);
  const seedCompilation = compileSources(sourceArray(task.seed.files), "full");
  const expectedCompilation = compileSources(sourceArray(task.expectedSolution.files), "full");
  assert.deepEqual(seedCompilation.diagnostics, [], `${task.id} seed`);
  assert.deepEqual(expectedCompilation.diagnostics, [], `${task.id} expected solution`);
  for (const [label, compilation] of [["seed", seedCompilation], ["expected", expectedCompilation]]) {
    const publicTest = run(compilation, "tests.registrationTest", [
      clockAdapter("capabilities::effect::Clock", [100n]),
      databaseAdapter("capabilities::effect::RegistrationStore")
    ]);
    assert.deepEqual(publicTest.diagnostics, [], `${task.id} ${label} public test diagnostics`);
    assert.equal(publicTest.value?.constructor, "Ok", `${task.id} ${label} public test`);
  }
  assert.equal(runHiddenTests(task, task.expectedSolution.files).passed, true, `${task.id} hidden tests`);
  assert.equal(verifyMutationCatalog(task).passed, true, `${task.id} mutants`);
}
assert.deepEqual(
  new Set(tasks.flatMap((task) => [
    ...task.mutations.map((mutation) => mutation.category),
    ...task.excludedMutations.map((mutation) => mutation.category)
  ])),
  new Set([
    "incomplete_propagation",
    "stale_contract",
    "weakened_invariant",
    "duplicated_invariant",
    "effect_bypass",
    "non_exhaustive_change",
    "unnecessary_capability",
    "unrelated_regression",
    "output_drift"
  ])
);

const schemaNames = Object.values(schemaIndex.records);
assert.equal(schemaNames.length, 22);
for (const path of schemaNames) {
  const schema = await readJson(path);
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(typeof schema.$id, "string");
  assert(schema.$id.length > 0);
}

assert.equal(baselines.claimClass, "descriptive");
assert.deepEqual(
  baselines.baselines.map((baseline) => baseline.id),
  ["typescript_strict", "rust", "gleam"]
);
for (const baseline of baselines.baselines) {
  const reference = await readFile(resolve(root, baseline.reference), "utf8");
  const fixtures = await Promise.all(
    baseline.fixtures.map((path) => readFile(resolve(root, path), "utf8"))
  );
  assert(reference.includes("descriptive only"));
  assert.equal(fixtures.length, 4);
  assert(fixtures.every((fixture) => fixture.length > 0));
  assert.equal(baseline.taskWording, "equivalent");
  assert.equal(baseline.publicHiddenAssertions, "equivalent");
  assert.equal(baseline.toolBudget, "identical");
}

const canonicalAliasSample = `module aliases
pub record Box { value: Int }
pub effect Notification { fn send(message: String) -> Unit }
pub fn notify() uses {Notification} -> Unit { Notification.send("public function effects struct") }
`;
const aliasedSample = canonicalAliasSample
  .replace("pub record", "public struct")
  .replace("pub effect", "public effect")
  .replace("pub fn notify() uses", "public function notify() effects");
const expanded = expandAliases(aliasedSample, aliases);
assert(expanded.includes("\"public function effects struct\""), "aliases must not rewrite string contents");
const aliasTreatment = compileCondition("alias_permissive", { "aliases.volt": aliasedSample }, { aliasManifest: aliases });
assert.deepEqual(aliasTreatment.compilation.diagnostics, []);
const canonicalTreatment = compileCondition("volt_full", { "aliases.volt": aliasedSample });
assert(canonicalTreatment.compilation.diagnostics.length > 0, "full Volt must reject treatment aliases");
const canonicalReference = compileCondition(
  "volt_full",
  { "aliases.volt": canonicalAliasSample }
);
assert.equal(aliasTreatment.canonicalFiles["aliases.volt"], canonicalReference.canonicalFiles["aliases.volt"]);
assert.deepEqual(treatmentParity(canonicalReference, aliasTreatment, ["preparedSourceHash"]), {
  preparedSourceHash: "targeted",
  graphHash: true,
  typedIrHash: true,
  normalizedAstHash: true,
  runManifestHash: true,
  diagnosticFactsHash: true,
  renderedDiagnosticsHash: true
});

const diagnosticSource = {
  "bad.volt": "module bad\npub fn value() -> Int { true + 1 }\n"
};
const structured = compileCondition("volt_full", diagnosticSource);
const plain = compileCondition("diagnostics_plain", diagnosticSource);
assert.deepEqual(diagnosticParity(structured, plain), {
  sameFacts: true,
  sameCompilation: true,
  representationDiffers: true
});
assert.deepEqual(treatmentParity(structured, plain, ["renderedDiagnosticsHash"]), {
  preparedSourceHash: true,
  graphHash: true,
  typedIrHash: true,
  normalizedAstHash: true,
  runManifestHash: true,
  diagnosticFactsHash: true,
  renderedDiagnosticsHash: "targeted"
});
const obligationSource = {
  "obligation.volt": `module obligation
pub type Flag { On Off }
pub fn value(flag: Flag) -> Int {
  match flag {
    On -> 1
  }
}
`
};
const fullObligations = compileCondition("volt_full", obligationSource);
const erasedObligations = compileCondition("static_obligations_erased", obligationSource);
assert(fullObligations.compilation.diagnostics.some((diagnostic) => diagnostic.code === "K_MATCH_NON_EXHAUSTIVE"));
assert.deepEqual(erasedObligations.compilation.diagnostics, []);
assert.deepEqual(
  treatmentParity(fullObligations, erasedObligations, [
    "typedIrHash",
    "runManifestHash",
    "diagnosticFactsHash",
    "renderedDiagnosticsHash"
  ]),
  {
    preparedSourceHash: true,
    graphHash: true,
    typedIrHash: "targeted",
    normalizedAstHash: true,
    runManifestHash: "targeted",
    diagnosticFactsHash: "targeted",
    renderedDiagnosticsHash: "targeted"
  }
);
assert.equal(
  compileCondition("static_obligations_erased", diagnosticSource).checkerProfileHash,
  ABLATION_PROFILE_HASH
);

assert.equal(authorization.approved, false);
assert.equal(authorization.maximumSpendUsd, 0);
assert.throws(
  () => assertAuthorized({
    manifest: authorization,
    phase: "calibration",
    expectedHashes: {},
    estimatedSpendUsd: 0
  }),
  AuthorizationError
);

for (const directory of ["benchmark/lib", "benchmark/scripts"]) {
  for (const name of await readdir(resolve(root, directory))) {
    if (!name.endsWith(".mjs")) continue;
    const source = await readFile(resolve(root, directory, name), "utf8");
    assert(!/\bfetch\s*\(/u.test(source), `${directory}/${name} may not call fetch`);
    assert(!/node:(?:http|https|net|tls)/u.test(source), `${directory}/${name} may not import network modules`);
  }
}

let sourceLines = 0;
for (const directory of ["benchmark/lib", "benchmark/scripts"]) {
  for (const name of await readdir(resolve(root, directory))) {
    if (!name.endsWith(".mjs")) continue;
    sourceLines += (await readFile(resolve(root, directory, name), "utf8")).split("\n").length;
  }
}
assert(sourceLines < 25_000);

process.stdout.write(`${JSON.stringify({
  ok: true,
  tasks: tasks.length,
  calibrationTasks: calibrationTasks.length,
  confirmatoryTasks: confirmatoryTasks.length,
  killedMutants: tasks.reduce((sum, task) => sum + task.mutations.length, 0),
  schemas: schemaNames.length,
  baselines: baselines.baselines.length,
  sourceLines,
  runtimeDependencies: 0,
  networkCalls: 0,
  providerSpendUsd: 0
})}\n`);
