---
name: Release checklist
about: Standard release governance checklist
title: "release: vX.Y.Z"
labels: ["release", "governance"]
assignees: []
---

## Release Checklist

## Scope

- Release version:
- Target environment:
- Related issue(s):

## Validation

- [ ] `yarn validate:delivery`
- [ ] `yarn release:check`
- [ ] Reports generated under `reports/`

## Governance

- [ ] `docs/reference/GOVERNANCE_INDEX.md` reviewed
- [ ] `config/ai-governance-sources.json` reviewed for impacted repos
- [ ] No-fake policy status accepted

## Git Traceability

- Tag: `vX.Y.Z`
- Commit SHA:
- PR link:

## Rollback Plan

- Rollback command(s):
- Owner on-call:
