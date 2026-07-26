---
updated: "2026-07-26T07:23:39Z"
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
- Specs stop at human approval before implementation.

## Research Protocol Verification

- Node.js 24 or newer is required by `package.json` for the Issue #3 research artifacts.
- Run `npm ci` to reproduce the committed `package-lock.json` state.
- Run `npm run verify` to validate the protocol/evidence/traceability artifacts and execute deterministic metric and decision-rule fixtures.
- GitHub Actions repeats `npm run verify` for research-protocol changes.
- Do not construct the benchmark corpus or execute study trajectories until Issue #6 is explicitly approved.

## Verification and Closeout

- Run available checks with `brain session run -- <command>`.
- Run `plan check --project .` after planning configuration changes.
- Run `brain context audit --project .` after meaningful context or architecture changes.
- Finish with `brain session finish --project .`.
