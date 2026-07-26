import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  ambientDependencyCount,
  astShapeEntropy,
  astShapeHash,
  obligationCoverage,
  repairLocality,
  zhangShashaDistance
} from "../lib/metrics.mjs";

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "metrics.json"
);
const fixtures = JSON.parse(await readFile(fixturePath, "utf8"));

test("obligation coverage excludes runtime-only invariants and requires intended rejection", () => {
  assert.deepEqual(
    obligationCoverage(fixtures.obligationCoverage.fixtures),
    fixtures.obligationCoverage.expected
  );
});

test("AST shape entropy is normalized by log2 of passing submissions", () => {
  assert.deepEqual(
    astShapeEntropy(fixtures.astShapeEntropy.shapeHashes),
    fixtures.astShapeEntropy.expected
  );
  assert.deepEqual(astShapeEntropy(["only"]), {
    passingCount: 1,
    entropyBits: null,
    normalizedEntropy: null
  });
});

test("AST shape hashes erase values by construction and preserve operators", () => {
  const add = {
    kind: "Binary",
    operator: "+",
    children: [
      {
        kind: "Literal",
        children: []
      }
    ]
  };
  const subtract = {
    ...add,
    operator: "-"
  };
  assert.equal(astShapeHash(add), astShapeHash(structuredClone(add)));
  assert.notEqual(astShapeHash(add), astShapeHash(subtract));
});

test("ambient dependency count deduplicates undeclared registered capabilities", () => {
  assert.deepEqual(
    ambientDependencyCount(fixtures.ambientDependencyCount.input),
    fixtures.ambientDependencyCount.expected
  );
});

test("Zhang-Shasha distance uses unit insert, delete, and relabel costs", () => {
  const leaf = (label) => ({
    label,
    children: []
  });
  assert.equal(zhangShashaDistance(leaf("A"), leaf("A")), 0);
  assert.equal(zhangShashaDistance(leaf("A"), leaf("B")), 1);
  assert.equal(
    zhangShashaDistance(
      {
        label: "A",
        children: []
      },
      {
        label: "A",
        children: [leaf("B")]
      }
    ),
    1
  );
});

test("repair locality reports changed files separately from AST tree distance", () => {
  assert.deepEqual(
    repairLocality(
      fixtures.repairLocality.firstFailedFiles,
      fixtures.repairLocality.firstPassingFiles
    ),
    fixtures.repairLocality.expected
  );
});

test("changed-file locality detects source-only edits even when AST shape is unchanged", () => {
  const ast = {
    kind: "Literal",
    children: []
  };
  assert.deepEqual(
    repairLocality(
      {
        "value.volt": {
          sourceHash: "literal-one",
          ast
        }
      },
      {
        "value.volt": {
          sourceHash: "literal-two",
          ast
        }
      }
    ),
    {
      changedFiles: 1,
      astTreeEditDistance: 0
    }
  );
});
