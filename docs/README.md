# UltraWeb AI Platform — Documentation

> **Author:** Ledjan Ahmati  
> **Website:** <https://ultraweb.ai>  
> **Version:** 8.0.0  
> **License:** Web8-Ultra Proprietary Industrial

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](./ARCHITECTURE.md)
3. [API Reference](./API.md)
4. [Deployment Guide](./DEPLOYMENT.md)
5. [SEO & Analytics](./SEO.md)
6. [Security](./SECURITY.md)
7. [Contributing](#contributing)

---

## Overview

**UltraWeb AI** is an AGI-powered Web8 platform built entirely by Ledjan Ahmati. It combines the following intelligence layers into a single industrial-grade product:

| Module | Description |
|---|---|
| **JOAN ASI** | Trinity AGI engine (Alba · Albi · Jona) |
| **AGIMed / AlbaMed** | Medical intelligence & diagnostics |
| **AGIXeco** | Financial intelligence & market analysis |
| **OpenMind** | Multi-model AI chat (GPT-4o, Claude, Gemini …) |
| **Neural Search** | Real-time semantic web search |
| **Quantum Security** | Post-quantum cryptography layer |
| **LoRa Mesh** | Offline-capable mesh networking |
| **IoT Manager** | Industrial IoT monitoring & control |
| **AGISheet / AGIOffice** | AI-enhanced productivity suite |
| **ASI Ultimate** | 12-layer advanced reasoning engine |

---

## Quick Start

### Prerequisites

- Node.js ≥ 18
- Yarn Berry (`yarn@4.x`)
- Docker (optional, for backend services)

### Install & run locally

```bash
# Install dependencies
yarn install

# Start Next.js dev server
yarn dev

# Start frontend + backend concurrently
yarn dev:full
```

The app runs at <http://127.0.0.1:3000> by default.

### Build for production

```bash
yarn build
yarn start
```

---

## Project Structure

```
/
├── app/                  # Next.js App Router pages & API routes
│   ├── layout.tsx        # Root layout with full SEO metadata
│   ├── sitemap.ts        # Dynamic XML sitemap
│   ├── ultra-saas/       # Main SaaS dashboard (default landing)
│   ├── agimed/           # Medical AI module
│   ├── openmind/         # Multi-model AI chat
│   ├── neural-search-demo/ # Neural search
│   └── ...               # 40+ feature pages
├── backend/              # Express / Node backend services
├── components/           # Shared React components
├── docs/                 # ← You are here
├── public/               # Static assets, robots.txt, sitemap hint
├── styles/               # Global CSS
├── types/                # TypeScript type definitions
└── vercel.json           # Vercel deployment config
```

---

## Contributing

This is a **proprietary** project. External contributions require written consent from Ledjan Ahmati.

Contact: <dealsjona@gmail.com>
