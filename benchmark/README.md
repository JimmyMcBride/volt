---
updated: "2026-07-28T05:16:55Z"
---
# Volt controlled-study harness

This directory implements the protocol-frozen benchmark and the owner-approved, fail-closed live-calibration boundary from GitHub Issue #17. Normal development, validation, tests, and fake calibration remain network-free and zero-spend. Implementing or merging this boundary does not authorize a provider inference request.

## What is included

- One content-addressed, four-module event-registration seed repository.
- Four public, non-scored calibration tasks and twelve publicly exposed development fixtures permanently retired from confirmatory evidence.
- A content-hashed retirement manifest and an exact provider-context allowlist for only the four calibration tasks.
- Full Volt, erased-static-obligation, alias-permissive, and plain-diagnostic condition adapters.
- A deterministic 160-trajectory calibration schedule: four tasks, two model families, four conditions, and five replicate blocks.
- Frozen structured/plain diagnostic forks with identical first submissions, ordered facts, and repair-turn nonces.
- Prompt-only OpenAI and Novita adapters using `AgentSubmissionV1`; models receive no shell, tools, hidden tests, expected solutions, secrets, or host paths.
- Exact request envelopes, identity and fingerprint checks, strict UTF-8/JSON validation, cache detection, and deterministic adapter-owned audit actions.
- A 640-request hard ceiling, exact token-price accounting, worst-case reservations, append-only checkpoints, ambiguous-billing retention, and no replay after interruption.
- Equivalent four-module strict TypeScript, Rust, and Gleam descriptive scaffolds.
- Six-endpoint calibration power selection, task-dispersion inputs, feasibility rules, and eleven separate operational measurements.

## Network-free commands

Regenerate committed corpus, manifest, and schema artifacts:

```sh
npm run build
npm run benchmark:generate
```

Validate all corpus, schema, hash, hidden-test, mutant, treatment-parity, provider-boundary, authorization, and network-isolation contracts:

```sh
npm run check:benchmark
```

Run the small offline fake/replay fixture:

```sh
npm run benchmark:offline
```

Run the complete 160-trajectory fake calibration and artifact flow with zero provider calls and zero spend:

```sh
npm run benchmark:calibration:dry-run
```

`npm run verify` remains network-free and spend-free.

## Two approval gates

Issue #17 spec approval authorizes implementation, fake-provider tests, frozen-manifest generation, and a review PR. It authorizes no live completion request and no spend.

After this implementation is merged, operators may run the explicit metadata-only preflight:

```sh
npm run benchmark:calibration:preflight
```

This command may contact only documented zero-charge metadata endpoints. It makes zero inference requests. A provider without adequate metadata evidence keeps `readyForRunApproval` false and requires an amended model/provider decision.

A run-approval packet is built from the merged 40-character commit, saved preflight evidence, current price evidence, and an expected duration:

```sh
npm run benchmark:calibration:approval-packet -- \
  --implementation-commit <merged-sha> \
  --preflight <preflight.json> \
  --price-evidence <price-evidence.json> \
  --expected-duration-minutes <minutes>
```

The packet freezes the exact authorization hash, all manifest hashes, provider evidence, price table, worst-case estimate, proposed `$45.00 USD` ceiling, expected duration, retired-corpus hash, and the exact owner response required. Live calibration remains unauthorized until the owner explicitly approves that hash and ceiling.

Only after that second approval may the one-shot calibration command be supplied the matching local authorization manifest, estimate, merged commit, and credentials:

```sh
npm run benchmark:calibrate -- \
  --authorization <approved-authorization.json> \
  --estimated-spend <usd> \
  --implementation-commit <merged-sha>
```

`benchmark:confirmatory` remains fail-closed. Calibration never authorizes confirmatory execution or contributes evidence to the Volt thesis.

## Failure, privacy, and storage boundaries

Scheduled inference requests never retry. A failed, timed-out, malformed, budget-exhausted, missing, or ambiguously billed trajectory remains a failure. An interruption after durable reservation is conservatively retained as ambiguous billing and that request identity is never replayed. Completed trajectories are checkpointed and skipped on resume.

Credentials are read only by the parent process from `OPENAI_API_KEY` and `NOVITA_API_KEY`. Raw calibration artifacts are owner-only and ignored under `benchmark/artifacts/calibration/<runId>/`. Only synthetic public calibration material may reach a provider. The twelve retired task hashes, hidden assertions, expected solutions, mutations, secrets, and host paths are denied.

Calibration, causal Volt, and descriptive-language results remain separate namespaces. Descriptive baselines cannot support a Volt-specific causal claim, calibration outcomes are non-evidentiary, and the eleven operational measurements cannot be collapsed into a success-determining composite.
