function invariant(condition, message) {
  if (!condition) {
    throw new TypeError(message);
  }
}

function validateProbability(value, name) {
  invariant(typeof value === "number" && value >= 0 && value <= 1, `${name} must be between 0 and 1`);
}

function validateComparison(comparison) {
  invariant(typeof comparison.id === "string" && comparison.id.length > 0, "comparison.id is required");
  invariant(comparison.kind === "language" || comparison.kind === "diagnostic", "comparison.kind is invalid");
  for (const key of ["pointEstimate", "ciLower", "ciUpper"]) {
    invariant(typeof comparison[key] === "number", `comparison.${key} must be numeric`);
  }
  validateProbability(comparison.adjustedPValue, "comparison.adjustedPValue");
  invariant(comparison.ciLower <= comparison.ciUpper, "comparison confidence interval is reversed");
}

export function holmAdjust(tests) {
  invariant(Array.isArray(tests) && tests.length > 0, "tests must be a non-empty array");
  const ids = new Set();
  const ordered = tests.map((test, originalIndex) => {
    invariant(typeof test.id === "string" && test.id.length > 0, "test.id is required");
    invariant(!ids.has(test.id), `duplicate test id: ${test.id}`);
    ids.add(test.id);
    validateProbability(test.pValue, `pValue for ${test.id}`);
    return {
      ...test,
      originalIndex
    };
  }).sort((left, right) => left.pValue - right.pValue || left.originalIndex - right.originalIndex);

  let runningMaximum = 0;
  const adjustedById = new Map();
  ordered.forEach((test, index) => {
    const adjusted = Math.min(1, (ordered.length - index) * test.pValue);
    runningMaximum = Math.max(runningMaximum, adjusted);
    adjustedById.set(test.id, runningMaximum);
  });

  return tests.map((test) => ({
    id: test.id,
    pValue: test.pValue,
    adjustedPValue: adjustedById.get(test.id)
  }));
}

export function isMeaningfulBenefit(comparison) {
  validateComparison(comparison);
  return (
    comparison.pointEstimate >= 0.1 &&
    comparison.ciLower > 0 &&
    comparison.adjustedPValue < 0.05
  );
}

export function isSignificantHarm(comparison) {
  validateComparison(comparison);
  return (
    comparison.pointEstimate <= -0.1 &&
    comparison.adjustedPValue < 0.05
  );
}

export function classifyThesis({
  confirmatoryComplete,
  validityFailure,
  comparisons,
  modelEffects,
  complexityGuardrails
}) {
  invariant(typeof confirmatoryComplete === "boolean", "confirmatoryComplete must be boolean");
  invariant(typeof validityFailure === "boolean", "validityFailure must be boolean");
  invariant(Array.isArray(comparisons) && comparisons.length === 3, "exactly three primary comparisons are required");
  invariant(Array.isArray(modelEffects), "modelEffects must be an array");
  invariant(Array.isArray(complexityGuardrails) && complexityGuardrails.length > 0, "complexityGuardrails are required");
  comparisons.forEach(validateComparison);

  if (!confirmatoryComplete) {
    return {
      classification: "not_run",
      reasons: ["confirmatory_study_incomplete"]
    };
  }

  const unresolvedGuardrails = complexityGuardrails
    .filter((guardrail) => guardrail.passed !== true)
    .map((guardrail) => guardrail.id);
  if (unresolvedGuardrails.length > 0) {
    return {
      classification: "falsified",
      reasons: unresolvedGuardrails.map((id) => `unresolved_complexity_guardrail:${id}`)
    };
  }

  if (validityFailure) {
    return {
      classification: "inconclusive",
      reasons: ["preregistered_validity_failure"]
    };
  }

  const harmfulComparisons = comparisons.filter(isSignificantHarm);
  if (harmfulComparisons.length > 0) {
    return {
      classification: "falsified",
      reasons: harmfulComparisons.map((comparison) => `holm_significant_harm:${comparison.id}`)
    };
  }

  if (comparisons.every((comparison) => comparison.ciUpper < 0.1)) {
    return {
      classification: "falsified",
      reasons: ["all_primary_upper_confidence_bounds_below_meaningful_effect"]
    };
  }

  const meaningful = comparisons.filter(isMeaningfulBenefit);
  const meaningfulIds = new Set(meaningful.map((comparison) => comparison.id));
  const harmfulModelEffects = modelEffects.filter(
    (effect) => meaningfulIds.has(effect.comparisonId) && effect.pointEstimate <= -0.1
  );
  const meaningfulLanguageComparisons = meaningful.filter((comparison) => comparison.kind === "language");

  if (
    meaningful.length >= 2 &&
    meaningfulLanguageComparisons.length >= 1 &&
    harmfulModelEffects.length === 0
  ) {
    return {
      classification: "supported",
      reasons: meaningful.map((comparison) => `meaningful_benefit:${comparison.id}`)
    };
  }

  const uncertaintySpansNoAndMeaningfulBenefit = comparisons.some(
    (comparison) => comparison.ciLower <= 0 && comparison.ciUpper >= 0.1
  );
  if (uncertaintySpansNoAndMeaningfulBenefit) {
    return {
      classification: "inconclusive",
      reasons: ["powered_interval_spans_no_and_meaningful_benefit"]
    };
  }

  const reasons = [];
  if (meaningful.length === 1) {
    reasons.push("exactly_one_meaningful_primary_comparison");
  }
  if (meaningful.length === 0) {
    reasons.push("no_meaningful_primary_comparison_without_falsification");
  }
  if (harmfulModelEffects.length > 0) {
    reasons.push(...harmfulModelEffects.map((effect) => `harmful_model_family_effect:${effect.comparisonId}:${effect.modelId}`));
  }

  return {
    classification: "weakened",
    reasons
  };
}
