function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function equalSet(actual, expected, label) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  invariant(actualSet.size === actual.length, `${label} contains duplicates`);
  invariant(actualSet.size === expectedSet.size, `${label} has the wrong size`);
  for (const item of expectedSet) {
    invariant(actualSet.has(item), `${label} is missing ${item}`);
  }
}

export function validateProtocol(protocol) {
  invariant(protocol.schemaVersion === 1, "protocol schemaVersion must be 1");
  invariant(protocol.protocolId === "volt-v0-evidence-ready", "unexpected protocolId");
  invariant(protocol.status === "approved", "protocol must be approved");
  invariant(protocol.source.issue === "https://github.com/JimmyMcBride/volt/issues/3", "protocol source Issue is wrong");

  equalSet(
    protocol.conditions.map((condition) => condition.id),
    ["volt_full", "static_obligations_erased", "alias_permissive", "diagnostics_plain"],
    "conditions"
  );
  const conditions = new Map(protocol.conditions.map((condition) => [condition.id, condition]));
  invariant(conditions.get("static_obligations_erased").bundledAblation === true, "static obligations must remain bundled");
  invariant(conditions.get("alias_permissive").canonicalSyntax === false, "alias condition must disable canonical-only syntax");
  invariant(conditions.get("diagnostics_plain").diagnostics === "plain_same_facts", "plain diagnostics must preserve facts");

  equalSet(
    protocol.descriptiveBaselines.map((baseline) => baseline.id),
    ["typescript_strict", "rust", "gleam"],
    "descriptive baselines"
  );
  invariant(protocol.descriptiveBaselines.every((baseline) => baseline.claimClass === "descriptive"), "external baselines must be descriptive");

  invariant(protocol.workload.confirmatoryTaskCount === 12, "confirmatory task count must be 12");
  invariant(protocol.workload.calibrationTaskCount === 4, "calibration task count must be 4");
  invariant(protocol.workload.calibrationIncludedInEvidence === false, "calibration cannot enter evidence");
  invariant(protocol.workload.networkAllowed === false, "network must be disabled");

  invariant(protocol.execution.modelFamilyCount === 2, "exactly two model families are required");
  invariant(protocol.execution.firstSubmissionMayRunCompilerOrTests === false, "first-pass tools must remain disabled");
  invariant(protocol.execution.repairTurnLimit === 3, "repair turn limit must be 3");
  invariant(protocol.execution.maxOutputTokensPerTurn === 4000, "per-turn token budget changed");
  invariant(protocol.execution.maxOutputTokensPerTrajectory === 16000, "trajectory token budget changed");
  invariant(protocol.execution.missingTrajectoryPolicy === "count_as_failure", "missing trajectories must be failures");

  equalSet(
    protocol.primaryEstimands.map((estimand) => estimand.id),
    ["static_obligation_effect", "canonical_syntax_effect", "structured_diagnostic_effect"],
    "primary estimands"
  );
  const estimands = new Map(protocol.primaryEstimands.map((estimand) => [estimand.id, estimand]));
  invariant(
    estimands.get("structured_diagnostic_effect").outcome === "hidden_test_repair_within_three_turns",
    "diagnostic estimand must measure repair"
  );
  invariant(
    estimands.get("structured_diagnostic_effect").firstPassOutcomeAllowed === false,
    "diagnostics cannot use a first-pass outcome"
  );

  equalSet(
    protocol.metrics.map((metric) => metric.id),
    ["obligation_coverage", "ast_shape_entropy", "ambient_dependency_count", "repair_locality"],
    "semantic-compression metrics"
  );
  invariant(protocol.metrics.every((metric) => metric.compositeEligible === false), "metrics cannot form a success composite");

  invariant(protocol.analysis.pooledEstimator === "equal_weight_mean_of_task_model_stratum_risk_differences", "pooled estimator changed");
  invariant(protocol.analysis.confidenceInterval.resamples === 10000, "bootstrap resamples must be 10,000");
  invariant(protocol.analysis.randomizationTest.permutations === 100000, "randomization permutations must be 100,000");
  invariant(protocol.analysis.multiplicity.method === "holm", "Holm correction is required");
  invariant(protocol.analysis.multiplicity.familyWiseAlpha === 0.05, "family-wise alpha must be .05");
  invariant(protocol.analysis.outcomeDependentExclusionsAllowed === false, "outcome-dependent exclusions are forbidden");

  invariant(protocol.power.calibrationTrajectoriesPerTaskModelCondition === 5, "calibration cell size must be 5");
  invariant(protocol.power.targetPower === 0.8, "target power must be 80%");
  invariant(protocol.power.detectableAbsoluteEffect === 0.1, "detectable effect must be 10 points");
  invariant(protocol.power.minimumConfirmatoryTrajectoriesPerTaskModelCondition === 20, "minimum confirmatory size must be 20");
  invariant(protocol.power.maximumConfirmatoryTrajectoriesPerTaskModelCondition === 60, "maximum confirmatory size must be 60");
  invariant(protocol.power.underpoweredNullMayFalsify === false, "an underpowered null cannot falsify");

  const guardrails = Object.fromEntries(
    protocol.complexityGuardrails.map((guardrail) => [guardrail.id, guardrail.threshold])
  );
  invariant(guardrails.non_test_source_lines === 25000, "source-line guardrail changed");
  invariant(guardrails.runtime_dependencies === 5, "dependency guardrail changed");
  invariant(guardrails.check_latency_p95 === 2, "check-latency guardrail changed");
  invariant(guardrails.diagnostic_serialization_latency_p95 === 50, "diagnostic-latency guardrail changed");
  invariant(guardrails.deterministic_execution_latency_p95 === 5, "execution-latency guardrail changed");

  invariant(protocol.decisionRules.meaningfulBenefit.minimumAbsoluteRiskDifference === 0.1, "meaningful effect changed");
  invariant(protocol.decisionRules.meaningfulBenefit.maximumHolmAdjustedPValueExclusive === 0.05, "significance gate changed");
  invariant(protocol.decisionRules.support.minimumMeaningfulPrimaryComparisons === 2, "support count changed");
  invariant(protocol.decisionRules.support.minimumMeaningfulLanguageComparisons === 1, "language-benefit gate changed");
  invariant(protocol.decisionRules.falsified.allPrimaryUpperConfidenceBoundsBelow === 0.1, "falsification bound changed");
  invariant(protocol.decisionRules.falsified.holmSignificantHarmAtOrBelow === -0.1, "harm threshold changed");

  invariant(
    protocol.claimBoundaries.humanAuditability === "deferred_pending_separately_approved_blinded_reviewer_study",
    "human auditability must remain deferred"
  );
  invariant(protocol.claimBoundaries.externalLanguageComparisons === "descriptive_only", "external baselines cannot become causal");
  invariant(protocol.claimBoundaries.semanticCompressionComposite === "prohibited_for_success_decision", "composite scoring is forbidden");
}

export function validateEvidenceMatrix(matrix) {
  invariant(matrix.schemaVersion === 1, "evidence matrix schemaVersion must be 1");
  equalSet(matrix.classifications, ["direct", "indirect", "counterevidence", "speculation"], "evidence classifications");

  const sourceIds = new Set();
  for (const source of matrix.sources) {
    invariant(!sourceIds.has(source.id), `duplicate source id: ${source.id}`);
    sourceIds.add(source.id);
    invariant(source.type.startsWith("primary_"), `${source.id} is not a primary source`);
    invariant(source.url.startsWith("https://"), `${source.id} must use an HTTPS source`);
  }

  const entryIds = new Set();
  const observedClassifications = new Set();
  for (const entry of matrix.entries) {
    invariant(!entryIds.has(entry.id), `duplicate evidence entry id: ${entry.id}`);
    entryIds.add(entry.id);
    observedClassifications.add(entry.classification);
    invariant(matrix.classifications.includes(entry.classification), `${entry.id} has an invalid classification`);
    invariant(entry.statement.length > 0, `${entry.id} has no statement`);
    invariant(entry.limitations.length > 0, `${entry.id} must state limitations`);
    if (entry.classification === "speculation") {
      invariant(entry.sourceIds.length === 0, `${entry.id} must not imply prior Volt evidence`);
    } else {
      invariant(entry.sourceIds.length > 0, `${entry.id} needs a primary source`);
    }
    for (const sourceId of entry.sourceIds) {
      invariant(sourceIds.has(sourceId), `${entry.id} references missing source ${sourceId}`);
    }
  }

  equalSet([...observedClassifications], matrix.classifications, "observed evidence classifications");
  return {
    sourceIds,
    entryIds
  };
}

export function validateTraceability(traceability, evidenceEntryIds) {
  invariant(traceability.schemaVersion === 1, "traceability schemaVersion must be 1");
  const nodeIds = new Set();
  for (const node of traceability.nodes) {
    invariant(!nodeIds.has(node.id), `duplicate traceability node: ${node.id}`);
    nodeIds.add(node.id);
  }

  const allIds = new Set([...nodeIds, ...evidenceEntryIds]);
  const edgeKeys = new Set();
  for (const edge of traceability.edges) {
    invariant(allIds.has(edge.from), `traceability edge has missing source: ${edge.from}`);
    invariant(allIds.has(edge.to), `traceability edge has missing target: ${edge.to}`);
    edgeKeys.add(`${edge.from}->${edge.to}`);
  }

  for (const entryId of evidenceEntryIds) {
    invariant(traceability.edges.some((edge) => edge.from === entryId), `${entryId} is not traced forward`);
  }

  for (const path of traceability.requiredPaths) {
    for (let index = 0; index < path.length - 1; index += 1) {
      invariant(edgeKeys.has(`${path[index]}->${path[index + 1]}`), `required trace path is broken at ${path[index]}`);
    }
  }
}

export function validateReportTemplate(report) {
  invariant(report.schemaVersion === 1, "report schemaVersion must be 1");
  invariant(report.status === "not_run", "report template must not imply results exist");
  invariant(report.protocolHash === null, "protocol is not frozen for confirmatory execution yet");
  equalSet(
    report.primaryComparisons.map((comparison) => comparison.id),
    ["static_obligation_effect", "canonical_syntax_effect", "structured_diagnostic_effect"],
    "report primary comparisons"
  );
  invariant(report.primaryComparisons.every((comparison) => comparison.pooled === null), "template cannot contain fabricated estimates");
  invariant(report.outcomeDependentOmissionAllowed === false, "report cannot omit outcomes selectively");
  for (const section of ["positiveResults", "negativeResults", "inconclusiveResults", "falsifyingResults"]) {
    invariant(Array.isArray(report[section]), `report is missing ${section}`);
  }
}

export function validateSchemaCoverage({ protocolSchema, manifestSchema, resultSchema, reportSchema }) {
  const protocolRequired = new Set(protocolSchema.required);
  for (const key of [
    "conditions",
    "primaryEstimands",
    "metrics",
    "analysis",
    "power",
    "controls",
    "complexityGuardrails",
    "decisionRules",
    "claimBoundaries"
  ]) {
    invariant(protocolRequired.has(key), `protocol schema does not require ${key}`);
  }

  invariant(manifestSchema.properties.frozenBeforeConfirmatory.const === true, "manifest must be frozen before confirmation");
  invariant(manifestSchema.properties.models.minItems === 2, "manifest must pin two models");
  invariant(resultSchema.properties.repairs.maxItems === 3, "result schema must cap repair turns");
  invariant(resultSchema.properties.task.properties.corpus.enum.includes("calibration"), "result schema must identify calibration data");
  invariant(resultSchema.properties.task.properties.corpus.enum.includes("confirmatory"), "result schema must identify confirmatory data");
  invariant(reportSchema.properties.outcomeDependentOmissionAllowed.const === false, "report schema must forbid selective omission");
}
