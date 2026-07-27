import assert from "node:assert/strict";
import test from "node:test";
import {
  changeReviewability,
  contractPropagationCompleteness,
  impactPredictionAccuracy,
  repositoryChangeSuccess,
  semanticBlastRadius,
  staleContractCount,
  unrelatedRegressionCount,
  unrequestedBehaviorChangeCount
} from "../lib/maintenance.mjs";

const successfulChange = {
  requestedBehaviorImplemented: true,
  contractPropagationComplete: true,
  hiddenTestsPass: true,
  effectDeclarationsAccurate: true,
  matchesExhaustive: true,
  guaranteesNotBypassed: true,
  unrelatedRegressionCount: 0,
  staleContractCount: 0,
  unrequestedBehaviorChangeCount: 0
};

test("repository change success requires requested behavior and every preservation criterion", () => {
  assert.deepEqual(repositoryChangeSuccess(successfulChange), {
    success: true,
    failedCriteria: []
  });
  assert.deepEqual(
    repositoryChangeSuccess({
      ...successfulChange,
      contractPropagationComplete: false,
      unrelatedRegressionCount: 1
    }),
    {
      success: false,
      failedCriteria: [
        "contract_propagation_complete",
        "unrelated_regression_count"
      ]
    }
  );
});

test("ADT extension propagation detects a forgotten match without blaming unrelated modules", () => {
  assert.deepEqual(
    contractPropagationCompleteness({
      expectedSites: [
        "domain.RegistrationState",
        "registrationService.describeState",
        "tests.registrationState"
      ],
      correctlyUpdatedSites: [
        "domain.RegistrationState",
        "tests.registrationState"
      ]
    }),
    {
      expectedCount: 3,
      correctlyUpdatedCount: 2,
      value: 2 / 3,
      missingSites: ["registrationService.describeState"],
      unexpectedSites: []
    }
  );
});

test("impact prediction uses deterministic symbol sets for callers and effect declarations", () => {
  assert.deepEqual(
    impactPredictionAccuracy({
      predictedSites: [
        "registrationService.register",
        "tests.registerNotifies",
        "capabilityInterfaces.Notification"
      ],
      actualRequiredSites: [
        "capabilityInterfaces.Notification",
        "registrationService.register",
        "registrationService.registerAll"
      ]
    }),
    {
      precision: 2 / 3,
      recall: 2 / 3,
      exactSetMatch: false,
      truePositiveCount: 2,
      falsePositives: ["tests.registerNotifies"],
      falseNegatives: ["registrationService.registerAll"]
    }
  );
});

test("semantic blast radius preserves dimensions and never invents a composite score", () => {
  const result = semanticBlastRadius({
    expectedImpact: {
      files: ["domain.volt", "registrationService.volt"],
      symbols: ["domain.Event", "registrationService.register"],
      contracts: ["domain.Event.capacity"],
      effects: [],
      astNodes: ["domain.Event.capacity", "registrationService.capacityCheck"]
    },
    actualImpact: {
      files: ["domain.volt", "registrationService.volt", "unrelated.volt"],
      symbols: ["domain.Event", "registrationService.register", "unrelated.format"],
      contracts: ["domain.Event.capacity"],
      effects: [],
      astNodes: ["domain.Event.capacity", "registrationService.capacityCheck", "unrelated.format.body"]
    }
  });

  assert.equal(result.compositeScore, null);
  assert.deepEqual(result.dimensions.files.unexpected, ["unrelated.volt"]);
  assert.deepEqual(result.dimensions.symbols.unexpected, ["unrelated.format"]);
  assert.deepEqual(result.dimensions.effects, {
    expectedCount: 0,
    actualCount: 0,
    unexpected: [],
    missing: []
  });
});

test("regression, stale-contract, and unrequested-change counts are distinct and sorted", () => {
  assert.deepEqual(unrelatedRegressionCount(["tests.clock", "tests.capacity"]), {
    count: 2,
    locations: ["tests.capacity", "tests.clock"]
  });
  assert.deepEqual(staleContractCount(["registrationService.register"]), {
    count: 1,
    locations: ["registrationService.register"]
  });
  assert.deepEqual(unrequestedBehaviorChangeCount([]), {
    count: 0,
    locations: []
  });
});

test("change reviewability is descriptive and reports unexplained or out-of-scope sites", () => {
  assert.deepEqual(
    changeReviewability({
      changedSites: ["domain.Event", "registrationService.register", "unrelated.format"],
      requestedImpactSites: ["domain.Event", "registrationService.register"],
      justificationBySite: {
        "domain.Event": "Extend the public event contract.",
        "registrationService.register": "Propagate the capacity invariant."
      }
    }),
    {
      changedSiteCount: 3,
      requestedSiteCount: 2,
      outsideRequestedImpact: ["unrelated.format"],
      unexplainedSites: ["unrelated.format"],
      attributionCoverage: 2 / 3,
      compositeScore: null
    }
  );
});

test("repair locality rejects malformed top-level file maps with a domain-specific error", async () => {
  const { repairLocality } = await import("../lib/metrics.mjs");
  assert.throws(
    () => repairLocality(null, {}),
    /firstFailedFiles must be a path-to-snapshot object/
  );
});
