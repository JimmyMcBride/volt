import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { sha256, stableJson } from "./stable.mjs";
import { validateArtifactIndex } from "./validation.mjs";

export class ArtifactStore {
  #artifacts = new Map();

  put(path, value, { privateArtifact = false } = {}) {
    if (this.#artifacts.has(path)) throw new TypeError(`duplicate artifact path: ${path}`);
    const bytes = typeof value === "string" ? value : `${stableJson(value)}\n`;
    const artifact = {
      path,
      bytes,
      hash: sha256(bytes),
      private: privateArtifact
    };
    this.#artifacts.set(path, artifact);
    return artifact.hash;
  }

  get(path) {
    return this.#artifacts.get(path);
  }

  index(runId) {
    return validateArtifactIndex({
      schemaVersion: 1,
      runId,
      artifacts: [...this.#artifacts.values()]
        .sort((left, right) => left.path.localeCompare(right.path))
        .map(({ path, hash, private: privateArtifact }) => ({
          path,
          hash,
          private: privateArtifact
        }))
    });
  }

  async write(root, runId) {
    for (const artifact of this.#artifacts.values()) {
      const target = resolve(root, artifact.path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, artifact.bytes, "utf8");
    }
    const index = this.index(runId);
    await mkdir(root, { recursive: true });
    await writeFile(resolve(root, "artifact-index.json"), `${stableJson(index)}\n`, "utf8");
    return index;
  }
}
