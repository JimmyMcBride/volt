import { createHash } from "node:crypto";

function normalize(value) {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalize(item)])
    );
  }
  if (value === undefined || typeof value === "function" || typeof value === "symbol") return null;
  return value;
}

export function stableJson(value) {
  return JSON.stringify(normalize(value));
}

export function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function contentHash(value) {
  return sha256(stableJson(value));
}

export function compareStable(left, right) {
  return left.localeCompare(right);
}

export function seededRandom(seed) {
  let state = Number(BigInt.asUintN(32, BigInt(seed)));
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

export function deterministicShuffle(values, seed) {
  const random = seededRandom(seed);
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}
