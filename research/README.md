---
updated: "2026-07-27T03:07:00Z"
---
# Volt Research Artifacts

GitHub [Issue #3](https://github.com/JimmyMcBride/volt/issues/3) is the canonical approved v1.1 research protocol. This directory implements that protocol as executable artifacts; it does not replace the GitHub planning contract.

Protocol v1.1 is owner-approved. Its six primary comparisons, Holm family, power calculation, and falsification gate are frozen unless Issue #3 is explicitly reopened and reapproved. Both Volt hypotheses remain unvalidated until confirmatory results exist.

## Contents

- `protocol/protocol-v1.json`: machine-readable v1.1 amendment with explicit approval state.
- `schema/`: contracts for the protocol, frozen run manifests, trajectory maintenance results, and analysis reports.
- `evidence/evidence-matrix.json`: sourced prior evidence, limitations, counterevidence, and explicitly unvalidated Volt hypotheses.
- `evidence/traceability.json`: evidence-to-hypothesis-to-experiment-to-decision links for correctness and safe evolution.
- `protocol/report-template.json`: disclosure-complete report skeleton with six primary comparisons.
- `lib/metrics.mjs`: deterministic semantic-compression and repair-locality calculations.
- `lib/maintenance.mjs`: strict repository-change success, propagation, regression, blast-radius, impact-prediction, stale-contract, unrequested-change, and descriptive reviewability calculations.
- `test/`: fixtures for preregistered metrics, decision paths, schema contracts, and conceptual repository-impact sets.

## Verification

Node.js 24 or newer is required. The research package has no runtime dependencies.

```sh
npm run verify
```

Study execution, task construction, hidden tests, compiler impact facts, and raw-result collection remain owned by separately approved downstream specs. No compiler exists on this branch.
