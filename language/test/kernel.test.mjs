import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  validateBenchmarkCoverage,
  validateBoundaries,
  validateConformanceManifest,
  validateConformanceRules,
  validateFormatterGoldens,
  validateKernel,
  validatePublicChangeFixtures
} from "../lib/kernel-validation.mjs";

const root = resolve(import.meta.dirname, "../..");

async function readJson(path) {
  return JSON.parse(await readFile(resolve(root, path), "utf8"));
}

const kernel = await readJson("language/kernel/kernel-v0.json");
const grammar = await readFile(resolve(root, "language/grammar/volt-v0.ebnf"), "utf8");
const schema = await readJson("language/schema/kernel.schema.json");
const protocol = await readJson("research/protocol/protocol-v1.json");
const conformance = await readJson("language/conformance/manifest.json");
const rules = await readJson("language/conformance/rules.json");
const boundaries = await readJson("language/conformance/boundaries.json");
const formatterGoldens = await readJson("language/formatter/golden.json");
const publicChanges = await readJson("language/public-change/fixtures.json");
const coverage = await readJson("language/benchmark/coverage.json");
const fixtureContents = new Map(
  await Promise.all(
    [...conformance.accepted, ...conformance.rejected].map(async (fixture) => [
      fixture.path,
      await readFile(resolve(root, fixture.path), "utf8")
    ])
  )
);

function clone(value) {
  return structuredClone(value);
}

test("approved kernel, grammar, schema, and protocol remain compatible", () => {
  assert.deepEqual(validateKernel({ kernel, grammar, schema, protocol }), {
    kernelId: "volt-v0",
    features: 15,
    publicChanges: 5
  });
});

test("accepted and rejected source fixtures are content-addressed", () => {
  assert.deepEqual(validateConformanceManifest(kernel, conformance, fixtureContents), {
    accepted: 7,
    rejected: 12
  });
});

test("every grammar production and approved static-rule category has fixture evidence", () => {
  assert.deepEqual(validateConformanceRules(grammar, conformance, rules), {
    grammarProductions: 44,
    staticRules: 25,
    rejectedCategories: 34
  });
});

test("every deferred and excluded feature has an explicit rejection fixture", () => {
  assert.deepEqual(validateBoundaries(kernel, boundaries), {
    deferred: 18,
    excluded: 13
  });
});

test("formatter goldens freeze canonical ordering, spacing, and line endings", () => {
  assert.deepEqual(validateFormatterGoldens(kernel, formatterGoldens), { cases: 3 });
});

test("each public-change category has a deterministic affected declaration fixture", () => {
  assert.deepEqual(validatePublicChangeFixtures(kernel, publicChanges), { cases: 5 });
});

test("all twelve protocol workload slots map only to approved kernel features", () => {
  assert.deepEqual(validateBenchmarkCoverage(kernel, protocol, coverage), {
    cases: 12,
    families: 4
  });
});

test("kernel status drift is rejected", () => {
  const changed = clone(kernel);
  changed.status = "draft";
  assert.throws(
    () => validateKernel({ kernel: changed, grammar, schema, protocol }),
    /kernel must remain approved/
  );
});

test("effect exactness drift is rejected", () => {
  const changed = clone(kernel);
  changed.effects.setsExact = false;
  assert.throws(
    () => validateKernel({ kernel: changed, grammar, schema, protocol }),
    /effect sets must be exact/
  );
});

test("unknown benchmark features are rejected", () => {
  const changed = clone(coverage);
  changed.cases[0].requiredFeatures = ["closed_adts", "future_feature"];
  assert.throws(
    () => validateBenchmarkCoverage(kernel, protocol, changed),
    /feature outside the approved kernel/
  );
});

test("unstable affected declaration ordering is rejected", () => {
  const changed = clone(publicChanges);
  changed.cases[0].affectedStableIds.reverse();
  assert.throws(
    () => validatePublicChangeFixtures(kernel, changed),
    /must be lexicographically sorted/
  );
});

test("missing rejection categories are rejected", () => {
  const changed = clone(conformance);
  changed.rejected.pop();
  assert.throws(
    () => validateConformanceManifest(kernel, changed, fixtureContents),
    /rejected fixture codes does not match/
  );
});

test("missing deferred feature boundaries are rejected", () => {
  const changed = clone(boundaries);
  changed.deferred.pop();
  assert.throws(
    () => validateBoundaries(kernel, changed),
    /deferred boundary fixtures does not match/
  );
});

test("formatter effect ordering drift is rejected", () => {
  const changed = clone(formatterGoldens);
  changed.cases[0].expected = changed.cases[0].expected.replace(
    "uses {Clock, RegistrationStore}",
    "uses {RegistrationStore, Clock}"
  );
  assert.throws(
    () => validateFormatterGoldens(kernel, changed),
    /effect names must be lexicographically sorted/
  );
});
