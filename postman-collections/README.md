# Postman Collections

This directory contains Postman collections for API testing via the Kitchen worker.

## Collections

| Collection | Description | Key |
| ---------- | ----------- | --- |
| `Protocol_Kitchen_Sovereign_System.postman_collection.json` | Core protocol tests | `sovereign` |
| `clisonix-ultra-mega-collection.json` | Comprehensive API tests | `ultra-mega` |
| `Clisonix_Cloud_API.postman_collection.json` | Main cloud service tests | `cloud-api` |
| `Clisonix-Cloud-Real-APIs.postman_collection.json` | Production endpoint tests | `real-apis` |
| `clisonix-cloud.postman_collection.json` | Standard test suite | `main` |

## Public Thunder Client / VS Code

We include a public export of the Thunder Client collections and environments for quick use in VS Code or to seed the Kitchen runner.

Files:

- `public/thunderCollection.json` — Thunder Client collection (public)
- `public/thunderEnvironment.json` — Thunder Client environment with production hostnames (replace tokens before running)

Import these into Thunder Client (VS Code) via the Thunder Client import UI.

## Usage

### Via API

```bash
curl -X POST https://api.clisonix.cloud/api/kitchen/run-tests \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"collection": "main", "baseUrl": "https://api.clisonix.cloud"}'
```

### Check Status

```bash
curl https://api.clisonix.cloud/api/kitchen/status/{runId}
```

### Get Report

```bash
curl https://api.clisonix.cloud/api/kitchen/reports/{runId}
```

## Environment Variables

Collections use the `base_url` environment variable which is set automatically by the Kitchen worker.

## Adding New Collections

1. Add the collection file to this directory
2. Update the `COLLECTIONS` map in `apps/web/app/api/kitchen/run-tests/route.ts`
3. Rebuild and deploy
