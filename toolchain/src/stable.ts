import { createHash } from "node:crypto";
import type {
  AstV1, Declaration, Expr, NormalizedAstV1, NormalizedNode, Pattern, TypeRef
} from "./contracts.js";

export function compareStable(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => compareStable(left, right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  return JSON.stringify(value);
}

export function typeText(type: TypeRef): string {
  return type.args.length === 0
    ? type.name
    : `${type.name}<${type.args.map(typeText).join(",")}>`;
}

export function declarationId(module: string, declaration: Declaration): string {
  const kind = declaration.kind === "type" ? "algebraic_data_type" : declaration.kind;
  return `${module}::${kind}::${declaration.name}`;
}

function node(kind: string, children: NormalizedNode[] = [], operator?: string): NormalizedNode {
  return { kind, ...(operator === undefined ? {} : { operator }), children };
}

function normalizedType(type: TypeRef): NormalizedNode {
  return node(`type:${type.name}`, type.args.map(normalizedType));
}

function normalizedPattern(pattern: Pattern): NormalizedNode {
  switch (pattern.kind) {
    case "wildcard": return node("pattern:wildcard");
    case "binding": return node("pattern:binding");
    case "literal": return node(`pattern:literal:${pattern.literalKind}`);
    case "constructor": return node("pattern:constructor", pattern.payload ? [normalizedPattern(pattern.payload)] : []);
    case "record": return node("pattern:record", pattern.fields.map((field) => normalizedPattern(field.pattern)));
    case "list": return node(pattern.empty ? "pattern:list-empty" : "pattern:list-cons", pattern.head ? [normalizedPattern(pattern.head)] : []);
  }
}

export function normalizedExpression(expression: Expr): NormalizedNode {
  switch (expression.kind) {
    case "literal": return node(`literal:${expression.literalKind}`);
    case "name": return node("name");
    case "list": return node("list", expression.items.map(normalizedExpression));
    case "record": return node("record", expression.fields.map((field) => normalizedExpression(field.value)));
    case "call": return node("call", [normalizedExpression(expression.callee), ...expression.args.map(normalizedExpression)]);
    case "field": return node("field", [normalizedExpression(expression.target)]);
    case "unary": return node("unary", [normalizedExpression(expression.operand)], expression.operator);
    case "binary": return node("binary", [normalizedExpression(expression.left), normalizedExpression(expression.right)], expression.operator);
    case "let":
      return node("let", [
        ...(expression.annotation ? [normalizedType(expression.annotation)] : []),
        normalizedExpression(expression.value),
        normalizedExpression(expression.body)
      ]);
    case "if":
      return node("if", [
        normalizedExpression(expression.condition),
        normalizedExpression(expression.then),
        normalizedExpression(expression.otherwise)
      ]);
    case "match":
      return node("match", [
        normalizedExpression(expression.subject),
        ...expression.arms.flatMap((arm) => [normalizedPattern(arm.pattern), normalizedExpression(arm.value)])
      ]);
  }
}

function normalizedDeclaration(declaration: Declaration): NormalizedNode {
  switch (declaration.kind) {
    case "record":
      return node("declaration:record", declaration.fields.map((field) => normalizedType(field.type)));
    case "type":
      return node("declaration:type", declaration.variants.map((variant) =>
        node("variant", variant.payload ? [normalizedType(variant.payload)] : [])
      ));
    case "effect":
      return node("declaration:effect", declaration.operations.map((operation) =>
        node("operation", [...operation.params.map((param) => normalizedType(param.type)), normalizedType(operation.returnType)])
      ));
    case "function":
      return node("declaration:function", [
        ...declaration.params.map((param) => normalizedType(param.type)),
        node("uses", declaration.uses.map(() => node("effect"))),
        normalizedType(declaration.returnType),
        normalizedExpression(declaration.body)
      ]);
  }
}

export function normalizeAst(ast: AstV1): NormalizedAstV1 {
  const root = node("program", [
    ...ast.imports.map((item) => node("import", item.names.map(() => node("import-name")))),
    ...ast.declarations.map(normalizedDeclaration)
  ]);
  return {
    schemaVersion: 1,
    moduleBoundary: ast.module,
    root,
    hash: sha256(stableJson(root))
  };
}

export function siteId(owner: string, kind: string, path: readonly number[], occurrence = 0): string {
  return `${owner}::site::${kind}::${sha256(path.join(".")).slice(0, 16)}::${occurrence}`;
}
