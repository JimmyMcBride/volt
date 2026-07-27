---
updated: "2026-07-27T03:18:37Z"
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
- Specs stop at human approval before implementation. Issue #4 is owner-approved; its linked branch may implement only the approved language-kernel contract. Issues #5 and #6 remain blocked.

## Research Protocol Verification

- Node.js 24 or newer is required by `package.json`.
- `package-lock.json` pins the dependency-free package state; run `npm ci` to reproduce it.
- Run `npm run verify` to validate protocol, evidence, traceability, report, and schema invariants, then execute deterministic tests.
- `research/test/protocol.test.mjs` covers approval state, traceability uniqueness, report identity, and schema contracts.
- `research/test/decision-rules.test.mjs` covers six-endpoint Holm adjustment and every support, weakening, uncertainty, harm, guardrail, and maintenance decision path.
- `research/test/metrics.test.mjs` covers semantic-compression and repair-locality algorithms.
- `research/test/maintenance.test.mjs` covers strict repository-change success, propagation completeness, preservation counts, semantic blast radius, impact prediction, and descriptive reviewability using stable conceptual impact-site fixtures.
- These are research-layer fixtures, not compiler conformance claims. No compiler exists.
- Protocol v1.1 is owner-approved. Do not change its six primary comparisons, power rules, or decision gates without reopening Issue #3. Study execution still requires the separately approved downstream corpus and study spec.
- Do not construct the benchmark corpus or execute trajectories until the downstream spec is explicitly approved.

## Verification and Closeout

- Run available checks with `brain session run -- <command>`.
- Run `plan check --project .` after planning changes.
- Run `brain context audit --project .` after meaningful context or architecture changes.
- Finish with `brain session finish --project .`.
