import type {
  AstV1, CheckerMode, CompilationResult, Declaration, DiagnosticV1, Expr, FunctionDecl,
  Located, Pattern, ProgramGraphEdge, ProgramGraphNode, ProgramGraphV1, RepositoryFacts,
  SourceFile, TypedExpression, TypedIrV1, TypeRef
} from "./contracts.js";
import { makeDiagnostic, orderDiagnostics } from "./diagnostics.js";
import { parse } from "./parser.js";
import {
  compareStable, declarationId, normalizeAst, sha256, siteId, stableJson, typeText
} from "./stable.js";

export const ABLATION_PROFILE = {
  schemaVersion: 1,
  id: "static-obligations-erased",
  version: "1.0.0",
  retained: [
    "K_FEATURE_DEFERRED", "K_FEATURE_EXCLUDED", "K_IMPORT_ALIAS", "K_IMPORT_AMBIGUOUS",
    "K_IMPORT_CYCLE", "K_IMPORT_DUPLICATE", "K_IMPORT_PRIVATE", "K_IMPORT_UNRESOLVED",
    "K_IMPORT_WILDCARD", "K_LEX_IDENTIFIER_ASCII", "K_LEX_LITERAL", "K_LEX_SEMICOLON",
    "K_LEX_TOKEN", "K_LEX_TRAILING_COMMA", "K_MODULE_FILE_MISMATCH", "K_NAME_CONSTRUCTOR_COLLISION",
    "K_NAME_CONVENTION", "K_NAME_DUPLICATE", "K_NAME_PATTERN_DUPLICATE", "K_NAME_SHADOWING",
    "K_NAME_UNDERSCORE",
    "K_PARSE_ALTERNATIVE_SPELLING", "K_PARSE_EXPECTED", "K_RESOLVE_NAME", "K_TYPE_BOUNDARY",
    "K_TYPE_CONDITION", "K_TYPE_LOCAL_OPERATOR"
  ],
  disabled: [
    "K_CHANGE_ADT_VARIANT", "K_CHANGE_EFFECT_SET", "K_CHANGE_FUNCTION_CONTRACT",
    "K_CHANGE_MODULE_MOVE", "K_CHANGE_RECORD_FIELD", "K_EFFECT_DUPLICATE", "K_EFFECT_MISSING",
    "K_EFFECT_UNUSED", "K_IMPORT_UNUSED", "K_MATCH_CATCH_ALL", "K_MATCH_DUPLICATE",
    "K_MATCH_NON_EXHAUSTIVE", "K_MATCH_OPEN_CATCH_ALL", "K_MATCH_OVERLAP",
    "K_MATCH_UNREACHABLE", "K_TYPE_CALL", "K_TYPE_CONSTRUCTOR", "K_TYPE_EXACT",
    "K_TYPE_MATCH_ARMS", "K_TYPE_RECORD_FIELDS", "K_TYPE_RECORD_FIELD_UNKNOWN"
  ]
} as const;

const DISABLED = new Set<string>(ABLATION_PROFILE.disabled);
export const ABLATION_PROFILE_HASH = sha256(stableJson(ABLATION_PROFILE));
const UNKNOWN = "Unknown";
const BUILTIN = new Set(["Int", "Bool", "String", "Unit"]);

interface Definition {
  module: AstV1;
  declaration: Declaration;
  id: string;
}

interface ConstructorDefinition {
  module: AstV1;
  type: Extract<Declaration, { kind: "type" }>;
  name: string;
  payload?: TypeRef;
  id: string;
}

interface ModuleContext {
  ast: AstV1;
  declarations: Map<string, Definition>;
  constructors: Map<string, ConstructorDefinition>;
  imports: Map<string, Definition | ConstructorDefinition>;
  usedImports: Set<string>;
}

interface FunctionFacts {
  definition: Definition;
  directEffects: Set<string>;
  calls: Set<string>;
  requiredEffects: Set<string>;
}

interface TypeEnvironment {
  values: Map<string, string>;
  bindingLocations: Map<string, Located>;
}

interface CheckState {
  mode: CheckerMode;
  diagnostics: DiagnosticV1[];
  modules: Map<string, ModuleContext>;
  definitions: Map<string, Definition>;
  constructors: Map<string, ConstructorDefinition>;
  functions: Map<string, FunctionFacts>;
  typed: Map<string, TypedExpression[]>;
  nodes: Map<string, ProgramGraphNode>;
  edges: ProgramGraphEdge[];
  siteOccurrences: Map<string, number>;
}

function emptyRange(): Located["range"] {
  return { startByte: 0, endByte: 0, startLine: 0, startColumn: 0, endLine: 0, endColumn: 0 };
}

function addDiagnostic(state: CheckState, input: Parameters<typeof makeDiagnostic>[0]): void {
  if (state.mode === "static_obligations_erased" && DISABLED.has(input.code)) return;
  state.diagnostics.push(makeDiagnostic(input));
}

function stableType(state: CheckState, context: ModuleContext, type: TypeRef): string {
  const args = type.args.map((arg) => stableType(state, context, arg));
  if (BUILTIN.has(type.name) || ["List", "Option", "Result"].includes(type.name)) {
    return args.length === 0 ? type.name : `${type.name}<${args.join(",")}>`;
  }
  const target = lookup(context, type.name);
  markImport(context, type.name);
  if (target && "declaration" in target && (target.declaration.kind === "record" || target.declaration.kind === "type")) {
    return `${target.module.module}::${target.declaration.name}`;
  }
  return type.name;
}

function typeBase(type: string): string {
  const index = type.indexOf("<");
  return index === -1 ? type : type.slice(0, index);
}

function typeArgs(type: string): string[] {
  const start = type.indexOf("<");
  if (start === -1 || !type.endsWith(">")) return [];
  const inside = type.slice(start + 1, -1);
  const result: string[] = [];
  let depth = 0;
  let part = "";
  for (const char of inside) {
    if (char === "<") depth += 1;
    if (char === ">") depth -= 1;
    if (char === "," && depth === 0) {
      result.push(part);
      part = "";
    } else part += char;
  }
  result.push(part);
  return result;
}

function lookup(context: ModuleContext, name: string): Definition | ConstructorDefinition | undefined {
  return context.declarations.get(name) ?? context.constructors.get(name) ?? context.imports.get(name);
}

function nestedId(definition: Definition, suffix: string): string {
  return `${definition.id}${suffix}`;
}

function addNode(state: CheckState, id: string, kind: string, ast: AstV1): void {
  state.nodes.set(id, { id, kind, module: ast.module, file: ast.file });
}

function makeSite(state: CheckState, owner: string, kind: string, path: readonly number[]): string {
  const base = `${owner}:${kind}:${path.join(".")}`;
  const occurrence = state.siteOccurrences.get(base) ?? 0;
  state.siteOccurrences.set(base, occurrence + 1);
  return siteId(owner, kind, path, occurrence);
}

function addEdge(
  state: CheckState,
  from: string,
  to: string,
  reason: ProgramGraphEdge["reason"],
  owner: string,
  path: readonly number[]
): string {
  const id = makeSite(state, owner, reason, path);
  state.edges.push({ from, to, reason, siteId: id });
  return id;
}

function addTyped(
  state: CheckState,
  module: string,
  owner: string,
  kind: string,
  path: readonly number[],
  inferredType: string,
  options: Partial<Omit<TypedExpression, "siteId" | "inferredType">> = {}
): void {
  const expressions = state.typed.get(module) ?? [];
  expressions.push({
    siteId: makeSite(state, owner, kind, path),
    inferredType,
    declaredEffects: options.declaredEffects ?? [],
    ...options
  });
  state.typed.set(module, expressions);
}

function namingValid(name: string, upper: boolean): boolean {
  return upper ? /^[A-Z][A-Za-z0-9]*$/u.test(name) : /^[a-z][A-Za-z0-9]*$/u.test(name);
}

function buildState(asts: AstV1[], mode: CheckerMode): CheckState {
  const state: CheckState = {
    mode,
    diagnostics: [],
    modules: new Map(),
    definitions: new Map(),
    constructors: new Map(),
    functions: new Map(),
    typed: new Map(),
    nodes: new Map(),
    edges: [],
    siteOccurrences: new Map()
  };

  for (const ast of asts) {
    if (state.modules.has(ast.module)) {
      addDiagnostic(state, {
        phase: "resolve", code: "K_NAME_DUPLICATE", message: `duplicate module ${ast.module}`,
        file: ast.file, range: ast.range
      });
      continue;
    }
    const context: ModuleContext = {
      ast, declarations: new Map(), constructors: new Map(), imports: new Map(), usedImports: new Set()
    };
    state.modules.set(ast.module, context);
    addNode(state, `${ast.module}::module`, "module", ast);
    for (const declaration of ast.declarations) {
      const upper = declaration.kind !== "function";
      if (!namingValid(declaration.name, upper)) {
        addDiagnostic(state, {
          phase: "resolve", code: "K_NAME_CONVENTION",
          message: `${declaration.name} violates canonical naming`,
          file: declaration.location.file, range: declaration.location.range
        });
      }
      if (context.declarations.has(declaration.name) || context.constructors.has(declaration.name)) {
        addDiagnostic(state, {
          phase: "resolve", code: "K_NAME_DUPLICATE", message: `duplicate declaration ${declaration.name}`,
          file: declaration.location.file, range: declaration.location.range
        });
        continue;
      }
      const id = declarationId(ast.module, declaration);
      const definition = { module: ast, declaration, id };
      context.declarations.set(declaration.name, definition);
      state.definitions.set(id, definition);
      addNode(state, id, declaration.kind, ast);
      addEdge(state, `${ast.module}::module`, id, "defines", id, [0]);

      if (declaration.kind === "record") {
        declaration.fields.forEach((field, index) => {
          const fieldId = nestedId(definition, `::field::${field.name}`);
          addNode(state, fieldId, "field", ast);
          addEdge(state, id, fieldId, "defines", id, [1, index]);
        });
      } else if (declaration.kind === "type") {
        declaration.variants.forEach((variant, index) => {
          const variantId = nestedId(definition, `::variant::${variant.name}`);
          addNode(state, variantId, "variant", ast);
          addEdge(state, id, variantId, "defines", id, [2, index]);
          if (context.constructors.has(variant.name) || context.declarations.has(variant.name)) {
            addDiagnostic(state, {
              phase: "resolve", code: "K_NAME_CONSTRUCTOR_COLLISION",
              message: `constructor ${variant.name} collides in module ${ast.module}`,
              file: variant.location.file, range: variant.location.range
            });
          } else {
            const constructor: ConstructorDefinition = {
              module: ast, type: declaration, name: variant.name,
              ...(variant.payload === undefined ? {} : { payload: variant.payload }),
              id: variantId
            };
            context.constructors.set(variant.name, constructor);
            state.constructors.set(variantId, constructor);
          }
        });
      } else if (declaration.kind === "effect") {
        declaration.operations.forEach((operation, index) => {
          const operationId = nestedId(definition, `::operation::${operation.name}`);
          addNode(state, operationId, "operation", ast);
          addEdge(state, id, operationId, "defines", id, [3, index]);
        });
      } else {
        declaration.params.forEach((param, index) => {
          const parameterId = nestedId(definition, `::param::${index}::${param.name}`);
          addNode(state, parameterId, "parameter", ast);
          addEdge(state, id, parameterId, "defines", id, [4, index]);
        });
        state.functions.set(id, {
          definition, directEffects: new Set(), calls: new Set(), requiredEffects: new Set()
        });
      }
    }
  }
  return state;
}

function resolveImports(state: CheckState): void {
  for (const context of state.modules.values()) {
    for (const imported of context.ast.imports) {
      const targetModule = state.modules.get(imported.module);
      if (!targetModule) {
        addDiagnostic(state, {
          phase: "resolve", code: "K_IMPORT_UNRESOLVED",
          message: `module ${imported.module} does not exist`,
          file: imported.location.file, range: imported.location.range
        });
        continue;
      }
      const seen = new Set<string>();
      for (const name of imported.names) {
        if (seen.has(name)) {
          addDiagnostic(state, {
            phase: "resolve", code: "K_IMPORT_DUPLICATE", message: `duplicate import ${name}`,
            file: imported.location.file, range: imported.location.range
          });
          continue;
        }
        seen.add(name);
        const target = targetModule.declarations.get(name);
        if (!target) {
          addDiagnostic(state, {
            phase: "resolve", code: "K_IMPORT_UNRESOLVED",
            message: `${name} does not exist in ${imported.module}`,
            file: imported.location.file, range: imported.location.range
          });
          continue;
        }
        if (!target.declaration.public) {
          addDiagnostic(state, {
            phase: "resolve", code: "K_IMPORT_PRIVATE",
            message: `${name} is private in ${imported.module}`,
            file: imported.location.file, range: imported.location.range
          });
          continue;
        }
        if (context.imports.has(name)) {
          addDiagnostic(state, {
            phase: "resolve", code: "K_IMPORT_AMBIGUOUS",
            message: `${name} is imported more than once`,
            file: imported.location.file, range: imported.location.range
          });
          continue;
        }
        context.imports.set(name, target);
        addEdge(state, `${context.ast.module}::module`, target.id, "imports", `${context.ast.module}::module`, [5, context.imports.size]);
        if (target.declaration.kind === "type") {
          for (const variant of target.declaration.variants) {
            const constructor = targetModule.constructors.get(variant.name);
            if (constructor) {
              if (context.imports.has(variant.name)) {
                addDiagnostic(state, {
                  phase: "resolve", code: "K_IMPORT_AMBIGUOUS",
                  message: `constructor ${variant.name} is ambiguous`,
                  file: imported.location.file, range: imported.location.range
                });
              } else context.imports.set(variant.name, constructor);
            }
          }
        }
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (module: string, stack: string[]): void => {
    if (visiting.has(module)) {
      const context = state.modules.get(module)!;
      addDiagnostic(state, {
        phase: "resolve", code: "K_IMPORT_CYCLE",
        message: `cyclic import: ${[...stack, module].join(" -> ")}`,
        file: context.ast.file, range: context.ast.range
      });
      return;
    }
    if (visited.has(module)) return;
    visiting.add(module);
    const context = state.modules.get(module);
    if (context) for (const item of context.ast.imports) visit(item.module, [...stack, module]);
    visiting.delete(module);
    visited.add(module);
  };
  for (const module of state.modules.keys()) visit(module, []);
}

function markImport(context: ModuleContext, name: string): void {
  const target = context.imports.get(name);
  if (!target) return;
  context.usedImports.add("type" in target ? target.type.name : name);
}

function findNominal(state: CheckState, stableTypeName: string): Definition | undefined {
  for (const definition of state.definitions.values()) {
    if (
      (definition.declaration.kind === "record" || definition.declaration.kind === "type") &&
      `${definition.module.module}::${definition.declaration.name}` === stableTypeName
    ) return definition;
  }
  return undefined;
}

function compatible(left: string, right: string): boolean {
  if (left === right || left === UNKNOWN || right === UNKNOWN) return true;
  if (typeBase(left) !== typeBase(right)) return false;
  const leftArgs = typeArgs(left);
  const rightArgs = typeArgs(right);
  return leftArgs.length > 0 && leftArgs.length === rightArgs.length &&
    leftArgs.every((item, index) => compatible(item, rightArgs[index]!));
}

function typeError(
  state: CheckState,
  expression: Located,
  code: string,
  message: string,
  expected: string,
  actual: string
): void {
  addDiagnostic(state, {
    phase: "type", code, message, expected, actual,
    file: expression.file, range: expression.range
  });
}

function bindPattern(
  state: CheckState,
  context: ModuleContext,
  pattern: Pattern,
  subjectType: string,
  environment: TypeEnvironment,
  owner: string
): void {
  const seen = new Set<string>();
  const bind = (current: Pattern, type: string): void => {
    if (current.kind === "binding") {
      if (seen.has(current.name)) {
        addDiagnostic(state, {
          phase: "resolve", code: "K_NAME_PATTERN_DUPLICATE",
          message: `pattern binding ${current.name} is repeated`,
          file: current.location.file, range: current.location.range
        });
      } else {
        seen.add(current.name);
        environment.values.set(current.name, type);
        environment.bindingLocations.set(current.name, current.location);
      }
      return;
    }
    if (current.kind === "constructor") {
      if (["None", "Some", "Ok", "Error"].includes(current.name)) {
        const base = typeBase(type);
        const args = typeArgs(type);
        const valid =
          ((current.name === "None" || current.name === "Some") && base === "Option") ||
          ((current.name === "Ok" || current.name === "Error") && base === "Result");
        if (!valid && type !== UNKNOWN) {
          typeError(state, current.location, "K_TYPE_CONSTRUCTOR", "constructor pattern type mismatch", current.name, type);
        }
        const payloadType = current.name === "Some"
          ? (args[0] ?? UNKNOWN)
          : current.name === "Ok"
            ? (args[0] ?? UNKNOWN)
            : current.name === "Error"
              ? (args[1] ?? UNKNOWN)
              : "Unit";
        if (current.payload) bind(current.payload, payloadType);
        return;
      }
      const constructor = lookup(context, current.name);
      if (!constructor || !("type" in constructor)) {
        addDiagnostic(state, {
          phase: "resolve", code: "K_RESOLVE_NAME",
          message: `unknown constructor ${current.name}`,
          file: current.location.file, range: current.location.range
        });
        return;
      }
      markImport(context, current.name);
      const constructedType = `${constructor.module.module}::${constructor.type.name}`;
      const constructorContext = state.modules.get(constructor.module.module)!;
      const payloadType = constructor.payload ? stableType(state, constructorContext, constructor.payload) : "Unit";
      if (current.payload) bind(current.payload, payloadType);
      if (!compatible(constructedType, subjectType)) {
        typeError(state, current.location, "K_TYPE_CONSTRUCTOR", "constructor pattern type mismatch", constructedType, subjectType);
      }
      addEdge(state, owner, constructor.id, "matches", owner, [20, current.location.range.startByte]);
      return;
    }
    if (current.kind === "record") {
      const target = lookup(context, current.name);
      if (target && "declaration" in target && target.declaration.kind === "record") {
        markImport(context, current.name);
        const expectedNames = target.declaration.fields.map((field) => field.name);
        const actualNames = current.fields.map((field) => field.name);
        if (
          new Set(actualNames).size !== actualNames.length ||
          expectedNames.length !== actualNames.length ||
          expectedNames.some((name) => !actualNames.includes(name))
        ) {
          typeError(
            state,
            current.location,
            "K_TYPE_RECORD_FIELDS",
            "record pattern fields must match exactly",
            expectedNames.join(","),
            actualNames.join(",")
          );
        }
        for (const field of current.fields) {
          const definitionField = target.declaration.fields.find((item) => item.name === field.name);
          const recordContext = state.modules.get(target.module.module)!;
          bind(field.pattern, definitionField ? stableType(state, recordContext, definitionField.type) : UNKNOWN);
        }
      }
      return;
    }
    if (current.kind === "list" && !current.empty) {
      const element = typeArgs(subjectType)[0] ?? UNKNOWN;
      if (current.head) bind(current.head, element);
      if (current.tail) {
        environment.values.set(current.tail, subjectType);
        environment.bindingLocations.set(current.tail, current.location);
      }
    }
  };
  bind(pattern, subjectType);
}

function patternKey(pattern: Pattern): string {
  switch (pattern.kind) {
    case "wildcard": return "*";
    case "binding": return "*";
    case "literal": return `${pattern.literalKind}:${String(pattern.value)}`;
    case "constructor": return `constructor:${pattern.name}`;
    case "record": return "record:*";
    case "list": return pattern.empty ? "list:empty" : "list:cons";
  }
}

function checkExhaustiveness(
  state: CheckState,
  context: ModuleContext,
  expression: Extract<Expr, { kind: "match" }>,
  subjectType: string
): void {
  const keys = expression.arms.map((arm) => patternKey(arm.pattern));
  const catchAllIndex = keys.indexOf("*");
  if (catchAllIndex !== -1 && catchAllIndex !== keys.length - 1) {
    addDiagnostic(state, {
      phase: "exhaustiveness", code: "K_MATCH_UNREACHABLE",
      message: "arms after a catch-all are unreachable",
      file: expression.location.file, range: expression.location.range
    });
  }
  const duplicateKeys = keys.filter((key, index) => keys.indexOf(key) !== index);
  if (duplicateKeys.some((key) =>
    ["Int:", "String:", "Bool:", "Unit:"].some((prefix) => key.startsWith(prefix))
  )) {
    addDiagnostic(state, {
      phase: "exhaustiveness", code: "K_MATCH_DUPLICATE",
      message: "duplicate match arm",
      file: expression.location.file, range: expression.location.range
    });
  } else if (duplicateKeys.length > 0) {
    addDiagnostic(state, {
      phase: "exhaustiveness", code: "K_MATCH_OVERLAP",
      message: "overlapping match arms",
      file: expression.location.file, range: expression.location.range
    });
  }
  const hasCatchAll = keys.includes("*");
  let expected: string[] | undefined;
  if (subjectType === "Bool") expected = ["Bool:false", "Bool:true"];
  else if (typeBase(subjectType) === "Option") expected = ["constructor:None", "constructor:Some"];
  else if (typeBase(subjectType) === "Result") expected = ["constructor:Error", "constructor:Ok"];
  else if (typeBase(subjectType) === "List") expected = ["list:cons", "list:empty"];
  else {
    const nominal = findNominal(state, subjectType);
    if (nominal?.declaration.kind === "type") {
      expected = nominal.declaration.variants.map((variant) => `constructor:${variant.name}`).sort(compareStable);
    }
  }
  if (expected) {
    if (hasCatchAll) {
      addDiagnostic(state, {
        phase: "exhaustiveness", code: "K_MATCH_CATCH_ALL",
        message: "closed matches must name every constructor",
        file: expression.location.file, range: expression.location.range
      });
    } else {
      const missing = expected.filter((item) => !keys.includes(item));
      if (missing.length > 0) {
        addDiagnostic(state, {
          phase: "exhaustiveness", code: "K_MATCH_NON_EXHAUSTIVE",
          message: `non-exhaustive match; missing ${missing.join(", ")}`,
          file: expression.location.file, range: expression.location.range
        });
      }
    }
  } else if (!hasCatchAll && subjectType !== UNKNOWN) {
    addDiagnostic(state, {
      phase: "exhaustiveness", code: "K_MATCH_OPEN_CATCH_ALL",
      message: "open matches require a final catch-all",
      file: expression.location.file, range: expression.location.range
    });
  }
  void context;
}

function validateDeclarations(state: CheckState): void {
  const validateType = (context: ModuleContext, type: TypeRef, ownerPublic: boolean): void => {
    const expectedArity = type.name === "List" || type.name === "Option"
      ? 1
      : type.name === "Result"
        ? 2
        : 0;
    if (BUILTIN.has(type.name) || ["List", "Option", "Result"].includes(type.name)) {
      if (type.args.length !== expectedArity) {
        typeError(
          state,
          type.location,
          "K_TYPE_BOUNDARY",
          `${type.name} requires ${expectedArity} type arguments`,
          String(expectedArity),
          String(type.args.length)
        );
      }
    } else {
      const target = lookup(context, type.name);
      if (!target || !("declaration" in target) ||
          (target.declaration.kind !== "record" && target.declaration.kind !== "type")) {
        addDiagnostic(state, {
          phase: "resolve", code: "K_RESOLVE_NAME", message: `unknown type ${type.name}`,
          file: type.location.file, range: type.location.range
        });
      } else {
        markImport(context, type.name);
        if (ownerPublic && target.module.module === context.ast.module && !target.declaration.public) {
          addDiagnostic(state, {
            phase: "resolve", code: "K_IMPORT_PRIVATE",
            message: `public surface cannot expose private type ${type.name}`,
            file: type.location.file, range: type.location.range
          });
        }
      }
    }
    for (const arg of type.args) validateType(context, arg, ownerPublic);
  };

  for (const context of state.modules.values()) {
    for (const definition of context.declarations.values()) {
      const declaration = definition.declaration;
      if (declaration.kind === "record") {
        for (const field of declaration.fields) {
          if (!namingValid(field.name, false)) {
            addDiagnostic(state, {
              phase: "resolve", code: "K_NAME_CONVENTION", message: `${field.name} violates lowerCamelCase`,
              file: field.location.file, range: field.location.range
            });
          }
        }
        const names = declaration.fields.map((field) => field.name);
        if (new Set(names).size !== names.length) {
          typeError(state, declaration.location, "K_TYPE_RECORD_FIELDS", "record declaration has duplicate fields", "unique fields", names.join(","));
        }
        for (const field of declaration.fields) validateType(context, field.type, declaration.public);
      } else if (declaration.kind === "type") {
        for (const variant of declaration.variants) {
          if (variant.payload) validateType(context, variant.payload, declaration.public);
        }
      } else if (declaration.kind === "effect") {
        for (const operation of declaration.operations) {
          if (!namingValid(operation.name, false)) {
            addDiagnostic(state, {
              phase: "resolve", code: "K_NAME_CONVENTION", message: `${operation.name} violates lowerCamelCase`,
              file: operation.location.file, range: operation.location.range
            });
          }
        }
        const names = declaration.operations.map((operation) => operation.name);
        if (new Set(names).size !== names.length) {
          addDiagnostic(state, {
            phase: "resolve", code: "K_NAME_DUPLICATE", message: "duplicate effect operation",
            file: declaration.location.file, range: declaration.location.range
          });
        }
        for (const operation of declaration.operations) {
          operation.params.forEach((param) => validateType(context, param.type, declaration.public));
          validateType(context, operation.returnType, declaration.public);
        }
      } else {
        for (const param of declaration.params) {
          if (!namingValid(param.name, false)) {
            addDiagnostic(state, {
              phase: "resolve", code: "K_NAME_CONVENTION", message: `${param.name} violates lowerCamelCase`,
              file: param.location.file, range: param.location.range
            });
          }
        }
        declaration.params.forEach((param) => validateType(context, param.type, declaration.public));
        validateType(context, declaration.returnType, declaration.public);
        for (const effect of declaration.uses) {
          const target = lookup(context, effect);
          if (!target || !("declaration" in target) || target.declaration.kind !== "effect") {
            addDiagnostic(state, {
              phase: "resolve", code: "K_RESOLVE_NAME", message: `unknown effect ${effect}`,
              file: declaration.location.file, range: declaration.location.range
            });
          } else markImport(context, effect);
        }
      }
    }
  }
}

function checkExpression(
  state: CheckState,
  context: ModuleContext,
  expression: Expr,
  environment: TypeEnvironment,
  owner: string,
  path: number[],
  facts: FunctionFacts
): string {
  const child = (value: Expr, index: number, env = environment): string =>
    checkExpression(state, context, value, env, owner, [...path, index], facts);
  let result = UNKNOWN;
  let resolvedTarget: string | undefined;
  let runtimeCapability: string | undefined;
  switch (expression.kind) {
    case "literal":
      result = expression.literalKind;
      if (expression.literalKind === "Int") {
        const value = expression.value as bigint;
        if (value > 9223372036854775807n) {
          typeError(state, expression.location, "K_TYPE_EXACT", "integer literal exceeds signed 64-bit range", "Int64", value.toString());
        }
      }
      break;
    case "name": {
      const local = environment.values.get(expression.name);
      if (local) result = local;
      else if (expression.name === "None") result = "Option<Unknown>";
      else if (["Some", "Ok", "Error"].includes(expression.name)) {
        result = `BuiltinConstructor:${expression.name}`;
      }
      else {
        const target = lookup(context, expression.name);
        if (!target) {
          addDiagnostic(state, {
            phase: "resolve", code: "K_RESOLVE_NAME", message: `unknown name ${expression.name}`,
            file: expression.location.file, range: expression.location.range
          });
        } else {
          markImport(context, expression.name);
          resolvedTarget = target.id;
          addEdge(state, owner, target.id, "references", owner, path);
          if ("type" in target) {
            result = target.payload === undefined
              ? `${target.module.module}::${target.type.name}`
              : `Constructor:${target.id}`;
          }
          else if (target.declaration.kind === "function") result = `Function:${target.id}`;
          else if (target.declaration.kind === "effect") result = `Effect:${target.id}`;
          else result = `${target.module.module}::${target.declaration.name}`;
        }
      }
      break;
    }
    case "list": {
      const types = expression.items.map((item, index) => child(item, index));
      const element = types.find((type) => type !== UNKNOWN) ?? UNKNOWN;
      for (const type of types) {
        if (!compatible(type, element)) typeError(state, expression.location, "K_TYPE_EXACT", "list elements require one exact type", element, type);
      }
      result = `List<${element}>`;
      break;
    }
    case "record": {
      const target = lookup(context, expression.name);
      if (!target || !("declaration" in target) || target.declaration.kind !== "record") {
        addDiagnostic(state, {
          phase: "resolve", code: "K_RESOLVE_NAME", message: `unknown record ${expression.name}`,
          file: expression.location.file, range: expression.location.range
        });
        expression.fields.forEach((field, index) => child(field.value, index));
        break;
      }
      markImport(context, expression.name);
      resolvedTarget = target.id;
      addEdge(state, owner, target.id, "constrains", owner, path);
      const recordDeclaration = target.declaration;
      const expectedNames = recordDeclaration.fields.map((field) => field.name);
      const actualNames = expression.fields.map((field) => field.name);
      if (
        new Set(actualNames).size !== actualNames.length ||
        expectedNames.length !== actualNames.length ||
        expectedNames.some((name) => !actualNames.includes(name))
      ) {
        typeError(state, expression.location, "K_TYPE_RECORD_FIELDS", "record fields must match exactly", expectedNames.join(","), actualNames.join(","));
      }
      expression.fields.forEach((field, index) => {
        const actual = child(field.value, index);
        const expected = recordDeclaration.fields.find((item) => item.name === field.name);
        if (expected) {
          const recordContext = state.modules.get(target.module.module)!;
          const expectedType = stableType(state, recordContext, expected.type);
          if (!compatible(actual, expectedType)) {
            typeError(state, field.location, "K_TYPE_EXACT", `field ${field.name} has wrong type`, expectedType, actual);
          }
        }
      });
      result = state.mode === "static_obligations_erased" ? UNKNOWN : `${target.module.module}::${target.declaration.name}`;
      break;
    }
    case "field": {
      const targetType = child(expression.target, 0);
      const nominal = findNominal(state, targetType);
      if (nominal?.declaration.kind === "record") {
        const field = nominal.declaration.fields.find((item) => item.name === expression.name);
        if (field) {
          result = stableType(state, state.modules.get(nominal.module.module)!, field.type);
          resolvedTarget = `${nominal.id}::field::${field.name}`;
          addEdge(state, owner, resolvedTarget, "references", owner, path);
        } else {
          typeError(state, expression.location, "K_TYPE_RECORD_FIELD_UNKNOWN", `record has no field ${expression.name}`, "known field", expression.name);
        }
      } else if (targetType !== UNKNOWN && !targetType.startsWith("Effect:")) {
        typeError(state, expression.location, "K_TYPE_RECORD_FIELD_UNKNOWN", "field access requires a record", "record", targetType);
      }
      break;
    }
    case "call": {
      if (expression.callee.kind === "field" && expression.callee.target.kind === "name") {
        const receiver = expression.callee.target.name;
        const calleeName = expression.callee.name;
        if (receiver === "List") {
          const args = expression.args.map((arg, index) => child(arg, index));
          if (calleeName === "length") {
            if (args.length !== 1 || typeBase(args[0] ?? UNKNOWN) !== "List") {
              typeError(state, expression.location, "K_TYPE_CALL", "List.length expects one List argument", "List<T>", args.join(","));
            }
            result = state.mode === "static_obligations_erased" ? UNKNOWN : "Int";
          } else if (calleeName === "prepend") {
            if (args.length !== 2 || typeBase(args[1] ?? UNKNOWN) !== "List") {
              typeError(state, expression.location, "K_TYPE_CALL", "List.prepend expects value and List", "T,List<T>", args.join(","));
            }
            result = state.mode === "static_obligations_erased" ? UNKNOWN : (args[1] ?? UNKNOWN);
          } else {
            addDiagnostic(state, {
              phase: "resolve", code: "K_RESOLVE_NAME", message: `unknown List operation ${calleeName}`,
              file: expression.location.file, range: expression.location.range
            });
          }
          break;
        }
        const effectTarget = lookup(context, receiver);
        if (effectTarget && "declaration" in effectTarget && effectTarget.declaration.kind === "effect") {
          markImport(context, receiver);
          const operation = effectTarget.declaration.operations.find((item) => item.name === calleeName);
          if (!operation) {
            addDiagnostic(state, {
              phase: "resolve", code: "K_RESOLVE_NAME", message: `unknown effect operation ${receiver}.${calleeName}`,
              file: expression.location.file, range: expression.location.range
            });
            expression.args.forEach((arg, index) => child(arg, index));
            break;
          }
          const args = expression.args.map((arg, index) => child(arg, index));
          const effectContext = state.modules.get(effectTarget.module.module)!;
          const expected = operation.params.map((param) => stableType(state, effectContext, param.type));
          if (args.length !== expected.length || args.some((arg, index) => !compatible(arg, expected[index] ?? UNKNOWN))) {
            typeError(state, expression.location, "K_TYPE_CALL", "effect operation arguments do not match", expected.join(","), args.join(","));
          }
          facts.directEffects.add(effectTarget.declaration.name);
          resolvedTarget = `${effectTarget.id}::operation::${operation.name}`;
          runtimeCapability = effectTarget.id;
          addEdge(state, owner, resolvedTarget, "uses-effect", owner, path);
          result = state.mode === "static_obligations_erased" ? UNKNOWN : stableType(state, effectContext, operation.returnType);
          break;
        }
      }
      const calleeType = child(expression.callee, 0);
      const args = expression.args.map((arg, index) => child(arg, index + 1));
      if (calleeType.startsWith("Function:")) {
        const targetId = calleeType.slice("Function:".length);
        const target = state.definitions.get(targetId);
        if (target?.declaration.kind === "function") {
          const expected = target.declaration.params.map((param) =>
            stableType(state, state.modules.get(target.module.module)!, param.type)
          );
          if (args.length !== expected.length || args.some((arg, index) => !compatible(arg, expected[index] ?? UNKNOWN))) {
            typeError(state, expression.location, "K_TYPE_CALL", "function arguments do not match", expected.join(","), args.join(","));
          }
          facts.calls.add(targetId);
          resolvedTarget = targetId;
          addEdge(state, owner, targetId, "calls", owner, path);
          result = state.mode === "static_obligations_erased"
            ? UNKNOWN
            : stableType(state, state.modules.get(target.module.module)!, target.declaration.returnType);
        }
      } else if (calleeType.startsWith("BuiltinConstructor:")) {
        const name = calleeType.slice("BuiltinConstructor:".length);
        if (args.length !== 1) {
          typeError(state, expression.location, "K_TYPE_CONSTRUCTOR", `${name} expects one payload`, "one argument", String(args.length));
        }
        result = state.mode === "static_obligations_erased"
          ? UNKNOWN
          : name === "Some"
            ? `Option<${args[0] ?? UNKNOWN}>`
            : name === "Ok"
              ? `Result<${args[0] ?? UNKNOWN},Unknown>`
              : `Result<Unknown,${args[0] ?? UNKNOWN}>`;
      } else if (calleeType.startsWith("Constructor:")) {
        const targetId = calleeType.slice("Constructor:".length);
        const constructor = state.constructors.get(targetId);
        if (constructor) {
          const constructorContext = state.modules.get(constructor.module.module)!;
          const expected = constructor.payload ? [stableType(state, constructorContext, constructor.payload)] : [];
          if (args.length !== expected.length || args.some((arg, index) => !compatible(arg, expected[index] ?? UNKNOWN))) {
            typeError(state, expression.location, "K_TYPE_CONSTRUCTOR", "constructor payload does not match", expected.join(","), args.join(","));
          }
          result = state.mode === "static_obligations_erased" ? UNKNOWN : `${constructor.module.module}::${constructor.type.name}`;
        }
      } else if (calleeType !== UNKNOWN) {
        typeError(state, expression.location, "K_TYPE_CALL", "value is not callable", "function or constructor", calleeType);
      }
      break;
    }
    case "unary": {
      const operand = child(expression.operand, 0);
      const expected = expression.operator === "!" ? "Bool" : "Int";
      if (operand !== UNKNOWN && operand !== expected) {
        typeError(state, expression.location, "K_TYPE_LOCAL_OPERATOR", `operator ${expression.operator} requires ${expected}`, expected, operand);
      }
      result = operand === UNKNOWN ? UNKNOWN : expected;
      break;
    }
    case "binary": {
      const left = child(expression.left, 0);
      const right = child(expression.right, 1);
      if (left === UNKNOWN || right === UNKNOWN) {
        result = UNKNOWN;
        break;
      }
      if (["&&", "||"].includes(expression.operator)) {
        if (left !== "Bool" || right !== "Bool") typeError(state, expression.location, "K_TYPE_LOCAL_OPERATOR", "boolean operator requires Bool operands", "Bool,Bool", `${left},${right}`);
        result = "Bool";
      } else if (["<", "<=", ">", ">="].includes(expression.operator)) {
        if (left !== right || !["Int", "String"].includes(left)) typeError(state, expression.location, "K_TYPE_LOCAL_OPERATOR", "ordering requires matching Int or String operands", "Int,Int or String,String", `${left},${right}`);
        result = "Bool";
      } else if (["==", "!="].includes(expression.operator)) {
        if (!compatible(left, right)) typeError(state, expression.location, "K_TYPE_LOCAL_OPERATOR", "equality operands must match", left, right);
        result = "Bool";
      } else if (expression.operator === "+") {
        if (left !== right || !["Int", "String"].includes(left)) typeError(state, expression.location, "K_TYPE_LOCAL_OPERATOR", "addition requires matching Int or String operands", "Int,Int or String,String", `${left},${right}`);
        result = left;
      } else {
        if (left !== "Int" || right !== "Int") typeError(state, expression.location, "K_TYPE_LOCAL_OPERATOR", "arithmetic requires Int operands", "Int,Int", `${left},${right}`);
        result = "Int";
      }
      break;
    }
    case "let": {
      if (environment.values.has(expression.name)) {
        addDiagnostic(state, {
          phase: "resolve", code: "K_NAME_SHADOWING", message: `${expression.name} shadows an existing binding`,
          file: expression.location.file, range: expression.location.range
        });
      }
      const valueType = child(expression.value, 0);
      const declared = expression.annotation ? stableType(state, context, expression.annotation) : valueType;
      if (expression.annotation && !compatible(valueType, declared)) {
        typeError(state, expression.location, "K_TYPE_EXACT", "local annotation does not match", declared, valueType);
      }
      const next: TypeEnvironment = {
        values: new Map(environment.values),
        bindingLocations: new Map(environment.bindingLocations)
      };
      next.values.set(expression.name, declared);
      next.bindingLocations.set(expression.name, expression.location);
      result = child(expression.body, 1, next);
      break;
    }
    case "if": {
      const condition = child(expression.condition, 0);
      if (condition !== UNKNOWN && condition !== "Bool") {
        typeError(state, expression.condition.location, "K_TYPE_CONDITION", "if condition must be Bool", "Bool", condition);
      }
      const thenType = child(expression.then, 1);
      const elseType = child(expression.otherwise, 2);
      if (!compatible(thenType, elseType)) {
        typeError(state, expression.location, "K_TYPE_EXACT", "if branches must have one exact type", thenType, elseType);
      }
      result = thenType === UNKNOWN ? elseType : thenType;
      break;
    }
    case "match": {
      const subject = child(expression.subject, 0);
      checkExhaustiveness(state, context, expression, subject);
      const armTypes: string[] = [];
      expression.arms.forEach((arm, index) => {
        const next: TypeEnvironment = {
          values: new Map(environment.values),
          bindingLocations: new Map(environment.bindingLocations)
        };
        bindPattern(state, context, arm.pattern, subject, next, owner);
        armTypes.push(child(arm.value, index + 1, next));
      });
      const concrete = armTypes.find((type) => type !== UNKNOWN) ?? UNKNOWN;
      for (const type of armTypes) {
        if (!compatible(type, concrete)) typeError(state, expression.location, "K_TYPE_MATCH_ARMS", "match arms must have one exact type", concrete, type);
      }
      result = concrete;
      break;
    }
  }
  addTyped(state, context.ast.module, owner, expression.kind, path, result, {
    ...(resolvedTarget === undefined ? {} : { resolvedTarget }),
    declaredEffects: [...facts.definition.declaration.kind === "function" ? facts.definition.declaration.uses : []],
    ...(runtimeCapability === undefined ? {} : { runtimeCapability })
  });
  return result;
}

function checkFunctions(state: CheckState): void {
  for (const facts of state.functions.values()) {
    const declaration = facts.definition.declaration as FunctionDecl;
    const context = state.modules.get(facts.definition.module.module)!;
    const values = new Map<string, string>();
    const bindingLocations = new Map<string, Located>();
    for (const param of declaration.params) {
      if (values.has(param.name)) {
        addDiagnostic(state, {
          phase: "resolve", code: "K_NAME_DUPLICATE", message: `duplicate parameter ${param.name}`,
          file: param.location.file, range: param.location.range
        });
      }
      values.set(param.name, stableType(state, context, param.type));
      bindingLocations.set(param.name, param.location);
    }
    if (new Set(declaration.uses).size !== declaration.uses.length) {
      addDiagnostic(state, {
        phase: "effect", code: "K_EFFECT_DUPLICATE", message: "effect set contains duplicates",
        file: declaration.location.file, range: declaration.location.range
      });
    }
    const actual = checkExpression(
      state, context, declaration.body, { values, bindingLocations }, facts.definition.id, [0], facts
    );
    const expected = stableType(state, context, declaration.returnType);
    if (!compatible(actual, expected)) {
      typeError(state, declaration.body.location, "K_TYPE_EXACT", "function body does not match declared return type", expected, actual);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const facts of state.functions.values()) {
      const next = new Set(facts.directEffects);
      for (const call of facts.calls) {
        const callee = state.functions.get(call);
        if (callee) for (const effect of callee.requiredEffects) next.add(effect);
      }
      if (next.size !== facts.requiredEffects.size || [...next].some((item) => !facts.requiredEffects.has(item))) {
        facts.requiredEffects = next;
        changed = true;
      }
    }
  }
  for (const facts of state.functions.values()) {
    const declaration = facts.definition.declaration as FunctionDecl;
    const declared = new Set(declaration.uses);
    const missing = [...facts.requiredEffects].filter((effect) => !declared.has(effect));
    const unused = [...declared].filter((effect) => !facts.requiredEffects.has(effect));
    if (missing.length > 0) {
      addDiagnostic(state, {
        phase: "effect", code: "K_EFFECT_MISSING", message: `missing effects: ${missing.sort(compareStable).join(", ")}`,
        file: declaration.location.file, range: declaration.location.range
      });
    }
    if (unused.length > 0) {
      addDiagnostic(state, {
        phase: "effect", code: "K_EFFECT_UNUSED", message: `unused effects: ${unused.sort(compareStable).join(", ")}`,
        file: declaration.location.file, range: declaration.location.range
      });
    }
    for (const effect of declaration.uses) {
      const target = lookup(state.modules.get(facts.definition.module.module)!, effect);
      if (target && "declaration" in target && target.declaration.kind === "effect") {
        addEdge(state, facts.definition.id, target.id, "uses-effect", facts.definition.id, [90, declaration.uses.indexOf(effect)]);
      }
    }
  }
}

function checkUnusedImports(state: CheckState): void {
  for (const context of state.modules.values()) {
    for (const item of context.ast.imports) {
      for (const name of item.names) {
        if (!context.usedImports.has(name)) {
          addDiagnostic(state, {
            phase: "resolve", code: "K_IMPORT_UNUSED", message: `unused import ${name}`,
            file: item.location.file, range: item.location.range
          });
        }
      }
    }
  }
}

function finalizeGraph(state: CheckState): ProgramGraphV1 {
  const testFunctions = [...state.functions.values()].filter((facts) =>
    facts.definition.module.module === "tests" || facts.definition.module.module.endsWith(".tests")
  );
  for (const test of testFunctions) {
    for (const edge of state.edges.filter((item) => item.from === test.definition.id && item.reason === "calls")) {
      addEdge(state, edge.to, test.definition.id, "tested-by", test.definition.id, [99, edge.siteId.length]);
    }
  }
  return {
    schemaVersion: 1,
    nodes: [...state.nodes.values()].sort((a, b) => compareStable(a.id, b.id)),
    edges: [...state.edges].sort((a, b) =>
      compareStable(a.from, b.from) || compareStable(a.to, b.to) ||
      compareStable(a.reason, b.reason) || compareStable(a.siteId, b.siteId)
    )
  };
}

function validateModulePaths(state: CheckState): void {
  for (const context of state.modules.values()) {
    const normalized = context.ast.file.replaceAll("\\", "/").replace(/\.volt$/u, "");
    if (!normalized.endsWith(context.ast.module.replaceAll(".", "/"))) {
      addDiagnostic(state, {
        phase: "resolve", code: "K_MODULE_FILE_MISMATCH",
        message: `module ${context.ast.module} does not match ${context.ast.file}`,
        file: context.ast.file, range: context.ast.range
      });
    }
  }
}

export function compileSources(sources: SourceFile[], mode: CheckerMode = "full"): CompilationResult {
  const asts: AstV1[] = [];
  const parseDiagnostics: DiagnosticV1[] = [];
  for (const source of [...sources].sort((a, b) => compareStable(a.path, b.path))) {
    const result = parse(source);
    if (result.ast) asts.push(result.ast);
    parseDiagnostics.push(...result.diagnostics);
  }
  const state = buildState(asts, mode);
  state.diagnostics.push(...parseDiagnostics);
  validateModulePaths(state);
  resolveImports(state);
  validateDeclarations(state);
  checkFunctions(state);
  checkUnusedImports(state);
  const graph = finalizeGraph(state);
  return {
    ast: asts.sort((a, b) => compareStable(a.module, b.module)),
    normalizedAst: asts.map(normalizeAst).sort((a, b) => compareStable(a.moduleBoundary, b.moduleBoundary)),
    typedIr: [...state.typed.entries()].map(([module, expressions]): TypedIrV1 => ({
      schemaVersion: 1,
      module,
      expressions: expressions.sort((a, b) => compareStable(a.siteId, b.siteId))
    })).sort((a, b) => compareStable(a.module, b.module)),
    graph,
    diagnostics: orderDiagnostics(state.diagnostics),
    runManifest: {
      schemaVersion: 1,
      checkerMode: mode,
      checkerProfileVersion: ABLATION_PROFILE.version,
      checkerProfileHash: ABLATION_PROFILE_HASH,
      sourceHashes: Object.fromEntries([...sources].sort((a, b) => compareStable(a.path, b.path))
        .map((source) => [source.path, sha256(source.text)]))
    }
  };
}

function signature(definition: Definition): string {
  const declaration = definition.declaration;
  switch (declaration.kind) {
    case "record": return stableJson(declaration.fields.map((field) => [field.name, typeText(field.type)]));
    case "type": return stableJson(declaration.variants.map((variant) => [variant.name, variant.payload ? typeText(variant.payload) : null]));
    case "effect": return stableJson(declaration.operations.map((operation) => [
      operation.name, operation.params.map((param) => typeText(param.type)), typeText(operation.returnType)
    ]));
    case "function": return stableJson([
      declaration.params.map((param) => typeText(param.type)), declaration.uses, typeText(declaration.returnType)
    ]);
  }
}

export interface PublicChange {
  category: "adt_variant" | "record_field" | "function_contract" | "effect_set" | "module_move";
  code: string;
  declaration: string;
  repository: RepositoryFacts;
}

const CHANGE_CODES: Record<PublicChange["category"], string> = {
  adt_variant: "K_CHANGE_ADT_VARIANT",
  record_field: "K_CHANGE_RECORD_FIELD",
  function_contract: "K_CHANGE_FUNCTION_CONTRACT",
  effect_set: "K_CHANGE_EFFECT_SET",
  module_move: "K_CHANGE_MODULE_MOVE"
};

function definitionsFrom(result: CompilationResult): Map<string, ProgramGraphNode> {
  return new Map(result.graph.nodes.filter((item) =>
    ["record", "type", "effect", "function"].includes(item.kind)
  ).map((item) => [item.id, item]));
}

export function analyzePublicChanges(
  beforeSources: SourceFile[],
  afterSources: SourceFile[]
): PublicChange[] {
  const before = compileSources(beforeSources, "full");
  const after = compileSources(afterSources, "full");
  const beforeNodes = definitionsFrom(before);
  const afterNodes = definitionsFrom(after);
  const beforeAsts = new Map(before.ast.flatMap((ast) => ast.declarations.map((declaration) => [
    declarationId(ast.module, declaration), { module: ast, declaration, id: declarationId(ast.module, declaration) }
  ] as const)));
  const afterAsts = new Map(after.ast.flatMap((ast) => ast.declarations.map((declaration) => [
    declarationId(ast.module, declaration), { module: ast, declaration, id: declarationId(ast.module, declaration) }
  ] as const)));
  const changes: Array<{ category: PublicChange["category"]; beforeId?: string; afterId: string }> = [];
  for (const [id, next] of afterAsts) {
    const previous = beforeAsts.get(id);
    if (previous && signature(previous) !== signature(next)) {
      if (next.declaration.kind === "type") changes.push({ category: "adt_variant", beforeId: id, afterId: id });
      else if (next.declaration.kind === "record") changes.push({ category: "record_field", beforeId: id, afterId: id });
      else if (next.declaration.kind === "function") {
        const beforeFunction = previous.declaration as FunctionDecl;
        const afterFunction = next.declaration;
        const category = stableJson(beforeFunction.uses) !== stableJson(afterFunction.uses)
          ? "effect_set"
          : "function_contract";
        changes.push({ category, beforeId: id, afterId: id });
      }
    } else if (!previous) {
      const moved = [...beforeAsts.entries()].find(([, candidate]) =>
        candidate.declaration.kind === next.declaration.kind &&
        candidate.declaration.name === next.declaration.name
      );
      if (moved) changes.push({ category: "module_move", beforeId: moved[0], afterId: id });
    }
  }
  return changes.map((change) => {
    const relatedEdges = [...before.graph.edges, ...after.graph.edges].filter((edge) =>
      edge.from === change.beforeId || edge.to === change.beforeId ||
      edge.from === change.afterId || edge.to === change.afterId
    );
    const affectedDeclarations = [...new Set(relatedEdges.flatMap((edge) => [edge.from, edge.to])
      .filter((id) => beforeNodes.has(id) || afterNodes.has(id) || id.includes("::function::")))].sort(compareStable);
    const affectedSites = [...new Set(relatedEdges.map((edge) => edge.siteId))].sort(compareStable);
    const beforeSites = new Set(before.graph.edges.filter((edge) =>
      edge.from === change.beforeId || edge.to === change.beforeId
    ).map((edge) => edge.siteId));
    const afterSites = new Set(after.graph.edges.filter((edge) =>
      edge.from === change.afterId || edge.to === change.afterId
    ).map((edge) => edge.siteId));
    const reasons = [...new Set(relatedEdges.map((edge) => edge.reason))].sort(compareStable);
    const files = [...new Set(affectedDeclarations.map((id) =>
      beforeNodes.get(id)?.file ?? afterNodes.get(id)?.file
    ).filter((file): file is string => file !== undefined))].sort(compareStable);
    const repository: RepositoryFacts = {
      affectedSymbols: [change.afterId, ...affectedDeclarations].filter((value, index, all) => all.indexOf(value) === index).sort(compareStable),
      affectedDeclarations,
      affectedFiles: files,
      affectedSites,
      missingPropagationSites: [...beforeSites].filter((site) => !afterSites.has(site)).sort(compareStable),
      dependencyReasons: reasons,
      boundedRepairSurface: affectedSites.map((stableId, index) => ({
        stableId,
        reason: reasons[index % Math.max(1, reasons.length)] ?? "references"
      }))
    };
    return {
      category: change.category,
      code: CHANGE_CODES[change.category],
      declaration: change.afterId,
      repository
    };
  }).sort((a, b) => compareStable(a.declaration, b.declaration));
}

const CHANGE_PHASES: Record<PublicChange["category"], "resolve" | "type" | "effect" | "exhaustiveness"> = {
  adt_variant: "exhaustiveness",
  record_field: "type",
  function_contract: "type",
  effect_set: "effect",
  module_move: "resolve"
};

export function publicChangeDiagnostics(
  beforeSources: SourceFile[],
  afterSources: SourceFile[],
  mode: CheckerMode = "full"
): DiagnosticV1[] {
  if (mode === "static_obligations_erased") return [];
  const after = compileSources(afterSources, "full");
  const locations = new Map(after.ast.flatMap((ast) => ast.declarations.map((declaration) => [
    declarationId(ast.module, declaration),
    declaration.location
  ] as const)));
  return orderDiagnostics(analyzePublicChanges(beforeSources, afterSources).map((change) => {
    const location = locations.get(change.declaration) ?? {
      file: change.repository.affectedFiles[0] ?? "<repository>",
      range: emptyRange()
    };
    return makeDiagnostic({
      phase: CHANGE_PHASES[change.category],
      code: change.code,
      message: `public ${change.category.replaceAll("_", " ")} change requires repository propagation`,
      file: location.file,
      range: location.range,
      repairs: change.repository.boundedRepairSurface.map((target) => ({
        title: `update ${target.stableId}`,
        applicability: "maybe",
        target: target.stableId
      })),
      repository: change.repository
    });
  }));
}
