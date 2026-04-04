# OceanCore Rust Node Agent

Minimal Rust-based edge agent for the `kloud-bridge` hardware contract.

## Features

- loads the shared JSON node profile
- fetches the firmware contract from the bridge
- registers a node over `/api/v1/hardware/nodes/register`
- sends one-shot or repeated heartbeats
- can emit a proof-of-life signal through `/api/v1/signals/publish`

## Build

```bash
cargo build --manifest-path scripts/hardware/rust_node_agent/Cargo.toml
```

## Run

```bash
cargo run --manifest-path scripts/hardware/rust_node_agent/Cargo.toml -- \
  --bridge http://127.0.0.1:8889 \
  --profile scripts/hardware/profiles/oceancore_lab_01.json \
  --count 3 --interval 5 --emit-signal
```
