# CLO Reference (Change Lifecycle Operations)

## Lifecycle Stages

1. **Plan**: Define scope, risk, and owner.
2. **Implement**: Apply minimal, auditable code changes.
3. **Validate**: Run CI gates and no-fake checks.
4. **Release**: Publish release notes and deployment references.
5. **Observe**: Monitor SLI/SLO outcomes.

## Required Inputs Per Change

- Issue or ticket reference
- Files changed and rationale
- Validation command outputs
- Rollback strategy

## Required Outputs Per Change

- PR checklist completed
- Reports generated under `reports/`
- Release notes updated with links and SHA
