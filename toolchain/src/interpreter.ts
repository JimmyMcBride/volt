import type {
  AstV1, CompilationResult, Declaration, DiagnosticV1, Expr, FunctionDecl, Pattern
} from "./contracts.js";
import { makeDiagnostic, orderDiagnostics } from "./diagnostics.js";

export type VoltValue =
  | bigint
  | string
  | boolean
  | null
  | VoltValue[]
  | { kind: "record"; type: string; fields: Record<string, VoltValue> }
  | { kind: "variant"; type: string; constructor: string; payload?: VoltValue };

export interface CapabilityAdapter {
  effectId: string;
  operations: Record<string, (...args: VoltValue[]) => VoltValue>;
  reset?: () => void;
}

export interface RuntimeResult {
  value?: VoltValue;
  diagnostics: DiagnosticV1[];
  internalFailure: boolean;
}

class RuntimeFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly internalFailure: boolean,
    readonly expression?: Expr
  ) {
    super(message);
  }
}

interface RuntimeDefinition {
  ast: AstV1;
  declaration: Declaration;
  id: string;
}

interface RuntimeModule {
  ast: AstV1;
  declarations: Map<string, RuntimeDefinition>;
  constructors: Map<string, { type: string; payload: boolean }>;
  imports: Map<string, RuntimeDefinition | { type: string; payload: boolean }>;
}

interface RuntimeProgram {
  modules: Map<string, RuntimeModule>;
  functions: Map<string, RuntimeDefinition>;
  adapters: Map<string, CapabilityAdapter>;
}

function declarationId(module: string, declaration: Declaration): string {
  const kind = declaration.kind === "type" ? "algebraic_data_type" : declaration.kind;
  return `${module}::${kind}::${declaration.name}`;
}

function buildProgram(compilation: CompilationResult, adapters: CapabilityAdapter[]): RuntimeProgram {
  const modules = new Map<string, RuntimeModule>();
  const functions = new Map<string, RuntimeDefinition>();
  const effectIds = new Map<string, string>();
  for (const ast of compilation.ast) {
    const module: RuntimeModule = {
      ast, declarations: new Map(), constructors: new Map(), imports: new Map()
    };
    modules.set(ast.module, module);
    for (const declaration of ast.declarations) {
      const definition = { ast, declaration, id: declarationId(ast.module, declaration) };
      module.declarations.set(declaration.name, definition);
      if (declaration.kind === "function") functions.set(`${ast.module}.${declaration.name}`, definition);
      if (declaration.kind === "effect") effectIds.set(declaration.name, definition.id);
      if (declaration.kind === "type") {
        for (const variant of declaration.variants) {
          module.constructors.set(variant.name, {
            type: `${ast.module}::${declaration.name}`,
            payload: variant.payload !== undefined
          });
        }
      }
    }
  }
  for (const module of modules.values()) {
    for (const imported of module.ast.imports) {
      const target = modules.get(imported.module);
      if (!target) continue;
      for (const name of imported.names) {
        const definition = target.declarations.get(name);
        if (definition) {
          module.imports.set(name, definition);
          if (definition.declaration.kind === "type") {
            for (const variant of definition.declaration.variants) {
              const constructor = target.constructors.get(variant.name);
              if (constructor) module.imports.set(variant.name, constructor);
            }
          }
        }
      }
    }
  }
  const adapterMap = new Map<string, CapabilityAdapter>();
  for (const adapter of adapters) {
    if (adapterMap.has(adapter.effectId)) {
      throw new RuntimeFailure("V_RUNTIME_ADAPTER_DUPLICATE", `duplicate adapter ${adapter.effectId}`, true);
    }
    adapterMap.set(adapter.effectId, adapter);
  }
  for (const ast of compilation.ast) {
    for (const declaration of ast.declarations) {
      if (declaration.kind !== "effect") continue;
      const effectId = declarationId(ast.module, declaration);
      const adapter = adapterMap.get(effectId);
      if (!adapter) continue;
      for (const operation of declaration.operations) {
        if (!adapter.operations[operation.name]) {
          throw new RuntimeFailure(
            "V_RUNTIME_ADAPTER_OPERATION",
            `adapter ${effectId} is missing operation ${operation.name}`,
            true
          );
        }
      }
    }
  }
  void effectIds;
  return { modules, functions, adapters: adapterMap };
}

function lookup(module: RuntimeModule, name: string): RuntimeDefinition | { type: string; payload: boolean } | undefined {
  return module.declarations.get(name) ?? module.constructors.get(name) ?? module.imports.get(name);
}

function isRecord(value: VoltValue): value is Extract<VoltValue, { kind: "record" }> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && value.kind === "record";
}

function isVariant(value: VoltValue): value is Extract<VoltValue, { kind: "variant" }> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && value.kind === "variant";
}

function equal(left: VoltValue, right: VoltValue): boolean {
  if (typeof left !== typeof right) return false;
  if (typeof left !== "object" || typeof right !== "object" || left === null || right === null) return left === right;
  if (Array.isArray(left)) {
    return Array.isArray(right) && left.length === right.length &&
      left.every((item, index) => equal(item, right[index]!));
  }
  if (Array.isArray(right)) return false;
  if (left.kind !== right.kind) return false;
  if (left.kind === "record" && right.kind === "record") {
    return left.type === right.type &&
      Object.keys(left.fields).length === Object.keys(right.fields).length &&
      Object.entries(left.fields).every(([key, value]) => right.fields[key] !== undefined && equal(value, right.fields[key]));
  }
  if (left.kind === "variant" && right.kind === "variant") {
    return left.type === right.type && left.constructor === right.constructor &&
      (left.payload === undefined
        ? right.payload === undefined
        : right.payload !== undefined && equal(left.payload, right.payload));
  }
  return false;
}

function matchPattern(pattern: Pattern, value: VoltValue): Map<string, VoltValue> | undefined {
  const bindings = new Map<string, VoltValue>();
  const visit = (current: Pattern, target: VoltValue): boolean => {
    switch (current.kind) {
      case "wildcard": return true;
      case "binding": bindings.set(current.name, target); return true;
      case "literal": return equal(current.value, target);
      case "constructor":
        if (!isVariant(target) || target.constructor !== current.name) return false;
        if (!current.payload) return target.payload === undefined;
        return target.payload !== undefined && visit(current.payload, target.payload);
      case "record":
        return isRecord(target) && current.fields.every((field) => {
          const fieldValue = target.fields[field.name];
          return fieldValue !== undefined && visit(field.pattern, fieldValue);
        });
      case "list":
        if (!Array.isArray(target)) return false;
        if (current.empty) return target.length === 0;
        if (target.length === 0 || !current.head || !current.tail) return false;
        if (!visit(current.head, target[0]!)) return false;
        bindings.set(current.tail, target.slice(1));
        return true;
    }
  };
  return visit(pattern, value) ? bindings : undefined;
}

function intResult(value: bigint, expression: Expr): bigint {
  if (value < -9223372036854775808n || value > 9223372036854775807n) {
    throw new RuntimeFailure("V_RUNTIME_INT_OVERFLOW", "signed 64-bit arithmetic overflow", false, expression);
  }
  return value;
}

function evaluate(
  program: RuntimeProgram,
  module: RuntimeModule,
  expression: Expr,
  environment: Map<string, VoltValue>
): VoltValue {
  const child = (value: Expr, env = environment): VoltValue => evaluate(program, module, value, env);
  switch (expression.kind) {
    case "literal": return expression.value;
    case "name": {
      if (environment.has(expression.name)) return environment.get(expression.name)!;
      if (expression.name === "None") {
        return { kind: "variant", type: "Option", constructor: "None" };
      }
      if (["Some", "Ok", "Error"].includes(expression.name)) {
        return `@builtin-constructor:${expression.name}`;
      }
      const target = lookup(module, expression.name);
      if (!target) throw new RuntimeFailure("V_RUNTIME_NAME", `unknown name ${expression.name}`, false, expression);
      if ("declaration" in target && target.declaration.kind === "function") return `@function:${target.ast.module}.${target.declaration.name}`;
      if ("declaration" in target && target.declaration.kind === "effect") return `@effect:${target.id}`;
      if ("type" in target) {
        if (target.payload) return `@constructor:${target.type}:${expression.name}:payload`;
        return { kind: "variant", type: target.type, constructor: expression.name };
      }
      throw new RuntimeFailure("V_RUNTIME_VALUE", `${expression.name} is not a value`, false, expression);
    }
    case "list": return expression.items.map((item) => child(item));
    case "record": {
      const target = lookup(module, expression.name);
      if (!target || !("declaration" in target) || target.declaration.kind !== "record") {
        throw new RuntimeFailure("V_RUNTIME_RECORD", `unknown record ${expression.name}`, false, expression);
      }
      return {
        kind: "record",
        type: `${target.ast.module}::${target.declaration.name}`,
        fields: Object.fromEntries(expression.fields.map((field) => [field.name, child(field.value)]))
      };
    }
    case "field": {
      if (expression.target.kind === "name") {
        const target = lookup(module, expression.target.name);
        if (target && "declaration" in target && target.declaration.kind === "effect") {
          return `@operation:${target.id}:${expression.name}`;
        }
        if (expression.target.name === "List") return `@list:${expression.name}`;
      }
      const target = child(expression.target);
      if (!isRecord(target) || target.fields[expression.name] === undefined) {
        throw new RuntimeFailure("V_RUNTIME_FIELD", `unknown field ${expression.name}`, false, expression);
      }
      return target.fields[expression.name]!;
    }
    case "call": {
      const callee = child(expression.callee);
      const args = expression.args.map((argument) => child(argument));
      if (typeof callee !== "string") throw new RuntimeFailure("V_RUNTIME_CALL", "value is not callable", false, expression);
      if (callee.startsWith("@function:")) return callFunction(program, callee.slice(10), args);
      if (callee.startsWith("@builtin-constructor:")) {
        const name = callee.slice("@builtin-constructor:".length);
        if (args.length !== 1) {
          throw new RuntimeFailure("V_RUNTIME_CONSTRUCTOR", `${name} expects one payload`, false, expression);
        }
        return {
          kind: "variant",
          type: name === "Some" ? "Option" : "Result",
          constructor: name,
          payload: args[0]!
        };
      }
      if (callee.startsWith("@constructor:")) {
        const [, type, name] = callee.match(/^@constructor:(.+):([^:]+):payload$/u) ?? [];
        if (!type || !name || args.length !== 1) {
          throw new RuntimeFailure("V_RUNTIME_CONSTRUCTOR", "constructor payload mismatch", false, expression);
        }
        return { kind: "variant", type, constructor: name, payload: args[0]! };
      }
      if (callee.startsWith("@operation:")) {
        const parts = callee.slice(11).split(":");
        const operation = parts.pop()!;
        const effectId = parts.join(":");
        const adapter = program.adapters.get(effectId);
        if (!adapter) throw new RuntimeFailure("V_RUNTIME_ADAPTER_MISSING", `missing adapter ${effectId}`, true, expression);
        const implementation = adapter.operations[operation];
        if (!implementation) throw new RuntimeFailure("V_RUNTIME_ADAPTER_OPERATION", `missing operation ${operation}`, true, expression);
        try {
          return implementation(...args);
        } catch (error) {
          throw new RuntimeFailure(
            "V_RUNTIME_HOST_EXCEPTION",
            `host adapter threw: ${error instanceof Error ? error.message : String(error)}`,
            true,
            expression
          );
        }
      }
      if (callee === "@list:length") {
        if (!Array.isArray(args[0])) throw new RuntimeFailure("V_RUNTIME_LIST", "List.length requires a list", false, expression);
        return BigInt(args[0].length);
      }
      if (callee === "@list:prepend") {
        if (!Array.isArray(args[1])) throw new RuntimeFailure("V_RUNTIME_LIST", "List.prepend requires a list", false, expression);
        return [args[0]!, ...args[1]];
      }
      throw new RuntimeFailure("V_RUNTIME_CALL", `unknown callable ${callee}`, false, expression);
    }
    case "unary": {
      const value = child(expression.operand);
      if (expression.operator === "!") {
        if (typeof value !== "boolean") throw new RuntimeFailure("V_RUNTIME_TYPE", "! requires Bool", false, expression);
        return !value;
      }
      if (typeof value !== "bigint") throw new RuntimeFailure("V_RUNTIME_TYPE", "- requires Int", false, expression);
      return intResult(-value, expression);
    }
    case "binary": {
      if (expression.operator === "&&") {
        const left = child(expression.left);
        if (typeof left !== "boolean") throw new RuntimeFailure("V_RUNTIME_TYPE", "&& requires Bool", false, expression);
        return left ? child(expression.right) : false;
      }
      if (expression.operator === "||") {
        const left = child(expression.left);
        if (typeof left !== "boolean") throw new RuntimeFailure("V_RUNTIME_TYPE", "|| requires Bool", false, expression);
        return left ? true : child(expression.right);
      }
      const left = child(expression.left);
      const right = child(expression.right);
      switch (expression.operator) {
        case "==": return equal(left, right);
        case "!=": return !equal(left, right);
        case "+":
          if (typeof left === "bigint" && typeof right === "bigint") return intResult(left + right, expression);
          if (typeof left === "string" && typeof right === "string") return left + right;
          break;
        case "-": if (typeof left === "bigint" && typeof right === "bigint") return intResult(left - right, expression); break;
        case "*": if (typeof left === "bigint" && typeof right === "bigint") return intResult(left * right, expression); break;
        case "/":
          if (typeof left === "bigint" && typeof right === "bigint") {
            if (right === 0n) throw new RuntimeFailure("V_RUNTIME_DIVISION_ZERO", "division by zero", false, expression);
            return intResult(left / right, expression);
          }
          break;
        case "%":
          if (typeof left === "bigint" && typeof right === "bigint") {
            if (right === 0n) throw new RuntimeFailure("V_RUNTIME_REMAINDER_ZERO", "remainder by zero", false, expression);
            return intResult(left % right, expression);
          }
          break;
        case "<": return (left as bigint | string) < (right as bigint | string);
        case "<=": return (left as bigint | string) <= (right as bigint | string);
        case ">": return (left as bigint | string) > (right as bigint | string);
        case ">=": return (left as bigint | string) >= (right as bigint | string);
      }
      throw new RuntimeFailure("V_RUNTIME_TYPE", `invalid operands for ${expression.operator}`, false, expression);
    }
    case "let": {
      const next = new Map(environment);
      next.set(expression.name, child(expression.value));
      return child(expression.body, next);
    }
    case "if": return child(expression.condition) === true ? child(expression.then) : child(expression.otherwise);
    case "match": {
      const subject = child(expression.subject);
      for (const arm of expression.arms) {
        const bindings = matchPattern(arm.pattern, subject);
        if (bindings) return child(arm.value, new Map([...environment, ...bindings]));
      }
      throw new RuntimeFailure("V_RUNTIME_NON_EXHAUSTIVE", "no match arm accepted the value", false, expression);
    }
  }
}

function callFunction(program: RuntimeProgram, entry: string, args: VoltValue[]): VoltValue {
  const definition = program.functions.get(entry);
  if (!definition || definition.declaration.kind !== "function") {
    throw new RuntimeFailure("V_RUNTIME_ENTRYPOINT", `unknown function ${entry}`, true);
  }
  const declaration = definition.declaration as FunctionDecl;
  if (args.length !== declaration.params.length) {
    throw new RuntimeFailure("V_RUNTIME_ARITY", `${entry} expects ${declaration.params.length} arguments`, false, declaration.body);
  }
  const environment = new Map(declaration.params.map((param, index) => [param.name, args[index]!]));
  return evaluate(program, program.modules.get(definition.ast.module)!, declaration.body, environment);
}

function runtimeDiagnostic(error: RuntimeFailure): DiagnosticV1 {
  const location = error.expression?.location ?? { file: "<runtime>", range: {
    startByte: 0, endByte: 0, startLine: 0, startColumn: 0, endLine: 0, endColumn: 0
  } };
  return makeDiagnostic({
    phase: "runtime",
    code: error.code,
    message: error.message,
    file: location.file,
    range: location.range
  });
}

export function run(
  compilation: CompilationResult,
  entry: string,
  adapters: CapabilityAdapter[] = [],
  args: VoltValue[] = []
): RuntimeResult {
  try {
    if (compilation.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
      return { diagnostics: compilation.diagnostics, internalFailure: false };
    }
    const separator = entry.lastIndexOf(".");
    if (separator <= 0 || separator === entry.length - 1) {
      throw new RuntimeFailure(
        "V_RUNTIME_ENTRYPOINT",
        `entrypoint ${entry} must be fully qualified as module.function`,
        true
      );
    }
    const moduleName = entry.slice(0, separator);
    const functionName = entry.slice(separator + 1);
    const ast = compilation.ast.find((item) => item.module === moduleName);
    const declaration = ast?.declarations.find(
      (item) => item.kind === "function" && item.name === functionName
    );
    if (!ast || !declaration || declaration.kind !== "function") {
      throw new RuntimeFailure("V_RUNTIME_ENTRYPOINT", `unknown function ${entry}`, true);
    }
    const required = new Set(declaration.uses.map((effectName) => {
      const local = ast.declarations.find((item) => item.kind === "effect" && item.name === effectName);
      if (local) return declarationId(ast.module, local);
      for (const imported of ast.imports) {
        if (!imported.names.includes(effectName)) continue;
        const targetAst = compilation.ast.find((item) => item.module === imported.module);
        const target = targetAst?.declarations.find(
          (item) => item.kind === "effect" && item.name === effectName
        );
        if (target && targetAst) return declarationId(targetAst.module, target);
      }
      return `unresolved::effect::${effectName}`;
    }));
    const supplied = new Set(adapters.map((adapter) => adapter.effectId));
    const missing = [...required].filter((effectId) => !supplied.has(effectId));
    const extra = [...supplied].filter((effectId) => !required.has(effectId));
    if (missing.length > 0 || extra.length > 0) {
      throw new RuntimeFailure(
        "V_RUNTIME_ADAPTER_SET",
        `capability registry mismatch; missing [${missing.join(", ")}], extra [${extra.join(", ")}]`,
        true
      );
    }
    const program = buildProgram(compilation, adapters);
    return { value: callFunction(program, entry, args), diagnostics: [], internalFailure: false };
  } catch (error) {
    if (error instanceof RuntimeFailure) {
      return { diagnostics: orderDiagnostics([runtimeDiagnostic(error)]), internalFailure: error.internalFailure };
    }
    throw error;
  }
}

export function clockAdapter(effectId: string, values: bigint[] = [0n]): CapabilityAdapter {
  const initial = [...values];
  let queue = [...initial];
  return {
    effectId,
    operations: {
      now: () => queue.shift() ?? initial.at(-1) ?? 0n
    },
    reset: () => { queue = [...initial]; }
  };
}

export function notificationAdapter(effectId: string): CapabilityAdapter & { messages: VoltValue[] } {
  const messages: VoltValue[] = [];
  return {
    effectId,
    messages,
    operations: {
      send: (message) => {
        messages.push(message!);
        return { kind: "variant", type: "Result<Unit,String>", constructor: "Ok", payload: null };
      }
    },
    reset: () => { messages.length = 0; }
  };
}

export function databaseAdapter(effectId: string): CapabilityAdapter {
  const values = new Map<string, VoltValue>();
  return {
    effectId,
    operations: {
      find: (...keys) => {
        const key = JSON.stringify(keys, (_name, value) => typeof value === "bigint" ? value.toString() : value);
        const value = values.get(key);
        return value === undefined
          ? { kind: "variant", type: "Option", constructor: "None" }
          : { kind: "variant", type: "Option", constructor: "Some", payload: value };
      },
      save: (value) => {
        const key = JSON.stringify([value], (_name, item) => typeof item === "bigint" ? item.toString() : item);
        values.set(key, value!);
        return { kind: "variant", type: "Result<Unit,String>", constructor: "Ok", payload: null };
      }
    },
    reset: () => values.clear()
  };
}

export function serializeValue(value: VoltValue): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(serializeValue);
  if (typeof value === "object" && value !== null) {
    if (value.kind === "record") {
      return { kind: value.kind, type: value.type, fields: Object.fromEntries(
        Object.entries(value.fields).map(([key, item]) => [key, serializeValue(item)])
      ) };
    }
    return {
      kind: value.kind,
      type: value.type,
      constructor: value.constructor,
      ...(value.payload === undefined ? {} : { payload: serializeValue(value.payload) })
    };
  }
  return value;
}
