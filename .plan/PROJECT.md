# Project: volt

Created: 2026-07-26T05:35:48Z

## Vision

Build Volt, a programming language designed around AI agents as first-class
authors and operators, without sacrificing human review, control, or
understanding.

## Principles

- Agent-first: syntax, semantics, diagnostics, and tools should support reliable
  machine generation and repair.
- Human-governed: generated programs must remain inspectable, reviewable, and
  attributable.
- Deterministic by default: minimize hidden behavior and ambiguous execution.
- Verifiable: make contracts, effects, and failures machine-checkable.
- Small before broad: prove a narrow semantic core before pursuing a
  general-purpose ecosystem.
- Bootstrap pragmatically: choose implementation technology after the language
  thesis and semantic requirements are clear.

## Constraints

- Project is at inception; no runtime, implementation language, syntax,
  execution model, or package system is selected.
- Initial work must distinguish language semantics from compiler/runtime
  implementation choices.
- Specs must define observable behavior and verification before implementation.

## Planning Rules

- Specs are the canonical execution contract.
- Brainstorms capture discovery; they do not authorize implementation.
- Keep architecture choices open until a spec establishes their requirements.
- Prefer one small executable language slice over a broad paper design.
- Record unresolved questions explicitly instead of silently choosing defaults.

## Notes

- Product thesis: language-level affordances may make agent-written software
  safer and easier to inspect than retrofitting agent workflows onto existing
  languages.
- First planning target: define Volt's target workloads, non-goals, and minimum
  viable semantic core.
