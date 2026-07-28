---
updated: "2026-07-28T05:23:00Z"
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
- Specs stop at human approval before implementation. Issues #3–#6 and #15 are complete; Issue #17 is approved for offline implementation only.

## Repository Verification

- `package.json` requires Node.js 24 or newer, defines the build/check/test workflows, and keeps runtime dependencies at zero.
- `package-lock.json` pins the reproducible npm dependency state; use `npm ci` for a clean install.
- `tsconfig.json` freezes strict TypeScript 6 compilation into ignored `dist/` output.
- Run `npm run check:research` for protocol, evidence, traceability, report, and schema invariants.
- `research/test/` freezes approval, evidence, decision-rule, metric, and safe-maintenance contracts.
- Run `npm run check:language` for the kernel, canonical camelCase naming, grammar coverage, fixture hashes, rejection/boundary coverage, formatter goldens, public-change obligations, and workload feature coverage.
- `language/test/` freezes kernel, grammar, naming, formatter, fixture, and workload-coverage contracts.
- Run `npm run build` and `npm run check:toolchain` for compilation, schemas, checker-profile fidelity, complexity, and dependency guardrails.
- `toolchain/test/` covers parser/checker fidelity, diagnostics, formatting, graph stability, runtime capabilities, and CLI behavior.
- Run `npm run benchmark:generate` after an approved source-contract change; generation must be byte-idempotent.
- Run `npm run check:benchmark` for all 16 task states, 128 retained mutation kills, treatment parity, provider manifests, authorization gates, schemas, and offline network/spend isolation.
- `benchmark/test/live.test.mjs` covers exact provider envelopes, response validation, context allowlisting, redaction, metadata-only retry rules, spend/checkpoint safety, the deterministic 160-trajectory schedule, two byte-identical fake calibrations, six-endpoint power failure, and the run-approval packet.
- `npm run benchmark:offline` writes ignored deterministic fake/replay artifacts without provider calls.
- `npm run benchmark:calibration:dry-run` exercises the full 160-trajectory schedule and artifact flow without provider calls or spend.
- `npm run benchmark:calibration:preflight` is an explicit post-merge metadata-only command; it may not issue inference.
- Build the run-approval packet only from the merged commit, no-inference preflight evidence, price evidence no older than 24 hours, expected duration, and every frozen hash.
- Do not run `benchmark:calibrate` until the owner explicitly approves the exact authorization hash and USD ceiling. Issue #17 implementation approval is not run approval.
- Keep `benchmark:confirmatory` fail-closed until fresh private tasks, calibration feasibility, powered sample size, validity review, and a separate owner approval exist.
- Run `npm run verify` for all contract validation and deterministic tests.
- After `npm run build`, invoke the local CLI with `node dist/toolchain/src/cli.js <check|run|test|fmt> --project <repo>`.

## Verification and Closeout

- Run checks with `brain session run -- <command>`.
- Run `plan check --project .` after planning changes or before closing a Plan-backed spec.
- Run `brain context audit --project .` after meaningful context, architecture, config, CI, or docs changes.
- Finish with `brain session finish --project .` before opening a ready pull request.
