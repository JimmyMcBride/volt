import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  validateEvidenceMatrix,
  validateProtocol,
  validateReportTemplate,
  validateSchemaCoverage,
  validateTraceability
} from "../lib/protocol-validation.mjs";

const researchRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(researchRoot, relativePath), "utf8"));
}

const [
  protocol,
  evidence,
  traceability,
  report,
  protocolSchema,
  manifestSchema,
  resultSchema,
  reportSchema
] = await Promise.all([
  readJson("protocol/protocol-v1.json"),
  readJson("evidence/evidence-matrix.json"),
  readJson("evidence/traceability.json"),
  readJson("protocol/report-template.json"),
  readJson("schema/protocol.schema.json"),
  readJson("schema/run-manifest.schema.json"),
  readJson("schema/trajectory-result.schema.json"),
  readJson("schema/analysis-report.schema.json")
]);

test("approved protocol retains every frozen decision rule", () => {
  assert.doesNotThrow(() => validateProtocol(protocol));
});

test("evidence matrix distinguishes sourced evidence from Volt hypotheses", () => {
  const result = validateEvidenceMatrix(evidence);
  assert.equal(result.entryIds.size, evidence.entries.length);
  assert(evidence.entries.some((entry) => entry.classification === "counterevidence"));
  assert(evidence.entries.some((entry) => entry.classification === "speculation"));
});

test("traceability links evidence, hypotheses, experiments, and decisions", () => {
  const { entryIds } = validateEvidenceMatrix(evidence);
  assert.doesNotThrow(() => validateTraceability(traceability, entryIds));
});

test("report template exposes every result direction without fabricating outcomes", () => {
  assert.doesNotThrow(() => validateReportTemplate(report));
});

test("machine-readable schemas cover protocol, manifests, results, and reports", () => {
  assert.doesNotThrow(() => validateSchemaCoverage({
    protocolSchema,
    manifestSchema,
    resultSchema,
    reportSchema
  }));
});
