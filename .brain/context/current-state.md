---
updated: "2026-07-27T06:58:17Z"
---
# Current State

<!-- brain:begin context-current-state -->
This file is a deterministic snapshot of the repository state at the last refresh.

## Repository

- Project: `volt`
- Root: `.`
- Runtime: `unknown`
- Current branch: `master`
- Go test files: `0`
<!-- brain:end context-current-state -->

## Local Notes

- PR #11 review hardening makes stable JSON total for unsupported JavaScript values, canonicalizes diagnostic ordering and sequencing at both rendering boundaries, rejects malformed runtime entrypoints explicitly, and preserves diagnostic-code phase ownership in parser-originated failures.
- Verified on the Issue #5 branch with `npm run verify` (68 tests passing) and `plan check --project .` (no findings).
- Issue #6 offline implementation adds the deterministic event-registration benchmark corpus, causal/descriptive condition adapters, replayable trajectory harness, artifact schemas, preregistered analysis, and baseline parity scaffolds under `benchmark/`.
- Calibration and confirmatory provider execution remain fail-closed: normal verification permits no network calls or spend, and live phases require separately approved, hash-bound authorization artifacts.
