import type { AstV1, Declaration, Expr, Pattern, TypeRef } from "./contracts.js";
import { parse } from "./parser.js";
import { compareStable } from "./stable.js";

function typeText(type: TypeRef): string {
  return type.args.length === 0 ? type.name : `${type.name}<${type.args.map(typeText).join(", ")}>`;
}

function indent(text: string, depth: number): string {
  const prefix = "  ".repeat(depth);
  return text.split("\n").map((line) => `${prefix}${line}`).join("\n");
}

function escapeString(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")
    .replaceAll("\n", "\\n").replaceAll("\r", "\\r").replaceAll("\t", "\\t")}"`;
}

const PRECEDENCE: Record<string, number> = {
  "||": 1, "&&": 2, "==": 3, "!=": 3, "<": 4, "<=": 4, ">": 4, ">=": 4,
  "+": 5, "-": 5, "*": 6, "/": 6, "%": 6
};

function patternText(pattern: Pattern, depth: number): string {
  switch (pattern.kind) {
    case "wildcard": return "_";
    case "binding": return pattern.name;
    case "literal":
      if (pattern.literalKind === "String") return escapeString(pattern.value as string);
      if (pattern.literalKind === "Unit") return "()";
      return String(pattern.value);
    case "constructor":
      return pattern.payload ? `${pattern.name}(${patternText(pattern.payload, depth)})` : pattern.name;
    case "record":
      return `${pattern.name} {\n${pattern.fields.map((field) =>
        indent(`${field.name}: ${patternText(field.pattern, depth + 1)}`, depth + 1)
      ).join(",\n")}\n${"  ".repeat(depth)}}`;
    case "list":
      return pattern.empty ? "[]" : `[${patternText(pattern.head!, depth)}, ...${pattern.tail}]`;
  }
}

function exprText(expression: Expr, depth = 0, parentPrecedence = 0): string {
  switch (expression.kind) {
    case "literal":
      if (expression.literalKind === "String") return escapeString(expression.value as string);
      if (expression.literalKind === "Unit") return "()";
      return String(expression.value);
    case "name": return expression.name;
    case "list": return `[${expression.items.map((item) => exprText(item, depth)).join(", ")}]`;
    case "record":
      return `${expression.name} {\n${expression.fields.map((field) =>
        indent(`${field.name}: ${exprText(field.value, depth + 1)}`, depth + 1)
      ).join(",\n")}\n${"  ".repeat(depth)}}`;
    case "call":
      return `${exprText(expression.callee, depth, 8)}(${expression.args.map((arg) => exprText(arg, depth)).join(", ")})`;
    case "field": return `${exprText(expression.target, depth, 8)}.${expression.name}`;
    case "unary": return `${expression.operator}${exprText(expression.operand, depth, 7)}`;
    case "binary": {
      const precedence = PRECEDENCE[expression.operator] ?? 0;
      const value = `${exprText(expression.left, depth, precedence)} ${expression.operator} ${exprText(expression.right, depth, precedence)}`;
      return precedence < parentPrecedence ? `(${value})` : value;
    }
    case "let":
      return `let ${expression.name}${expression.annotation ? `: ${typeText(expression.annotation)}` : ""} = ${exprText(expression.value, depth)} in\n${indent(exprText(expression.body, depth), depth)}`;
    case "if":
      return `if ${exprText(expression.condition, depth)} {\n${indent(exprText(expression.then, depth + 1), depth + 1)}\n${"  ".repeat(depth)}} else {\n${indent(exprText(expression.otherwise, depth + 1), depth + 1)}\n${"  ".repeat(depth)}}`;
    case "match":
      return `match ${exprText(expression.subject, depth)} {\n${expression.arms.map((arm) =>
        indent(`${patternText(arm.pattern, depth + 1)} -> ${exprText(arm.value, depth + 1)}`, depth + 1)
      ).join("\n")}\n${"  ".repeat(depth)}}`;
  }
}

function declarationText(declaration: Declaration): string {
  const visibility = declaration.public ? "pub " : "";
  switch (declaration.kind) {
    case "record":
      return `${visibility}record ${declaration.name} {\n${declaration.fields.map((field) =>
        `  ${field.name}: ${typeText(field.type)}`
      ).join(",\n")}\n}`;
    case "type":
      return `${visibility}type ${declaration.name} {\n${declaration.variants.map((variant) =>
        `  ${variant.name}${variant.payload ? `(${typeText(variant.payload)})` : ""}`
      ).join("\n")}\n}`;
    case "effect":
      return `${visibility}effect ${declaration.name} {\n${declaration.operations.map((operation) =>
        `  fn ${operation.name}(${operation.params.map((param) => `${param.name}: ${typeText(param.type)}`).join(", ")}) -> ${typeText(operation.returnType)}`
      ).join("\n")}\n}`;
    case "function": {
      const uses = declaration.uses.length === 0
        ? ""
        : ` uses {${[...declaration.uses].sort(compareStable).join(", ")}}`;
      return `${visibility}fn ${declaration.name}(${declaration.params.map((param) =>
        `${param.name}: ${typeText(param.type)}`
      ).join(", ")})${uses} -> ${typeText(declaration.returnType)} {\n${indent(exprText(declaration.body, 0), 1)}\n}`;
    }
  }
}

export function formatAst(ast: AstV1): string {
  const sections = [`module ${ast.module}`];
  if (ast.imports.length > 0) {
    sections.push([...ast.imports]
      .sort((left, right) => compareStable(left.module, right.module))
      .map((item) => `import ${item.module}.{${[...item.names].sort(compareStable).join(", ")}}`)
      .join("\n"));
  }
  if (ast.declarations.length > 0) sections.push(ast.declarations.map(declarationText).join("\n\n"));
  return `${sections.join("\n\n")}\n`;
}

export function formatSource(path: string, source: string): { output?: string; diagnostics: ReturnType<typeof parse>["diagnostics"] } {
  const parsed = parse({ path, text: source });
  return parsed.ast ? { output: formatAst(parsed.ast), diagnostics: parsed.diagnostics } : { diagnostics: parsed.diagnostics };
}
