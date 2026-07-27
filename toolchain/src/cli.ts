#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { CheckerMode, DiagnosticV1 } from "./contracts.js";
import { renderNdjson, renderText } from "./diagnostics.js";
import { formatSource } from "./formatter.js";
import { run, serializeValue } from "./interpreter.js";
import { adaptersFromManifest, compileRepository } from "./repository.js";

interface Options {
  project: string;
  format: "text" | "ndjson";
  mode?: CheckerMode;
  write: boolean;
  checkOnly: boolean;
}

function parseOptions(args: string[]): { command: string; options: Options } {
  const command = args[0] ?? "";
  const options: Options = {
    project: process.cwd(),
    format: "text",
    write: false,
    checkOnly: false
  };
  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === "--project") options.project = resolve(args[++index] ?? "");
    else if (arg === "--format") {
      const value = args[++index];
      if (value !== "text" && value !== "ndjson") throw new Error("--format must be text or ndjson");
      options.format = value;
    } else if (arg === "--mode") {
      const value = args[++index];
      if (value !== "full" && value !== "static_obligations_erased") {
        throw new Error("--mode must be full or static_obligations_erased");
      }
      options.mode = value;
    } else if (arg === "--write") options.write = true;
    else if (arg === "--check") options.checkOnly = true;
    else throw new Error(`unknown argument ${arg}`);
  }
  return { command, options };
}

function outputDiagnostics(diagnostics: DiagnosticV1[], format: Options["format"]): void {
  process.stdout.write(format === "ndjson" ? renderNdjson(diagnostics) : renderText(diagnostics));
}

async function check(options: Options): Promise<number> {
  const { compilation } = await compileRepository(options.project, options.mode);
  outputDiagnostics(compilation.diagnostics, options.format);
  return compilation.diagnostics.some((diagnostic) => diagnostic.severity === "error") ? 1 : 0;
}

async function runCommand(options: Options): Promise<number> {
  const { repository, compilation } = await compileRepository(options.project, options.mode);
  if (!repository.manifest.run) throw new Error("volt run requires manifest run entrypoint");
  if (compilation.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    outputDiagnostics(compilation.diagnostics, options.format);
    return 1;
  }
  const result = run(compilation, repository.manifest.run, adaptersFromManifest(repository.manifest));
  if (result.diagnostics.length > 0) {
    outputDiagnostics(result.diagnostics, options.format);
    return result.internalFailure ? 2 : 1;
  }
  process.stdout.write(`${JSON.stringify(serializeValue(result.value!))}\n`);
  return 0;
}

async function testCommand(options: Options): Promise<number> {
  const { repository, compilation } = await compileRepository(options.project, options.mode);
  if (compilation.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    outputDiagnostics(compilation.diagnostics, options.format);
    return 1;
  }
  let failed = false;
  for (const entry of repository.manifest.tests) {
    const result = run(compilation, entry, adaptersFromManifest(repository.manifest));
    if (result.diagnostics.length > 0) {
      outputDiagnostics(result.diagnostics, options.format);
      if (result.internalFailure) return 2;
      failed = true;
      continue;
    }
    const value = serializeValue(result.value!);
    const success = typeof value === "object" && value !== null &&
      "constructor" in value && (value as Record<string, unknown>)["constructor"] === "Ok";
    process.stdout.write(`${success ? "ok" : "not ok"} ${entry}\n`);
    if (!success) failed = true;
  }
  return failed ? 1 : 0;
}

async function fmt(options: Options): Promise<number> {
  const { repository } = await compileRepository(options.project, options.mode);
  let changed = false;
  const diagnostics: DiagnosticV1[] = [];
  for (const source of repository.sources) {
    const result = formatSource(source.path, source.text);
    diagnostics.push(...result.diagnostics);
    if (result.output !== undefined && result.output !== source.text.replaceAll("\r\n", "\n")) {
      changed = true;
      if (options.write) {
        await writeFile(resolve(repository.root, repository.manifest.sourceRoot, source.path), result.output, "utf8");
      }
    }
  }
  if (diagnostics.length > 0) {
    outputDiagnostics(diagnostics, options.format);
    return 1;
  }
  if ((options.checkOnly || !options.write) && changed) {
    process.stdout.write("formatting changes required\n");
    return 1;
  }
  return 0;
}

async function main(): Promise<void> {
  try {
    const { command, options } = parseOptions(process.argv.slice(2));
    let exitCode: number;
    if (command === "check") exitCode = await check(options);
    else if (command === "run") exitCode = await runCommand(options);
    else if (command === "test") exitCode = await testCommand(options);
    else if (command === "fmt") exitCode = await fmt(options);
    else throw new Error("usage: volt <check|run|test|fmt> [--project path] [--format text|ndjson]");
    process.exitCode = exitCode;
  } catch (error) {
    process.stderr.write(`volt: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}

await main();
