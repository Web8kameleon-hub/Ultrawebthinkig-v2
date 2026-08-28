# API Reference — UltraWeb AI Platform

Base URL (production): `https://ultraweb.ai`  
Base URL (local dev): `http://127.0.0.1:3000`

All API routes live under `/api/`.

---

## Health

### `GET /api/health`

Returns platform health status. Also used by Vercel cron (every 6 h).

**Response 200**
```json
{
  "status": "ok",
  "timestamp": "2025-07-18T12:00:00.000Z",
  "version": "8.0.0"
}
```

---

## Ads

All ads routes proxy to `ADS_UPSTREAM_URL`. Requires the following env vars:

```env
ADS_UPSTREAM_URL=https://<your-ads-service>
ADS_UPSTREAM_TOKEN=<secure-token>
ADS_TIMEOUT=20
```

### `GET /api/ads/health`
Returns upstream ads service health.

### `GET /api/ads/campaigns`
Returns active ad campaigns.

### `POST /api/ads/serve`
Serves an ad impression for a given placement.

**Body**
```json
{
  "placement": "banner-top",
  "pageUrl": "https://ultraweb.ai/ultra-saas"
}
```

### `GET /api/ads/revenue`
Returns aggregated revenue data.

---

## OpenAPI Spec

### `GET /openapi.json`

Returns the full OpenAPI 3.0 specification (rewritten from `/api/openapi`).

---

## Backend Services

These endpoints are served by the Express backend (`backend/server.ts`) and are
proxied through Vercel rewrites at `/backend/*`.

| Endpoint | Description |
|---|---|
| `GET /backend/status` | System status & metrics |
| `GET /backend/metrics` | Prometheus metrics |
| `WS /backend/events` | WebSocket real-time event stream |

---

## Error Codes

| Code | Meaning |
|---|---|
| `configuration_error` | Required env var missing |
| `upstream_error` | Upstream service returned an error |
| `rate_limited` | Too many requests |
| `not_found` | Resource does not exist |

---

## Authentication

Currently, the platform uses per-service tokens passed as `Authorization: Bearer <token>` headers.
OAuth2 / OIDC integration is planned for a future release.

---

## Rate Limits

| Route | Limit |
|---|---|
| `/api/ads/*` | 200 req / min |
| `/api/health` | Unlimited |
| All others | 60 req / min per IP |
