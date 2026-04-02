# Kloud Bridge

Isolated microservice inside `clisonix-cloud` that connects platform workloads to the external `Kameleonlife/Kloud` sovereign fabric.

## Why isolated?

- `Kloud` remains the canonical sovereign runtime in its own repository.
- `kloud-bridge` only handles contracts, translation, and connectivity.
- This keeps infra IP and application IP separated.

## Default port

- `8889`

## Endpoints

- `GET /health`
- `GET /status`
- `POST /signals/publish`
- `POST /fabric/sync`

## Environment variables

- `PORT=8889`
- `KLOUD_UPSTREAM_URL=`
- `KLOUD_SIGNAL_PATH=/submit`
- `KLOUD_STATUS_PATH=/status`
- `KLOUD_PEERS_PATH=/peers`
- `KLOUD_STATE_PATH=/state`
- `KLOUD_ISOLATED_MODE=true`

## Local run

```bash
uvicorn main:app --host 0.0.0.0 --port 8889
```

## Example publish

```bash
curl -X POST http://localhost:8889/signals/publish \
  -H "Content-Type: application/json" \
  -d '{"ops":["S"],"payload":{"signal":"alpha","source":"albi"}}'
```
