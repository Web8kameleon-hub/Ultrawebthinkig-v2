# Pull Request Checklist

## Summary

- What changed:
- Why it changed:

## Governance References

- [ ] `docs/reference/CI_REFERENCE.md`
- [ ] `docs/reference/CD_REFERENCE.md`
- [ ] `docs/reference/CLI_REFERENCE.md`
- [ ] `docs/reference/CLO_REFERENCE.md`
- [ ] `docs/reference/SLI_SLO_REFERENCE.md`
- [ ] `docs/reference/RELEASE_REFERENCE.md`
- [ ] `docs/reference/TEST_VALIDATION_REFERENCE.md`
- [ ] `docs/reference/AI_AGI_GOVERNANCE_REFERENCE.md`

## Validation Evidence

- [ ] `yarn infra:validate`
- [ ] `yarn governance:docs:check`
- [ ] `yarn no-fake:audit` (or `yarn no-fake:enforce` when required)
- [ ] `yarn release:check` (for release-affecting changes)

Attach report paths:

- `reports/infra-topology-validation.json`
- `reports/governance-docs-check.json`
- `reports/no-fake-audit.json`
- `reports/release-readiness.json`

## Git Traceability

- Issue/Task IDs:
- Commit SHA(s):
- Related repo(s) from `config/ai-governance-sources.json`:

## Deployment & Release

- [ ] Requires deployment
- [ ] Requires release note entry
- [ ] Rollback strategy documented
