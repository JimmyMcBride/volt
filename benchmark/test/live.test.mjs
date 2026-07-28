import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { selectCalibrationPowerRecommendation } from "../lib/analysis.mjs";
import {
  buildCalibrationSchedule,
  CALIBRATION_REQUEST_CEILING,
  validateCalibrationSchedule
} from "../lib/calibration.mjs";
import { publicTaskContext } from "../lib/corpus.mjs";
import {
  AGENT_SUBMISSION_MAX_BYTES,
  buildProviderPrompt,
  CALIBRATION_SYSTEM_PROMPT,
  LiveContractError,
  parseAgentSubmission,
  parseJsonUtf8,
  validateProviderPayload
} from "../lib/live-contract.mjs";
import {
  executeFakeCalibration,
  rehydrateFirstSubmissions
} from "../lib/live-runner.mjs";
import {
  exactRequestEnvelope,
  LIVE_MODEL_MANIFEST,
  preflightMetadata,
  ProviderError,
  ProviderModel,
  redact
} from "../lib/providers.mjs";
import { buildRunApprovalPacket, calibrationWorstCase } from "../lib/run-approval.mjs";
import { CheckpointJournal, SpendError, SpendLedger } from "../lib/spend.mjs";
import { contentHash, stableJson } from "../lib/stable.mjs";

const root = resolve(import.meta.dirname, "../..");
const fixture = async (path) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const calibrationTasks = async () => Promise.all(
  [
    "calibration_cross_module_contract_change.json",
    "calibration_effect_addition.json",
    "calibration_invariant_change.json",
    "calibration_state_extension.json"
  ].map((name) => fixture(`benchmark/corpus/generated/calibration/${name}`))
);

function response({
  model,
  files,
  status = 200,
  id = "completion-1",
  requestId = "request-1",
  fingerprint = "deployment-1",
  usage = { prompt_tokens: 100, completion_tokens: 50 },
  headers = {},
  extra = {}
}) {
  return new Response(JSON.stringify({
    id,
    model,
    system_fingerprint: fingerprint,
    choices: [{ message: { content: JSON.stringify({ schemaVersion: 1, files }) } }],
    usage,
    ...extra
  }), {
    status,
    headers: { "content-type": "application/json", "x-request-id": requestId, ...headers }
  });
}

async function providerFixture(provider = "openai", fetchImplementation) {
  const [task, contextManifest, retirementManifest] = await Promise.all([
    fixture("benchmark/corpus/generated/calibration/calibration_state_extension.json"),
    fixture("benchmark/corpus/calibration-context-manifest-v1.json"),
    fixture("benchmark/corpus/confirmatory-retirement-v1.json")
  ]);
  const model = LIVE_MODEL_MANIFEST.models.find((item) => item.provider === provider);
  const authorizationHash = contentHash("test-authorization");
  return {
    task,
    model,
    authorizationHash,
    provider: new ProviderModel({
      model,
      apiKey: "test-key-not-a-real-secret",
      authorizationHash,
      contextManifest,
      retirementManifest,
      fetchImplementation
    }),
    request: {
      task: publicTaskContext(task),
      condition: "volt_full",
      turn: 0,
      feedback: null,
      trajectoryId: `${task.id}:${model.id}:volt_full:1`,
      authorizationHash,
      nonce: "opaque-nonce-1",
      seed: null
    }
  };
}

test("AgentSubmissionV1 rejects non-canonical, duplicate, oversized, and non-visible output", () => {
  assert.deepEqual(
    parseAgentSubmission(
      "{\"schemaVersion\":1,\"files\":{\"src/a.volt\":\"module a\\n\"}}",
      ["src/a.volt"]
    ),
    { schemaVersion: 1, files: { "src/a.volt": "module a\n" } }
  );
  for (const raw of [
    "{\"schemaVersion\":1,\"schemaVersion\":1,\"files\":{}}",
    "{\"schemaVersion\":1,\"files\":{},\"prose\":\"done\"}",
    "```json\n{\"schemaVersion\":1,\"files\":{}}\n```"
  ]) {
    assert.throws(() => parseAgentSubmission(raw, []), LiveContractError);
  }
  assert.throws(
    () => parseAgentSubmission(
      "{\"schemaVersion\":1,\"files\":{\"src/hidden.volt\":\"\"}}",
      ["src/a.volt"]
    ),
    /not visible/u
  );
  assert.throws(
    () => parseAgentSubmission("x".repeat(AGENT_SUBMISSION_MAX_BYTES + 1), []),
    /exceeds/u
  );
  assert.throws(
    () => parseJsonUtf8(Uint8Array.from([0xc3, 0x28])),
    /UTF-8/u
  );
});

test("provider adapters freeze exact envelopes and return adapter-owned audit actions", async () => {
  const captures = [];
  const setup = await providerFixture("openai", async (url, init) => {
    captures.push({ url, init });
    return response({
      model: LIVE_MODEL_MANIFEST.models[0].id,
      files: (await calibrationTasks())[0].expectedSolution.files
    });
  });
  const result = await setup.provider.complete(setup.request);
  assert.deepEqual(result.auditActions, ["inspect", "edit", "submit"]);
  assert.equal(captures.length, 1);
  assert.equal(captures[0].url, setup.model.endpoint);
  const body = JSON.parse(captures[0].init.body);
  assert.deepEqual(body, exactRequestEnvelope(setup.model, body.messages, null));
  assert.equal(body.messages[0].content, CALIBRATION_SYSTEM_PROMPT);
  assert.equal(Object.hasOwn(body, "tools"), false);
  assert.equal(Object.hasOwn(body, "seed"), false);
  assert.match(captures[0].init.headers.authorization, /^Bearer /u);

  const novita = LIVE_MODEL_MANIFEST.models.find((model) => model.provider === "novita");
  assert.deepEqual(Object.keys(exactRequestEnvelope(novita, [], null)).sort(), [
    "max_tokens",
    "messages",
    "model",
    "n",
    "response_format",
    "stream",
    "temperature",
    "top_p"
  ]);
});

test("repair prompts carry the prior conversation and only supplied compiler feedback", () => {
  const publicContext = {
    schemaVersion: 1,
    id: "calibration_state_extension",
    family: "state_extension",
    corpus: "calibration",
    wording: "Add the Paused event state.",
    files: { "src/domain.volt": "module domain\n" },
    publicTests: ["tests.registrationTest"],
    allowedTools: ["inspect", "edit", "submit"],
    nonGoals: []
  };
  const priorConversation = [{
    turn: 0,
    submission: {
      schemaVersion: 1,
      files: { "src/domain.volt": "module domain\n" }
    },
    compilerFeedback: "type K_TYPE_EXACT"
  }];
  const prompt = buildProviderPrompt({
    publicContext,
    turn: 1,
    feedback: "type K_TYPE_EXACT",
    nonce: "paired-repair-nonce",
    priorConversation
  });
  const payload = JSON.parse(prompt.user);
  assert.deepEqual(payload.priorConversation, priorConversation);
  assert.equal(payload.feedback, "type K_TYPE_EXACT");
  assert.deepEqual(Object.keys(payload.task).sort(), ["id", "wording"]);
  assert.equal(stableJson(payload).includes("expectedSolution"), false);
  assert.equal(stableJson(payload).includes("hidden"), false);
});

test("provider context is content-bound to calibration and excludes retired or hidden material", async () => {
  const [task, contextManifest, retirementManifest] = await Promise.all([
    fixture("benchmark/corpus/generated/calibration/calibration_state_extension.json"),
    fixture("benchmark/corpus/calibration-context-manifest-v1.json"),
    fixture("benchmark/corpus/confirmatory-retirement-v1.json")
  ]);
  const visible = publicTaskContext(task);
  assert.doesNotThrow(() => validateProviderPayload(
    { task: visible },
    contextManifest,
    retirementManifest
  ));
  assert.equal(stableJson(visible).includes("expectedSolution"), false);
  assert.equal(stableJson(visible).includes("invariants"), false);
  for (const retired of retirementManifest.tasks) {
    assert.equal(stableJson(visible).includes(retired.id), false);
  }
  let calls = 0;
  const setup = await providerFixture("openai", async () => {
    calls += 1;
    throw new Error("must not dispatch");
  });
  setup.request.task.wording = `${setup.request.task.wording} modified`;
  await assert.rejects(() => setup.provider.complete(setup.request), /unknown or modified/u);
  assert.equal(calls, 0);
});

test("provider failures are retained without retries and redact credentials", async () => {
  for (const status of [400, 401, 403, 500, 503]) {
    let calls = 0;
    const setup = await providerFixture("openai", async () => {
      calls += 1;
      return new Response(
        JSON.stringify({ error: { message: "Bearer sk-secretvalue123456" } }),
        { status, headers: { "content-type": "application/json", "x-request-id": `request-${status}` } }
      );
    });
    await assert.rejects(
      () => setup.provider.complete(setup.request),
      (error) => error instanceof ProviderError && !error.message.includes("secretvalue")
    );
    assert.equal(calls, 1);
  }
  assert.equal(
    redact("{\"api_key\":\"key-secretvalue123\",\"authorization\":\"Bearer token-secretvalue123\"}")
      .includes("secretvalue"),
    false
  );
});

test("provider validation rejects identity drift, missing usage, result cache, and reused response ids", async () => {
  const cases = [
    {
      name: "identity",
      make: (setup) => response({ model: "rolling-alias", files: setup.task.expectedSolution.files }),
      pattern: /identity drift/u
    },
    {
      name: "usage",
      make: (setup) => response({ model: setup.model.id, files: setup.task.expectedSolution.files, usage: null }),
      pattern: /missing usage/u
    },
    {
      name: "cache",
      make: (setup) => response({
        model: setup.model.id,
        files: setup.task.expectedSolution.files,
        headers: { "x-response-cache": "hit" }
      }),
      pattern: /cached completion/u
    }
  ];
  for (const item of cases) {
    let setup;
    setup = await providerFixture("openai", async () => item.make(setup));
    await assert.rejects(() => setup.provider.complete(setup.request), item.pattern, item.name);
  }

  let setup;
  let requestSequence = 0;
  setup = await providerFixture("openai", async () => response({
    model: setup.model.id,
    files: setup.task.expectedSolution.files,
    id: "same-response",
    requestId: `request-${requestSequence++}`
  }));
  await setup.provider.complete(setup.request);
  await assert.rejects(
    () => setup.provider.complete({ ...setup.request, nonce: "opaque-nonce-2", turn: 1 }),
    /response identity was reused/u
  );
});

test("metadata preflight retries only explicit unbilled pre-inference 429 responses", async () => {
  const model = LIVE_MODEL_MANIFEST.models.find((item) => item.provider === "openai");
  let calls = 0;
  const sleeps = [];
  const result = await preflightMetadata({
    model,
    apiKey: "test-key",
    sleep: async (milliseconds) => sleeps.push(milliseconds),
    fetchImplementation: async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(JSON.stringify({ inference_started: false, billed: false }), {
          status: 429,
          headers: {
            "content-type": "application/json",
            "x-inference-started": "false",
            "x-request-billed": "false"
          }
        });
      }
      return new Response(JSON.stringify({ id: model.id }), {
        status: 200,
        headers: { "content-type": "application/json", "x-request-id": "metadata-1" }
      });
    }
  });
  assert.equal(result.ok, true);
  assert.equal(calls, 2);
  assert.deepEqual(sleeps, [100]);

  let forbiddenCalls = 0;
  await assert.rejects(
    () => preflightMetadata({
      model,
      apiKey: "test-key",
      fetchImplementation: async () => {
        forbiddenCalls += 1;
        return new Response(JSON.stringify({ error: "rate limited" }), {
          status: 429,
          headers: { "content-type": "application/json" }
        });
      }
    }),
    /429/u
  );
  assert.equal(forbiddenCalls, 1);
});

test("spend ledger refuses ceiling breaches and restores checkpoints without replay", async () => {
  const models = LIVE_MODEL_MANIFEST.models;
  const ledger = new SpendLedger({ maximumSpendUsd: 0.01, models, requestCeiling: 1 });
  assert.throws(
    () => ledger.reserve({
      requestId: "over",
      trajectoryId: "trajectory-over",
      provider: "openai",
      remainingInputTokens: 4_001,
      remainingOutputTokens: 0
    }),
    SpendError
  );
  ledger.reserve({
    requestId: "reserved",
    trajectoryId: "trajectory-1",
    provider: "openai",
    remainingInputTokens: 4_000,
    remainingOutputTokens: 0
  });
  const restored = SpendLedger.restore({ snapshot: ledger.snapshot(), models });
  const settled = restored.settleInterruptedReservations();
  assert.equal(settled.length, 1);
  assert.equal(settled[0].status, "ambiguous_billing");
  assert.equal(restored.hasRequest("reserved"), true);
  assert.throws(
    () => restored.reserve({
      requestId: "reserved",
      trajectoryId: "trajectory-1",
      provider: "openai",
      remainingInputTokens: 1,
      remainingOutputTokens: 0
    }),
    /already exists/u
  );

  const directory = await mkdtemp(resolve(tmpdir(), "volt-checkpoint-"));
  try {
    const path = resolve(directory, "checkpoint.ndjson");
    const journal = new CheckpointJournal(path);
    await journal.append("request_reserved", { ledger: ledger.snapshot() });
    const loaded = await CheckpointJournal.load(path);
    assert.equal(loaded.records.length, 1);
    assert.equal(loaded.journal.sequence, 1);
    const text = await readFile(path, "utf8");
    await writeFile(path, text.replace("\"sequence\":1", "\"sequence\":2"), "utf8");
    await assert.rejects(() => CheckpointJournal.load(path), /sequence/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("completed full-arm checkpoints rehydrate the diagnostic fork submission", () => {
  const trajectoryId =
    "calibration_state_extension:gpt-5.4-2026-03-05:volt_full:1";
  const frozenFirstSubmission = {
    files: { "src/domain.volt": "module domain\n" },
    generatedTokens: 42,
    auditActions: ["inspect", "edit", "submit"]
  };
  const restored = rehydrateFirstSubmissions([{
    kind: "trajectory_completed",
    value: {
      record: { trajectoryId, condition: "volt_full" },
      frozenFirstSubmission
    }
  }]);
  assert.deepEqual(restored.get(trajectoryId), frozenFirstSubmission);
  assert.notEqual(restored.get(trajectoryId), frozenFirstSubmission);
  assert.equal(
    rehydrateFirstSubmissions([{
      kind: "trajectory_completed",
      value: {
        record: { trajectoryId, condition: "diagnostics_plain" },
        frozenFirstSubmission
      }
    }]).size,
    0
  );
});

test("calibration schedule is deterministic, paired, randomized, and bounded", async () => {
  const tasks = await calibrationTasks();
  const first = buildCalibrationSchedule({ tasks, models: LIVE_MODEL_MANIFEST.models });
  const second = buildCalibrationSchedule({ tasks, models: LIVE_MODEL_MANIFEST.models });
  assert.deepEqual(first, second);
  assert.equal(first.length, 160);
  assert.equal(new Set(first.map((item) => item.trajectoryId)).size, 160);
  assert.equal(Math.max(...first.map((item) => item.replicate)), 5);
  for (const plain of first.filter((item) => item.condition === "diagnostics_plain")) {
    const full = first.find((item) => item.trajectoryId === plain.frozenFirstSubmissionFrom);
    assert(full);
    assert(first.indexOf(full) < first.indexOf(plain));
    assert.deepEqual(plain.turnNonces.slice(1), full.turnNonces.slice(1));
    assert.equal(plain.turnNonces[0], null);
  }
  const rootOrders = new Set();
  for (let index = 0; index < first.length; index += 4) {
    rootOrders.add(first.slice(index, index + 4).map((item) => item.condition).join(","));
  }
  assert(rootOrders.size > 1);
  assert.equal(CALIBRATION_REQUEST_CEILING, 640);
  assert.doesNotThrow(() => validateCalibrationSchedule(first));
});

test("full fake calibration is byte-deterministic, zero-network, and preserves fork relationships", async () => {
  const [tasks, aliases] = await Promise.all([
    calibrationTasks(),
    fixture("benchmark/corpus/alias-manifest-v1.json")
  ]);
  const first = await executeFakeCalibration({
    tasks,
    models: LIVE_MODEL_MANIFEST.models,
    aliasManifest: aliases
  });
  const second = await executeFakeCalibration({
    tasks,
    models: LIVE_MODEL_MANIFEST.models,
    aliasManifest: aliases
  });
  assert.equal(first.trajectoryCount, 160);
  assert(first.inferenceRequestCount <= 640);
  assert.equal(first.networkCalls, 0);
  assert.equal(first.providerSpendUsd, 0);
  assert.equal(first.scheduleHash, second.scheduleHash);
  assert.equal(first.recordsHash, second.recordsHash);
  assert.equal(first.requestHash, second.requestHash);
});

test("six-endpoint power selection fails closed for empty and over-60 cohorts", () => {
  const empty = Array.from({ length: 6 }, (_, index) => ({
    id: `endpoint-${index}`,
    eligibleCount: index === 0 ? 0 : 10,
    baselineRate: 0.5,
    taskVariance: 0
  }));
  assert.equal(selectCalibrationPowerRecommendation(empty).feasible, false);
  assert.match(selectCalibrationPowerRecommendation(empty).reason, /no estimable/u);

  const dispersed = Array.from({ length: 6 }, (_, index) => ({
    id: `endpoint-${index}`,
    eligibleCount: 10,
    baselineRate: 0.5,
    taskVariance: 100
  }));
  const result = selectCalibrationPowerRecommendation(dispersed);
  assert.equal(result.feasible, false);
  assert.match(result.reason, /more than 60/u);
});

test("run-approval packet freezes the final commit, evidence, hashes, ceiling, and exact owner response", () => {
  const hashes = Object.fromEntries(
    [
      "protocolHash",
      "corpusManifestHash",
      "modelManifestHash",
      "systemPromptHash",
      "taskContextManifestHash",
      "toolVersionsHash",
      "conditionAdaptersHash",
      "aliasManifestHash",
      "retirementManifestHash"
    ].map((name) => [name, contentHash(name)])
  );
  const preflight = {
    inferenceRequests: 0,
    providerSpendUsd: 0,
    readyForRunApproval: true,
    results: LIVE_MODEL_MANIFEST.models.map((model) => ({
      ok: true,
      provider: model.provider,
      modelId: model.id,
      systemFingerprint: `${model.provider}-fingerprint`
    }))
  };
  const priceEvidence = {
    checkedAt: "2026-07-27T00:00:00.000Z",
    models: LIVE_MODEL_MANIFEST.models.map((model) => ({
      provider: model.provider,
      modelId: model.id,
      priceUsdPerMillion: model.priceUsdPerMillion,
      source: model.evidence
    }))
  };
  const packet = buildRunApprovalPacket({
    implementationCommit: "a".repeat(40),
    preflight,
    priceEvidence,
    expectedDurationMinutes: 240,
    ...hashes,
    models: LIVE_MODEL_MANIFEST.models,
    now: new Date("2026-07-27T01:00:00.000Z")
  });
  assert.equal(packet.readyForOwnerApproval, true);
  assert.equal(packet.worstCase.maximumSpendUsd, 45);
  assert(calibrationWorstCase(LIVE_MODEL_MANIFEST.models).tokenSubtotalUsd < 45);
  assert.match(packet.requiredOwnerResponse, new RegExp(packet.authorizationHash, "u"));
  assert.match(packet.requiredOwnerResponse, /\$45\.00 USD ceiling/u);
  assert.equal(packet.proposedAuthorization.implementationCommit, "a".repeat(40));
  assert.equal(packet.confirmatoryAuthorized, false);
  assert.equal(contentHash(packet.proposedAuthorization), packet.authorizationHash);
});
