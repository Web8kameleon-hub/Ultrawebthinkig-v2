# Verification Run - 2026-08-22

## Scope

This run verifies governance controls, delivery checks, and local platform startup.

## Commands Executed

```powershell
yarn governance:docs:check
yarn validate:delivery
yarn release:check
yarn ultra
```

## Results

- `yarn governance:docs:check` -> **PASS**
- `yarn infra:validate` -> **PASS** (`errors: 0`, `warnings: 0`)
- `yarn validate:delivery` -> **PASS** for topology/docs checks and generated no-fake audit report
- `yarn release:check` -> **PASS** (release readiness report generated)
- `yarn ultra` -> **PASS** (frontend and backend windows launched)

## Runtime Startup (Ultra)

- Frontend: `http://127.0.0.1:3000`
- Backend bridge: `http://127.0.0.1:3000/api/bridge/health`
- Backend internal: `http://127.0.0.1:3001`

## Reports Generated

- `reports/infra-topology-validation.json`
- `reports/governance-docs-check.json`
- `reports/no-fake-audit.json`
- `reports/release-readiness.json`

## Notes

- The no-fake report currently records existing legacy findings across the repository (`findingCount: 672`).
- Governance, topology, release-readiness, and startup checks are operational.
