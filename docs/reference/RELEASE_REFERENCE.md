# Release Reference

## Release Types

- Patch: fixes and safe behavior changes
- Minor: additive functionality
- Major: breaking behavior or interface changes

## Mandatory Release Checklist

1. `yarn release:check` passes.
2. PR checklist completed.
3. Release notes include:
   - commit SHA
   - PR link
   - issue/task links
   - validation reports

## Git References

- Tag format: `vX.Y.Z`
- Every release must map to a single tagged commit.
- Release artifact must include governance reports from `reports/`.
