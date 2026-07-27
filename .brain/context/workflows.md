---
updated: "2026-07-27T03:48:27Z"
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
- Specs stop at human approval before implementation. Issue #4 is owner-approved and limited to language-kernel contracts. Issues #5 and #6 require their own approval before execution.

## Repository Verification

- Node.js 24 or newer is required by `package.json`.
- `package-lock.json` pins the dependency-free package state; run `npm ci` to reproduce it.
- Run `npm run check:research` for approved protocol, evidence, traceability, report, and schema invariants.
- `research/test/` covers protocol approval and traceability, decision rules, research metrics, and maintenance measures.
- Run `npm run check:language` for the Issue #4 kernel, grammar coverage, fixture hashes, rejection/boundary coverage, formatter goldens, public-change obligations, and twelve-slot feature coverage.
- `language/test/kernel.test.mjs` covers approved-kernel drift, fixture addressing, grammar/static-rule coverage, all feature boundaries, formatter ordering, public-change ordering, and protocol workload compatibility.
- Run `npm run verify` for all contract validation and deterministic tests.
- Language contract checks are conformance-input checks, not claims that a compiler exists. Issue #5 must consume these inputs in executable lexer/parser/resolver/checker/formatter tests.
- Protocol v1.1 is owner-approved. Do not change its six primary comparisons, power rules, or decision gates without reopening Issue #3.
- Do not construct the benchmark corpus or execute trajectories until Issue #6 is explicitly approved.

## Verification and Closeout

- Run checks with `brain session run -- <command>`.
- Run `plan check --project .` after planning changes or before closing a Plan-backed spec.
- Run `brain context audit --project .` after meaningful context, architecture, config, CI, or docs changes.
- Finish with `brain session finish --project .` before opening a ready pull request.
