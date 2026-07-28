---
updated: "2026-07-28T05:21:38Z"
---
<!-- brain:begin context-current-state -->
This file is a deterministic snapshot of the repository state at the last refresh.

## Repository

- Project: `volt`
- Root: `.`
- Runtime: `node`
- Current branch: `codex/live-calibration-provider-boundary-and-authorization`
- Default branch: `main`
<!-- brain:end context-current-state -->

## Local Notes

- Issues #3–#6 and #15 are implemented, merged, and closed.
- [Issue #17](https://github.com/JimmyMcBride/volt/issues/17) is owner-approved for offline implementation on branch `codex/live-calibration-provider-boundary-and-authorization`; approval authorizes fake-provider verification, frozen manifests, and a review PR, but no provider inference request or spend.
- The Issue #17 implementation freezes exact OpenAI and Novita envelopes, `AgentSubmissionV1`, four-task provider-context hashes, the 160-trajectory schedule, paired diagnostic forks, a 640-request ceiling, exact spend reservations, append-only checkpoints, and a merged-commit run-approval packet.
- Normal verification and the complete fake calibration remain network-free and zero-spend. Live calibration still requires a separate owner response naming the exact authorization hash and USD ceiling; confirmatory execution remains separately gated and fail-closed.
- Issue #17 verification passes 94 tests, validates all 16 tasks and 128 retained mutants, freezes 22 benchmark schemas, and produces byte-identical schedule/record/request hashes across repeated 160-trajectory fake calibrations.
- The twelve tracked `benchmark/corpus/generated/private/` tasks are publicly exposed and permanently retired from confirmatory evidence. Future confirmatory tasks must be freshly generated after freeze and remain outside public Git until the study completes.
- Canonical Volt source uses lowerCamelCase for value/module names, UpperCamelCase for type/effect/variant names, and no underscores in Volt-authored identifiers.
- Protocol v1.1, the v0 grammar, the causal endpoints, and thesis decision rules remain unchanged by Issue #17.
