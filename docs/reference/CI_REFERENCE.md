# CI Reference

## Objective

Standardize continuous integration checks for each change with reproducible quality gates.

## Mandatory CI Gates

1. `yarn infra:validate`
2. `yarn no-fake:audit`
3. `yarn governance:docs:check`

## Optional CI Gates (by scope)

- `yarn type-check`
- `yarn lint`
- `yarn test`
- `yarn test:mesh`

## Required Artifacts

- `reports/infra-topology-validation.json`
- `reports/no-fake-audit.json`

## Branch Policy

- Every PR must link issue/task IDs and include validation outputs.
- CI must pass before merge.
