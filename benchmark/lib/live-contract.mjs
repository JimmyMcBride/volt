import { TextDecoder } from "node:util";
import { contentHash, stableJson } from "./stable.mjs";

export const CALIBRATION_SYSTEM_PROMPT = [
  "You are the coding agent in a controlled language-maintenance study.",
  "Work only from the supplied synthetic repository context.",
  "Do not use the web or any network tool.",
  "Before the first submission, do not run the compiler, formatter, tests, checks, or any equivalent oracle.",
  "Return exactly one JSON object containing the complete contents of changed visible files.",
  "Include no prose.",
  "On repair turns, use only the supplied compiler feedback and the prior conversation.",
  "Never request, infer, or claim access to hidden tests."
].join(" ");

export const AGENT_SUBMISSION_MAX_BYTES = 1_048_576;

export class LiveContractError extends Error {
  constructor(message) {
    super(message);
    this.name = "LiveContractError";
  }
}

function jsonParser(text) {
  let index = 0;

  const fail = (message) => {
    throw new LiveContractError(`invalid JSON at byte-like offset ${index}: ${message}`);
  };
  const whitespace = () => {
    while (/\s/u.test(text[index] ?? "")) index += 1;
  };
  const string = () => {
    if (text[index] !== "\"") fail("expected string");
    const start = index;
    index += 1;
    while (index < text.length) {
      if (text[index] === "\\") {
        index += 2;
        continue;
      }
      if (text[index] === "\"") {
        index += 1;
        try {
          return JSON.parse(text.slice(start, index));
        } catch {
          fail("invalid string escape");
        }
      }
      if (text.charCodeAt(index) < 0x20) fail("unescaped control character");
      index += 1;
    }
    fail("unterminated string");
  };
  const value = () => {
    whitespace();
    if (text[index] === "{") return object();
    if (text[index] === "[") return array();
    if (text[index] === "\"") return string();
    for (const [literal, result] of [["true", true], ["false", false], ["null", null]]) {
      if (text.startsWith(literal, index)) {
        index += literal.length;
        return result;
      }
    }
    const match = text.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u);
    if (match === null) fail("expected value");
    index += match[0].length;
    const number = Number(match[0]);
    if (!Number.isFinite(number)) fail("number must be finite");
    return number;
  };
  const object = () => {
    index += 1;
    whitespace();
    const result = {};
    const keys = new Set();
    if (text[index] === "}") {
      index += 1;
      return result;
    }
    while (index < text.length) {
      whitespace();
      const key = string();
      if (keys.has(key)) throw new LiveContractError(`duplicate JSON key: ${key}`);
      keys.add(key);
      whitespace();
      if (text[index] !== ":") fail("expected colon");
      index += 1;
      result[key] = value();
      whitespace();
      if (text[index] === "}") {
        index += 1;
        return result;
      }
      if (text[index] !== ",") fail("expected comma or object end");
      index += 1;
    }
    fail("unterminated object");
  };
  const array = () => {
    index += 1;
    whitespace();
    const result = [];
    if (text[index] === "]") {
      index += 1;
      return result;
    }
    while (index < text.length) {
      result.push(value());
      whitespace();
      if (text[index] === "]") {
        index += 1;
        return result;
      }
      if (text[index] !== ",") fail("expected comma or array end");
      index += 1;
    }
    fail("unterminated array");
  };

  const result = value();
  whitespace();
  if (index !== text.length) fail("trailing content");
  return result;
}

export function parseJsonUtf8(bytes) {
  let text;
  try {
    text = typeof bytes === "string"
      ? bytes
      : new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new LiveContractError("response is not valid UTF-8");
  }
  return { text, value: jsonParser(text) };
}

export function parseAgentSubmission(raw, visiblePaths) {
  const byteLength = Buffer.byteLength(raw, "utf8");
  if (byteLength > AGENT_SUBMISSION_MAX_BYTES) {
    throw new LiveContractError(`agent submission exceeds ${AGENT_SUBMISSION_MAX_BYTES} UTF-8 bytes`);
  }
  const { value } = parseJsonUtf8(raw);
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new LiveContractError("agent submission must be one JSON object");
  }
  const keys = Object.keys(value).sort();
  if (stableJson(keys) !== stableJson(["files", "schemaVersion"])) {
    throw new LiveContractError("agent submission fields must be exactly schemaVersion and files");
  }
  if (value.schemaVersion !== 1) throw new LiveContractError("agent submission schemaVersion must be 1");
  if (value.files === null || typeof value.files !== "object" || Array.isArray(value.files)) {
    throw new LiveContractError("agent submission files must be an object");
  }
  const allowed = new Set(visiblePaths);
  for (const [path, contents] of Object.entries(value.files)) {
    if (!allowed.has(path)) throw new LiveContractError(`agent submission path is not visible: ${path}`);
    if (typeof contents !== "string") {
      throw new LiveContractError(`agent submission file must contain complete UTF-8 text: ${path}`);
    }
  }
  return {
    schemaVersion: 1,
    files: Object.fromEntries(
      Object.entries(value.files).sort(([left], [right]) => left.localeCompare(right))
    )
  };
}

export function auditActionsForTurn(turn) {
  return turn === 0 ? ["inspect", "edit", "submit"] : ["edit", "submit"];
}

export function buildProviderPrompt({
  publicContext,
  turn,
  feedback,
  nonce,
  priorConversation = []
}) {
  const payload = turn === 0
    ? {
        schemaVersion: 1,
        nonce,
        task: publicContext,
        instruction: "Submit the requested repository change without running checks."
      }
    : {
        schemaVersion: 1,
        nonce,
        task: { id: publicContext.id, wording: publicContext.wording },
        instruction: "Repair the submission using only the supplied compiler feedback.",
        priorConversation,
        feedback
      };
  return {
    system: CALIBRATION_SYSTEM_PROMPT,
    user: stableJson(payload),
    payloadHash: contentHash(payload)
  };
}

export function validateProviderPayload(payload, contextManifest, retirementManifest) {
  if (!contextManifest.allowedTaskIds.includes(payload.task.id)) {
    throw new LiveContractError(`task is not in the calibration provider allowlist: ${payload.task.id}`);
  }
  if (payload.task.corpus !== undefined && payload.task.corpus !== "calibration") {
    throw new LiveContractError(`provider payload corpus must be calibration: ${payload.task.corpus}`);
  }
  const serialized = stableJson(payload);
  for (const retired of retirementManifest.tasks) {
    if (serialized.includes(retired.id) || serialized.includes(retired.manifestHash)) {
      throw new LiveContractError(`retired confirmatory content reached provider payload: ${retired.id}`);
    }
  }
  for (const forbidden of ["expectedSolution", "mutations", "invariants", "privateOutput"]) {
    if (serialized.includes(`\"${forbidden}\"`)) {
      throw new LiveContractError(`restricted task field reached provider payload: ${forbidden}`);
    }
  }
  return payload;
}
