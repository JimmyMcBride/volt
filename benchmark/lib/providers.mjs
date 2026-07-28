import {
  auditActionsForTurn,
  buildProviderPrompt,
  parseAgentSubmission,
  parseJsonUtf8,
  validateProviderPayload
} from "./live-contract.mjs";
import { contentHash, stableJson } from "./stable.mjs";

export const LIVE_MODEL_MANIFEST = Object.freeze({
  schemaVersion: 1,
  id: "volt-live-calibration-models-v1",
  status: "frozen_for_implementation_pending_run_approval",
  responseParserVersion: "ProviderEnvelopeV1+AgentSubmissionV1",
  modelReportedIdentifierPolicy: "must_equal_frozen_model_id",
  requestTraceIdentifierPolicy: "non_empty_provider_request_or_trace_id_required",
  fingerprintPolicy: "bind_first_returned_value_and_reject_drift",
  models: [
    {
      id: "gpt-5.4-2026-03-05",
      family: "frontier_hosted",
      provider: "openai",
      endpoint: "https://api.openai.com/v1/chat/completions",
      metadataEndpoint: "https://api.openai.com/v1/models/gpt-5.4-2026-03-05",
      revision: "gpt-5.4-2026-03-05",
      tokenizer: "provider_managed:gpt-5.4-2026-03-05",
      seedSupported: false,
      requiresRuntimeFingerprint: false,
      priceUsdPerMillion: { input: 2.5, cachedInput: 0.25, output: 15 },
      request: {
        stream: false,
        n: 1,
        response_format: { type: "json_object" },
        reasoning_effort: "none",
        store: false,
        temperature: 0.2,
        top_p: 1,
        max_completion_tokens: 4000
      },
      evidence: "https://developers.openai.com/api/docs/models/gpt-5.4"
    },
    {
      id: "qwen/qwen3-coder-next",
      family: "open_weight_code",
      provider: "novita",
      endpoint: "https://api.novita.ai/openai/v1/chat/completions",
      metadataEndpoint: null,
      revision: "da6e2ed27304dd39abadd9c82ef50e8de67bdd4c",
      tokenizer: "Qwen/Qwen3-Coder-Next-FP8@da6e2ed27304dd39abadd9c82ef50e8de67bdd4c",
      quantization: "fp8",
      seedSupported: false,
      requiresRuntimeFingerprint: true,
      seedPolicy: "include_only_after_endpoint_metadata_confirmation",
      priceUsdPerMillion: { input: 0.2, cachedInput: 0.02, output: 1.5 },
      request: {
        stream: false,
        n: 1,
        response_format: { type: "json_object" },
        temperature: 0.2,
        top_p: 1,
        max_tokens: 4000
      },
      evidence: "https://novita.ai/models/model-detail/qwen-qwen3-coder-next",
      upstream: "https://huggingface.co/Qwen/Qwen3-Coder-Next-FP8/tree/da6e2ed27304dd39abadd9c82ef50e8de67bdd4c"
    }
  ],
  limits: {
    cumulativeInputTokensPerTrajectory: 64_000,
    outputTokensPerTurn: 4_000,
    cumulativeOutputTokensPerTrajectory: 16_000,
    repairTurns: 3,
    requestCeiling: 640
  }
});

export class ProviderError extends Error {
  constructor(message, { status = null, mayHaveStartedInference = false, billingAmbiguous = false } = {}) {
    super(redact(message));
    this.name = "ProviderError";
    this.status = status;
    this.mayHaveStartedInference = mayHaveStartedInference;
    this.billingAmbiguous = billingAmbiguous;
  }
}

export function redact(value) {
  return String(value)
    .replace(/Bearer\s+[^\s"']+/giu, "Bearer [REDACTED]")
    .replace(/\b(?:sk|key|token)-[A-Za-z0-9_-]{8,}\b/gu, "[REDACTED]")
    .replace(/("(?:authorization|api[_-]?key|token)"\s*:\s*")[^"]+(")/giu, "$1[REDACTED]$2");
}

export function exactRequestEnvelope(model, messages, seed) {
  const envelope = {
    model: model.id,
    messages,
    ...structuredClone(model.request)
  };
  if (model.provider === "novita" && model.seedSupported && seed !== null) envelope.seed = seed;
  return envelope;
}

function responseMetadata(response, envelope, model, requestId, fingerprint) {
  const usage = envelope.usage;
  if (usage === null || typeof usage !== "object") throw new ProviderError("provider response is missing usage");
  const inputTokens = usage.prompt_tokens ?? usage.input_tokens;
  const outputTokens = usage.completion_tokens ?? usage.output_tokens;
  const cachedInputTokens =
    usage.prompt_tokens_details?.cached_tokens ??
    usage.input_tokens_details?.cached_tokens ??
    0;
  for (const [name, value] of Object.entries({ inputTokens, outputTokens, cachedInputTokens })) {
    if (!Number.isInteger(value) || value < 0) throw new ProviderError(`provider usage ${name} is invalid`);
  }
  if (envelope.model !== model.id) {
    throw new ProviderError(`provider model identity drift: expected ${model.id}, received ${envelope.model}`);
  }
  if (typeof requestId !== "string" || requestId.length === 0) {
    throw new ProviderError("provider response is missing a stable request or trace id");
  }
  if (fingerprint !== null && envelope.system_fingerprint !== undefined &&
      envelope.system_fingerprint !== fingerprint) {
    throw new ProviderError("provider deployment fingerprint drift");
  }
  const responseId = envelope.id;
  if (typeof responseId !== "string" || responseId.length === 0) {
    throw new ProviderError("provider response is missing a stable response id");
  }
  return {
    provider: model.provider,
    modelId: envelope.model,
    requestId,
    responseId,
    systemFingerprint: envelope.system_fingerprint ?? null,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    cache: {
      inputPrefixHit: cachedInputTokens > 0,
      completionResultHit: false
    }
  };
}

async function readResponseEnvelope(response) {
  let bytes;
  try {
    bytes = new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    throw new ProviderError(`provider response body failed: ${error.message}`, {
      status: response.status,
      mayHaveStartedInference: true,
      billingAmbiguous: true
    });
  }
  try {
    return parseJsonUtf8(bytes).value;
  } catch (error) {
    throw new ProviderError(error.message, {
      status: response.status,
      mayHaveStartedInference: true,
      billingAmbiguous: true
    });
  }
}

export class ProviderModel {
  #fetchImplementation;
  #apiKey;
  #authorizationHash;
  #contextManifest;
  #retirementManifest;
  #fingerprint;
  #requestIds = new Set();
  #responseIds = new Set();

  constructor({
    model,
    apiKey,
    authorizationHash,
    contextManifest,
    retirementManifest,
    fingerprint = null,
    fetchImplementation = globalThis.fetch
  }) {
    if (typeof fetchImplementation !== "function") throw new TypeError("fetch implementation is required");
    if (typeof apiKey !== "string" || apiKey.length === 0) throw new TypeError(`${model.provider} API key is required`);
    if (typeof authorizationHash !== "string" || !authorizationHash.startsWith("sha256:")) {
      throw new TypeError("approved authorization hash is required");
    }
    this.id = model.id;
    this.seedSupported = model.seedSupported;
    this.model = structuredClone(model);
    this.#apiKey = apiKey;
    this.#authorizationHash = authorizationHash;
    this.#contextManifest = contextManifest;
    this.#retirementManifest = retirementManifest;
    this.#fingerprint = fingerprint;
    this.#fetchImplementation = fetchImplementation;
  }

  bindFingerprint(fingerprint) {
    if (fingerprint === null || fingerprint === undefined) return;
    if (typeof fingerprint !== "string" || fingerprint.length === 0) {
      throw new ProviderError("provider deployment fingerprint is invalid");
    }
    if (this.#fingerprint !== null && this.#fingerprint !== fingerprint) {
      throw new ProviderError("provider deployment fingerprint drift");
    }
    this.#fingerprint = fingerprint;
  }

  bindResponseIdentity(responseId) {
    if (typeof responseId !== "string" || responseId.length === 0) {
      throw new ProviderError("provider response identity is invalid");
    }
    if (this.#responseIds.has(responseId)) {
      throw new ProviderError("provider response identity was reused");
    }
    this.#responseIds.add(responseId);
  }

  async complete(request) {
    if (request.authorizationHash !== this.#authorizationHash) {
      throw new ProviderError("live request authorization hash mismatch");
    }
    if (typeof request.nonce !== "string" || request.nonce.length === 0) {
      throw new ProviderError("live request nonce is required");
    }
    const taskEntry = this.#contextManifest.tasks.find((task) => task.id === request.task.id);
    if (taskEntry === undefined || contentHash(request.task) !== taskEntry.publicContextHash) {
      throw new ProviderError(`live provider rejected unknown or modified calibration context: ${request.task.id}`);
    }
    const prompt = buildProviderPrompt({
      publicContext: request.task,
      turn: request.turn,
      feedback: request.feedback,
      nonce: request.nonce,
      priorConversation: request.priorConversation
    });
    validateProviderPayload(
      JSON.parse(prompt.user),
      this.#contextManifest,
      this.#retirementManifest
    );
    const messages = [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user }
    ];
    const body = exactRequestEnvelope(this.model, messages, request.seed ?? null);
    const requestId = contentHash({
      model: this.model.id,
      trajectoryId: request.trajectoryId,
      turn: request.turn,
      nonce: request.nonce,
      body
    });
    if (this.#requestIds.has(requestId)) throw new ProviderError("scheduled provider request identity was reused");
    this.#requestIds.add(requestId);

    let response;
    try {
      response = await this.#fetchImplementation(this.model.endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.#apiKey}`,
          "content-type": "application/json"
        },
        body: stableJson(body),
        signal: request.signal
      });
    } catch (error) {
      throw new ProviderError(`provider transport failed: ${error.message}`, {
        mayHaveStartedInference: true,
        billingAmbiguous: true
      });
    }
    const envelope = await readResponseEnvelope(response);
    if (!response.ok) {
      throw new ProviderError(`provider request failed with HTTP ${response.status}: ${stableJson(envelope)}`, {
        status: response.status,
        mayHaveStartedInference: true,
        billingAmbiguous: response.status >= 500
      });
    }
    const declaredCompletionCache =
      response.headers.get("x-response-cache")?.toLowerCase() === "hit" ||
      envelope.cache?.completion_result === "hit";
    if (declaredCompletionCache) throw new ProviderError("provider declared a cached completion result");

    const metadata = responseMetadata(
      response,
      envelope,
      this.model,
      response.headers.get("x-request-id") ??
        response.headers.get("request-id") ??
        envelope.request_id ??
        null,
      this.#fingerprint
    );
    if (this.model.requiresRuntimeFingerprint && metadata.systemFingerprint === null) {
      throw new ProviderError(
        `${this.model.provider} did not return the stable deployment fingerprint required by the approved manifest`
      );
    }
    if (this.#fingerprint === null && metadata.systemFingerprint !== null) {
      this.#fingerprint = metadata.systemFingerprint;
    }
    if (this.#responseIds.has(metadata.responseId)) {
      throw new ProviderError("provider response identity was reused");
    }
    this.#responseIds.add(metadata.responseId);
    const content = envelope.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new ProviderError("provider response is missing message content");
    const submission = parseAgentSubmission(content, Object.keys(request.task.files));
    return {
      files: submission.files,
      generatedTokens: metadata.outputTokens,
      auditActions: auditActionsForTurn(request.turn),
      providerMetadata: metadata
    };
  }
}

function explicitlyUnbilledPreInference(response, envelope) {
  return (
    response.status === 429 &&
    response.headers.get("x-inference-started") === "false" &&
    response.headers.get("x-request-billed") === "false" &&
    envelope.inference_started === false &&
    envelope.billed === false
  );
}

export async function preflightMetadata({
  model,
  apiKey,
  fetchImplementation = globalThis.fetch,
  sleep = async () => {},
  attempts = 3
}) {
  if (model.metadataEndpoint === null) {
    return {
      ok: false,
      provider: model.provider,
      reason: "no_documented_zero_charge_metadata_endpoint",
      requiresRunApprovalAmendment: true
    };
  }
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetchImplementation(model.metadataEndpoint, {
      method: "GET",
      headers: { authorization: `Bearer ${apiKey}` }
    });
    const envelope = await readResponseEnvelope(response);
    if (response.ok) {
      if (envelope.id !== model.id) throw new ProviderError("metadata model identity drift");
      if (model.quantization !== undefined &&
          String(envelope.quantization ?? "").toLowerCase() !== model.quantization.toLowerCase()) {
        throw new ProviderError("metadata quantization identity drift");
      }
      if (model.provider === "novita" &&
          envelope.revision !== model.revision) {
        throw new ProviderError("metadata upstream revision identity drift");
      }
      const requestId = response.headers.get("x-request-id") ??
        response.headers.get("request-id") ??
        envelope.request_id ??
        null;
      if (typeof requestId !== "string" || requestId.length === 0) {
        throw new ProviderError("metadata response is missing a stable request or trace id");
      }
      return {
        ok: true,
        provider: model.provider,
        modelId: envelope.id,
        requestId,
        quantization: envelope.quantization ?? null,
        revision: envelope.revision ?? model.revision,
        attempt
      };
    }
    if ([400, 401, 403].includes(response.status)) {
      throw new ProviderError(`metadata preflight failed with HTTP ${response.status}`, { status: response.status });
    }
    if (explicitlyUnbilledPreInference(response, envelope) && attempt < attempts) {
      await sleep(2 ** (attempt - 1) * 100);
      continue;
    }
    throw new ProviderError(`metadata preflight failed with HTTP ${response.status}`, {
      status: response.status
    });
  }
  throw new ProviderError("metadata preflight exhausted");
}
