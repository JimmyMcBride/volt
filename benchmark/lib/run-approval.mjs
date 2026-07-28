import { contentHash, stableJson } from "./stable.mjs";

const CALIBRATION_TRAJECTORIES_PER_MODEL = 80;
const PHASE_ZERO_REQUESTS_PER_MODEL = 1;
const PROPOSED_MAXIMUM_SPEND_USD = 45;

function assertHash(value, name) {
  if (typeof value !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(value)) {
    throw new TypeError(`${name} must be a sha256 content hash`);
  }
}

function assertPriceEvidence(priceEvidence, models, now) {
  if (priceEvidence === null || typeof priceEvidence !== "object") {
    throw new TypeError("current price evidence is required");
  }
  if (typeof priceEvidence.checkedAt !== "string" || priceEvidence.checkedAt.length === 0) {
    throw new TypeError("price evidence must record checkedAt");
  }
  const checkedAt = Date.parse(priceEvidence.checkedAt);
  const current = now.getTime();
  if (!Number.isFinite(checkedAt) ||
      checkedAt > current + 5 * 60 * 1_000 ||
      current - checkedAt > 24 * 60 * 60 * 1_000) {
    throw new TypeError("price evidence must be a valid observation from the previous 24 hours");
  }
  if (!Array.isArray(priceEvidence.models) || priceEvidence.models.length !== models.length) {
    throw new TypeError("price evidence must cover every live model");
  }
  for (const model of models) {
    const evidence = priceEvidence.models.find((item) => item.provider === model.provider);
    if (evidence === undefined ||
        evidence.modelId !== model.id ||
        stableJson(evidence.priceUsdPerMillion) !== stableJson(model.priceUsdPerMillion) ||
        typeof evidence.source !== "string" ||
        evidence.source.length === 0) {
      throw new TypeError(`price evidence does not match the frozen ${model.provider} model`);
    }
  }
}

function assertPreflight(preflight, models) {
  if (preflight?.inferenceRequests !== 0 || preflight?.providerSpendUsd !== 0) {
    throw new TypeError("run-approval preflight must be metadata-only and zero-spend");
  }
  if (!Array.isArray(preflight.results) || preflight.results.length !== models.length) {
    throw new TypeError("run-approval preflight must cover every provider");
  }
}

export function calibrationWorstCase(models) {
  const byProvider = models.map((model) => {
    const trajectories = CALIBRATION_TRAJECTORIES_PER_MODEL + PHASE_ZERO_REQUESTS_PER_MODEL;
    const inputUsd = trajectories * 64_000 / 1_000_000 * model.priceUsdPerMillion.input;
    const outputUsd = trajectories * 16_000 / 1_000_000 * model.priceUsdPerMillion.output;
    return {
      provider: model.provider,
      modelId: model.id,
      inferenceRequestsRepresented:
        CALIBRATION_TRAJECTORIES_PER_MODEL * 4 + PHASE_ZERO_REQUESTS_PER_MODEL,
      trajectoryEquivalents: trajectories,
      inputUsd,
      outputUsd,
      worstCaseUsd: inputUsd + outputUsd
    };
  });
  return {
    byProvider,
    tokenSubtotalUsd: byProvider.reduce((sum, item) => sum + item.worstCaseUsd, 0),
    maximumSpendUsd: PROPOSED_MAXIMUM_SPEND_USD
  };
}

export function buildRunApprovalPacket({
  implementationCommit,
  preflight,
  priceEvidence,
  expectedDurationMinutes,
  protocolHash,
  corpusManifestHash,
  modelManifestHash,
  systemPromptHash,
  taskContextManifestHash,
  toolVersionsHash,
  conditionAdaptersHash,
  aliasManifestHash,
  retirementManifestHash,
  models,
  now = new Date()
}) {
  if (!/^[a-f0-9]{40}$/u.test(implementationCommit)) {
    throw new TypeError("run-approval packet requires the merged 40-character implementation commit");
  }
  if (!Number.isFinite(expectedDurationMinutes) || expectedDurationMinutes <= 0) {
    throw new TypeError("run-approval packet requires a positive expected duration");
  }
  const frozenHashes = {
    protocolHash,
    corpusManifestHash,
    modelManifestHash,
    systemPromptHash,
    taskContextManifestHash,
    toolVersionsHash,
    conditionAdaptersHash,
    aliasManifestHash,
    retirementManifestHash
  };
  for (const [name, value] of Object.entries(frozenHashes)) assertHash(value, name);
  assertPreflight(preflight, models);
  assertPriceEvidence(priceEvidence, models, now);

  const worstCase = calibrationWorstCase(models);
  const priceTableHash = contentHash(
    models.map(({ provider, priceUsdPerMillion }) => ({ provider, priceUsdPerMillion }))
  );
  if (worstCase.tokenSubtotalUsd > worstCase.maximumSpendUsd) {
    throw new TypeError("current worst-case estimate exceeds the proposed calibration ceiling");
  }
  const providerChecksReady = preflight.readyForRunApproval === true &&
    preflight.results.every((result) => result.ok === true);
  const proposedAuthorization = {
    schemaVersion: 1,
    phase: "calibration",
    approved: true,
    owner: "JimmyMcBride",
    approvalId: "issue-17-explicit-run-approval",
    maximumSpendUsd: worstCase.maximumSpendUsd,
    ...frozenHashes,
    priceTableHash,
    implementationCommit,
    providerFingerprints: Object.fromEntries(
      preflight.results.map((result) => [result.provider, result.systemFingerprint ?? null])
    ),
    credentialsBoundary: "Only the parent orchestrator reads OPENAI_API_KEY and NOVITA_API_KEY; values never enter agent context, child environments, logs, errors, fixtures, artifacts, or Git.",
    storagePrivacyPolicy: "Only four synthetic public calibration contexts may reach providers; retired confirmatory content, secrets, host paths, and hidden assertions are denied."
  };
  const packet = {
    schemaVersion: 1,
    kind: "calibration_run_approval_packet",
    implementationCommit,
    readyForOwnerApproval: providerChecksReady,
    blockingReasons: providerChecksReady
      ? []
      : ["Every provider must pass a documented zero-inference metadata identity check."],
    preflight,
    priceEvidence,
    priceTableHash,
    worstCase,
    expectedDurationMinutes,
    retiredCorpusHash: retirementManifestHash,
    frozenHashes,
    proposedAuthorization,
    authorizationHash: contentHash(proposedAuthorization),
    requiredOwnerResponse:
      `approve calibration authorization ${contentHash(proposedAuthorization)} with a $${worstCase.maximumSpendUsd.toFixed(2)} USD ceiling`,
    confirmatoryAuthorized: false
  };
  return { ...packet, packetHash: contentHash(packet) };
}
