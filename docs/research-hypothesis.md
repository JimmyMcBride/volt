---
updated: "2026-07-26T07:52:51Z"
---
# Volt Research Hypothesis

## Mission

Volt investigates whether a programming language designed around AI coding models and autonomous software-engineering agents can measurably improve both initial correctness and safe evolution of existing codebases.

Volt is a research instrument first. A production language is a possible later outcome, not an assumption. Human-auditability benefit remains deferred to a separately approved blinded reviewer study.

## Testable Hypotheses

### H1: generation and repair

Given equivalent tasks, context, tool access, repair limits, and token budgets, Volt's explicit static obligations, canonical syntax, and structured diagnostics improve first-submission hidden-test success or bounded repair success under causal ablation.

### H2: safe repository evolution

Given an existing passing Volt repository and a requested change, the same treatments improve strict repository-change success: requested behavior is implemented, every required contract is propagated, hidden tests pass, effects and matches remain accurate, static guarantees are not bypassed, and unrelated behavior remains unchanged.

The guiding principle is:

> Every requested change has an explicit machine-readable impact surface, and unrelated behavior remains unchanged.

Both are Volt-specific hypotheses, not established facts.

## Evaluation Workload

The confirmatory corpus remains a synthetic four-module event-registration repository with twelve maintenance tasks:

- three state extensions;
- three invariant changes;
- three effect additions; and
- three cross-module contract changes.

Every task begins from a compiling, passing, content-addressed repository snapshot. Before execution, it freezes the requested behavior, minimum required impact surface, preservation assertions, and hidden tests. Hidden tests check the requested behavior and detect incomplete matches, forgotten callers, stale contracts, undeclared or unnecessary effects, duplicated or weakened invariants, unrelated output changes, and bypassed guarantees.

Function-sized exercises remain compiler conformance tests, not the primary language evaluation.

## Primary Outcomes

The approved v1.0 first-pass and bounded-repair estimands remain. Proposed v1.1 adds `repository_change_success_rate` as the primary maintenance outcome for the static-obligation and canonical-syntax ablations, plus repository-change success within three turns for the diagnostic representation ablation.

Repository-change success is binary and awards no partial credit. Missing trajectories are failures.

This expands the primary Holm family from three to six comparisons and changes the power calculation and falsification gate. Therefore v1.1 is `pending_reapproval`; these changes are not represented as approved results or frozen study rules.

## Operational Metrics

Semantic compression and maintenance behavior are reported as separate preregistered values. No composite may determine success.

- `obligation_coverage`: intended static-obligation rejections divided by preregistered static-obligation fixtures.
- `ast_shape_entropy`: normalized entropy of identifier- and literal-erased AST shapes among passing first submissions.
- `ambient_dependency_count`: distinct undeclared benchmark capabilities observed in typed IR.
- `repair_locality`: changed-file count and normalized AST tree-edit distance between the first failure and first passing repair.
- `contract_propagation_completeness`: correctly updated required sites divided by all preregistered required sites, with missing and unexpected identifiers.
- `unrelated_regression_count`: previously passing preservation assertions that fail after the change.
- `semantic_blast_radius`: expected and actual files, symbols, contracts, effects, and AST nodes, reported separately.
- `impact_prediction_accuracy`: precision, recall, exact-set match, false positives, and false negatives for predicted versus actually required impact sites.
- `stale_contract_count`: declarations, callers, matches, effect sets, or tests left inconsistent with the requested public change.
- `unrequested_behavior_change_count`: observable changes outside the request and allowed impact surface.
- `change_reviewability`: changed-site counts, out-of-scope sites, unexplained sites, and justification coverage; descriptive only.

Exact algorithms and deterministic fixtures live under `research/`.

## Evidence Status

Repository-level evaluations support the workload choice, not the Volt thesis. Strengthened hidden tests reduce false positives but require validation for this corpus. Cross-language results remain descriptive because exposure, tokenization, libraries, and tooling maturity cannot be equalized fully. Repair-feedback research supports treating diagnostics as part of the intervention, but does not prove a DiagnosticV1 advantage.

No existing source validates Volt's safe-evolution hypothesis, proposed program graph, impact diagnostics, or semantic diff. The evidence matrix records this explicitly as speculation with limitations.

## Language and Tooling Direction

The intended v0 kernel remains small: closed algebraic data types, exhaustive matching, explicit boundary types, exact named effect sets, immutable values, `Result` failures, canonical syntax, explicit imports, and narrow modules. No deferred feature has been pulled into v0.

A proposed downstream design rule is that a public type, contract, effect, or module-boundary change produces a deterministic affected-symbol and diagnostic list. A future compiler program graph would cover definitions, references, imports, callers, public contracts, ADT variants, matches, effects, operations, and related tests. Repository diagnostics would explain affected declarations, missing propagation, dependency reasons, and bounded repair surfaces with stable ordering.

Those are planning directions only. No compiler exists on this branch, and implementation requires separate approval of the language-kernel and interpreter specs.

## Decision Boundary

The proposed v1.1 support rule preserves the v1.0 requirement for at least two meaningful first-pass/repair comparisons, including a language comparison, and adds at least one meaningful maintenance-language comparison. Significant harm in any of the six comparisons, exclusion of meaningful benefit by both maintenance-language upper bounds, harmful model-family effects, or unresolved complexity guardrails prevents support according to the machine-readable rules.

No exploratory composite can override the preregistered decision. The owner must reapprove the amendment before confirmatory freezing or execution.

## Durable Constraints

- Define evaluation before language design hardens.
- Treat safe evolution of existing code as a primary use case.
- Make small requested changes produce explicit, deterministic impact surfaces.
- Test preservation and requested behavior together.
- Keep the first prototype deliberately small.
- Separate evidence, hypotheses, implementation directions, and results.
- Require human approval of GitHub-owned specs before implementation.
