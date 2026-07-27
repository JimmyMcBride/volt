import type { DiagnosticV1, SourceFile, SourceRange, Token } from "./contracts.js";
import { makeDiagnostic } from "./diagnostics.js";

const KEYWORDS = new Set([
  "module", "import", "pub", "record", "type", "effect", "fn", "uses",
  "let", "in", "if", "else", "match", "true", "false"
]);
const TWO_CHAR = new Set(["->", "||", "&&", "==", "!=", "<=", ">=", "..."]);
const SINGLE = new Set([".", "{", "}", "(", ")", "[", "]", ",", ":", "<", ">",
  "=", "+", "-", "*", "/", "%", "!", "?"]);

function positions(source: string): Array<{ byte: number; line: number; column: number }> {
  const result: Array<{ byte: number; line: number; column: number }> = [];
  let byte = 0;
  let line = 0;
  let column = 0;
  for (let index = 0; index <= source.length; index += 1) {
    result[index] = { byte, line, column };
    if (index === source.length) break;
    const codePoint = source.codePointAt(index);
    if (codePoint === undefined) break;
    const char = String.fromCodePoint(codePoint);
    byte += Buffer.byteLength(char);
    if (char === "\n") {
      line += 1;
      column = 0;
    } else {
      column += 1;
    }
    if (char.length === 2) {
      index += 1;
      result[index] = { byte, line, column };
    }
  }
  return result;
}

function range(table: ReturnType<typeof positions>, start: number, end: number): SourceRange {
  const a = table[start] ?? table[0]!;
  const b = table[end] ?? table[table.length - 1]!;
  return {
    startByte: a.byte,
    endByte: b.byte,
    startLine: a.line,
    startColumn: a.column,
    endLine: b.line,
    endColumn: b.column
  };
}

export interface LexResult {
  tokens: Token[];
  diagnostics: DiagnosticV1[];
}

export function lex(sourceFile: SourceFile): LexResult {
  const source = sourceFile.text.replaceAll("\r\n", "\n");
  const table = positions(source);
  const tokens: Token[] = [];
  const diagnostics: DiagnosticV1[] = [];
  let index = 0;

  const push = (kind: Token["kind"], text: string, start: number, end: number, value?: string): void => {
    tokens.push({
      kind,
      text,
      ...(value === undefined ? {} : { value }),
      location: { file: sourceFile.path, range: range(table, start, end) }
    });
  };
  const error = (code: string, message: string, start: number, end: number): void => {
    diagnostics.push(makeDiagnostic({
      phase: "lex",
      code,
      message,
      file: sourceFile.path,
      range: range(table, start, end)
    }));
  };

  while (index < source.length) {
    const char = source[index]!;
    if (/\s/u.test(char)) {
      index += 1;
      continue;
    }
    if (source.startsWith("//", index)) {
      const newline = source.indexOf("\n", index + 2);
      index = newline === -1 ? source.length : newline + 1;
      continue;
    }
    if (source.startsWith("/*", index)) {
      const end = source.indexOf("*/", index + 2);
      error("K_FEATURE_DEFERRED", "block comments are deferred", index, end === -1 ? source.length : end + 2);
      index = end === -1 ? source.length : end + 2;
      continue;
    }
    if (char === ";") {
      error("K_LEX_SEMICOLON", "semicolons are forbidden", index, index + 1);
      index += 1;
      continue;
    }
    if (char === "\"") {
      const start = index;
      index += 1;
      let value = "";
      let closed = false;
      while (index < source.length) {
        const current = source[index]!;
        if (current === "\"") {
          index += 1;
          closed = true;
          break;
        }
        if (current === "\\") {
          const escaped = source[index + 1];
          const map: Record<string, string> = { "\"": "\"", "\\": "\\", n: "\n", r: "\r", t: "\t" };
          if (escaped === undefined || map[escaped] === undefined) {
            error("K_LEX_LITERAL", "unsupported string escape", index, Math.min(source.length, index + 2));
            index += escaped === undefined ? 1 : 2;
            continue;
          }
          value += map[escaped];
          index += 2;
          continue;
        }
        if (current === "\n") {
          error("K_LEX_LITERAL", "string literals cannot contain a raw line break", start, index);
          break;
        }
        value += current;
        index += 1;
      }
      if (!closed) error("K_LEX_LITERAL", "unterminated string literal", start, index);
      push("string", source.slice(start, index), start, index, value);
      continue;
    }
    if (/[0-9]/u.test(char)) {
      const start = index;
      while (index < source.length && /[0-9_]/u.test(source[index]!)) index += 1;
      const text = source.slice(start, index);
      if (text.includes("_") || (text.length > 1 && text.startsWith("0"))) {
        error("K_LEX_LITERAL", "integer literal is not canonical", start, index);
      }
      push("integer", text, start, index, text);
      continue;
    }
    if (/[A-Za-z_]/u.test(char)) {
      const start = index;
      while (index < source.length && /[A-Za-z0-9_]/u.test(source[index]!)) index += 1;
      const text = source.slice(start, index);
      push(KEYWORDS.has(text) ? "keyword" : "identifier", text, start, index, text);
      continue;
    }
    const codePoint = source.codePointAt(index)!;
    const width = codePoint > 0xffff ? 2 : 1;
    if (codePoint > 0x7f) {
      error("K_LEX_IDENTIFIER_ASCII", "identifiers and source tokens must be ASCII", index, index + width);
      index += width;
      continue;
    }
    const three = source.slice(index, index + 3);
    const two = source.slice(index, index + 2);
    if (TWO_CHAR.has(three)) {
      push("symbol", three, index, index + 3);
      index += 3;
      continue;
    }
    if (TWO_CHAR.has(two)) {
      push("symbol", two, index, index + 2);
      index += 2;
      continue;
    }
    if (SINGLE.has(char)) {
      push("symbol", char, index, index + 1);
      index += 1;
      continue;
    }
    error("K_LEX_TOKEN", `unexpected character ${JSON.stringify(char)}`, index, index + 1);
    index += 1;
  }
  push("eof", "", source.length, source.length);
  return { tokens, diagnostics };
}
