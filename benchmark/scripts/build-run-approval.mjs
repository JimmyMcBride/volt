import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildRunApprovalPacket } from "../lib/run-approval.mjs";
import { contentHash, stableJson } from "../lib/stable.mjs";

const root = resolve(import.meta.dirname, "../..");
const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), "utf8"));

const implementationCommit = argument("--implementation-commit");
const preflightPath = argument("--preflight");
const priceEvidencePath = argument("--price-evidence");
const duration = Number(argument("--expected-duration-minutes"));
if (preflightPath === undefined || priceEvidencePath === undefined) {
  throw new TypeError(
    "usage: node benchmark/scripts/build-run-approval.mjs --implementation-commit <sha> --preflight <json> --price-evidence <json> --expected-duration-minutes <number>"
  );
}

const [protocol, corpus, models, liveCalibration, context, retirement, preflight, priceEvidence] =
  await Promise.all([
    readJson("research/protocol/protocol-v1.json"),
    readJson("benchmark/corpus/corpus-manifest-v1.json"),
    readJson("benchmark/corpus/live-model-manifest-v1.json"),
    readJson("benchmark/corpus/live-calibration-manifest-v1.json"),
    readJson("benchmark/corpus/calibration-context-manifest-v1.json"),
    readJson("benchmark/corpus/confirmatory-retirement-v1.json"),
    readJson(preflightPath),
    readJson(priceEvidencePath)
  ]);

const packet = buildRunApprovalPacket({
  implementationCommit,
  preflight,
  priceEvidence,
  expectedDurationMinutes: duration,
  protocolHash: contentHash(protocol),
  corpusManifestHash: contentHash(corpus),
  modelManifestHash: contentHash(models),
  systemPromptHash: liveCalibration.systemPromptHash,
  taskContextManifestHash: contentHash(context),
  toolVersionsHash: liveCalibration.toolVersionsHash,
  conditionAdaptersHash: liveCalibration.conditionAdaptersHash,
  aliasManifestHash: corpus.aliasManifestHash,
  retirementManifestHash: contentHash(retirement),
  models: models.models
});

process.stdout.write(`${stableJson(packet)}\n`);
