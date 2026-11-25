# Internal API + IoT Mesh Topology (NO FAKE EVER)

This document defines how to keep internal APIs, IoT mesh nodes, and LoRa signals organized with a single source of truth and strict anti-fabrication validation.

## Source of Truth

- Topology file: `config/infra-topology.json`
- Validator: `scripts/validate-infra-topology.mjs`
- No-fake policy audit: `scripts/no-fake-policy.mjs`

## What is tracked

- `internalApis`: internal routes for mesh control and telemetry.
- `mesh.nodes`: node inventory by host, port, region, and type.
- `mesh.links`: logical connections and wave categories across nodes.
- `lora`: gateway/packet requirements and verification signal keys.

## Required workflow

1. Update `config/infra-topology.json` whenever a new internal endpoint or node is added/removed.
2. Validate topology before push.
3. Run global no-fake policy enforcement before merge.

## Commands

```powershell
yarn infra:validate
yarn no-fake:enforce
```

## Failure policy

- Any topology validation error blocks merge/deploy.
- Any fake/mock/synthetic/placeholder markers in runtime configs or code block merge/deploy.
- For unknown data state, publish explicit unavailable status instead of generated values.