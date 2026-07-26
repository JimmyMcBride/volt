---
updated: "2026-07-26T07:22:30Z"
---
# Volt Research Hypothesis

## Mission

Volt investigates whether a programming language designed around AI coding models and autonomous software-engineering agents can measurably improve correctness and repair efficiency.

Volt is a research instrument first. A production language is a possible later outcome, not an initial assumption. Human-auditability benefit is explicitly deferred to a separately approved blinded reviewer study.

## Working Hypothesis

Given approximately equivalent model exposure, tasks, and tooling, a language with immutable defaults, algebraic data types, exhaustive matching, explicit effects, canonical syntax, structured diagnostics, and narrow idiomatic conventions will produce greater first-pass correctness and faster repair cycles than languages with greater semantic or stylistic ambiguity.

## Semantic Compression

Semantic compression is an explanatory vector, not a composite success score:

- `obligation_coverage`: intended static-obligation rejections divided by preregistered static-obligation fixtures.
- `ast_shape_entropy`: normalized entropy of identifier- and literal-erased AST shapes among passing first submissions.
- `ambient_dependency_count`: distinct undeclared benchmark capabilities observed in typed IR.
- `repair_locality`: changed-file count and normalized AST tree-edit distance reported separately.

Exact algorithms and deterministic fixtures live under `research/`.

## Evidence Status

The project-specific evidence synthesis is complete for the approved v0 protocol; the Volt thesis itself remains unvalidated.

- Repository-level work and strengthened hidden tests are supported as evaluation-method choices, not as proof of Volt-specific benefit.
- Cross-language results are descriptive because exposure, tokenization, libraries, and tooling maturity cannot be equalized fully.
- Iterative repair evidence makes feedback representation part of the treatment, but does not establish a DiagnosticV1 advantage.
- Static obligations, canonical syntax, and structured diagnostic benefits remain preregistered causal hypotheses.
- No controlled Volt result exists yet, and calibration data cannot count as confirmatory evidence.

The sourced matrix and its limitations are in `research/evidence/evidence-matrix.json`. GitHub [Issue #3](https://github.com/JimmyMcBride/volt/issues/3) remains the canonical protocol specification.

## Definitions

- **AI-friendly language:** a language whose semantics and tools measurably improve agent correctness or repair efficiency under controlled comparison.
- **Canonical syntax:** one officially preferred representation for foundational constructs, enforced by grammar and formatter where practical.
- **Ambiguity:** the number or diversity of plausible interpretations or implementations consistent with a task, source fragment, or diagnostic.
- **First-pass correctness:** a generated program satisfies compilation and hidden functional tests before any repair feedback.
- **Repair cycle:** one generate-or-edit, check, diagnostic, and retry loop.
- **Effect:** an observable interaction beyond pure value computation, such as I/O, time, randomness, mutation, or external capability use.
- **Invariant:** a condition required to hold across defined program states or transitions.
- **Agent-readable diagnostic:** stable structured output with machine-addressable codes, locations, expected/received facts, related symbols, and bounded repair possibilities.

## Decision Boundary

Continued research is supported only when at least two of the three primary comparisons show a preregistered meaningful benefit, at least one is a language comparison, neither model family has a materially harmful result on an otherwise successful comparison, and every complexity guardrail passes.

The result is weakened, inconclusive, or falsified according to the exact machine-readable rules in `research/protocol/protocol-v1.json`; no exploratory composite can override those rules.

## Durable Constraints

- Define evaluation before language design hardens.
- Keep the first prototype deliberately small.
- Separate semantic requirements from implementation architecture.
- Rank evidence and counterevidence explicitly.
- Preserve traceability from evidence to hypothesis, experiment, and decision.
- Require human approval of GitHub-owned specs before implementation.
