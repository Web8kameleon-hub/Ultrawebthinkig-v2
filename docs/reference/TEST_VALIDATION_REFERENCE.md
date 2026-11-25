# Test & Validation Reference

## Baseline Validation

```powershell
yarn infra:validate
yarn no-fake:audit
yarn governance:docs:check
```

## Extended Validation

```powershell
yarn type-check
yarn lint
yarn test
```

## Enforcement Rules

- Topology validation must pass.
- No-fake audit report must be produced on each PR.
- Enforce mode (`yarn no-fake:enforce`) is mandatory before protected branch release.
