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

test("Holm adjustment is monotone in sorted p-value order", () => {
  assert.deepEqual(holmAdjust(fixtures.holm.input), fixtures.holm.expected);
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

test("significant harm follows the approved effect and Holm gates", () => {
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
    assert.equal(classifyThesis(fixture).classification, fixture.expected);
  });
}

test("an incomplete confirmatory study cannot produce a thesis decision", () => {
  assert.equal(
    classifyThesis({
      ...fixtures.supported,
      confirmatoryComplete: false
    }).classification,
    "not_run"
  );
});

test("a preregistered validity failure is inconclusive", () => {
  assert.equal(
    classifyThesis({
      ...fixtures.supported,
      validityFailure: true
    }).classification,
    "inconclusive"
  );
});

test("a harmful model family blocks otherwise supported pooled results", () => {
  const result = classifyThesis({
    ...fixtures.supported,
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
