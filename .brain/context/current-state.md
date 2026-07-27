---
updated: "2026-07-27T17:43:26Z"
---
<!-- brain:begin context-current-state -->
This file is a deterministic snapshot of the repository state at the last refresh.

## Repository

- Project: `volt`
- Root: `.`
- Runtime: `node`
- Current branch: `codex/canonical-camelcase-identifier-migration`
- Default branch: `main`
<!-- brain:end context-current-state -->

## Local Notes

- Issues #3–#6 are implemented, merged, and closed. Live calibration and confirmatory execution remain separately gated and have not run.
- Owner-approved Issue #15 is the active pre-calibration breaking migration: lowerCamelCase for Volt value/module names, UpperCamelCase for type/effect/variant names, and no underscores in Volt-authored identifiers.
- The parser emits `K_NAME_UNDERSCORE` for underscore-bearing tokens and `K_NAME_CONVENTION` for role-specific case errors. Both remain retained in the static-obligations-erased profile; alias-permissive changes keywords only.
- The four-module seed, all 16 tasks, stable Volt identities, and module-derived filenames use canonical camelCase. Protocol/research IDs and external-baseline conventions remain unchanged.
- Verification on the Issue #15 branch: `npm run verify` passes 82 tests; all 16 tasks pass, all 128 retained mutants are killed, generation is idempotent, and normal verification reports zero network calls and zero provider spend.
