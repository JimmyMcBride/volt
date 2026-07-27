import { readFile, readdir } from "node:fs/promises";
import { resolve, relative, sep } from "node:path";
import type {
  CheckerMode, CompilationResult, RepositoryManifestV1, SourceFile
} from "./contracts.js";
import { compileSources } from "./compiler.js";
import {
  clockAdapter, databaseAdapter, notificationAdapter, type CapabilityAdapter
} from "./interpreter.js";
import { compareStable, typeText } from "./stable.js";

export interface LoadedRepository {
  root: string;
  manifestPath: string;
  manifest: RepositoryManifestV1;
  sources: SourceFile[];
}

function ensureObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function validateManifest(value: unknown): RepositoryManifestV1 {
  ensureObject(value, "manifest");
  if (value.schemaVersion !== 1) throw new Error("manifest schemaVersion must be 1");
  if (typeof value.sourceRoot !== "string" || value.sourceRoot.length === 0) {
    throw new Error("manifest sourceRoot must be a non-empty string");
  }
  if (!Array.isArray(value.tests) || value.tests.some((item) => typeof item !== "string")) {
    throw new Error("manifest tests must be an array of fully qualified function names");
  }
  if (value.run !== undefined && typeof value.run !== "string") throw new Error("manifest run must be a string");
  if (
    value.checkerMode !== undefined &&
    value.checkerMode !== "full" &&
    value.checkerMode !== "static_obligations_erased"
  ) throw new Error("manifest checkerMode is invalid");
  if (value.capabilities !== undefined) {
    if (!Array.isArray(value.capabilities)) throw new Error("manifest capabilities must be an array");
    for (const capability of value.capabilities) {
      ensureObject(capability, "capability");
      if (typeof capability.effect !== "string") throw new Error("capability effect must be a stable identity");
      if (!["clock", "database", "notification"].includes(String(capability.adapter))) {
        throw new Error(`unsupported deterministic adapter ${String(capability.adapter)}`);
      }
    }
  }
  return value as unknown as RepositoryManifestV1;
}

async function collectVoltFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries.sort((a, b) => compareStable(a.name, b.name))) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectVoltFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".volt")) files.push(path);
  }
  return files;
}

export async function loadRepository(root: string): Promise<LoadedRepository> {
  const absoluteRoot = resolve(root);
  const manifestPath = resolve(absoluteRoot, "volt.json");
  const manifest = validateManifest(JSON.parse(await readFile(manifestPath, "utf8")) as unknown);
  const sourceRoot = resolve(absoluteRoot, manifest.sourceRoot);
  const relativeRoot = relative(absoluteRoot, sourceRoot);
  if (relativeRoot.startsWith("..") || relativeRoot === "") {
    if (relativeRoot.startsWith("..")) throw new Error("manifest sourceRoot must stay within the repository");
  }
  const paths = await collectVoltFiles(sourceRoot);
  const sources = await Promise.all(paths.map(async (path): Promise<SourceFile> => ({
    path: relative(sourceRoot, path).split(sep).join("/"),
    text: await readFile(path, "utf8")
  })));
  return { root: absoluteRoot, manifestPath, manifest, sources };
}

export async function compileRepository(
  root: string,
  mode?: CheckerMode
): Promise<{ repository: LoadedRepository; compilation: CompilationResult }> {
  const repository = await loadRepository(root);
  const compilation = compileSources(repository.sources, mode ?? repository.manifest.checkerMode ?? "full");
  if (compilation.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return { repository, compilation };
  }
  const findFunction = (entry: string) => {
    const separator = entry.lastIndexOf(".");
    if (separator <= 0) throw new Error(`entrypoint ${entry} must be fully qualified`);
    const module = entry.slice(0, separator);
    const name = entry.slice(separator + 1);
    return compilation.ast.find((item) => item.module === module)?.declarations.find(
      (declaration) => declaration.kind === "function" && declaration.name === name
    );
  };
  if (repository.manifest.run) {
    const entry = findFunction(repository.manifest.run);
    if (!entry || entry.kind !== "function") throw new Error(`run entrypoint ${repository.manifest.run} does not exist`);
    if (entry.params.length !== 0) throw new Error("run entrypoint must have zero parameters");
  }
  for (const testEntry of repository.manifest.tests) {
    const entry = findFunction(testEntry);
    if (!entry || entry.kind !== "function") throw new Error(`test entrypoint ${testEntry} does not exist`);
    if (entry.params.length !== 0 || typeText(entry.returnType) !== "Result<Unit,String>") {
      throw new Error(`test entrypoint ${testEntry} must be () -> Result<Unit,String>`);
    }
  }
  return { repository, compilation };
}

export function adaptersFromManifest(manifest: RepositoryManifestV1): CapabilityAdapter[] {
  return (manifest.capabilities ?? []).map((capability) => {
    if (capability.adapter === "clock") {
      const raw = capability.config?.values;
      const values = Array.isArray(raw)
        ? raw.map((value) => BigInt(String(value)))
        : [BigInt(String(capability.config?.now ?? 0))];
      return clockAdapter(capability.effect, values);
    }
    if (capability.adapter === "database") return databaseAdapter(capability.effect);
    return notificationAdapter(capability.effect);
  });
}
