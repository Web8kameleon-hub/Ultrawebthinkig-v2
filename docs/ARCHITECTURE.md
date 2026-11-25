# Architecture — UltraWeb AI Platform

## High-Level Overview

```
Browser (Next.js App Router)
        │
        ├── /ultra-saas          ← Main SaaS dashboard
        ├── /openmind            ← Multi-model AI chat
        ├── /agimed              ← Medical intelligence
        ├── /neural-search-demo  ← Semantic search
        └── ... 40+ pages
        │
        ▼
API Routes (app/api/**)
        │
        ├── /api/health          ← Health check (cron every 6 h)
        ├── /api/ads/*           ← Ads proxy → upstream ADS_UPSTREAM_URL
        ├── /api/openapi         ← OpenAPI spec
        └── ...
        │
        ▼
Backend Services (backend/)
        │
        ├── Express server (tsx backend/server.ts)
        ├── Socket.IO (real-time events)
        ├── Redis / ioredis (cache & pub-sub)
        └── PostgreSQL / pg (persistent data)
        │
        ▼
External AI Providers
        │
        ├── OpenAI GPT-4o
        ├── Anthropic Claude
        ├── Google Gemini
        └── HuggingFace Inference
```

---

## JOAN ASI Trinity

The core intelligence engine is organised into three complementary roles:

| Component | Albanian Name | Responsibility |
|---|---|---|
| **Alba** | Trupi (Body) | Data collection, real-time monitoring, execution |
| **Albi** | Shpirti (Spirit) | Intelligence creation, pattern recognition, learning |
| **Jona** | Zemra (Heart) | Ethical guidance, love-driven protection of life |

---

## Frontend Stack

| Technology | Purpose |
|---|---|
| Next.js 14 (App Router) | Routing, SSR, API routes |
| TypeScript 5 | Type safety across the entire codebase |
| Framer Motion | Animations & transitions |
| Tailwind CSS | Utility-first styling |
| Vanilla Extract | Type-safe CSS-in-JS where needed |
| Recharts | Data visualisation |
| TanStack Query | Server state management |
| Lucide React | Icon library |

---

## Backend Stack

| Technology | Purpose |
|---|---|
| Node.js 18+ | Runtime |
| Express 5 | HTTP server |
| Socket.IO 4 | WebSocket / real-time layer |
| ioredis | Redis client |
| pg | PostgreSQL client |
| Pino / Winston | Structured logging |
| prom-client | Prometheus metrics |
| Helmet | Security headers |

---

## Infrastructure

| Layer | Technology |
|---|---|
| Hosting | Vercel (Edge Functions) |
| CDN | Cloudflare |
| Containers | Docker + docker-compose |
| Orchestration | Kubernetes (k8s/) |
| CI/CD | GitHub Actions |
| Monitoring | Prometheus + custom AGI dashboard |

---

## Data Flow — AI Chat (OpenMind)

```
User message
    │
    ▼
/app/openmind/         (React UI)
    │
    ▼
/app/api/openmind/     (Next.js route handler)
    │ selects model based on context
    ▼
AI Provider (OpenAI / Anthropic / Gemini / HuggingFace)
    │
    ▼
Streamed response back to UI via SSE
```

---

## Security Architecture

- **Quantum Security Layer** (`quantum-security.js`) — post-quantum key exchange
- **DDoS Protection** (`ddos/`) — rate limiting, IP filtering, anomaly detection
- **CSP & HSTS** via Vercel headers (vercel.json)
- **Helmet middleware** on all Express routes
- **Environment secrets** never committed; loaded via `.env` / Vercel env vars
