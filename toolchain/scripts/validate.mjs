import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import {
  ABLATION_PROFILE,
  ABLATION_PROFILE_HASH,
  stableJson,
  sha256
} from "../../dist/toolchain/src/index.js";

const root = resolve(import.meta.dirname, "../..");
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), "utf8"));

const packageJson = await readJson("package.json");
const profile = await readJson("toolchain/profile/static-obligations-v1.json");
const schemas = await readdir(resolve(root, "toolchain/schema"));

assert.match(packageJson.devDependencies.typescript, /^\^?6\./u);
assert.equal(Object.keys(packageJson.dependencies ?? {}).length, 0);
assert.deepEqual(profile, ABLATION_PROFILE);
assert.equal(sha256(stableJson(profile)), ABLATION_PROFILE_HASH);
assert.equal(new Set([...profile.retained, ...profile.disabled]).size, profile.retained.length + profile.disabled.length);
assert.equal(schemas.length, 8);

for (const name of schemas) {
  const schema = await readJson(`toolchain/schema/${name}`);
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.match(schema.$id, /^https:\/\/volt\.dev\/schema\//u);
}

const sourceFiles = (await readdir(resolve(root, "toolchain/src"))).filter((name) => name.endsWith(".ts"));
let sourceLines = 0;
for (const name of sourceFiles) {
  sourceLines += (await readFile(resolve(root, "toolchain/src", name), "utf8")).split("\n").length;
}
assert.ok(sourceLines <= 25_000, `toolchain exceeds 25,000 non-test source lines: ${sourceLines}`);

process.stdout.write(JSON.stringify({
  profileHash: ABLATION_PROFILE_HASH,
  schemas: schemas.length,
  sourceLines,
  runtimeDependencies: Object.keys(packageJson.dependencies ?? {}).length
}) + "\n");
