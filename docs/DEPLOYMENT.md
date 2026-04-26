# Deployment Guide — UltraWeb AI Platform

---

## Vercel (Recommended)

### One-command deploy

```bash
vercel --prod
```

Vercel automatically:
- Detects Next.js and builds with `next build`
- Deploys API routes as Edge Functions (Node 18)
- Applies headers, redirects and rewrites from `vercel.json`
- Runs the health cron every 6 h

### Environment variables

Set these in the Vercel dashboard or with the CLI:

```bash
vercel env add ADS_UPSTREAM_URL
vercel env add ADS_UPSTREAM_TOKEN
vercel env add DATABASE_URL
vercel env add REDIS_URL
vercel env add OPENAI_API_KEY
vercel env add ANTHROPIC_API_KEY
vercel env add GOOGLE_AI_API_KEY
```

### Domains

The project is aliased to:
- `ultraweb.ai`
- `www.ultraweb.ai`
- `api.ultraweb.ai` (backend proxy)

---

## Docker

### Development

```bash
docker-compose -f docker-compose.yml up --build
```

### Production

```bash
docker-compose -f docker-compose.production.yml up -d --build
```

### Kameleon (custom runtime)

```bash
docker-compose -f docker-compose.kameleon.yml up -d
```

---

## Kubernetes

```bash
kubectl apply -f k8s/
```

Manifests in `k8s/` include Deployments, Services, Ingress, and HPA configs.

---

## Manual / VPS

```bash
# Install dependencies
yarn install

# Build
yarn build

# Start (listens on 127.0.0.1:3000 by default)
yarn start

# Start backend separately
yarn dev:backend
```

Use PM2 or systemd to keep the process alive:

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## Post-deployment checklist

- [ ] Verify `https://ultraweb.ai/robots.txt` is reachable
- [ ] Verify `https://ultraweb.ai/sitemap.xml` returns valid XML
- [ ] Submit sitemap in **Google Search Console** and **Bing Webmaster Tools**
- [ ] Confirm `X-Robots-Tag: index, follow` header is present on all pages
- [ ] Test ads health: `curl https://ultraweb.ai/api/ads/health`
- [ ] Monitor Prometheus metrics at `/backend/metrics`
