# Volt controlled-study harness

This directory implements the offline-only scope of GitHub Issue #6. It makes the approved protocol executable without contacting a model provider or spending money.

## What is included

- One content-addressed, four-module event-registration seed repository.
- Four non-scored calibration tasks and twelve private confirmatory tasks, with three confirmatory tasks in each approved maintenance family.
- Public task context separated from hidden assertions, expected solutions, preservation checks, impact surfaces, and mutation catalogs.
- Full Volt, erased-static-obligation, alias-permissive, and plain-diagnostic condition adapters.
- Equivalent four-module strict TypeScript, Rust, and Gleam descriptive scaffolds.
- Fresh-trajectory orchestration, deterministic fake/replay models, first-submission tool restrictions, three-turn repair limits, stable randomization, budgets, and content-addressed artifacts.
- Versioned corpus, task, invariant, impact, preservation, mutation, alias, model, authorization, artifact, analysis, report, run, and trajectory schemas.
- Six-endpoint causal analysis, task-cluster bootstrap intervals, stratified randomization tests, Holm adjustment, power selection, complexity gates, and eleven separate operational measurements.

## Commands

Regenerate committed corpus and schema artifacts:

```sh
npm run build
npm run benchmark:generate
```

Validate all corpus, schema, hash, public-test, hidden-test, mutant, treatment-parity, baseline, authorization, and network-isolation contracts:

```sh
npm run check:benchmark
```

Run four deterministic fake/replay calibration trajectories and write ignored artifacts under `benchmark/artifacts/`:

```sh
npm run benchmark:offline
```

The normal `npm run verify` command remains network-free and spend-free.

## Approval gates

`benchmark:calibrate` and `benchmark:confirmatory` fail closed. The committed authorization and model manifests are unapproved templates with a zero-dollar ceiling and unset model revisions. No provider integration is active in the offline implementation.

Before calibration, the owner must separately approve exact model revisions, provider and tokenizer settings, sampling, prompts, task context, tool versions, condition and alias hashes, credential isolation, storage policy, and a maximum spend.

Before confirmatory execution, calibration must be complete and the owner must separately approve the powered trajectories-per-cell decision, feasibility result, total count, expected cost and duration, frozen hashes, and validity review.

## Privacy and result boundaries

Confirmatory task manifests live under `corpus/generated/private/` and are never included in model-visible task context. Hidden outcomes are stored only as private artifacts and are not returned as repair feedback. Credentials and secrets have no representation in task, trajectory, or artifact schemas.

Calibration, causal Volt, and descriptive-language results remain distinct namespaces. Descriptive baselines cannot support a Volt-specific causal claim, and the eleven operational measurements cannot be collapsed into a success-determining composite.
