import { holmAdjust, classifyThesis } from "../../research/lib/decision-rules.mjs";
import {
  ambientDependencyCount,
  astShapeEntropy,
  obligationCoverage,
  repairLocality
} from "../../research/lib/metrics.mjs";
import {
  changeReviewability,
  contractPropagationCompleteness,
  impactPredictionAccuracy,
  semanticBlastRadius,
  staleContractCount,
  unrelatedRegressionCount,
  unrequestedBehaviorChangeCount
} from "../../research/lib/maintenance.mjs";
import { contentHash, seededRandom } from "./stable.mjs";

function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function quantile(values, probability) {
  const ordered = [...values].sort((left, right) => left - right);
  if (ordered.length === 0) return 0;
  const index = Math.min(ordered.length - 1, Math.max(0, Math.floor(probability * ordered.length)));
  return ordered[index];
}

function outcome(record, outcomeId) {
  if (record.status !== "completed") return 0;
  if (outcomeId === "first_submission_hidden_test_pass") {
    return record.firstSubmission?.hiddenTestPass === true ? 1 : 0;
  }
  if (outcomeId === "hidden_test_repair_within_three_turns") {
    return (
      record.firstSubmission?.hiddenTestPass === false &&
      record.repairs.some((repair) => repair.turn <= 3 && repair.hiddenTestPass)
    ) ? 1 : 0;
  }
  if (outcomeId === "repository_change_success_rate") {
    return record.maintenanceEvaluations?.firstSubmission?.repositoryChangeSuccess === true ? 1 : 0;
  }
  if (outcomeId === "repository_change_success_within_three_turns") {
    return (
      record.maintenanceEvaluations?.firstSubmission?.repositoryChangeSuccess === false &&
      record.maintenanceEvaluations?.finalSubmission?.repositoryChangeSuccess === true &&
      record.repairs.length > 0 &&
      record.repairs.at(-1).turn <= 3
    ) ? 1 : 0;
  }
  throw new TypeError(`unknown outcome: ${outcomeId}`);
}

function stratumKey(record) {
  return `${record.task.id}\0${record.modelId}`;
}

function diagnosticCohort(records, estimand) {
  if (estimand.kind !== "diagnostic") return records;
  const hashes = new Map();
  for (const record of records) {
    const hash = record.firstSubmission?.sourceHash;
    if (hash === undefined) continue;
    const key = `${stratumKey(record)}\0${record.replicate}\0${hash}`;
    const conditions = hashes.get(key) ?? new Set();
    conditions.add(record.condition);
    hashes.set(key, conditions);
  }
  const eligible = new Set(
    [...hashes.entries()]
      .filter(([, conditions]) => conditions.has(estimand.treatment) && conditions.has(estimand.control))
      .map(([key]) => key)
  );
  return records.filter((record) => {
    const hash = record.firstSubmission?.sourceHash;
    if (hash === undefined) return false;
    return eligible.has(`${stratumKey(record)}\0${record.replicate}\0${hash}`);
  });
}

function stratumDifferences(records, estimand) {
  const eligible = diagnosticCohort(
    records.filter((record) => record.condition === estimand.treatment || record.condition === estimand.control),
    estimand
  );
  const strata = new Map();
  for (const record of eligible) {
    const key = stratumKey(record);
    const entry = strata.get(key) ?? {
      taskId: record.task.id,
      family: record.task.family,
      modelId: record.modelId,
      treatment: [],
      control: []
    };
    entry[record.condition === estimand.treatment ? "treatment" : "control"]
      .push(outcome(record, estimand.outcome));
    strata.set(key, entry);
  }
  return [...strata.values()]
    .filter((stratum) => stratum.treatment.length > 0 && stratum.control.length > 0)
    .map((stratum) => ({
      ...stratum,
      difference: mean(stratum.treatment) - mean(stratum.control)
    }));
}

function estimateFromStrata(strata) {
  return mean(strata.map((stratum) => stratum.difference));
}

function bootstrap(strata, resamples, seed) {
  const taskIds = [...new Set(strata.map((stratum) => stratum.taskId))].sort();
  const byTask = new Map(taskIds.map((taskId) => [
    taskId,
    strata.filter((stratum) => stratum.taskId === taskId)
  ]));
  const random = seededRandom(seed);
  const resampleValues = (values) => Array.from(
    { length: values.length },
    () => values[Math.floor(random() * values.length)]
  );
  const estimates = [];
  for (let iteration = 0; iteration < resamples; iteration += 1) {
    const sampled = [];
    for (let index = 0; index < taskIds.length; index += 1) {
      const task = taskIds[Math.floor(random() * taskIds.length)];
      sampled.push(...byTask.get(task).map((stratum) => {
        const treatment = resampleValues(stratum.treatment);
        const control = resampleValues(stratum.control);
        return {
          ...stratum,
          treatment,
          control,
          difference: mean(treatment) - mean(control)
        };
      }));
    }
    estimates.push(estimateFromStrata(sampled));
  }
  return {
    lower: quantile(estimates, 0.025),
    upper: quantile(estimates, 0.975)
  };
}

function randomizationPValue(strata, permutations, seed) {
  const observed = Math.abs(estimateFromStrata(strata));
  const random = seededRandom(seed);
  let atLeastObserved = 0;
  for (let iteration = 0; iteration < permutations; iteration += 1) {
    const randomized = strata.map((stratum) => ({
      ...stratum,
      difference: random() < 0.5 ? stratum.difference : -stratum.difference
    }));
    if (Math.abs(estimateFromStrata(randomized)) >= observed - Number.EPSILON) atLeastObserved += 1;
  }
  return (atLeastObserved + 1) / (permutations + 1);
}

export function analyzeEstimand(
  records,
  estimand,
  { bootstrapResamples = 10_000, permutations = 100_000, seed = 17 } = {}
) {
  const strata = stratumDifferences(records, estimand);
  if (strata.length === 0) throw new TypeError(`no complete strata for ${estimand.id}`);
  const pointEstimate = estimateFromStrata(strata);
  const interval = bootstrap(strata, bootstrapResamples, seed);
  const pValue = randomizationPValue(strata, permutations, seed + 1);
  const perModel = Object.fromEntries(
    [...new Set(strata.map((stratum) => stratum.modelId))].sort().map((modelId) => [
      modelId,
      estimateFromStrata(strata.filter((stratum) => stratum.modelId === modelId))
    ])
  );
  const perTaskFamily = Object.fromEntries(
    [...new Set(strata.map((stratum) => stratum.family))].sort().map((family) => [
      family,
      estimateFromStrata(strata.filter((stratum) => stratum.family === family))
    ])
  );
  return {
    id: estimand.id,
    kind: estimand.kind,
    treatment: estimand.treatment,
    control: estimand.control,
    outcome: estimand.outcome,
    pointEstimate,
    ciLower: interval.lower,
    ciUpper: interval.upper,
    pValue,
    strata: strata.length,
    perModel,
    perTaskFamily
  };
}

export function analyzeSixPrimaryComparisons(
  records,
  protocol,
  options = {}
) {
  const comparisons = protocol.primaryEstimands.map((estimand, index) =>
    analyzeEstimand(records, estimand, { ...options, seed: (options.seed ?? 17) + index * 101 })
  );
  const adjusted = new Map(
    holmAdjust(comparisons.map(({ id, pValue }) => ({ id, pValue })))
      .map((comparison) => [comparison.id, comparison.adjustedPValue])
  );
  return comparisons.map((comparison) => ({
    ...comparison,
    adjustedPValue: adjusted.get(comparison.id)
  }));
}

function normalCdf(value) {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const erf = sign * (
    1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t +
      0.254829592) * t * Math.exp(-x * x)
  );
  return 0.5 * (1 + erf);
}

export function selectPoweredSampleSize({
  baselineRate,
  detectableEffect = 0.1,
  targetPower = 0.8,
  minimum = 20,
  maximum = 60,
  familySize = 6,
  strata = 24,
  taskVariance = 0
}) {
  if (!(baselineRate >= 0 && baselineRate <= 1)) throw new TypeError("baselineRate must be a probability");
  if (familySize !== 6) throw new TypeError("the frozen Holm family contains exactly six comparisons");
  const treatmentRate = Math.min(1, baselineRate + detectableEffect);
  const holmCriticalZ = 2.638257273476751;
  for (let sampleSize = minimum; sampleSize <= maximum; sampleSize += 1) {
    const baseVariance =
      baselineRate * (1 - baselineRate) / (sampleSize * strata) +
      treatmentRate * (1 - treatmentRate) / (sampleSize * strata);
    const standardError = Math.sqrt(baseVariance + taskVariance / strata);
    const power = standardError === 0
      ? 1
      : normalCdf(detectableEffect / standardError - holmCriticalZ);
    if (power >= targetPower) {
      return {
        feasible: true,
        trajectoriesPerTaskModelCondition: sampleSize,
        estimatedPower: power,
        familySize,
        strata,
        holmAdjusted: true
      };
    }
  }
  const maximumVariance =
    baselineRate * (1 - baselineRate) / (maximum * strata) +
    treatmentRate * (1 - treatmentRate) / (maximum * strata);
  const maximumStandardError = Math.sqrt(maximumVariance + taskVariance / strata);
  return {
    feasible: false,
    trajectoriesPerTaskModelCondition: null,
    estimatedPower: maximumStandardError === 0
      ? 1
      : normalCdf(detectableEffect / maximumStandardError - holmCriticalZ),
    familySize,
    strata,
    holmAdjusted: true,
    decision: "declare_infeasible_and_reapprove"
  };
}

export function selectCalibrationPowerRecommendation(endpoints) {
  if (!Array.isArray(endpoints) || endpoints.length !== 6) {
    throw new TypeError("calibration power selection requires exactly six endpoints");
  }
  const ids = new Set();
  const results = [];
  for (const endpoint of endpoints) {
    if (typeof endpoint.id !== "string" || endpoint.id.length === 0 || ids.has(endpoint.id)) {
      throw new TypeError("calibration power endpoints require unique non-empty ids");
    }
    ids.add(endpoint.id);
    if (!Number.isInteger(endpoint.eligibleCount) || endpoint.eligibleCount <= 0) {
      return {
        feasible: false,
        trajectoriesPerTaskModelCondition: null,
        decision: "declare_infeasible_and_reapprove",
        reason: `endpoint ${endpoint.id} has no estimable eligible cohort`,
        endpoints: []
      };
    }
    const result = selectPoweredSampleSize({
      baselineRate: endpoint.baselineRate,
      taskVariance: endpoint.taskVariance ?? 0,
      detectableEffect: 0.1,
      targetPower: 0.8,
      minimum: 20,
      maximum: 60,
      familySize: 6,
      strata: 24
    });
    results.push({ id: endpoint.id, ...result });
  }
  if (results.some((result) => !result.feasible)) {
    return {
      feasible: false,
      trajectoriesPerTaskModelCondition: null,
      decision: "declare_infeasible_and_reapprove",
      reason: "at least one endpoint requires more than 60 trajectories per task/model/condition",
      endpoints: results
    };
  }
  const recommendation = Math.max(
    ...results.map((result) => result.trajectoriesPerTaskModelCondition)
  );
  return {
    feasible: true,
    trajectoriesPerTaskModelCondition: recommendation,
    decision: "eligible_for_confirmatory_authorization_review",
    endpoints: results,
    calibrationEffectsAreEvidence: false
  };
}

export function computeOperationalMeasurements(input) {
  const measurements = {
    obligation_coverage: obligationCoverage(input.obligationFixtures),
    ast_shape_entropy: astShapeEntropy(input.astShapeHashes),
    ambient_dependency_count: ambientDependencyCount(input.dependencies),
    repair_locality: repairLocality(input.firstFailedFiles, input.firstPassingFiles),
    contract_propagation_completeness: contractPropagationCompleteness(input.contractPropagation),
    unrelated_regression_count: unrelatedRegressionCount(input.unrelatedRegressions),
    semantic_blast_radius: semanticBlastRadius(input.semanticBlastRadius),
    impact_prediction_accuracy: impactPredictionAccuracy(input.impactPrediction),
    stale_contract_count: staleContractCount(input.staleContracts),
    unrequested_behavior_change_count: unrequestedBehaviorChangeCount(input.unrequestedChanges),
    change_reviewability: changeReviewability(input.reviewability)
  };
  return {
    composite: null,
    compositeEligible: false,
    measurements
  };
}

export function evaluateComplexityGuardrails(guardrails, observations) {
  return guardrails.map((guardrail) => {
    if (guardrail.comparison !== "maximum") {
      throw new TypeError(`unsupported complexity comparison: ${guardrail.comparison}`);
    }
    const observed = observations[guardrail.id];
    if (!Number.isFinite(observed) || observed < 0) {
      throw new TypeError(`missing non-negative observation for ${guardrail.id}`);
    }
    return {
      id: guardrail.id,
      observed,
      threshold: guardrail.threshold,
      unit: guardrail.unit,
      passed: observed <= guardrail.threshold
    };
  });
}

export function buildStudyReport({
  protocol,
  causalRecords,
  calibrationRecords,
  descriptiveRecords,
  complexityGuardrails,
  validityFailure = false,
  analysisOptions = {}
}) {
  const comparisons = analyzeSixPrimaryComparisons(causalRecords, protocol, analysisOptions);
  const firstPass = comparisons.slice(0, 3);
  const maintenance = comparisons.slice(3);
  const modelEffects = comparisons.flatMap((comparison) =>
    Object.entries(comparison.perModel).map(([modelId, pointEstimate]) => ({
      comparisonId: comparison.id,
      modelId,
      pointEstimate
    }))
  );
  const decision = classifyThesis({
    confirmatoryComplete: true,
    validityFailure,
    comparisons: firstPass,
    maintenanceComparisons: maintenance,
    modelEffects,
    complexityGuardrails
  });
  const report = {
    schemaVersion: 1,
    protocolId: protocol.protocolId,
    protocolVersion: protocol.version,
    namespaces: {
      causalVolt: {
        trajectoryCount: causalRecords.length,
        comparisons
      },
      calibration: {
        trajectoryCount: calibrationRecords.length,
        excludedFromConfirmatoryEstimates: true
      },
      descriptiveBaselines: {
        trajectoryCount: descriptiveRecords.length,
        claimClass: "descriptive"
      }
    },
    decision,
    complexityGuardrails,
    compositeScore: null
  };
  return { ...report, reportHash: contentHash(report) };
}
