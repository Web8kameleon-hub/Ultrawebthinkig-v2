# Security Guide — UltraWeb AI Platform

---

## HTTP Security Headers

Configured in `vercel.json` and applied to all routes:

| Header | Value |
|---|---|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `X-Robots-Tag` | `index, follow` |

API routes (`/api/*`) use `no-cache, no-store` for `Cache-Control`.

---

## Quantum Security Layer

The `quantum-security.js` module implements post-quantum cryptography for
sensitive data exchange. It is loaded server-side and does not expose keys to
the client.

---

## DDoS Protection

`ddos/` directory contains:
- IP-based rate limiting
- Anomaly detection (sudden traffic spikes)
- Automatic block-listing of abusive IPs

The Express backend also uses `express-rate-limit` for per-route limiting.

---

## Secrets Management

**Never commit secrets to the repository.**

All sensitive values must be stored as environment variables:

```env
# AI Providers
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_AI_API_KEY=

# Database
DATABASE_URL=

# Redis
REDIS_URL=

# Ads Service
ADS_UPSTREAM_URL=
ADS_UPSTREAM_TOKEN=
```

Use `vercel env add <NAME>` for production or `.env.local` for local dev.
`.env.local` is already listed in `.gitignore`.

---

## Authentication

- Current: per-service bearer tokens (`Authorization: Bearer <token>`)
- Planned: OAuth2 / OIDC with session cookies

---

## Dependency Auditing

Run before every release:

```bash
yarn npm audit
```

Address any **critical** or **high** severity advisories before deploying.

---

## Vulnerability Reporting

Found a security issue? Please disclose responsibly:

- Email: **dealsjona@gmail.com**
- Subject: `[SECURITY] UltraWeb AI — <brief description>`

Do **not** open a public GitHub issue for security vulnerabilities.
