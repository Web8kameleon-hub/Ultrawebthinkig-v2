# CD Reference

## Objective

Define safe and traceable continuous delivery from validated commits to runtime environments.

## Environments

- `staging`
- `production`

## Deployment Entry

- Existing pipeline: `.github/workflows/production.yml`
- Release governance pipeline: `.github/workflows/release-governance.yml`

## Pre-Deploy Requirements

1. CI governance checks pass.
2. Release readiness check passes.
3. Release notes and change references are complete.

## Traceability

- Deployment must reference commit SHA.
- Deployment must reference issue/ticket IDs.
- Deployment artifacts must include validation reports.
