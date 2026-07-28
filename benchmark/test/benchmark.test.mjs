import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import {
  analyzeSixPrimaryComparisons,
  buildStudyReport,
  computeOperationalMeasurements,
  evaluateComplexityGuardrails,
  selectPoweredSampleSize
} from "../lib/analysis.mjs";
import { ArtifactStore } from "../lib/artifacts.mjs";
import {
  assertAuthorized,
  AuthorizationError,
  parseEstimatedSpendUsd
} from "../lib/authorization.mjs";
import { compileCondition, diagnosticParity, treatmentParity } from "../lib/conditions.mjs";
import { applyMutation, runHiddenTests, verifyMutationCatalog } from "../lib/corpus.mjs";
import {
  FakeModel,
  randomizedSchedule,
  ReplayModel,
  runTrajectory,
  sameFrozenFirstFailure,
  trajectoryLimits
} from "../lib/harness.mjs";
import { contentHash, stableJson } from "../lib/stable.mjs";

const root = resolve(import.meta.dirname, "../..");
const fixture = async (path) => JSON.parse(await readFile(resolve(root, path), "utf8"));

test("generated corpus freezes four calibration tasks and retires twelve exposed confirmatory fixtures", async () => {
  const corpus = await fixture("benchmark/corpus/corpus-manifest-v1.json");
  assert.equal(corpus.calibrationTaskCount, 4);
  assert.equal(corpus.confirmatoryTaskCount, 12);
  assert.equal(corpus.confirmatoryPrivateUntilStudyComplete, false);
  assert.equal(corpus.confirmatoryEligibleForEvidence, false);
  assert.equal(corpus.confirmatoryStatus, "retired_public_development_fixtures");
  assert.deepEqual(corpus.normalVerification, {
    networkAllowed: false,
    providerCallsAllowed: false,
    spendAllowedUsd: 0
  });
  assert.equal(corpus.taskIds.length, 16);
});

test("expected task solutions pass hidden assertions and every retained mutant is killed", async () => {
  const task = await fixture("benchmark/corpus/generated/private/state_extension_1.json");
  assert.equal(runHiddenTests(task, task.expectedSolution.files).passed, true);
  const mutationResult = verifyMutationCatalog(task);
  assert.equal(mutationResult.passed, true);
  assert.equal(mutationResult.results.length, 8);
  assert(mutationResult.results.every((result) => result.killedBy.includes(result.declaredKilledBy)));
  assert.equal(task.excludedMutations[0].category, "duplicated_invariant");
  assert.match(task.excludedMutations[0].removedReason, /Equivalent mutant/u);
});

test("condition adapters isolate their named treatment and preserve diagnostic facts", async () => {
  const aliases = await fixture("benchmark/corpus/alias-manifest-v1.json");
  const source = {
    "sample.volt": "module sample\npub fn broken() -> Int { true + 1 }\n"
  };
  const full = compileCondition("volt_full", source);
  const plain = compileCondition("diagnostics_plain", source);
  assert.deepEqual(diagnosticParity(full, plain), {
    sameFacts: true,
    sameCompilation: true,
    representationDiffers: true
  });
  assert.deepEqual(
    treatmentParity(full, plain, ["renderedDiagnosticsHash"]),
    {
      preparedSourceHash: true,
      graphHash: true,
      typedIrHash: true,
      normalizedAstHash: true,
      runManifestHash: true,
      diagnosticFactsHash: true,
      renderedDiagnosticsHash: "targeted"
    }
  );

  const canonical = {
    "aliases.volt": "module aliases\npub fn value() -> Int { 1 }\n"
  };
  const aliased = {
    "aliases.volt": "module aliases\npublic function value() -> Int { 1 }\n"
  };
  assert.deepEqual(
    compileCondition("alias_permissive", aliased, { aliasManifest: aliases }).compilation.diagnostics,
    []
  );
  assert(compileCondition("volt_full", aliased).compilation.diagnostics.length > 0);
  assert.equal(
    compileCondition("alias_permissive", aliased, { aliasManifest: aliases }).normalizedAstHash,
    compileCondition("volt_full", canonical).normalizedAstHash
  );
  assert.equal(
    compileCondition("alias_permissive", {
      "aliases.volt": "module aliases\npublic function snake_case() -> Int { 1 }\n"
    }, { aliasManifest: aliases }).compilation.diagnostics[0]?.code,
    "K_NAME_UNDERSCORE"
  );
});

test("trajectory runner captures first submission, limits repair, hides private outcomes, and replays", async () => {
  const [task, aliases] = await Promise.all([
    fixture("benchmark/corpus/generated/private/state_extension_1.json"),
    fixture("benchmark/corpus/alias-manifest-v1.json")
  ]);
  const mutant = applyMutation(task, task.mutations[0]);
  const firstResponse = {
    files: mutant,
    generatedTokens: 100,
    toolCalls: ["inspect", "edit", "submit"]
  };
  const passingResponse = {
    files: task.expectedSolution.files,
    generatedTokens: 100,
    toolCalls: ["edit", "submit"]
  };
  const requests = [];
  const model = {
    id: "recording-fake",
    seedSupported: true,
    responses: [firstResponse, passingResponse],
    async complete(request) {
      requests.push(structuredClone(request));
      return this.responses.shift();
    }
  };
  let tick = 0;
  const record = await runTrajectory({
    task,
    condition: "volt_full",
    model,
    aliasManifest: aliases,
    now: () => tick++
  });
  assert.equal(record.status, "completed");
  assert.equal(record.firstSubmission.hiddenTestPass, false);
  assert.equal(record.repairs.length, 1);
  assert.equal(record.repairs[0].hiddenTestPass, true);
  assert.equal(record.finalHiddenTestPass, true);
  assert.equal(record.maintenanceEvaluations.finalSubmission.repositoryChangeSuccess, true);
  assert.equal("hiddenOutputExposed" in record, false);
  assert(requests.length <= trajectoryLimits.repairTurns + 1);
  assert(!JSON.stringify(requests).includes("privateOutput"));
  assert(!JSON.stringify(requests).includes(`${task.id}:requested_behavior`));

  const context = requests[0].task;
  const prompt = JSON.parse(requests[0].prompt);
  const replayKey = contentHash({
    taskId: task.id,
    condition: "volt_full",
    turn: 0,
    prompt: stableJson(prompt)
  });
  const replay = await runTrajectory({
    task,
    condition: "volt_full",
    model: new ReplayModel({
      records: new Map([
        [replayKey, firstResponse],
        [
          contentHash({
            taskId: task.id,
            condition: "volt_full",
            turn: 1,
            prompt: requests[1].prompt
          }),
          passingResponse
        ]
      ])
    }),
    aliasManifest: aliases,
    now: () => tick++
  });
  assert.equal(replay.firstSubmission.sourceHash, record.firstSubmission.sourceHash);
  assert.equal(replay.finalHiddenTestPass, true);
  assert.equal(context.id, task.id);
});

test("diagnostic arms fork from the same frozen first failure", async () => {
  const [task, aliases] = await Promise.all([
    fixture("benchmark/corpus/generated/private/state_extension_3.json"),
    fixture("benchmark/corpus/alias-manifest-v1.json")
  ]);
  const first = {
    files: applyMutation(task, task.mutations[0]),
    generatedTokens: 10,
    toolCalls: ["submit"]
  };
  const repair = {
    files: task.expectedSolution.files,
    generatedTokens: 10,
    toolCalls: ["edit", "submit"]
  };
  let tick = 0;
  const structured = await runTrajectory({
    task,
    condition: "volt_full",
    model: new FakeModel({ responses: [repair] }),
    frozenFirstSubmission: first,
    aliasManifest: aliases,
    now: () => tick++
  });
  const plain = await runTrajectory({
    task,
    condition: "diagnostics_plain",
    model: new FakeModel({ responses: [repair] }),
    frozenFirstSubmission: first,
    aliasManifest: aliases,
    now: () => tick++
  });
  assert.equal(sameFrozenFirstFailure(structured, plain), true);
  assert.equal(structured.finalHiddenTestPass, true);
  assert.equal(plain.finalHiddenTestPass, true);
});

test("harness retains forbidden-tool, budget, crash, timeout, and missing outcomes as failures", async () => {
  const [task, aliases] = await Promise.all([
    fixture("benchmark/corpus/generated/calibration/calibration_invariant_change.json"),
    fixture("benchmark/corpus/alias-manifest-v1.json")
  ]);
  const forbidden = await runTrajectory({
    task,
    condition: "volt_full",
    model: new FakeModel({
      responses: [{
        files: {},
        generatedTokens: 1,
        toolCalls: ["test"]
      }]
    }),
    aliasManifest: aliases
  });
  assert.equal(forbidden.status, "crashed");

  const budget = await runTrajectory({
    task,
    condition: "volt_full",
    model: new FakeModel({
      responses: [{
        files: {},
        generatedTokens: trajectoryLimits.maxOutputTokensPerTurn + 1,
        toolCalls: ["submit"]
      }]
    }),
    aliasManifest: aliases
  });
  assert.equal(budget.status, "budget_exhausted");

  const crashed = await runTrajectory({
    task,
    condition: "volt_full",
    model: new FakeModel({ responses: [{ throw: "provider failed" }] }),
    aliasManifest: aliases
  });
  assert.equal(crashed.status, "crashed");

  const crashedDuringRepair = await runTrajectory({
    task,
    condition: "volt_full",
    model: new FakeModel({
      responses: [
        {
          files: applyMutation(task, task.mutations[0]),
          generatedTokens: 1,
          toolCalls: ["submit"]
        },
        { throw: "repair provider failed" }
      ]
    }),
    aliasManifest: aliases
  });
  assert.equal(crashedDuringRepair.status, "crashed");
  assert.notEqual(crashedDuringRepair.firstSubmission.sourceHash, contentHash(""));
  assert.equal(
    crashedDuringRepair.maintenanceEvaluations.firstSubmission.repositoryChangeSuccess,
    false
  );

  let time = 0;
  const timedOut = await runTrajectory({
    task,
    condition: "volt_full",
    model: new FakeModel({
      responses: [{
        files: task.expectedSolution.files,
        generatedTokens: 1,
        toolCalls: ["submit"]
      }]
    }),
    aliasManifest: aliases,
    now: () => {
      time += trajectoryLimits.wallClockMilliseconds + 1;
      return time;
    }
  });
  assert.equal(timedOut.status, "timed_out");
  for (const record of [forbidden, budget, crashed, crashedDuringRepair, timedOut]) {
    assert.equal(record.finalHiddenTestPass, false);
    assert.equal("hiddenOutputExposed" in record, false);
  }
});

test("randomization is task/model-blocked and records unsupported seeds", () => {
  const input = {
    tasks: [
      { id: "task_a" },
      { id: "task_b" }
    ],
    models: [
      { id: "seeded", seedSupported: true },
      { id: "unseeded", seedSupported: false }
    ],
    conditions: ["volt_full", "static_obligations_erased", "alias_permissive", "diagnostics_plain"],
    replicates: 2,
    seed: 41
  };
  const first = randomizedSchedule(input);
  const second = randomizedSchedule(input);
  assert.deepEqual(first, second);
  assert.equal(first.length, 32);
  assert(first.filter((item) => item.modelId === "seeded").every((item) => item.seed === 41));
  assert(first.filter((item) => item.modelId === "unseeded").every((item) => item.seed === null));
});

test("artifact indexes are content-addressed, stable, and keep private flags", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "volt-benchmark-artifacts-"));
  try {
    const store = new ArtifactStore();
    store.put("visible/prompt.json", { value: 1 });
    store.put("private/hidden.json", { secret: false }, { privateArtifact: true });
    const index = await store.write(directory, "run-1");
    assert.deepEqual(
      index.artifacts.map((artifact) => artifact.path),
      ["private/hidden.json", "visible/prompt.json"]
    );
    assert.equal(index.artifacts[0].private, true);
    const persisted = JSON.parse(await readFile(resolve(directory, "artifact-index.json"), "utf8"));
    assert.deepEqual(persisted, index);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("authorization gates fail closed on approval, hash, and spend mismatches", async () => {
  const template = await fixture("benchmark/corpus/authorization.template.json");
  assert.throws(
    () => assertAuthorized({
      manifest: template,
      phase: "calibration",
      expectedHashes: {},
      estimatedSpendUsd: 0
    }),
    AuthorizationError
  );
  const approved = {
    ...template,
    approved: true,
    approvalId: "owner-approval-1",
    maximumSpendUsd: 25
  };
  assert.equal(
    assertAuthorized({
      manifest: approved,
      phase: "calibration",
      expectedHashes: { protocolHash: approved.protocolHash },
      estimatedSpendUsd: 20
    }).approvalId,
    "owner-approval-1"
  );
  assert.throws(
    () => assertAuthorized({
      manifest: approved,
      phase: "calibration",
      expectedHashes: { protocolHash: contentHash("wrong") },
      estimatedSpendUsd: 20
    }),
    /hash mismatch/u
  );
  assert.throws(
    () => assertAuthorized({
      manifest: approved,
      phase: "calibration",
      expectedHashes: {},
      estimatedSpendUsd: 26
    }),
    /spend/u
  );
  for (const estimatedSpendUsd of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
    assert.throws(
      () => assertAuthorized({
        manifest: approved,
        phase: "calibration",
        expectedHashes: {},
        estimatedSpendUsd
      }),
      /finite non-negative/u
    );
  }
});

test("live phases require an explicit finite non-negative spend estimate", () => {
  for (const value of [undefined, ""]) {
    assert.throws(() => parseEstimatedSpendUsd(value), /--estimated-spend is required/u);
  }
  for (const value of ["NaN", "Infinity", "-1"]) {
    assert.throws(() => parseEstimatedSpendUsd(value), /finite non-negative/u);
  }
  assert.equal(parseEstimatedSpendUsd("0"), 0);
  assert.equal(parseEstimatedSpendUsd("12.50"), 12.5);
});

function syntheticRecord({ task, modelId, condition, replicate, first, final, sourceHash }) {
  return {
    schemaVersion: 1,
    trajectoryId: `${task.id}:${modelId}:${condition}:${replicate}`,
    task,
    modelId,
    condition,
    replicate,
    status: "completed",
    firstSubmission: {
      sourceHash,
      hiddenTestPass: first,
      parseSuccess: true,
      typecheckSuccess: true,
      diagnosticsHash: null
    },
    repairs: first ? [] : [{
      turn: 1,
      sourceHash: contentHash(`${sourceHash}:repair`),
      feedbackHash: contentHash("feedback"),
      hiddenTestPass: final
    }],
    finalHiddenTestPass: final,
    maintenanceEvaluations: {
      firstSubmission: { repositoryChangeSuccess: first },
      finalSubmission: { repositoryChangeSuccess: final }
    }
  };
}

function syntheticStudyRecords() {
  const families = [
    "state_extension",
    "invariant_change",
    "effect_addition",
    "cross_module_contract_change"
  ];
  const records = [];
  for (const [taskIndex, family] of families.entries()) {
    const task = { id: `task_${taskIndex}`, family, corpus: "confirmatory" };
    for (const modelId of ["frontier", "open-weight"]) {
      records.push(
        syntheticRecord({
          task, modelId, condition: "volt_full", replicate: 1,
          first: true, final: true, sourceHash: contentHash(`${task.id}:${modelId}:language`)
        }),
        syntheticRecord({
          task, modelId, condition: "static_obligations_erased", replicate: 1,
          first: false, final: false, sourceHash: contentHash(`${task.id}:${modelId}:erased`)
        }),
        syntheticRecord({
          task, modelId, condition: "alias_permissive", replicate: 1,
          first: false, final: false, sourceHash: contentHash(`${task.id}:${modelId}:alias`)
        })
      );
      const diagnosticHash = contentHash(`${task.id}:${modelId}:diagnostic-fork`);
      records.push(
        syntheticRecord({
          task, modelId, condition: "volt_full", replicate: 2,
          first: false, final: true, sourceHash: diagnosticHash
        }),
        syntheticRecord({
          task, modelId, condition: "diagnostics_plain", replicate: 2,
          first: false, final: false, sourceHash: diagnosticHash
        })
      );
    }
  }
  return records;
}

test("analysis reproduces six endpoints, Holm adjustment, power bounds, and namespace separation", async () => {
  const protocol = await fixture("research/protocol/protocol-v1.json");
  const records = syntheticStudyRecords();
  const comparisons = analyzeSixPrimaryComparisons(records, protocol, {
    bootstrapResamples: 200,
    permutations: 1_000,
    seed: 91
  });
  assert.equal(comparisons.length, 6);
  assert.deepEqual(comparisons.map((comparison) => comparison.id), protocol.primaryEstimands.map(({ id }) => id));
  assert(comparisons.every((comparison) => comparison.pointEstimate > 0));
  assert(comparisons.every((comparison) => comparison.adjustedPValue >= comparison.pValue));
  assert(comparisons.every((comparison) => Object.keys(comparison.perModel).length === 2));

  const power = selectPoweredSampleSize({ baselineRate: 0.5 });
  assert.equal(power.feasible, true);
  assert(power.trajectoriesPerTaskModelCondition >= 20);
  assert(power.trajectoriesPerTaskModelCondition <= 60);
  const infeasible = selectPoweredSampleSize({ baselineRate: 0.5, taskVariance: 2 });
  assert.equal(infeasible.feasible, false);
  assert.equal(infeasible.decision, "declare_infeasible_and_reapprove");

  const report = buildStudyReport({
    protocol,
    causalRecords: records,
    calibrationRecords: [{ namespace: "calibration" }],
    descriptiveRecords: [{ namespace: "descriptive" }],
    complexityGuardrails: protocol.complexityGuardrails.map(({ id }) => ({ id, passed: true })),
    analysisOptions: {
      bootstrapResamples: 200,
      permutations: 1_000,
      seed: 91
    }
  });
  assert.equal(report.namespaces.calibration.excludedFromConfirmatoryEstimates, true);
  assert.equal(report.namespaces.descriptiveBaselines.claimClass, "descriptive");
  assert.equal(report.compositeScore, null);

  const guardrails = evaluateComplexityGuardrails(protocol.complexityGuardrails, {
    non_test_source_lines: 3_112,
    runtime_dependencies: 0,
    check_latency_p95: 0.2,
    diagnostic_serialization_latency_p95: 1,
    deterministic_execution_latency_p95: 0.3
  });
  assert.equal(guardrails.length, 5);
  assert(guardrails.every((guardrail) => guardrail.passed));
  assert.equal(
    evaluateComplexityGuardrails(protocol.complexityGuardrails, {
      non_test_source_lines: 25_001,
      runtime_dependencies: 0,
      check_latency_p95: 0.2,
      diagnostic_serialization_latency_p95: 1,
      deterministic_execution_latency_p95: 0.3
    })[0].passed,
    false
  );
});

test("all eleven operational measurements remain separate and composite-ineligible", () => {
  const ast = { kind: "literal", children: [] };
  const files = {
    "main.volt": { sourceHash: "before", ast }
  };
  const changed = {
    "main.volt": { sourceHash: "after", ast: { kind: "binary", operator: "+", children: [ast, ast] } }
  };
  const dimensions = {
    files: ["main.volt"],
    symbols: ["main::value"],
    contracts: [],
    effects: [],
    astNodes: ["main::value:binary"]
  };
  const result = computeOperationalMeasurements({
    obligationFixtures: [
      { scope: "static", rejectedBeforeExecution: true, intendedInvariantObserved: true },
      { scope: "runtime", rejectedBeforeExecution: false, intendedInvariantObserved: true }
    ],
    astShapeHashes: ["a", "b"],
    dependencies: {
      observedCapabilities: ["Clock", "Ambient"],
      capabilityRegistry: ["Clock", "Ambient"],
      parameters: [],
      imports: ["Clock"],
      uses: []
    },
    firstFailedFiles: files,
    firstPassingFiles: changed,
    contractPropagation: {
      expectedSites: ["a", "b"],
      correctlyUpdatedSites: ["a", "b"]
    },
    unrelatedRegressions: [],
    semanticBlastRadius: {
      expectedImpact: dimensions,
      actualImpact: dimensions
    },
    impactPrediction: {
      predictedSites: ["a"],
      actualRequiredSites: ["a"]
    },
    staleContracts: [],
    unrequestedChanges: [],
    reviewability: {
      changedSites: ["a"],
      requestedImpactSites: ["a"],
      justificationBySite: { a: "required" }
    }
  });
  assert.equal(Object.keys(result.measurements).length, 11);
  assert.equal(result.composite, null);
  assert.equal(result.compositeEligible, false);
  assert.equal(result.measurements.obligation_coverage.value, 1);
  assert.equal(result.measurements.ambient_dependency_count.count, 1);
});
