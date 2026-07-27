---
updated: "2026-07-27T05:45:59Z"
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
- GitHub Milestones and Projects own initiative and delivery sequencing.
- Local `.plan/` Markdown contains compatibility pointers only; do not duplicate GitHub planning content there.
- Use `plan discuss assess` and `plan discuss promote` for GitHub-backed promotion.
- Do not create planning issues, labels, milestones, or projects manually unless Plan emits `manual_fallback_allowed=true`.
- Specs stop at human approval before implementation. Issues #3, #4, and #5 are complete. Issue #6 is owner-approved for offline implementation only.

## Repository Verification

- Node.js 24 or newer is required by `package.json`.
- `tsconfig.json` freezes strict TypeScript 6 compilation to the ignored `dist/` output tree.
- `package-lock.json` pins the dependency-free package state; run `npm ci` to reproduce it.
- Run `npm run check:research` for approved protocol, evidence, traceability, report, and schema invariants.
- `research/test/` covers protocol approval and traceability, decision rules, research metrics, and maintenance measures.
- Run `npm run check:language` for the Issue #4 kernel, grammar coverage, fixture hashes, rejection/boundary coverage, formatter goldens, public-change obligations, and twelve-slot feature coverage.
- `language/test/kernel.test.mjs` covers approved-kernel drift, fixture addressing, grammar/static-rule coverage, all feature boundaries, formatter ordering, public-change ordering, and protocol workload compatibility.
- Run `npm run build` for strict TypeScript 6 compilation and `npm run check:toolchain` for schemas, checker-profile fidelity, complexity, and dependency guardrails.
- `toolchain/test/toolchain.test.mjs` covers accepted/rejected conformance, both checker modes, Unknown propagation, AST/IR/graph stability, all public-change categories, DiagnosticV1 rendering, manifests, CLI commands, interpreter behavior, capability isolation, exit classes, and latency guardrails.
- Run `npm run verify` for all contract validation and deterministic tests.
- After `npm run build`, invoke the local CLI with `node dist/toolchain/src/cli.js <check|run|test|fmt> --project <repo>`.
- Protocol v1.1 is owner-approved. Do not change its six primary comparisons, power rules, or decision gates without reopening Issue #3.
- Issue #6 offline implementation must remain network-free and spend-free under normal verification.
- Do not run live calibration without its owner-approved frozen model/authorization manifest and spend ceiling.
- Do not run confirmatory trajectories without completed calibration, a valid powered sample-size decision, and separate owner approval.

## Verification and Closeout

- Run checks with `brain session run -- <command>`.
- Run `plan check --project .` after planning changes or before closing a Plan-backed spec.
- Run `brain context audit --project .` after meaningful context, architecture, config, CI, or docs changes.
- Finish with `brain session finish --project .` before opening a ready pull request.
