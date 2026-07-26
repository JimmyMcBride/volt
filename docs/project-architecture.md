---
updated: "2026-07-26T05:37:21Z"
---
Volt has no implementation architecture yet. Architecture choices remain downstream of the language thesis and minimum semantic core.

## Current Repository Boundaries

- `.brain/`: project memory, context, session policy, and retrieval state.
- `.plan/`: brainstorms, specs, roadmap, and planning metadata.
- `docs/`: durable human- and agent-readable product and architecture context.
- `AGENTS.md`: entry contract for agents working in the repository.

## Guardrails

- Do not infer a runtime, compiler implementation language, VM, bytecode format, or package system from the empty repository.
- Keep language semantics separate from bootstrap implementation choices.
- Promote architectural decisions into this document only after a Plan spec or explicit project decision establishes them.
