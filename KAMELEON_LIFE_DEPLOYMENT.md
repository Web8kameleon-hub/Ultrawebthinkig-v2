# Legacy `kameleon.life` Deployment Note

This file documents the current production domain strategy after moving the primary brand to `clisonix.com`.

## Active Domains

- **Primary Brand**: `https://clisonix.com`
- **Frontend App**: `https://app.clisonix.com`
- **API Gateway**: `https://api.clisonix.com`
- **NeuroSonix API**: `https://neuro.clisonix.com`
- **Legacy Redirect**: `https://kameleon.life` → `https://app.clisonix.com`

## Deployment Shape

```text
clisonix.com
├── app.clisonix.com      Next.js frontend
├── api.clisonix.com      FastAPI backend
├── neuro.clisonix.com    NeuroSonix service
└── kameleon.life         301 redirect to app.clisonix.com
```

## DNS Baseline

```text
A     clisonix.com          → [Server IP]
CNAME app.clisonix.com     → clisonix.com
CNAME api.clisonix.com     → clisonix.com
CNAME neuro.clisonix.com   → clisonix.com
A     kameleon.life        → [Server IP]
CNAME www.kameleon.life    → kameleon.life
```

## Operational Notes

- **Hosting**: Strato.de
- **Frontend Runtime**: Next.js on port `80`
- **Backend Runtime**: FastAPI on port `8080`
- **Neuro Runtime**: Python service on port `8081`
- **SSL**: Enable certificates for `clisonix.com` and all subdomains

## Next Steps

1. Point DNS records to the production server.

2. Enable SSL for `clisonix.com`, `app`, `api`, and `neuro` subdomains.

3. Configure `kameleon.life` as a permanent redirect to `https://app.clisonix.com`.

4. Deploy with `ecosystem.config.js` or `docker-compose.kameleon.yml`.
