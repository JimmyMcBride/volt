function invariant(condition, message) {
  if (!condition) {
    throw new TypeError(message);
  }
}

function stableStringSet(values, name) {
  invariant(Array.isArray(values), `${name} must be an array`);
  const seen = new Set();
  for (const [index, value] of values.entries()) {
    invariant(typeof value === "string" && value.length > 0, `${name}[${index}] must be a non-empty string`);
    invariant(!seen.has(value), `${name} contains duplicate ${value}`);
    seen.add(value);
  }
  return [...seen].sort();
}

function difference(left, right) {
  const rightSet = new Set(right);
  return left.filter((value) => !rightSet.has(value));
}

function intersection(left, right) {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value));
}

function countLocations(locationIds, name) {
  const locations = stableStringSet(locationIds, name);
  return {
    count: locations.length,
    locations
  };
}

export function repositoryChangeSuccess({
  requestedBehaviorImplemented,
  contractPropagationComplete,
  hiddenTestsPass,
  effectDeclarationsAccurate,
  matchesExhaustive,
  guaranteesNotBypassed,
  unrelatedRegressionCount,
  staleContractCount,
  unrequestedBehaviorChangeCount
}) {
  const booleanCriteria = {
    requested_behavior_implemented: requestedBehaviorImplemented,
    contract_propagation_complete: contractPropagationComplete,
    hidden_tests_pass: hiddenTestsPass,
    effect_declarations_accurate: effectDeclarationsAccurate,
    matches_exhaustive: matchesExhaustive,
    guarantees_not_bypassed: guaranteesNotBypassed
  };
  for (const [name, value] of Object.entries(booleanCriteria)) {
    invariant(typeof value === "boolean", `${name} must be boolean`);
  }

  const countCriteria = {
    unrelated_regression_count: unrelatedRegressionCount,
    stale_contract_count: staleContractCount,
    unrequested_behavior_change_count: unrequestedBehaviorChangeCount
  };
  for (const [name, value] of Object.entries(countCriteria)) {
    invariant(Number.isInteger(value) && value >= 0, `${name} must be a non-negative integer`);
  }

  const failedCriteria = [
    ...Object.entries(booleanCriteria)
      .filter(([, passed]) => !passed)
      .map(([name]) => name),
    ...Object.entries(countCriteria)
      .filter(([, count]) => count !== 0)
      .map(([name]) => name)
  ].sort();

  return {
    success: failedCriteria.length === 0,
    failedCriteria
  };
}

export function contractPropagationCompleteness({
  expectedSites,
  correctlyUpdatedSites
}) {
  const expected = stableStringSet(expectedSites, "expectedSites");
  const updated = stableStringSet(correctlyUpdatedSites, "correctlyUpdatedSites");
  const correctlyUpdated = intersection(expected, updated);
  const missingSites = difference(expected, updated);
  const unexpectedSites = difference(updated, expected);

  return {
    expectedCount: expected.length,
    correctlyUpdatedCount: correctlyUpdated.length,
    value: expected.length === 0 ? 1 : correctlyUpdated.length / expected.length,
    missingSites,
    unexpectedSites
  };
}

export function unrelatedRegressionCount(locationIds) {
  return countLocations(locationIds, "unrelatedRegressionLocations");
}

export function staleContractCount(contractIds) {
  return countLocations(contractIds, "staleContractIds");
}

export function unrequestedBehaviorChangeCount(changeIds) {
  return countLocations(changeIds, "unrequestedBehaviorChangeIds");
}

const BLAST_RADIUS_DIMENSIONS = [
  "files",
  "symbols",
  "contracts",
  "effects",
  "astNodes"
];

function validateImpactSurface(surface, name) {
  invariant(surface !== null && typeof surface === "object" && !Array.isArray(surface), `${name} must be an object`);
  const keys = Object.keys(surface).sort();
  invariant(
    keys.length === BLAST_RADIUS_DIMENSIONS.length &&
      BLAST_RADIUS_DIMENSIONS.every((dimension) => keys.includes(dimension)),
    `${name} must contain exactly ${BLAST_RADIUS_DIMENSIONS.join(", ")}`
  );
  return Object.fromEntries(
    BLAST_RADIUS_DIMENSIONS.map((dimension) => [
      dimension,
      stableStringSet(surface[dimension], `${name}.${dimension}`)
    ])
  );
}

export function semanticBlastRadius({ expectedImpact, actualImpact }) {
  const expected = validateImpactSurface(expectedImpact, "expectedImpact");
  const actual = validateImpactSurface(actualImpact, "actualImpact");

  return {
    dimensions: Object.fromEntries(
      BLAST_RADIUS_DIMENSIONS.map((dimension) => [
        dimension,
        {
          expectedCount: expected[dimension].length,
          actualCount: actual[dimension].length,
          unexpected: difference(actual[dimension], expected[dimension]),
          missing: difference(expected[dimension], actual[dimension])
        }
      ])
    ),
    compositeScore: null
  };
}

export function impactPredictionAccuracy({
  predictedSites,
  actualRequiredSites
}) {
  const predicted = stableStringSet(predictedSites, "predictedSites");
  const actual = stableStringSet(actualRequiredSites, "actualRequiredSites");
  const truePositives = intersection(predicted, actual);
  const falsePositives = difference(predicted, actual);
  const falseNegatives = difference(actual, predicted);

  return {
    precision: predicted.length === 0 ? (actual.length === 0 ? 1 : null) : truePositives.length / predicted.length,
    recall: actual.length === 0 ? 1 : truePositives.length / actual.length,
    exactSetMatch: falsePositives.length === 0 && falseNegatives.length === 0,
    truePositiveCount: truePositives.length,
    falsePositives,
    falseNegatives
  };
}

export function changeReviewability({
  changedSites,
  requestedImpactSites,
  justificationBySite
}) {
  const changed = stableStringSet(changedSites, "changedSites");
  const requested = stableStringSet(requestedImpactSites, "requestedImpactSites");
  invariant(
    justificationBySite !== null && typeof justificationBySite === "object" && !Array.isArray(justificationBySite),
    "justificationBySite must be an object"
  );

  const justifiedSites = changed.filter((site) => {
    const justification = justificationBySite[site];
    return typeof justification === "string" && justification.length > 0;
  });

  return {
    changedSiteCount: changed.length,
    requestedSiteCount: requested.length,
    outsideRequestedImpact: difference(changed, requested),
    unexplainedSites: difference(changed, justifiedSites),
    attributionCoverage: changed.length === 0 ? 1 : justifiedSites.length / changed.length,
    compositeScore: null
  };
}
