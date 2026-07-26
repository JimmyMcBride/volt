import { readFile } from "node:fs/promises";
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

validateProtocol(protocol);
const { entryIds } = validateEvidenceMatrix(evidence);
validateTraceability(traceability, entryIds);
validateReportTemplate(report);
validateSchemaCoverage({
  protocolSchema,
  manifestSchema,
  resultSchema,
  reportSchema
});

process.stdout.write(JSON.stringify({
  ok: true,
  protocolId: protocol.protocolId,
  evidenceEntries: evidence.entries.length,
  primaryEstimands: protocol.primaryEstimands.length,
  metrics: protocol.metrics.length,
  traceabilityEdges: traceability.edges.length
}) + "\n");
