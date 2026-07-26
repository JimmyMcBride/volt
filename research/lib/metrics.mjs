import { createHash } from "node:crypto";

function invariant(condition, message) {
  if (!condition) {
    throw new TypeError(message);
  }
}

function validateShapeNode(node, path = "root") {
  invariant(node !== null && typeof node === "object", `${path} must be an object`);
  invariant(typeof node.kind === "string" && node.kind.length > 0, `${path}.kind must be a non-empty string`);
  invariant(Array.isArray(node.children), `${path}.children must be an array`);
  if ("operator" in node) {
    invariant(typeof node.operator === "string", `${path}.operator must be a string`);
  }
  if ("moduleBoundary" in node) {
    invariant(typeof node.moduleBoundary === "string", `${path}.moduleBoundary must be a string`);
  }
  node.children.forEach((child, index) => validateShapeNode(child, `${path}.children[${index}]`));
}

function shapeLabel(node) {
  return JSON.stringify([
    node.kind,
    node.operator ?? null,
    node.moduleBoundary ?? null
  ]);
}

function canonicalShape(node) {
  return [
    shapeLabel(node),
    node.children.map(canonicalShape)
  ];
}

export function astShapeHash(node) {
  validateShapeNode(node);
  const serialized = JSON.stringify(canonicalShape(node));
  return createHash("sha256").update(serialized, "utf8").digest("hex");
}

export function obligationCoverage(fixtures) {
  invariant(Array.isArray(fixtures), "fixtures must be an array");
  const staticFixtures = fixtures.filter((fixture) => fixture.scope === "static");
  invariant(staticFixtures.length > 0, "at least one static-obligation fixture is required");

  for (const [index, fixture] of fixtures.entries()) {
    invariant(
      fixture.scope === "static" || fixture.scope === "runtime",
      `fixtures[${index}].scope must be static or runtime`
    );
    invariant(
      typeof fixture.rejectedBeforeExecution === "boolean",
      `fixtures[${index}].rejectedBeforeExecution must be boolean`
    );
    invariant(
      typeof fixture.intendedInvariantObserved === "boolean",
      `fixtures[${index}].intendedInvariantObserved must be boolean`
    );
  }

  const rejected = staticFixtures.filter(
    (fixture) => fixture.rejectedBeforeExecution && fixture.intendedInvariantObserved
  ).length;

  return {
    rejected,
    total: staticFixtures.length,
    value: rejected / staticFixtures.length
  };
}

export function astShapeEntropy(shapeHashes) {
  invariant(Array.isArray(shapeHashes), "shapeHashes must be an array");
  shapeHashes.forEach((hash, index) => {
    invariant(typeof hash === "string" && hash.length > 0, `shapeHashes[${index}] must be a non-empty string`);
  });

  const passingCount = shapeHashes.length;
  if (passingCount < 2) {
    return {
      passingCount,
      entropyBits: null,
      normalizedEntropy: null
    };
  }

  const counts = new Map();
  for (const hash of shapeHashes) {
    counts.set(hash, (counts.get(hash) ?? 0) + 1);
  }

  let entropyBits = 0;
  for (const count of counts.values()) {
    const probability = count / passingCount;
    entropyBits -= probability * Math.log2(probability);
  }

  return {
    passingCount,
    entropyBits,
    normalizedEntropy: entropyBits / Math.log2(passingCount)
  };
}

export function ambientDependencyCount({
  observedCapabilities,
  capabilityRegistry,
  parameters = [],
  imports = [],
  uses = []
}) {
  for (const [name, value] of Object.entries({
    observedCapabilities,
    capabilityRegistry,
    parameters,
    imports,
    uses
  })) {
    invariant(Array.isArray(value), `${name} must be an array`);
    value.forEach((item, index) => {
      invariant(typeof item === "string" && item.length > 0, `${name}[${index}] must be a non-empty string`);
    });
  }

  const registry = new Set(capabilityRegistry);
  const declared = new Set([...parameters, ...imports, ...uses]);
  const ambient = new Set(
    observedCapabilities.filter((capability) => registry.has(capability) && !declared.has(capability))
  );

  return {
    capabilities: [...ambient].sort(),
    count: ambient.size
  };
}

function indexTree(root) {
  const nodes = [null];
  const leftmost = [0];

  function visit(node) {
    invariant(node !== null && typeof node === "object", "ordered tree nodes must be objects");
    invariant(typeof node.label === "string", "ordered tree node labels must be strings");
    invariant(Array.isArray(node.children), "ordered tree node children must be arrays");

    const childIndices = node.children.map(visit);
    const index = nodes.length;
    nodes.push(node);
    leftmost[index] = childIndices.length === 0 ? index : leftmost[childIndices[0]];
    return index;
  }

  visit(root);

  const lastRootForLeaf = new Map();
  for (let index = 1; index < nodes.length; index += 1) {
    lastRootForLeaf.set(leftmost[index], index);
  }

  return {
    nodes,
    leftmost,
    keyroots: [...lastRootForLeaf.values()].sort((a, b) => a - b)
  };
}

function matrix(rows, columns, initialValue) {
  return Array.from({ length: rows }, () => Array(columns).fill(initialValue));
}

export function zhangShashaDistance(leftRoot, rightRoot) {
  const left = indexTree(leftRoot);
  const right = indexTree(rightRoot);
  const treeDistance = matrix(left.nodes.length, right.nodes.length, 0);

  for (const leftKeyroot of left.keyroots) {
    for (const rightKeyroot of right.keyroots) {
      const forestDistance = matrix(left.nodes.length, right.nodes.length, Number.POSITIVE_INFINITY);
      const leftBase = left.leftmost[leftKeyroot] - 1;
      const rightBase = right.leftmost[rightKeyroot] - 1;
      forestDistance[leftBase][rightBase] = 0;

      for (let leftIndex = leftBase + 1; leftIndex <= leftKeyroot; leftIndex += 1) {
        forestDistance[leftIndex][rightBase] = forestDistance[leftIndex - 1][rightBase] + 1;
      }
      for (let rightIndex = rightBase + 1; rightIndex <= rightKeyroot; rightIndex += 1) {
        forestDistance[leftBase][rightIndex] = forestDistance[leftBase][rightIndex - 1] + 1;
      }

      for (let leftIndex = leftBase + 1; leftIndex <= leftKeyroot; leftIndex += 1) {
        for (let rightIndex = rightBase + 1; rightIndex <= rightKeyroot; rightIndex += 1) {
          const deletion = forestDistance[leftIndex - 1][rightIndex] + 1;
          const insertion = forestDistance[leftIndex][rightIndex - 1] + 1;

          if (
            left.leftmost[leftIndex] === left.leftmost[leftKeyroot] &&
            right.leftmost[rightIndex] === right.leftmost[rightKeyroot]
          ) {
            const relabel =
              forestDistance[leftIndex - 1][rightIndex - 1] +
              (left.nodes[leftIndex].label === right.nodes[rightIndex].label ? 0 : 1);
            forestDistance[leftIndex][rightIndex] = Math.min(deletion, insertion, relabel);
            treeDistance[leftIndex][rightIndex] = forestDistance[leftIndex][rightIndex];
          } else {
            const subtree =
              forestDistance[left.leftmost[leftIndex] - 1][right.leftmost[rightIndex] - 1] +
              treeDistance[leftIndex][rightIndex];
            forestDistance[leftIndex][rightIndex] = Math.min(deletion, insertion, subtree);
          }
        }
      }
    }
  }

  return treeDistance[left.nodes.length - 1][right.nodes.length - 1];
}

function shapeToOrderedTree(node) {
  validateShapeNode(node);
  return {
    label: shapeLabel(node),
    children: node.children.map(shapeToOrderedTree)
  };
}

function validateFileSnapshot(snapshot, path) {
  invariant(
    snapshot !== null && typeof snapshot === "object" && !Array.isArray(snapshot),
    `${path} must be a file snapshot`
  );
  invariant(
    typeof snapshot.sourceHash === "string" && snapshot.sourceHash.length > 0,
    `${path}.sourceHash must be a non-empty string`
  );
  validateShapeNode(snapshot.ast, `${path}.ast`);
}

function projectTree(files) {
  invariant(files !== null && typeof files === "object" && !Array.isArray(files), "files must be a path-to-snapshot object");
  return {
    label: "Project",
    children: Object.entries(files)
      .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
      .map(([path, snapshot]) => {
        validateFileSnapshot(snapshot, `files[${JSON.stringify(path)}]`);
        return {
          label: `File:${path}`,
          children: [shapeToOrderedTree(snapshot.ast)]
        };
      })
  };
}

export function repairLocality(firstFailedFiles, firstPassingFiles) {
  const allPaths = new Set([
    ...Object.keys(firstFailedFiles),
    ...Object.keys(firstPassingFiles)
  ]);
  let changedFiles = 0;

  for (const path of allPaths) {
    const before = firstFailedFiles[path];
    const after = firstPassingFiles[path];
    if (before === undefined || after === undefined) {
      changedFiles += 1;
      continue;
    }
    validateFileSnapshot(before, `firstFailedFiles[${JSON.stringify(path)}]`);
    validateFileSnapshot(after, `firstPassingFiles[${JSON.stringify(path)}]`);
    if (before.sourceHash !== after.sourceHash) {
      changedFiles += 1;
    }
  }

  return {
    changedFiles,
    astTreeEditDistance: zhangShashaDistance(
      projectTree(firstFailedFiles),
      projectTree(firstPassingFiles)
    )
  };
}
