---
updated: "2026-07-26T05:39:44Z"
---
## Startup

1. Run `brain prep --task "<task>"`.
2. Read `AGENTS.md`, project Brain context, and relevant Plan artifacts.
3. Use `brain search` when compiled context is insufficient.

## Product and Language Design

1. Read `.plan/PROJECT.md` and `.plan/ROADMAP.md`.
2. Use brainstorms for discovery and specs as canonical implementation contracts.
3. Keep unresolved language semantics explicit.
4. Do not begin architecture or implementation from unapproved brainstorm material.

## Verification and Closeout

- Run available checks with `brain session run -- <command>`.
- No language build or test commands exist during inception.
- Run `plan check --project .` after planning changes.
- Run `brain context audit --project .` after meaningful context or architecture changes.
- Finish with `brain session finish --project .`.
