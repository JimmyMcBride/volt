export type Phase =
  | "lex"
  | "parse"
  | "resolve"
  | "type"
  | "effect"
  | "exhaustiveness"
  | "runtime";

export interface SourceRange {
  startByte: number;
  endByte: number;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface Located {
  file: string;
  range: SourceRange;
}

export interface RelatedLocation extends Located {
  message: string;
}

export type RepairApplicability = "always" | "maybe" | "unsafe";

export interface RepairAction {
  title: string;
  applicability: RepairApplicability;
  target?: string;
  replacement?: string;
}

export type DependencyReason =
  | "defines"
  | "references"
  | "imports"
  | "calls"
  | "constrains"
  | "matches"
  | "uses-effect"
  | "tested-by";

export interface RepairTarget {
  stableId: string;
  reason: DependencyReason;
}

export interface RepositoryFacts {
  affectedSymbols: string[];
  affectedDeclarations: string[];
  affectedFiles: string[];
  affectedSites: string[];
  missingPropagationSites: string[];
  dependencyReasons: DependencyReason[];
  boundedRepairSurface: RepairTarget[];
}

export interface DiagnosticV1 extends Located {
  schemaVersion: 1;
  sequence: number;
  phase: Phase;
  code: string;
  severity: "error" | "warning";
  message: string;
  expected?: string;
  actual?: string;
  related: RelatedLocation[];
  repairs: RepairAction[];
  repository?: RepositoryFacts;
}

export interface TypeRef {
  kind: "named";
  name: string;
  args: TypeRef[];
  location: Located;
}

export interface Param {
  name: string;
  type: TypeRef;
  location: Located;
}

export interface ImportDecl {
  module: string;
  names: string[];
  location: Located;
}

export interface RecordField {
  name: string;
  type: TypeRef;
  location: Located;
}

export interface VariantDecl {
  name: string;
  payload?: TypeRef;
  location: Located;
}

export interface EffectOperation {
  name: string;
  params: Param[];
  returnType: TypeRef;
  location: Located;
}

export interface RecordDecl {
  kind: "record";
  public: boolean;
  name: string;
  fields: RecordField[];
  location: Located;
}

export interface TypeDecl {
  kind: "type";
  public: boolean;
  name: string;
  variants: VariantDecl[];
  location: Located;
}

export interface EffectDecl {
  kind: "effect";
  public: boolean;
  name: string;
  operations: EffectOperation[];
  location: Located;
}

export interface FunctionDecl {
  kind: "function";
  public: boolean;
  name: string;
  params: Param[];
  uses: string[];
  returnType: TypeRef;
  body: Expr;
  location: Located;
}

export type Declaration = RecordDecl | TypeDecl | EffectDecl | FunctionDecl;

export type LiteralValue = bigint | string | boolean | null;

export interface LiteralExpr {
  kind: "literal";
  value: LiteralValue;
  literalKind: "Int" | "String" | "Bool" | "Unit";
  location: Located;
}

export interface NameExpr {
  kind: "name";
  name: string;
  location: Located;
}

export interface ListExpr {
  kind: "list";
  items: Expr[];
  location: Located;
}

export interface RecordExpr {
  kind: "record";
  name: string;
  fields: Array<{ name: string; value: Expr; location: Located }>;
  location: Located;
}

export interface CallExpr {
  kind: "call";
  callee: Expr;
  args: Expr[];
  location: Located;
}

export interface FieldExpr {
  kind: "field";
  target: Expr;
  name: string;
  location: Located;
}

export interface UnaryExpr {
  kind: "unary";
  operator: "!" | "-";
  operand: Expr;
  location: Located;
}

export interface BinaryExpr {
  kind: "binary";
  operator: string;
  left: Expr;
  right: Expr;
  location: Located;
}

export interface LetExpr {
  kind: "let";
  name: string;
  annotation?: TypeRef;
  value: Expr;
  body: Expr;
  location: Located;
}

export interface IfExpr {
  kind: "if";
  condition: Expr;
  then: Expr;
  otherwise: Expr;
  location: Located;
}

export interface MatchExpr {
  kind: "match";
  subject: Expr;
  arms: Array<{ pattern: Pattern; value: Expr; location: Located }>;
  location: Located;
}

export type Expr =
  | LiteralExpr
  | NameExpr
  | ListExpr
  | RecordExpr
  | CallExpr
  | FieldExpr
  | UnaryExpr
  | BinaryExpr
  | LetExpr
  | IfExpr
  | MatchExpr;

export interface WildcardPattern {
  kind: "wildcard";
  location: Located;
}
export interface BindingPattern {
  kind: "binding";
  name: string;
  location: Located;
}
export interface LiteralPattern {
  kind: "literal";
  value: LiteralValue;
  literalKind: "Int" | "String" | "Bool" | "Unit";
  location: Located;
}
export interface ConstructorPattern {
  kind: "constructor";
  name: string;
  payload?: Pattern;
  location: Located;
}
export interface RecordPattern {
  kind: "record";
  name: string;
  fields: Array<{ name: string; pattern: Pattern; location: Located }>;
  location: Located;
}
export interface ListPattern {
  kind: "list";
  empty: boolean;
  head?: Pattern;
  tail?: string;
  location: Located;
}
export type Pattern =
  | WildcardPattern
  | BindingPattern
  | LiteralPattern
  | ConstructorPattern
  | RecordPattern
  | ListPattern;

export interface AstV1 {
  schemaVersion: 1;
  module: string;
  imports: ImportDecl[];
  declarations: Declaration[];
  file: string;
  range: SourceRange;
}

export interface SourceFile {
  path: string;
  text: string;
}

export type CheckerMode = "full" | "static_obligations_erased";

export interface RepositoryManifestV1 {
  schemaVersion: 1;
  sourceRoot: string;
  run?: string;
  tests: string[];
  checkerMode?: CheckerMode;
  capabilities?: Array<{
    effect: string;
    adapter: "database" | "clock" | "notification";
    config?: Record<string, unknown>;
  }>;
}

export interface Token {
  kind: "identifier" | "integer" | "string" | "symbol" | "keyword" | "eof";
  text: string;
  value?: string;
  location: Located;
}

export interface NormalizedNode {
  kind: string;
  operator?: string;
  children: NormalizedNode[];
}

export interface NormalizedAstV1 {
  schemaVersion: 1;
  moduleBoundary: string;
  root: NormalizedNode;
  hash: string;
}

export interface TypedExpression {
  siteId: string;
  declaredType?: string;
  inferredType: string;
  resolvedTarget?: string;
  declaredEffects: string[];
  runtimeCapability?: string;
}

export interface TypedIrV1 {
  schemaVersion: 1;
  module: string;
  expressions: TypedExpression[];
}

export interface ProgramGraphNode {
  id: string;
  kind: string;
  module: string;
  file: string;
}

export interface ProgramGraphEdge {
  from: string;
  to: string;
  reason: DependencyReason;
  siteId: string;
}

export interface ProgramGraphV1 {
  schemaVersion: 1;
  nodes: ProgramGraphNode[];
  edges: ProgramGraphEdge[];
}

export interface RunManifestV1 {
  schemaVersion: 1;
  checkerMode: CheckerMode;
  checkerProfileVersion: string;
  checkerProfileHash: string;
  sourceHashes: Record<string, string>;
}

export interface CompilationResult {
  ast: AstV1[];
  normalizedAst: NormalizedAstV1[];
  typedIr: TypedIrV1[];
  graph: ProgramGraphV1;
  diagnostics: DiagnosticV1[];
  runManifest: RunManifestV1;
}
