---
updated: "2026-07-27T05:12:53Z"
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
- `npm run build`: compile the reference toolchain with strict TypeScript 6.
- `npm run check:toolchain`: validate toolchain schemas, the ablation profile hash, source-size guardrail, and zero runtime dependencies.
- `npm run verify`: run all contract validators, compile the toolchain, and execute all deterministic tests.
- `plan check --project .`: validate Plan/GitHub-backed project state.
- `brain context audit --project .`: audit durable context after meaningful changes.

Use `node dist/toolchain/src/cli.js <check|run|test|fmt> --project <repo>` after `npm run build`. A Volt repository must provide the versioned repository manifest; test discovery is explicit and never filename-based.
