import {
  ABLATION_PROFILE_HASH,
  compileSources,
  formatSource,
  renderNdjson,
  renderText,
  stableJson as toolchainStableJson
} from "../../dist/toolchain/src/index.js";
import { contentHash } from "./stable.mjs";
import { validateAliasManifest } from "./validation.mjs";

function sourceArray(files) {
  return Object.entries(files)
    .filter(([path]) => path.endsWith(".volt"))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, text]) => ({ path, text }));
}

function outsideStrings(text, transform) {
  let result = "";
  let segment = "";
  let quoted = false;
  let escaped = false;
  for (const character of text) {
    if (quoted) {
      result += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === "\"") quoted = false;
      continue;
    }
    if (character === "\"") {
      result += transform(segment);
      segment = "";
      result += character;
      quoted = true;
    } else {
      segment += character;
    }
  }
  return result + transform(segment);
}

export function expandAliases(text, aliasManifest) {
  validateAliasManifest(aliasManifest);
  return outsideStrings(text, (segment) => {
    let output = segment;
    for (const alias of aliasManifest.aliases) {
      output = output.replace(
        new RegExp(`\\b${alias.alias.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\b`, "gu"),
        alias.canonical
      );
    }
    return output;
  });
}

export function canonicalizeAliasedFiles(files, aliasManifest) {
  return Object.fromEntries(
    Object.entries(files).map(([path, text]) => [path, expandAliases(text, aliasManifest)])
  );
}

function renderStructured(diagnostics) {
  return renderNdjson(diagnostics);
}

function renderPlain(diagnostics) {
  return renderText(diagnostics);
}

function factsHash(diagnostics) {
  return contentHash(JSON.parse(`[${renderNdjson(diagnostics).trim().split("\n").filter(Boolean).join(",")}]`));
}

export function compileCondition(condition, files, { aliasManifest } = {}) {
  let prepared = files;
  let checkerMode = "full";
  let renderer = renderStructured;

  if (condition === "static_obligations_erased") checkerMode = "static_obligations_erased";
  else if (condition === "alias_permissive") {
    if (aliasManifest === undefined) throw new TypeError("alias_permissive requires an alias manifest");
    prepared = canonicalizeAliasedFiles(files, aliasManifest);
  } else if (condition === "diagnostics_plain") renderer = renderPlain;
  else if (condition !== "volt_full") throw new TypeError(`not a causal Volt condition: ${condition}`);

  const compilation = compileSources(sourceArray(prepared), checkerMode);
  const renderedDiagnostics = renderer(compilation.diagnostics);
  const canonicalFiles = {};
  for (const source of sourceArray(prepared)) {
    const formatted = formatSource(source.path, source.text);
    canonicalFiles[source.path] = formatted.output ?? source.text;
  }

  return {
    condition,
    checkerMode,
    checkerProfileHash: ABLATION_PROFILE_HASH,
    compilation,
    canonicalFiles,
    renderedDiagnostics,
    renderedDiagnosticsHash: contentHash(renderedDiagnostics),
    diagnosticFactsHash: factsHash(compilation.diagnostics),
    preparedSourceHash: contentHash(prepared),
    graphHash: contentHash(compilation.graph),
    typedIrHash: contentHash(compilation.typedIr),
    normalizedAstHash: contentHash(compilation.normalizedAst),
    runManifestHash: contentHash(compilation.runManifest)
  };
}

export function diagnosticParity(structured, plain) {
  return {
    sameFacts: structured.diagnosticFactsHash === plain.diagnosticFactsHash,
    sameCompilation: toolchainStableJson(structured.compilation.diagnostics) ===
      toolchainStableJson(plain.compilation.diagnostics),
    representationDiffers: structured.renderedDiagnostics !== plain.renderedDiagnostics
  };
}

export function treatmentParity(reference, treatment, targetedFields) {
  const fields = [
    "preparedSourceHash",
    "graphHash",
    "typedIrHash",
    "normalizedAstHash",
    "runManifestHash",
    "diagnosticFactsHash",
    "renderedDiagnosticsHash"
  ];
  const targeted = new Set(targetedFields);
  return Object.fromEntries(fields.map((field) => [
    field,
    targeted.has(field) ? "targeted" : reference[field] === treatment[field]
  ]));
}

export function describeBaseline(condition, baselineManifest) {
  const baseline = baselineManifest.baselines.find((item) => item.id === condition);
  if (baseline === undefined) throw new TypeError(`unknown descriptive baseline: ${condition}`);
  return {
    ...baseline,
    claimClass: "descriptive",
    executableInNormalVerification: false,
    manifestHash: contentHash(baseline)
  };
}
