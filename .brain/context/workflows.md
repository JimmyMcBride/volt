---
updated: "2026-07-27T17:41:59Z"
---
## Startup

1. Run `brain prep --task "<task>"`.
2. Read `AGENTS.md` and relevant Brain context.
3. Read `.plan/PROJECT.md` and `.plan/ROADMAP.md` for backend ownership and canonical GitHub links.
4. Inspect linked GitHub Discussions, Issues, Milestones, or Projects before planning or execution.
5. Use `brain search` when compiled context is insufficient.

## GitHub-Backed Planning

- Plan source mode and story backend are `github`.
- GitHub Discussions are the canonical brainstorm and shaping surface.
- GitHub Issues are canonical specifications and readiness records.
- GitHub Milestones and Projects own sequencing.
- Local `.plan/` Markdown contains compatibility pointers only; do not duplicate GitHub planning content there.
- Use `plan discuss assess` and `plan discuss promote` for GitHub-backed promotion.
- Do not create planning issues, labels, milestones, or projects manually unless Plan emits `manual_fallback_allowed=true`.
- Specs stop at human approval before implementation. Issues #3–#6 are complete; Issue #15 is the active owner-approved pre-calibration naming migration.

## Repository Verification

- `package.json` requires Node.js 24 or newer, defines the build/check/test workflows, and keeps runtime dependencies at zero.
- `package-lock.json` pins the reproducible npm dependency state; use `npm ci` for a clean install.
- `tsconfig.json` freezes strict TypeScript 6 compilation into ignored `dist/` output.
- Run `npm run check:research` for protocol, evidence, traceability, report, and schema invariants. `research/test/` covers approval, evidence, decision rules, metrics, and safe-maintenance measurements.
- Run `npm run check:language` for the kernel, canonical camelCase naming, grammar coverage, fixture hashes, rejection/boundary coverage, formatter goldens, public-change obligations, and workload feature coverage. `language/test/` freezes those validation contracts.
- Run `npm run build` and `npm run check:toolchain` for compilation, schemas, checker-profile fidelity, complexity, and dependency guardrails.
- `toolchain/test/toolchain.test.mjs` covers all identifier roles, rejects underscores through `K_NAME_UNDERSCORE`, rejects wrong case through `K_NAME_CONVENTION`, and proves formatting never guesses invalid renames.
- Run `npm run benchmark:generate` after an approved source-contract change; generation must be byte-idempotent.
- Run `npm run check:benchmark` for all 16 task states, content hashes, assertions, 128 retained mutation kills, treatment parity, baseline equivalence, schemas, authorization gates, and offline network/spend isolation. `benchmark/test/` covers conditions, trajectories, hidden-output isolation, authorization, power, analysis, and operational measures.
- Every Volt condition uses canonical camelCase. The alias-permissive condition varies keywords only and must still reject snake_case.
- Preserve protocol v1.1 IDs, research metric/task/condition IDs, diagnostic/JSON keys, CLI flags, artifact directory IDs, and idiomatic external-baseline naming.
- `npm run benchmark:offline` writes ignored deterministic fake/replay artifacts and performs no provider calls.
- Run `npm run verify` for all contract validation and deterministic tests.
- After `npm run build`, invoke the local CLI with `node dist/toolchain/src/cli.js <check|run|test|fmt> --project <repo>`.
- Do not run live calibration without its owner-approved frozen model/authorization manifest and spend ceiling.
- Do not run confirmatory trajectories without completed calibration, a valid powered sample-size decision, and separate owner approval.

## Verification and Closeout

- Run checks with `brain session run -- <command>`.
- Run `plan check --project .` after planning changes or before closing a Plan-backed spec.
- Run `brain context audit --project .` after meaningful context, architecture, config, CI, or docs changes.
- Finish with `brain session finish --project .` before opening a ready pull request.
