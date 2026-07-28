import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { preflightMetadata, redact } from "../lib/providers.mjs";
import { stableJson } from "../lib/stable.mjs";

const root = resolve(import.meta.dirname, "../..");
const manifest = JSON.parse(
  await readFile(resolve(root, "benchmark/corpus/live-model-manifest-v1.json"), "utf8")
);
const keys = {
  openai: process.env.OPENAI_API_KEY,
  novita: process.env.NOVITA_API_KEY
};

try {
  const results = [];
  for (const model of manifest.models) {
    if (model.metadataEndpoint !== null && !keys[model.provider]) {
      throw new Error(`${model.provider} API key is required for its metadata preflight`);
    }
    results.push(await preflightMetadata({
      model,
      apiKey: keys[model.provider] ?? ""
    }));
  }
  process.stdout.write(`${stableJson({
    schemaVersion: 1,
    inferenceRequests: 0,
    providerSpendUsd: 0,
    readyForRunApproval:
      results.every((result) => result.ok) &&
      results.every((result) => result.requiresRunApprovalAmendment !== true),
    results
  })}\n`);
} catch (error) {
  process.stderr.write(`${redact(error.message)}\n`);
  process.exitCode = 1;
}
