# Volt Research Hypothesis

## Mission

Volt investigates whether a programming language designed around AI coding
models and autonomous software-engineering agents can measurably improve
correctness, repair efficiency, and human auditability.

Volt is a research instrument first. A production language is a possible later
outcome, not an initial assumption.

## Working Hypothesis

Given approximately equivalent model exposure, tasks, and tooling, a language
with immutable defaults, algebraic data types, exhaustive matching, explicit
effects, canonical syntax, structured diagnostics, and narrow idiomatic
conventions will produce greater first-pass correctness and faster repair
cycles than languages with greater semantic or stylistic ambiguity.

## Semantic Compression

Semantic compression is the proposed objective of maximizing how much
programmer intent valid source communicates while minimizing ambiguity and
plausible incorrect interpretations.

This is not yet an operational metric. Research must define observable proxies,
competing explanations, and falsification thresholds.

## What Better for Agents Means

Candidate measurements:

- Higher first-pass compilation and functional correctness.
- Fewer repair iterations and repair tokens.
- Less wall-clock time to a correct program.
- Fewer unhandled domain states and unintended effects.
- Better cross-file consistency.
- Greater success using structured diagnostics without human explanation.
- Stable results across repeated trials, prompts, and model families.
- Acceptable human readability, review burden, and runtime/tooling cost.

## Evidence Status

No project-specific empirical evidence review has been completed yet.

- The central hypothesis is unvalidated.
- Candidate language features are research inputs, not approved requirements.
- Existing-language comparisons and AI performance claims require sourced
  research.
- Functional-first design, actor concurrency, proof obligations, semantic
  diffs, and transactional agent changes remain speculative until evidence or
  experiments justify them.
- Training exposure and tool maturity are major confounders.

## Definitions

- **AI-friendly language:** a language whose semantics and tools measurably
  improve agent correctness, repair efficiency, or auditability under
  controlled comparison.
- **Canonical syntax:** one officially preferred representation for
  foundational constructs, enforced by grammar and formatter where practical.
- **Ambiguity:** the number or diversity of plausible interpretations or
  implementations consistent with a task, source fragment, or diagnostic.
- **First-pass correctness:** a generated program satisfies compilation and
  hidden functional tests before any repair feedback.
- **Repair cycle:** one generate-or-edit, check, diagnostic, and retry loop.
- **Effect:** an observable interaction beyond pure value computation, such as
  I/O, time, randomness, mutation, or external capability use.
- **Invariant:** a condition required to hold across defined program states or
  transitions.
- **Agent-readable diagnostic:** stable structured output with
  machine-addressable codes, locations, expected/received facts, related
  symbols, and bounded repair possibilities.

## Falsification

The hypothesis weakens or fails if controlled experiments show no meaningful
improvement; benefits disappear when exposure and tooling are controlled;
repair cost materially increases; or restrictions impose complexity,
performance, or usability costs larger than correctness and auditability gains.

## Durable Constraints

- Define evaluation before language design hardens.
- Keep the first prototype deliberately small.
- Separate semantic requirements from implementation architecture.
- Rank evidence and counterevidence explicitly.
- Require traceability from evidence to hypothesis, requirement, experiment,
  and result.
- Require human approval of GitHub-owned specs before implementation.
