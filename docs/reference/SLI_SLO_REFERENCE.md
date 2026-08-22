# SLI / SLO Reference

## Service Level Indicators (SLI)

- API availability (`/api/mesh/status`, platform health endpoints)
- Request latency (P50/P95)
- Error rate (5xx and failed operations)
- Deployment success rate

## Service Level Objectives (SLO)

- Availability: `>= 99.5%` monthly
- API P95 latency: `<= 500ms` for internal control endpoints
- Error rate: `<= 1%` over rolling 7-day window
- Successful deployment rate: `>= 99%`

## Validation After Change

1. Confirm CI checks pass.
2. Confirm deployment completed without rollback.
3. Confirm SLI dashboards do not regress after release.
