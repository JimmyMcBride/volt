import type {
  AstV1, Declaration, DiagnosticV1, EffectDecl, EffectOperation, Expr, FunctionDecl,
  ImportDecl, Located, Param, Pattern, RecordDecl, RecordField, SourceFile, Token,
  TypeDecl, TypeRef, VariantDecl
} from "./contracts.js";
import { makeDiagnostic } from "./diagnostics.js";
import { lex } from "./lexer.js";

class ParseFailure extends Error {
  constructor(readonly diagnostic: DiagnosticV1) {
    super(diagnostic.message);
  }
}

const BINARY: Record<string, number> = {
  "||": 1, "&&": 2, "==": 3, "!=": 3, "<": 4, "<=": 4, ">": 4, ">=": 4,
  "+": 5, "-": 5, "*": 6, "/": 6, "%": 6
};

class Parser {
  private index = 0;
  constructor(private readonly file: string, private readonly tokens: Token[]) {}

  parse(): AstV1 {
    const start = this.peek().location.range;
    this.expect("module");
    const module = this.modulePath();
    const imports: ImportDecl[] = [];
    while (this.at("import")) imports.push(this.importDecl());
    const declarations: Declaration[] = [];
    while (!this.atKind("eof")) declarations.push(this.declaration());
    const end = this.peek().location.range;
    return {
      schemaVersion: 1,
      module,
      imports,
      declarations,
      file: this.file,
      range: { ...start, endByte: end.endByte, endLine: end.endLine, endColumn: end.endColumn }
    };
  }

  private peek(offset = 0): Token {
    return this.tokens[Math.min(this.index + offset, this.tokens.length - 1)]!;
  }
  private at(text: string): boolean { return this.peek().text === text; }
  private atKind(kind: Token["kind"]): boolean { return this.peek().kind === kind; }
  private take(): Token { return this.tokens[this.index++]!; }
  private expect(text: string): Token {
    if (!this.at(text)) this.fail("K_PARSE_EXPECTED", `expected ${text}`, this.peek(), text);
    return this.take();
  }
  private identifier(caseKind?: "lower" | "upper"): Token {
    const token = this.peek();
    if (token.kind !== "identifier") this.fail("K_PARSE_EXPECTED", "expected identifier", token, "identifier");
    if (caseKind === "lower" && !/^[a-z][A-Za-z0-9_]*$/u.test(token.text)) {
      this.fail("K_NAME_CONVENTION", `expected lower_snake_case name, received ${token.text}`, token);
    }
    if (caseKind === "upper" && !/^[A-Z][A-Za-z0-9]*$/u.test(token.text)) {
      this.fail("K_NAME_CONVENTION", `expected UpperCamelCase name, received ${token.text}`, token);
    }
    return this.take();
  }
  private fail(code: string, message: string, token: Token, expected?: string): never {
    const phase =
      code.startsWith("K_LEX")
        ? "lex"
        : code.startsWith("K_NAME") ||
            code.startsWith("K_IMPORT") ||
            code.startsWith("K_RESOLVE") ||
            code.startsWith("K_MODULE")
          ? "resolve"
          : code.startsWith("K_TYPE")
            ? "type"
            : code.startsWith("K_EFFECT")
              ? "effect"
              : code.startsWith("K_MATCH")
                ? "exhaustiveness"
                : "parse";
    throw new ParseFailure(makeDiagnostic({
      phase,
      code,
      message,
      file: this.file,
      range: token.location.range,
      ...(expected === undefined ? {} : { expected }),
      actual: token.text || "EOF"
    }));
  }
  private located(start: Token, end: Token): Located {
    return {
      file: this.file,
      range: {
        ...start.location.range,
        endByte: end.location.range.endByte,
        endLine: end.location.range.endLine,
        endColumn: end.location.range.endColumn
      }
    };
  }

  private modulePath(): string {
    const segments = [this.identifier("lower").text];
    while (this.at(".") && !["{", "*"].includes(this.peek(1).text)) {
      this.take();
      segments.push(this.identifier("lower").text);
    }
    return segments.join(".");
  }

  private importDecl(): ImportDecl {
    const start = this.expect("import");
    const module = this.modulePath();
    this.expect(".");
    if (this.at("*")) this.fail("K_IMPORT_WILDCARD", "wildcard imports are forbidden", this.peek());
    this.expect("{");
    const names: string[] = [];
    while (!this.at("}")) {
      names.push(this.identifier().text);
      if (this.at("as")) this.fail("K_IMPORT_ALIAS", "import aliases are forbidden", this.peek());
      if (!this.at(",")) break;
      const comma = this.take();
      if (this.at("}")) this.fail("K_LEX_TRAILING_COMMA", "trailing commas are forbidden", comma);
    }
    const end = this.expect("}");
    return { module, names, location: this.located(start, end) };
  }

  private declaration(): Declaration {
    const start = this.peek();
    const publicValue = this.at("pub") ? (this.take(), true) : false;
    if (this.at("record")) return this.recordDecl(start, publicValue);
    if (this.at("type")) return this.typeDecl(start, publicValue);
    if (this.at("effect")) return this.effectDecl(start, publicValue);
    if (this.at("fn")) return this.functionDecl(start, publicValue);
    const token = this.peek();
    if (["class", "interface", "macro", "throw", "null"].includes(token.text)) {
      this.fail("K_FEATURE_EXCLUDED", `${token.text} is excluded from Volt v0`, token);
    }
    this.fail("K_PARSE_ALTERNATIVE_SPELLING", "expected record, type, effect, or fn declaration", token);
  }

  private recordDecl(start: Token, publicValue: boolean): RecordDecl {
    this.expect("record");
    const name = this.identifier("upper").text;
    this.expect("{");
    const fields: RecordField[] = [];
    while (!this.at("}")) {
      const field = this.identifier("lower");
      this.expect(":");
      fields.push({ name: field.text, type: this.typeRef(), location: field.location });
      if (!this.at(",")) break;
      const comma = this.take();
      if (this.at("}")) this.fail("K_LEX_TRAILING_COMMA", "trailing commas are forbidden", comma);
    }
    const end = this.expect("}");
    return { kind: "record", public: publicValue, name, fields, location: this.located(start, end) };
  }

  private typeDecl(start: Token, publicValue: boolean): TypeDecl {
    this.expect("type");
    const name = this.identifier("upper").text;
    this.expect("{");
    const variants: VariantDecl[] = [];
    while (!this.at("}")) {
      const variant = this.identifier("upper");
      let payload: TypeRef | undefined;
      if (this.at("(")) {
        this.take();
        payload = this.typeRef();
        this.expect(")");
      }
      variants.push({ name: variant.text, ...(payload === undefined ? {} : { payload }), location: variant.location });
    }
    const end = this.expect("}");
    return { kind: "type", public: publicValue, name, variants, location: this.located(start, end) };
  }

  private effectDecl(start: Token, publicValue: boolean): EffectDecl {
    this.expect("effect");
    const name = this.identifier("upper").text;
    this.expect("{");
    const operations: EffectOperation[] = [];
    while (!this.at("}")) {
      const operationStart = this.expect("fn");
      const operationName = this.identifier("lower").text;
      this.expect("(");
      const params = this.params();
      this.expect(")");
      this.expect("->");
      const returnType = this.typeRef();
      operations.push({ name: operationName, params, returnType, location: operationStart.location });
    }
    const end = this.expect("}");
    return { kind: "effect", public: publicValue, name, operations, location: this.located(start, end) };
  }

  private functionDecl(start: Token, publicValue: boolean): FunctionDecl {
    this.expect("fn");
    if (this.at("+") || this.at("-") || this.at("*") || this.at("/")) {
      this.fail("K_FEATURE_EXCLUDED", "operator overloading is excluded from Volt v0", this.peek());
    }
    const name = this.identifier("lower").text;
    if (this.at("<")) this.fail("K_FEATURE_DEFERRED", "user-defined generics are deferred", this.peek());
    this.expect("(");
    const params = this.params();
    this.expect(")");
    const uses: string[] = [];
    if (this.at("uses")) {
      this.take();
      this.expect("{");
      while (!this.at("}")) {
        uses.push(this.identifier("upper").text);
        if (!this.at(",")) break;
        const comma = this.take();
        if (this.at("}")) this.fail("K_LEX_TRAILING_COMMA", "trailing commas are forbidden", comma);
      }
      this.expect("}");
    }
    if (!this.at("->")) this.fail("K_TYPE_BOUNDARY", "function boundaries require explicit return types", this.peek());
    this.take();
    const returnType = this.typeRef();
    const body = this.block();
    return { kind: "function", public: publicValue, name, params, uses, returnType, body, location: this.located(start, this.previous()) };
  }

  private params(): Param[] {
    const params: Param[] = [];
    while (!this.at(")")) {
      const name = this.identifier("lower");
      if (!this.at(":")) this.fail("K_TYPE_BOUNDARY", "function boundaries require explicit types", name);
      this.take();
      params.push({ name: name.text, type: this.typeRef(), location: name.location });
      if (!this.at(",")) break;
      const comma = this.take();
      if (this.at(")")) this.fail("K_LEX_TRAILING_COMMA", "trailing commas are forbidden", comma);
    }
    return params;
  }

  private typeRef(): TypeRef {
    const token = this.identifier();
    const args: TypeRef[] = [];
    if (this.at("<")) {
      this.take();
      args.push(this.typeRef());
      if (this.at(",")) {
        this.take();
        args.push(this.typeRef());
      }
      this.expect(">");
    }
    return { kind: "named", name: token.text, args, location: token.location };
  }

  private block(): Expr {
    this.expect("{");
    const expression = this.expression();
    this.expect("}");
    return expression;
  }

  private expression(minimum = 0): Expr {
    let left = this.prefix();
    while (true) {
      if (this.at("(")) {
        const start = left.location;
        this.take();
        const args: Expr[] = [];
        while (!this.at(")")) {
          args.push(this.expression());
          if (!this.at(",")) break;
          const comma = this.take();
          if (this.at(")")) this.fail("K_LEX_TRAILING_COMMA", "trailing commas are forbidden", comma);
        }
        const end = this.expect(")");
        left = { kind: "call", callee: left, args, location: { file: this.file, range: { ...start.range, endByte: end.location.range.endByte, endLine: end.location.range.endLine, endColumn: end.location.range.endColumn } } };
        continue;
      }
      if (this.at(".")) {
        const start = left.location;
        this.take();
        const field = this.identifier("lower");
        left = { kind: "field", target: left, name: field.text, location: { file: this.file, range: { ...start.range, endByte: field.location.range.endByte, endLine: field.location.range.endLine, endColumn: field.location.range.endColumn } } };
        continue;
      }
      const precedence = BINARY[this.peek().text];
      if (this.at("?")) this.fail("K_FEATURE_DEFERRED", "implicit Result propagation is deferred", this.peek());
      if (precedence === undefined || precedence <= minimum) break;
      const operator = this.take();
      const right = this.expression(precedence);
      left = {
        kind: "binary", operator: operator.text, left, right,
        location: { file: this.file, range: { ...left.location.range, endByte: right.location.range.endByte, endLine: right.location.range.endLine, endColumn: right.location.range.endColumn } }
      };
    }
    return left;
  }

  private prefix(): Expr {
    const token = this.peek();
    if (this.at("let")) {
      this.take();
      const name = this.identifier("lower");
      const annotation = this.at(":") ? (this.take(), this.typeRef()) : undefined;
      this.expect("=");
      const value = this.expression();
      this.expect("in");
      const body = this.expression();
      return { kind: "let", name: name.text, ...(annotation === undefined ? {} : { annotation }), value, body, location: this.located(token, this.previous()) };
    }
    if (this.at("if")) {
      this.take();
      const condition = this.expression();
      const then = this.block();
      this.expect("else");
      const otherwise = this.block();
      return { kind: "if", condition, then, otherwise, location: this.located(token, this.previous()) };
    }
    if (this.at("match")) {
      this.take();
      const subject = this.expression();
      this.expect("{");
      const arms: Array<{ pattern: Pattern; value: Expr; location: Located }> = [];
      while (!this.at("}")) {
        const start = this.peek();
        const pattern = this.pattern();
        this.expect("->");
        const value = this.expression();
        arms.push({ pattern, value, location: this.located(start, this.previous()) });
      }
      this.expect("}");
      return { kind: "match", subject, arms, location: this.located(token, this.previous()) };
    }
    if (this.at("!") || this.at("-")) {
      const operator = this.take();
      const operand = this.expression(7);
      return { kind: "unary", operator: operator.text as "!" | "-", operand, location: this.located(operator, this.previous()) };
    }
    return this.atom();
  }

  private atom(): Expr {
    const token = this.peek();
    if (["null", "throw", "new", "class", "macro"].includes(token.text)) {
      this.fail("K_FEATURE_EXCLUDED", `${token.text} is excluded from Volt v0`, token);
    }
    if (token.kind === "integer") {
      this.take();
      return { kind: "literal", value: BigInt(token.value ?? token.text.replaceAll("_", "")), literalKind: "Int", location: token.location };
    }
    if (token.kind === "string") {
      this.take();
      return { kind: "literal", value: token.value ?? "", literalKind: "String", location: token.location };
    }
    if (this.at("true") || this.at("false")) {
      this.take();
      return { kind: "literal", value: token.text === "true", literalKind: "Bool", location: token.location };
    }
    if (this.at("(")) {
      const start = this.take();
      if (this.at(")")) {
        const end = this.take();
        return { kind: "literal", value: null, literalKind: "Unit", location: this.located(start, end) };
      }
      const expression = this.expression();
      this.expect(")");
      return expression;
    }
    if (this.at("[")) {
      const start = this.take();
      const items: Expr[] = [];
      while (!this.at("]")) {
        items.push(this.expression());
        if (!this.at(",")) break;
        const comma = this.take();
        if (this.at("]")) this.fail("K_LEX_TRAILING_COMMA", "trailing commas are forbidden", comma);
      }
      const end = this.expect("]");
      return { kind: "list", items, location: this.located(start, end) };
    }
    if (token.kind === "identifier") {
      this.take();
      if (/^[A-Z]/u.test(token.text) && this.at("{")) {
        this.take();
        const fields: Array<{ name: string; value: Expr; location: Located }> = [];
        while (!this.at("}")) {
          const field = this.identifier("lower");
          this.expect(":");
          fields.push({ name: field.text, value: this.expression(), location: field.location });
          if (!this.at(",")) break;
          const comma = this.take();
          if (this.at("}")) this.fail("K_LEX_TRAILING_COMMA", "trailing commas are forbidden", comma);
        }
        const end = this.expect("}");
        return { kind: "record", name: token.text, fields, location: this.located(token, end) };
      }
      return { kind: "name", name: token.text, location: token.location };
    }
    this.fail("K_PARSE_EXPECTED", "expected expression", token, "expression");
  }

  private pattern(): Pattern {
    const token = this.peek();
    if (this.at("_")) { this.take(); return { kind: "wildcard", location: token.location }; }
    if (token.kind === "integer") { this.take(); return { kind: "literal", value: BigInt(token.text), literalKind: "Int", location: token.location }; }
    if (token.kind === "string") { this.take(); return { kind: "literal", value: token.value ?? "", literalKind: "String", location: token.location }; }
    if (this.at("true") || this.at("false")) { this.take(); return { kind: "literal", value: token.text === "true", literalKind: "Bool", location: token.location }; }
    if (this.at("[")) {
      const start = this.take();
      if (this.at("]")) { const end = this.take(); return { kind: "list", empty: true, location: this.located(start, end) }; }
      const head = this.pattern();
      this.expect(",");
      this.expect("...");
      const tail = this.identifier("lower");
      const end = this.expect("]");
      return { kind: "list", empty: false, head, tail: tail.text, location: this.located(start, end) };
    }
    const name = this.identifier();
    if (/^[A-Z]/u.test(name.text)) {
      if (this.at("{")) {
        this.take();
        const fields: Array<{ name: string; pattern: Pattern; location: Located }> = [];
        while (!this.at("}")) {
          const field = this.identifier("lower");
          this.expect(":");
          fields.push({ name: field.text, pattern: this.pattern(), location: field.location });
          if (!this.at(",")) break;
          const comma = this.take();
          if (this.at("}")) this.fail("K_LEX_TRAILING_COMMA", "trailing commas are forbidden", comma);
        }
        const end = this.expect("}");
        return { kind: "record", name: name.text, fields, location: this.located(name, end) };
      }
      if (this.at("(")) {
        this.take();
        const payload = this.pattern();
        const end = this.expect(")");
        return { kind: "constructor", name: name.text, payload, location: this.located(name, end) };
      }
      return { kind: "constructor", name: name.text, location: name.location };
    }
    return { kind: "binding", name: name.text, location: name.location };
  }
  private previous(): Token { return this.tokens[Math.max(0, this.index - 1)]!; }
}

export interface ParseResult {
  ast?: AstV1;
  diagnostics: DiagnosticV1[];
}

export function parse(source: SourceFile): ParseResult {
  const lexed = lex(source);
  if (lexed.diagnostics.length > 0) return { diagnostics: lexed.diagnostics };
  try {
    return { ast: new Parser(source.path, lexed.tokens).parse(), diagnostics: [] };
  } catch (error) {
    if (error instanceof ParseFailure) return { diagnostics: [error.diagnostic] };
    throw error;
  }
}
