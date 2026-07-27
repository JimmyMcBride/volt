---
updated: "2026-07-27T03:47:53Z"
---
## Project Workflow

1. Start with `brain prep --task "<task>"`.
2. Use Brain for durable mission, evidence, terminology, decisions, risks, and rejected alternatives.
3. Use local `.plan/PROJECT.md` and `.plan/ROADMAP.md` only to resolve GitHub ownership and links.
4. Use GitHub Discussions for brainstorms and shaping.
5. Use Plan promotion commands to create GitHub-owned spec issues and milestones.
6. Stop specifications at human approval before implementation.
7. Run verification through `brain session run -- <command>` and finish the Brain session before opening a ready pull request.

## Planning Ownership

- Source mode: GitHub.
- Canonical specs: GitHub Issues.
- Canonical sequencing: GitHub Milestones and Projects.
- Local Plan Markdown must not mirror canonical planning content.
- Plan must authorize any manual fallback before planning objects are created outside Plan.

## Verification Commands

- `npm run check:research`: validate approved protocol v1.1 and research evidence contracts.
- `npm run check:language`: validate the Issue #4 kernel contract and all conformance inputs.
- `npm run verify`: run both contract validators and all deterministic tests.
- `plan check --project .`: validate Plan/GitHub-backed project state.
- `brain context audit --project .`: audit durable context after meaningful changes.

Language fixture validation is not executable Volt compilation. Issue #5 must implement and run the parser, resolver, checker, formatter, DiagnosticV1, and interpreter conformance suites against these frozen inputs.
