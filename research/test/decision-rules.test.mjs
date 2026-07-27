import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  classifyThesis,
  holmAdjust,
  isMeaningfulBenefit,
  isSignificantHarm
} from "../lib/decision-rules.mjs";

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "decision-cases.json"
);
const fixtures = JSON.parse(await readFile(fixturePath, "utf8"));

const maintenanceComparisons = [
  {
    id: "static_obligation_maintenance_effect",
    kind: "language",
    pointEstimate: 0.12,
    ciLower: 0.02,
    ciUpper: 0.2,
    adjustedPValue: 0.01
  },
  {
    id: "canonical_syntax_maintenance_effect",
    kind: "language",
    pointEstimate: 0.04,
    ciLower: 0.01,
    ciUpper: 0.09,
    adjustedPValue: 0.2
  },
  {
    id: "structured_diagnostic_maintenance_effect",
    kind: "diagnostic",
    pointEstimate: 0.03,
    ciLower: 0,
    ciUpper: 0.09,
    adjustedPValue: 0.3
  }
];

function amendedFixture(fixture) {
  return {
    ...fixture,
    maintenanceComparisons
  };
}

test("Holm adjustment is monotone in sorted p-value order", () => {
  const input = [
    ...fixtures.holm.input,
    { id: "maintenance-static", pValue: 0.05 },
    { id: "maintenance-syntax", pValue: 0.06 },
    { id: "maintenance-diagnostics", pValue: 0.07 }
  ];
  assert.deepEqual(
    holmAdjust(input).map(({ adjustedPValue }) => adjustedPValue),
    [0.06, 0.15, 0.16, 0.16, 0.16, 0.16]
  );
});

test("meaningful benefit requires effect, interval, and adjusted significance gates", () => {
  const comparison = fixtures.supported.comparisons[0];
  assert.equal(isMeaningfulBenefit(comparison), true);
  assert.equal(isMeaningfulBenefit({
    ...comparison,
    ciLower: 0
  }), false);
  assert.equal(isMeaningfulBenefit({
    ...comparison,
    adjustedPValue: 0.05
  }), false);
});

test("significant harm follows the approved amended effect and Holm gates", () => {
  assert.equal(isSignificantHarm({
    id: "static_obligation_effect",
    kind: "language",
    pointEstimate: -0.1,
    ciLower: -0.2,
    ciUpper: 0.01,
    adjustedPValue: 0.049
  }), true);
});

for (const fixtureName of [
  "supported",
  "weakened",
  "inconclusive",
  "falsifiedByBounds",
  "falsifiedByHarm",
  "falsifiedByGuardrail"
]) {
  test(`thesis decision fixture: ${fixtureName}`, () => {
    const fixture = fixtures[fixtureName];
    assert.equal(classifyThesis(amendedFixture(fixture)).classification, fixture.expected);
  });
}

test("an incomplete confirmatory study cannot produce a thesis decision", () => {
  assert.equal(
    classifyThesis({
      ...amendedFixture(fixtures.supported),
      confirmatoryComplete: false
    }).classification,
    "not_run"
  );
});

test("a preregistered validity failure is inconclusive", () => {
  assert.equal(
    classifyThesis({
      ...amendedFixture(fixtures.supported),
      validityFailure: true
    }).classification,
    "inconclusive"
  );
});

test("a harmful model family blocks otherwise supported pooled results", () => {
  const result = classifyThesis({
    ...amendedFixture(fixtures.supported),
    modelEffects: [
      ...fixtures.supported.modelEffects,
      {
        comparisonId: "canonical_syntax_effect",
        modelId: "open_weight",
        pointEstimate: -0.1
      }
    ]
  });
  assert.equal(result.classification, "weakened");
  assert(result.reasons.some((reason) => reason.startsWith("harmful_model_family_effect:")));
});

test("support requires a meaningful maintenance-language result", () => {
  const result = classifyThesis({
    ...amendedFixture(fixtures.supported),
    maintenanceComparisons: maintenanceComparisons.map((comparison) => ({
      ...comparison,
      pointEstimate: 0.04,
      ciLower: 0,
      ciUpper: 0.12,
      adjustedPValue: 0.2
    }))
  });
  assert.equal(result.classification, "inconclusive");
  assert(result.reasons.includes("powered_interval_spans_no_and_meaningful_benefit"));
});
