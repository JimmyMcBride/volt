---
updated: "2026-07-28T05:17:28Z"
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
- [Issue #17](https://github.com/JimmyMcBride/volt/issues/17) is the approved live-calibration provider-boundary specification.

## Live-Calibration Workflow

- Issue #17 spec approval authorizes implementation, fake-provider verification, committed manifest generation, and a review PR only. It authorizes zero inference requests and zero spend.
- Keep `npm run verify`, `npm run benchmark:offline`, and `npm run benchmark:calibration:dry-run` network-free and zero-spend.
- Run `npm run benchmark:calibration:preflight` only after the implementation is merged. It may use documented zero-charge metadata endpoints but must make no inference request.
- Build the run-approval packet from the exact merged commit, saved preflight result, current price evidence, expected duration, and all frozen hashes.
- Do not run `benchmark:calibrate` until the owner explicitly approves the packet's exact authorization hash and USD ceiling.
- Treat any model, provider, endpoint, revision, tokenizer, quantization, request-field, fingerprint, price, or ceiling drift as requiring a revised packet or spec amendment.
- Keep `benchmark:confirmatory` fail-closed. Calibration cannot authorize confirmatory execution or update the Volt thesis.
- The twelve tracked confirmatory fixtures are publicly exposed and permanently retired from confirmatory evidence. Future confirmatory tasks must be newly generated after freeze and kept outside public Git until the study completes.

## Naming-Migration Workflow

- Treat snake_case-to-camelCase as a breaking source migration, not a formatter rewrite.
- Keep the lexer broad enough to report source-located naming diagnostics.
- Reject underscores and wrong case before semantic resolution.
- Preserve research metric/task/condition IDs, diagnostic codes, JSON keys, CLI flags, and baseline-language conventions.
- Regenerate the content-addressed benchmark corpus from its generator; never hand-edit generated task JSON.
- Verify generation is idempotent and all 16 expected solutions plus 128 retained mutants still satisfy their frozen outcomes.
- Do not run live calibration or consume provider spend as part of migration verification.

## Verification Commands

- `npm run check:research`: validate approved protocol v1.1 and research evidence contracts.
- `npm run check:language`: validate the kernel contract and all conformance inputs.
- `npm run build`: compile the reference toolchain with strict TypeScript 6.
- `npm run check:toolchain`: validate toolchain schemas, checker-profile hash, source-size guardrail, and zero runtime dependencies.
- `npm run check:benchmark`: validate all 16 tasks, hashes, assertions, 128 retained mutants, treatment parity, provider manifests, authorization gates, and offline network/spend isolation.
- `npm run benchmark:generate`: regenerate content-addressed corpus, provider manifests, and schemas after approved source-contract changes.
- `npm run benchmark:offline`: run deterministic fake/replay trajectories without provider calls.
- `npm run benchmark:calibration:dry-run`: run the complete deterministic 160-trajectory fake calibration and artifact flow without provider calls.
- `npm run verify`: run all contract validators, compile the toolchain, and execute all deterministic tests.
- `plan check --project .`: validate Plan/GitHub-backed project state.
- `brain context audit --project .`: audit durable context after meaningful changes.

Use `node dist/toolchain/src/cli.js <check|run|test|fmt> --project <repo>` after `npm run build`. A Volt repository must provide the versioned repository manifest; test discovery is explicit and never filename-based.
