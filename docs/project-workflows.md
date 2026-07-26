---
updated: "2026-07-26T05:51:12Z"
---
## Project Workflow

1. Start with `brain prep --task "<task>"`.
2. Use Brain for durable mission, evidence, terminology, decisions, risks, and rejected alternatives.
3. Use local `.plan/PROJECT.md` and `.plan/ROADMAP.md` only to resolve GitHub ownership and links.
4. Use GitHub Discussions for brainstorms and shaping.
5. Use Plan promotion commands to create GitHub-owned spec issues and milestones.
6. Stop draft specifications at human approval before implementation.
7. Run verification through `brain session run -- <command>` and finish the Brain session.

## Planning Ownership

- Source mode: GitHub.
- Canonical specs: GitHub Issues.
- Canonical sequencing: GitHub Milestones and Projects.
- Local Plan Markdown must not mirror canonical planning content.
- Plan must authorize any manual fallback before planning objects are created outside Plan.
