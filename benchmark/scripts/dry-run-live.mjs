import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { executeFakeCalibration } from "../lib/live-runner.mjs";
import { stableJson } from "../lib/stable.mjs";

const root = resolve(import.meta.dirname, "../..");
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const taskNames = (await readdir(resolve(root, "benchmark/corpus/generated/calibration")))
  .filter((name) => name.endsWith(".json"))
  .sort();
const [tasks, aliases, models] = await Promise.all([
  Promise.all(taskNames.map((name) => readJson(`benchmark/corpus/generated/calibration/${name}`))),
  readJson("benchmark/corpus/alias-manifest-v1.json"),
  readJson("benchmark/corpus/live-model-manifest-v1.json")
]);

const result = await executeFakeCalibration({
  tasks,
  models: models.models,
  aliasManifest: aliases,
  artifactRoot: resolve(root, "benchmark/artifacts/calibration-dry-run")
});

process.stdout.write(`${stableJson({
  ok:
    result.trajectoryCount === 160 &&
    result.inferenceRequestCount <= result.requestCeiling &&
    result.networkCalls === 0 &&
    result.providerSpendUsd === 0,
  kind: result.kind,
  trajectoryCount: result.trajectoryCount,
  inferenceRequestCount: result.inferenceRequestCount,
  requestCeiling: result.requestCeiling,
  networkCalls: result.networkCalls,
  providerSpendUsd: result.providerSpendUsd,
  scheduleHash: result.scheduleHash,
  recordsHash: result.recordsHash,
  requestHash: result.requestHash
})}\n`);
