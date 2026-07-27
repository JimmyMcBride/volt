import { createHash } from "node:crypto";

const EXPECTED_FEATURES = new Set([
  "modules",
  "explicit_imports",
  "records",
  "closed_adts",
  "functions",
  "immutable_let",
  "if_expression",
  "match_expression",
  "exact_effect_sets",
  "list",
  "option",
  "result",
  "canonical_formatting",
  "stable_public_identities",
  "public_change_obligations"
]);

const EXPECTED_CHANGE_CODES = new Map([
  ["adt_variant", "K_CHANGE_ADT_VARIANT"],
  ["record_field", "K_CHANGE_RECORD_FIELD"],
  ["function_contract", "K_CHANGE_FUNCTION_CONTRACT"],
  ["effect_set", "K_CHANGE_EFFECT_SET"],
  ["module_move", "K_CHANGE_MODULE_MOVE"]
]);

const EXPECTED_REJECTION_CODES = new Set([
  "K_EFFECT_MISSING",
  "K_EFFECT_UNUSED",
  "K_IMPORT_ALIAS",
  "K_IMPORT_UNUSED",
  "K_LEX_IDENTIFIER_ASCII",
  "K_LEX_SEMICOLON",
  "K_LEX_TRAILING_COMMA",
  "K_MATCH_CATCH_ALL",
  "K_NAME_CONVENTION",
  "K_NAME_UNDERSCORE",
  "K_NAME_SHADOWING",
  "K_TYPE_BOUNDARY",
  "K_TYPE_RECORD_FIELDS"
]);

const EXPECTED_TASK_FAMILIES = [
  "state_extension",
  "invariant_change",
  "effect_addition",
  "cross_module_contract_change"
];

const EXPECTED_STATIC_RULES = new Set([
  "module_file_mapping",
  "explicit_imports",
  "ascii_identifiers",
  "canonical_naming",
  "underscore_free_identifiers",
  "literal_contract",
  "function_boundary_types",
  "local_inference_only",
  "nominal_user_types",
  "exact_record_fields",
  "exact_call_contracts",
  "deterministic_resolution",
  "public_visibility",
  "operator_typing",
  "left_to_right_evaluation",
  "exact_effect_sets",
  "transitive_effects",
  "recursive_effect_fixed_point",
  "closed_match_exhaustiveness",
  "closed_match_no_catch_all",
  "open_match_catch_all",
  "stable_public_identity",
  "public_change_obligations",
  "canonical_formatter",
  "deferred_boundaries",
  "excluded_boundaries"
]);

const EXPECTED_REJECTED_CATEGORIES = new Set([
  "alternative_spelling",
  "semicolon",
  "trailing_comma",
  "non_ascii_identifier",
  "invalid_naming",
  "underscore_identifier",
  "unsupported_literal",
  "missing_boundary_type",
  "implicit_conversion",
  "operator_overload",
  "null",
  "expected_failure_exception",
  "implicit_result_propagation",
  "non_exhaustive_closed_match",
  "closed_match_catch_all",
  "missing_effect",
  "extra_effect",
  "duplicate_effect",
  "unresolved_import",
  "ambiguous_import",
  "private_import",
  "cyclic_import",
  "wildcard_import",
  "aliased_import",
  "duplicate_import",
  "unused_import",
  "record_missing_field",
  "record_extra_field",
  "record_duplicate_field",
  "record_unknown_field",
  "local_shadowing",
  "duplicate_declaration",
  "constructor_collision",
  "deferred_feature",
  "excluded_feature"
]);

const EXPECTED_FORMATTER_ASSERTIONS = new Set([
  "parse_preserving",
  "byte_idempotent",
  "utf8",
  "lf_line_endings",
  "two_space_indentation",
  "sorted_import_modules",
  "sorted_import_names",
  "sorted_effect_names",
  "no_semicolons",
  "no_trailing_commas",
  "no_trailing_whitespace"
]);

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertUnique(values, label) {
  invariant(new Set(values).size === values.length, `${label} must be duplicate-free`);
}

function assertExactSet(actual, expected, label) {
  assertUnique(actual, label);
  invariant(
    actual.length === expected.size && actual.every((value) => expected.has(value)),
    `${label} does not match the approved set`
  );
}

function compareLexicographically(left, right) {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function assertSorted(values, label) {
  const sorted = [...values].sort(compareLexicographically);
  invariant(
    values.every((value, index) => value === sorted[index]),
    `${label} must be lexicographically sorted`
  );
}

function assertObject(value, label) {
  invariant(value !== null && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
}

export function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

export function validateKernel({ kernel, grammar, schema, protocol }) {
  assertObject(kernel, "kernel");
  invariant(kernel.schemaVersion === 1, "kernel schemaVersion must be 1");
  invariant(kernel.kernelId === "volt-v0", "kernelId must be volt-v0");
  invariant(kernel.version === "0.2.0", "kernel version must be 0.2.0");
  invariant(kernel.status === "approved", "kernel must remain approved");
  invariant(kernel.source.issue === "https://github.com/JimmyMcBride/volt/issues/15", "kernel must cite Issue #15");
  invariant(kernel.source.discussion === "https://github.com/JimmyMcBride/volt/discussions/1", "kernel must cite Discussion #1");
  assertExactSet(
    kernel.boundaries.owns,
    new Set([
      "canonical_grammar",
      "lexical_contract",
      "name_resolution_contract",
      "type_rules",
      "effect_rules",
      "exhaustiveness_rules",
      "stable_public_identities",
      "public_change_obligations",
      "canonical_format_contract",
      "feature_boundaries"
    ]),
    "kernel-owned surfaces"
  );
  assertExactSet(
    kernel.boundaries.doesNotOwn,
    new Set([
      "lexer_or_parser_implementation",
      "diagnostic_v1",
      "program_graph",
      "interpreter",
      "runtime_capability_adapters",
      "semantic_diff",
      "benchmark_corpus",
      "agent_study"
    ]),
    "downstream-owned surfaces"
  );

  invariant(kernel.sourceModel.encoding === "UTF-8", "source encoding must be UTF-8");
  invariant(kernel.sourceModel.extension === ".volt", "source extension must be .volt");
  invariant(
    kernel.sourceModel.modulePathPattern === "^[a-z][A-Za-z0-9]*(\\.[a-z][A-Za-z0-9]*)*$",
    "module paths must use lowerCamelCase segments"
  );
  invariant(kernel.sourceModel.oneModulePerFile === true, "one module per file is required");
  invariant(kernel.sourceModel.importAliasesAllowed === false, "import aliases must remain rejected");
  invariant(kernel.sourceModel.globImportsAllowed === false, "glob imports must remain rejected");
  invariant(kernel.sourceModel.implicitPreludeImportsAllowed === false, "implicit prelude imports must remain rejected");
  invariant(kernel.sourceModel.importableVisibility === "pub_only", "only public declarations may be imported");
  invariant(kernel.sourceModel.unusedImports === "error", "unused imports must remain errors");
  assertExactSet(
    kernel.sourceModel.importErrors,
    new Set(["duplicate", "unresolved", "ambiguous", "private", "unused", "cyclic", "wildcard", "aliased"]),
    "import errors"
  );
  invariant(kernel.lexical.semicolons === false, "semicolons must remain rejected");
  invariant(kernel.lexical.trailingCommas === false, "trailing commas must remain rejected");
  invariant(kernel.lexical.blockComments === false, "block comments must remain deferred");
  invariant(
    kernel.lexical.identifierPattern === "^[A-Za-z][A-Za-z0-9]*$",
    "identifiers must be ASCII alphanumeric without underscores"
  );
  assertExactSet(
    kernel.naming.lowerCamelCase,
    new Set([
      "module_segment",
      "function",
      "parameter",
      "local_binding",
      "record_field",
      "effect_operation",
      "imported_value_name"
    ]),
    "lowerCamelCase naming categories"
  );
  assertExactSet(
    kernel.naming.upperCamelCase,
    new Set(["record", "algebraic_data_type", "constructor", "effect", "imported_type_name"]),
    "UpperCamelCase naming categories"
  );
  invariant(kernel.lexical.string.normalization === "none", "strings must not be normalized");
  invariant(
    kernel.lexical.string.hashing === "exact_unicode_scalar_sequence",
    "string hashing must use exact Unicode scalar sequences"
  );

  assertExactSet(kernel.features, EXPECTED_FEATURES, "kernel features");
  assertUnique(kernel.deferred, "deferred features");
  assertUnique(kernel.excluded, "excluded features");
  invariant(
    kernel.features.every((feature) => !kernel.deferred.includes(feature) && !kernel.excluded.includes(feature)),
    "required, deferred, and excluded features must not overlap"
  );

  invariant(kernel.types.functionBoundaryTypesExplicit === true, "function boundary types must be explicit");
  invariant(kernel.types.localInferenceOnly === true, "inference must remain local");
  invariant(kernel.types.userDefinedGenerics === false, "user-defined generics must remain deferred");
  invariant(kernel.types.functionsFirstClass === false, "functions must not be first-class in v0");
  invariant(kernel.types.recordFieldsExact === true, "record fields must be exact");

  invariant(
    kernel.resolution.valueLookupOrder.join(",") ===
      "local_binding,parameter,same_module_declaration,explicit_import",
    "value lookup order must remain deterministic"
  );
  invariant(kernel.resolution.fallbackSearch === false, "name resolution must not use fallback search");
  invariant(kernel.resolution.effectOperationCallShape === "EffectName.operation(args)", "effect operation syntax drift");

  invariant(kernel.operators.length === 8, "operator table must contain eight precedence levels");
  const precedence = kernel.operators.map((operator) => operator.precedence);
  assertExactSet(precedence, new Set([1, 2, 3, 4, 5, 6, 7, 8]), "operator precedence levels");
  invariant(kernel.evaluation.order === "left_to_right", "evaluation order must be left-to-right");
  invariant(kernel.evaluation.implicitConversions === false, "implicit conversions must remain excluded");
  invariant(kernel.evaluation.operatorOverloading === false, "operator overloading must remain excluded");
  invariant(kernel.operatorTyping.chainedComparisons === "error", "chained comparisons must remain errors");
  assertExactSet(kernel.operatorTyping.ordering, new Set(["Int", "String"]), "ordered types");

  invariant(kernel.effects.setsExact === true, "effect sets must be exact");
  invariant(kernel.effects.setsSorted === true, "effect sets must be sorted");
  invariant(kernel.effects.setsDuplicateFree === true, "effect sets must be duplicate-free");
  invariant(kernel.effects.missingEffect === "error", "missing effects must be errors");
  invariant(kernel.effects.unusedEffect === "error", "unused effects must be errors");
  invariant(kernel.effects.transitivePropagation === true, "effects must propagate transitively");
  invariant(kernel.effects.recursiveGroups === "least_fixed_point", "recursive effects require a least fixed point");

  assertExactSet(
    kernel.matching.closedTypes,
    new Set(["user_adt", "Option", "Result", "List", "Bool"]),
    "closed match types"
  );
  invariant(kernel.matching.closedCatchAllAllowed === false, "closed ADTs must reject catch-all patterns");
  assertExactSet(
    kernel.matching.openTypesRequireCatchAll,
    new Set(["Int", "String", "record"]),
    "open match types"
  );

  invariant(kernel.publicChanges.length === EXPECTED_CHANGE_CODES.size, "five public-change categories are required");
  invariant(
    kernel.stableIdentity.affectedOrdering === "stable_identity_lexicographic",
    "affected declarations must use stable identity ordering"
  );
  const changeIds = kernel.publicChanges.map((change) => change.id);
  assertExactSet(changeIds, new Set(EXPECTED_CHANGE_CODES.keys()), "public-change categories");
  for (const change of kernel.publicChanges) {
    invariant(
      change.obligationCode === EXPECTED_CHANGE_CODES.get(change.id),
      `${change.id} has the wrong obligation code`
    );
    assertUnique(change.affectedKinds, `${change.id} affected kinds`);
    invariant(
      ["resolve", "type", "effect", "exhaustiveness"].includes(change.diagnosticPhase),
      `${change.id} has an invalid diagnostic phase`
    );
  }

  invariant(kernel.formatter.command === "volt fmt", "formatter command must be volt fmt");
  invariant(kernel.formatter.parsePreserving === true, "formatting must preserve parsing");
  invariant(kernel.formatter.idempotent === true, "formatting must be idempotent");
  invariant(kernel.warnings.unusedLocalBinding === "warning", "unused local bindings must remain warnings");

  const productionNames = [
    "Program",
    "ModuleDecl",
    "ImportDecl",
    "RecordDecl",
    "TypeDecl",
    "EffectDecl",
    "FunctionDecl",
    "Type",
    "Expr",
    "Pattern"
  ];
  for (const production of productionNames) {
    invariant(new RegExp(`^${production}\\s*=`, "m").test(grammar), `grammar is missing ${production}`);
  }
  invariant(!grammar.includes('";"'), "grammar must not accept semicolons");
  invariant(!grammar.includes('","?'), "grammar must not accept optional trailing commas");

  assertObject(schema, "kernel schema");
  invariant(schema.$schema === "https://json-schema.org/draft/2020-12/schema", "kernel schema must use JSON Schema 2020-12");
  for (const field of [
    "schemaVersion",
    "kernelId",
    "version",
    "status",
    "source",
    "boundaries",
    "sourceModel",
    "lexical",
    "naming",
    "types",
    "resolution",
    "operators",
    "operatorTyping",
    "effects",
    "matching",
    "stableIdentity",
    "publicChanges",
    "formatter",
    "warnings",
    "features",
    "deferred",
    "excluded",
    "protocolCompatibility"
  ]) {
    invariant(schema.required.includes(field), `kernel schema must require ${field}`);
  }

  invariant(protocol.protocolId === kernel.protocolCompatibility.protocolId, "protocol ID mismatch");
  invariant(protocol.version === kernel.protocolCompatibility.protocolVersion, "protocol version mismatch");
  invariant(protocol.status === "approved", "research protocol must remain approved");
  invariant(protocol.workload.confirmatoryTaskCount === 12, "protocol must retain twelve confirmatory tasks");
  assertExactSet(
    kernel.protocolCompatibility.conditionInterfaces,
    new Set(["canonical_syntax_toggle", "static_obligation_toggle", "diagnostic_fact_interface"]),
    "protocol condition interfaces"
  );
  assertExactSet(
    kernel.protocolCompatibility.measurementInterfaces,
    new Set([
      "stable_ast_shape",
      "declared_effect_set",
      "stable_public_identity",
      "public_change_obligation_set"
    ]),
    "protocol measurement interfaces"
  );
  invariant(
    kernel.protocolCompatibility.mayChangeProtocolDecisionRules === false,
    "kernel changes must not alter protocol decision rules"
  );

  return {
    kernelId: kernel.kernelId,
    features: kernel.features.length,
    publicChanges: kernel.publicChanges.length
  };
}

export function validateConformanceManifest(kernel, manifest, fixtureContents) {
  invariant(manifest.schemaVersion === 1, "conformance schemaVersion must be 1");
  invariant(manifest.kernelId === kernel.kernelId, "conformance kernel ID mismatch");
  invariant(manifest.accepted.length > 0, "accepted fixtures are required");
  invariant(manifest.rejected.length > 0, "rejected fixtures are required");

  const allFixtures = [...manifest.accepted, ...manifest.rejected];
  assertUnique(allFixtures.map((fixture) => fixture.id), "fixture IDs");
  assertUnique(allFixtures.map((fixture) => fixture.path), "fixture paths");

  for (const fixture of allFixtures) {
    const contents = fixtureContents.get(fixture.path);
    invariant(contents !== undefined, `missing fixture ${fixture.path}`);
    invariant(sha256(contents) === fixture.sha256, `fixture hash mismatch for ${fixture.path}`);
    invariant(contents.endsWith("\n"), `${fixture.path} must end with LF`);
    invariant(!contents.includes("\r"), `${fixture.path} must use LF line endings`);
  }

  for (const fixture of manifest.accepted) {
    invariant(!fixture.path.includes("/rejected/"), `${fixture.id} is in the wrong fixture directory`);
    invariant(!fixtureContents.get(fixture.path).includes(";"), `${fixture.id} uses a semicolon`);
    assertUnique(fixture.covers, `${fixture.id} feature coverage`);
    invariant(
      fixture.covers.every((feature) => kernel.features.includes(feature)),
      `${fixture.id} names an unknown kernel feature`
    );
  }

  for (const fixture of manifest.rejected) {
    invariant(!fixture.path.includes("/accepted/"), `${fixture.id} is in the wrong fixture directory`);
  }
  assertExactSet(
    manifest.rejected.map((fixture) => fixture.expectedCode),
    EXPECTED_REJECTION_CODES,
    "rejected fixture codes"
  );

  return {
    accepted: manifest.accepted.length,
    rejected: manifest.rejected.length
  };
}

export function validateConformanceRules(grammar, manifest, rules) {
  invariant(rules.schemaVersion === 1, "rules schemaVersion must be 1");
  invariant(rules.kernelId === manifest.kernelId, "rules kernel ID mismatch");

  const grammarProductions = [...grammar.matchAll(/^([A-Z][A-Za-z]*)\s*=/gm)].map((match) => match[1]);
  const coveredProductions = rules.grammarCoverage.flatMap((coverage) => coverage.productions);
  assertExactSet(coveredProductions, new Set(grammarProductions), "grammar production coverage");
  const acceptedFixtureIds = new Set(manifest.accepted.map((fixture) => fixture.id));
  for (const coverage of rules.grammarCoverage) {
    invariant(acceptedFixtureIds.has(coverage.fixture), `unknown grammar fixture ${coverage.fixture}`);
    assertUnique(coverage.productions, `${coverage.fixture} grammar productions`);
  }

  assertExactSet(
    rules.staticRuleCoverage.map((coverage) => coverage.rule),
    EXPECTED_STATIC_RULES,
    "static rule coverage"
  );
  for (const coverage of rules.staticRuleCoverage) {
    invariant(typeof coverage.evidence === "string" && coverage.evidence.length > 0, `${coverage.rule} needs evidence`);
  }

  assertExactSet(
    rules.requiredRejectedCategories.map((fixture) => fixture.category),
    EXPECTED_REJECTED_CATEGORIES,
    "required rejected categories"
  );
  assertUnique(
    rules.requiredRejectedCategories.map((fixture) => `${fixture.category}:${fixture.expectedCode}`),
    "rejected category/code pairs"
  );
  for (const fixture of rules.requiredRejectedCategories) {
    invariant(fixture.example.length > 0, `${fixture.category} needs a source example`);
    invariant(/^K_[A-Z_]+$/.test(fixture.expectedCode), `${fixture.category} has an invalid code`);
  }

  return {
    grammarProductions: grammarProductions.length,
    staticRules: rules.staticRuleCoverage.length,
    rejectedCategories: rules.requiredRejectedCategories.length
  };
}

export function validateBoundaries(kernel, boundaries) {
  invariant(boundaries.schemaVersion === 1, "boundaries schemaVersion must be 1");
  invariant(boundaries.kernelId === kernel.kernelId, "boundaries kernel ID mismatch");
  assertExactSet(
    boundaries.deferred.map((fixture) => fixture.feature),
    new Set(kernel.deferred),
    "deferred boundary fixtures"
  );
  assertExactSet(
    boundaries.excluded.map((fixture) => fixture.feature),
    new Set(kernel.excluded),
    "excluded boundary fixtures"
  );
  for (const fixture of boundaries.deferred) {
    invariant(fixture.expectedCode === "K_FEATURE_DEFERRED", `${fixture.feature} needs the deferred code`);
    invariant(fixture.example.length > 0, `${fixture.feature} needs an example`);
  }
  for (const fixture of boundaries.excluded) {
    invariant(fixture.expectedCode === "K_FEATURE_EXCLUDED", `${fixture.feature} needs the excluded code`);
    invariant(fixture.example.length > 0, `${fixture.feature} needs an example`);
  }

  return {
    deferred: boundaries.deferred.length,
    excluded: boundaries.excluded.length
  };
}

export function validateFormatterGoldens(kernel, goldens) {
  invariant(goldens.schemaVersion === 1, "formatter schemaVersion must be 1");
  invariant(goldens.kernelId === kernel.kernelId, "formatter kernel ID mismatch");
  assertExactSet(goldens.assertions, EXPECTED_FORMATTER_ASSERTIONS, "formatter assertions");
  invariant(goldens.cases.length >= 3, "at least three formatter golden cases are required");
  assertUnique(goldens.cases.map((fixture) => fixture.id), "formatter fixture IDs");

  for (const fixture of goldens.cases) {
    invariant(fixture.input.endsWith("\n"), `${fixture.id} input must end with LF`);
    invariant(fixture.expected.endsWith("\n"), `${fixture.id} expected output must end with LF`);
    invariant(!fixture.expected.includes("\r"), `${fixture.id} expected output must use LF`);
    invariant(!fixture.expected.includes(";"), `${fixture.id} expected output must reject semicolons`);
    invariant(!/,\s*\}/u.test(fixture.expected), `${fixture.id} expected output has a trailing comma`);
    invariant(!/[ \t]+$/mu.test(fixture.expected), `${fixture.id} expected output has trailing whitespace`);

    const importLines = fixture.expected.split("\n").filter((line) => line.startsWith("import "));
    assertSorted(importLines, `${fixture.id} import modules`);
    for (const line of importLines) {
      const names = line.slice(line.indexOf("{") + 1, line.lastIndexOf("}")).split(", ");
      assertSorted(names, `${fixture.id} import names`);
    }
    for (const match of fixture.expected.matchAll(/uses \{([^}]+)\}/gu)) {
      assertSorted(match[1].split(", "), `${fixture.id} effect names`);
    }
  }

  return { cases: goldens.cases.length };
}

export function validatePublicChangeFixtures(kernel, fixtures) {
  invariant(fixtures.schemaVersion === 1, "public-change schemaVersion must be 1");
  invariant(fixtures.kernelId === kernel.kernelId, "public-change kernel ID mismatch");
  invariant(fixtures.cases.length === EXPECTED_CHANGE_CODES.size, "one fixture per public-change category is required");
  assertUnique(fixtures.cases.map((fixture) => fixture.id), "public-change fixture IDs");
  assertExactSet(
    fixtures.cases.map((fixture) => fixture.category),
    new Set(EXPECTED_CHANGE_CODES.keys()),
    "public-change fixture categories"
  );

  for (const fixture of fixtures.cases) {
    invariant(
      fixture.obligationCode === EXPECTED_CHANGE_CODES.get(fixture.category),
      `${fixture.id} has the wrong obligation code`
    );
    invariant(fixture.affectedStableIds.length > 0, `${fixture.id} must identify affected declarations`);
    assertUnique(fixture.affectedStableIds, `${fixture.id} affected stable IDs`);
    assertSorted(fixture.affectedStableIds, `${fixture.id} affected stable IDs`);
  }

  return { cases: fixtures.cases.length };
}

export function validateBenchmarkCoverage(kernel, protocol, coverage) {
  invariant(coverage.schemaVersion === 1, "coverage schemaVersion must be 1");
  invariant(coverage.kernelId === kernel.kernelId, "coverage kernel ID mismatch");
  invariant(coverage.protocolId === protocol.protocolId, "coverage protocol ID mismatch");
  invariant(coverage.protocolVersion === protocol.version, "coverage protocol version mismatch");
  invariant(coverage.cases.length === protocol.workload.confirmatoryTaskCount, "coverage must contain twelve cases");
  assertUnique(coverage.cases.map((entry) => entry.id), "coverage IDs");

  for (const family of EXPECTED_TASK_FAMILIES) {
    const cases = coverage.cases.filter((entry) => entry.family === family);
    invariant(cases.length === 3, `${family} must have three coverage cases`);
  }
  assertExactSet(
    coverage.cases.map((entry) => entry.family).filter((family, index, values) => values.indexOf(family) === index),
    new Set(protocol.workload.taskFamilies),
    "coverage task families"
  );

  for (const entry of coverage.cases) {
    invariant(EXPECTED_CHANGE_CODES.has(entry.publicChangeCategory), `${entry.id} has an unknown public-change category`);
    invariant(entry.requiredFeatures.length > 0, `${entry.id} must require kernel features`);
    assertUnique(entry.requiredFeatures, `${entry.id} required features`);
    assertSorted(entry.requiredFeatures, `${entry.id} required features`);
    invariant(
      entry.requiredFeatures.every((feature) => kernel.features.includes(feature)),
      `${entry.id} names a feature outside the approved kernel`
    );
  }

  return {
    cases: coverage.cases.length,
    families: EXPECTED_TASK_FAMILIES.length
  };
}
