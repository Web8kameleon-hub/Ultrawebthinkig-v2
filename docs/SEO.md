# SEO Guide — UltraWeb AI Platform

Canonical domain: **`https://ultraweb.ai`**

---

## What is already in place

| SEO Element | Location | Status |
|---|---|---|
| `metadataBase` | `app/layout.tsx` | ✅ Set to `https://ultraweb.ai` |
| `title` (default + template) | `app/layout.tsx` | ✅ |
| `description` | `app/layout.tsx` | ✅ |
| `keywords` | `app/layout.tsx` | ✅ |
| `openGraph` (title, description, image, url) | `app/layout.tsx` | ✅ |
| `twitter` card | `app/layout.tsx` | ✅ |
| `robots` (index/follow + googleBot) | `app/layout.tsx` | ✅ |
| `alternates.canonical` | `app/layout.tsx` | ✅ |
| `/robots.txt` | `public/robots.txt` | ✅ Allows all, blocks `/api/` |
| `/sitemap.xml` | `app/sitemap.ts` | ✅ 57 URLs, domain = `ultraweb.ai` |
| Web App Manifest | `public/site.webmanifest` | ✅ Updated branding |
| `X-Robots-Tag` header | `vercel.json` | ✅ `index, follow` |

---

## Per-page metadata

Each feature page should export its own `metadata` constant to override the root defaults:

```tsx
// app/agimed/page.tsx  (example)
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AGIMed — Medical Intelligence',
  description: 'AI-powered medical diagnostics and health intelligence on UltraWeb AI.',
  alternates: { canonical: 'https://ultraweb.ai/agimed' },
}
```

---

## Sitemap

The sitemap at `https://ultraweb.ai/sitemap.xml` is generated dynamically by `app/sitemap.ts`.

- **57 URLs** covering all major routes
- Home: priority `1.0`, weekly
- Feature pages (AGI, OpenMind, AGIMed …): priority `0.9`, weekly
- Tool & demo pages: priority `0.7`, monthly

To add new routes, edit `app/sitemap.ts` and append to the appropriate array.

---

## robots.txt

```
User-agent: *
Allow: /
Disallow: /api/
Disallow: /backend/
Disallow: /_next/
Sitemap: https://ultraweb.ai/sitemap.xml
```

---

## Structured Data (recommended next step)

Add JSON-LD to the root layout for organisation schema:

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'UltraWeb AI',
      url: 'https://ultraweb.ai',
      logo: 'https://ultraweb.ai/favicon.svg',
      contactPoint: {
        '@type': 'ContactPoint',
        email: 'dealsjona@gmail.com',
        contactType: 'customer support',
      },
    }),
  }}
/>
```

---

## Google Search Console checklist

- [ ] Verify ownership of `https://ultraweb.ai`
- [ ] Submit `https://ultraweb.ai/sitemap.xml`
- [ ] Request indexing of the root URL
- [ ] Monitor Core Web Vitals in the Experience tab

---

## Performance (Core Web Vitals)

| Metric | Target |
|---|---|
| LCP (Largest Contentful Paint) | < 2.5 s |
| FID / INP (Interaction) | < 200 ms |
| CLS (Cumulative Layout Shift) | < 0.1 |

Use `next/image` for all images, preconnect to AI provider domains, and ensure fonts are served from the same origin or with `font-display: swap`.
