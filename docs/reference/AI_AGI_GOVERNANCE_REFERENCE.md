# AI / AGI Governance Reference

## Goal

Use existing local and GitHub knowledge sources to build an independent, evidence-based AI/AGI operating model.

## Source Registry

- Registry file: `config/ai-governance-sources.json`
- Local policy baseline: `NO_FAKE_POLICY.md`
- Delivery governance index: `docs/reference/GOVERNANCE_INDEX.md`

## Governance Rules

1. Decisions must cite sources from registry.
2. Runtime behavior must avoid fabricated data paths.
3. Every change must include CI/CD and release evidence.

## Multi-Repo Operation

- Keep a curated list of contributed repositories.
- For cross-repo changes, track:
  - repo name
  - issue/PR link
  - commit SHA
  - validation report paths

## Required Evidence for AGI Changes

- `reports/infra-topology-validation.json`
- `reports/no-fake-audit.json`
- `reports/release-readiness.json`
