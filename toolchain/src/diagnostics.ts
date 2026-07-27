import type {
  DiagnosticV1,
  Located,
  Phase,
  RelatedLocation,
  RepairAction,
  RepositoryFacts
} from "./contracts.js";

export interface DiagnosticInput extends Located {
  phase: Phase;
  code: string;
  message: string;
  severity?: "error" | "warning";
  expected?: string;
  actual?: string;
  related?: RelatedLocation[];
  repairs?: RepairAction[];
  repository?: RepositoryFacts;
}

export function makeDiagnostic(input: DiagnosticInput): DiagnosticV1 {
  return {
    schemaVersion: 1,
    sequence: 0,
    phase: input.phase,
    code: input.code,
    severity: input.severity ?? "error",
    message: input.message,
    file: input.file,
    range: input.range,
    ...(input.expected === undefined ? {} : { expected: input.expected }),
    ...(input.actual === undefined ? {} : { actual: input.actual }),
    related: input.related ?? [],
    repairs: input.repairs ?? [],
    ...(input.repository === undefined ? {} : { repository: input.repository })
  };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function orderDiagnostics(inputs: DiagnosticV1[]): DiagnosticV1[] {
  return [...inputs]
    .sort(
      (a, b) =>
        compareText(a.file, b.file) ||
        a.range.startByte - b.range.startByte ||
        compareText(a.phase, b.phase) ||
        compareText(a.code, b.code) ||
        compareText(a.message, b.message)
    )
    .map((diagnostic, sequence) => ({ ...diagnostic, sequence }));
}

export function renderNdjson(diagnostics: DiagnosticV1[]): string {
  const ordered = orderDiagnostics(diagnostics);
  return ordered.map((diagnostic) => JSON.stringify(diagnostic)).join("\n") +
    (diagnostics.length === 0 ? "" : "\n");
}

export function renderText(diagnostics: DiagnosticV1[]): string {
  return orderDiagnostics(diagnostics)
    .map((diagnostic) => {
      const position = `${diagnostic.file}:${diagnostic.range.startLine + 1}:${diagnostic.range.startColumn + 1}`;
      const facts = {
        expected: diagnostic.expected,
        actual: diagnostic.actual,
        related: diagnostic.related,
        repairs: diagnostic.repairs,
        repository: diagnostic.repository
      };
      return `v${diagnostic.schemaVersion}#${diagnostic.sequence} ${position} ${diagnostic.severity} ${diagnostic.code} [${diagnostic.phase}] ${diagnostic.message} ${JSON.stringify(facts)}`;
    })
    .join("\n") + (diagnostics.length === 0 ? "" : "\n");
}
