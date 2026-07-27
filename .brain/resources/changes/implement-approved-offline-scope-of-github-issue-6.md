---
updated: "2026-07-27T17:01:43Z"
---
# Issue #6 Offline Benchmark Implementation

## Durable Outcome

- Added a deterministic four-module event-registration seed, four calibration tasks, and twelve private confirmatory tasks.
- Added exact causal ablations, descriptive language baseline scaffolds, a replayable three-repair trajectory harness, content-addressed artifacts, authorization gates, and preregistered analysis.
- The trajectory harness enforces the 15-minute budget before and during model completion; timeouts are retained as failed outcomes.
- Live calibration and confirmatory provider execution remain separately gated; repository verification is offline-only with zero allowed network calls and zero spend.
- Every live phase requires an explicit finite non-negative spend estimate; missing, negative, infinite, or `NaN` values fail before authorization.

## Verification

- `npm run verify`
- `npm run benchmark:offline`
- `plan check --project .`

The offline replay uses deterministic fake/replay model adapters and does not authorize a live study.
