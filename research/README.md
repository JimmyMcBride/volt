# Volt Research Artifacts

GitHub [Issue #3](https://github.com/JimmyMcBride/volt/issues/3) is the
canonical specification. This directory contains its executable deliverables;
it does not replace or mirror the planning contract.

## Contents

- `protocol/protocol-v1.json`: approved, machine-readable protocol values.
- `schema/`: contracts for the protocol, frozen run manifests, trajectory
  results, and analysis reports.
- `evidence/evidence-matrix.json`: sourced prior evidence, limitations,
  counterevidence, and explicitly unvalidated Volt hypotheses.
- `evidence/traceability.json`: evidence-to-hypothesis-to-experiment-to-decision
  links.
- `protocol/report-template.json`: disclosure-complete report skeleton for the
  later controlled study.
- `lib/`: deterministic metric and decision-rule implementations.
- `test/`: fixtures for every preregistered metric and decision path.

## Verification

Node.js 24 or newer is required. The research package has no runtime
dependencies.

```sh
npm run verify
```

Study execution, task construction, hidden tests, and raw-result collection
remain owned by Issue #6.
