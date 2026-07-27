import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
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

const kernelResult = validateKernel({ kernel, grammar, schema, protocol });
const conformanceResult = validateConformanceManifest(kernel, conformance, fixtureContents);
const rulesResult = validateConformanceRules(grammar, conformance, rules);
const boundaryResult = validateBoundaries(kernel, boundaries);
const formatterResult = validateFormatterGoldens(kernel, formatterGoldens);
const publicChangeResult = validatePublicChangeFixtures(kernel, publicChanges);
const coverageResult = validateBenchmarkCoverage(kernel, protocol, coverage);

console.log(
  `Volt ${kernelResult.kernelId}: ${kernelResult.features} features, ` +
    `${conformanceResult.accepted} accepted fixtures, ${conformanceResult.rejected} rejected fixtures, ` +
    `${rulesResult.grammarProductions} grammar productions, ${rulesResult.staticRules} static rules, ` +
    `${rulesResult.rejectedCategories} rejection categories, ` +
    `${boundaryResult.deferred + boundaryResult.excluded} feature boundaries, ` +
    `${formatterResult.cases} formatter goldens, ` +
    `${publicChangeResult.cases} change categories, ${coverageResult.cases} workload coverage cases`
);
