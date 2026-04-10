'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Copy, Check } from 'lucide-react';

interface Endpoint {
  method: string;
  path: string;
  description: string;
  response: string;
}

const ENDPOINTS: Endpoint[] = [
  {
    method: 'GET',
    path: '/api/dashboard/metrics',
    description: 'Returns live system metrics, crypto prices, weather, and news feed in one call.',
    response: `{
  "data": {
    "scrapedData": 5,
    "latestScrapes": [{ "title": "...", "source": "...", "timestamp": "..." }],
    "requestCount": 42,
    "weather": { "temperature": 18, "humidity": 62, "windSpeed": 14, "timezone": "Europe/Athens" },
    "crypto": {
      "bitcoin": { "usd": 85000, "eur": 78000 },
      "ethereum": { "usd": 2100, "eur": 1940 },
      "solana": { "usd": 142, "eur": 131 }
    },
    "system": {
      "cpu": 0, "memory": 72, "uptime": 3.2, "uptimePct": 10.7,
      "totalMemGB": "15.85", "freeMemGB": "4.41", "usedMemGB": "11.44",
      "hostname": "DESKTOP-xxx", "platform": "win32"
    },
    "timestamp": "2026-04-10T12:00:00.000Z"
  }
}`,
  },
  {
    method: 'GET',
    path: '/api/signals/all',
    description: 'Returns all active market signal feeds (route under construction).',
    response: `{ "signals": [] }`,
  },
];

export default function DocumentationPage() {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <Link href="/ultra-saas/dashboard" style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowLeft size={18} /> Dashboard
          </Link>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>
            <BookOpen size={22} style={{ marginRight: 8, verticalAlign: 'middle', color: '#f59e0b' }} />
            API Documentation
          </h1>
        </div>

        <p style={{ color: '#64748b', marginBottom: '2rem', lineHeight: 1.7 }}>
          All endpoints are Next.js Route Handlers served from <code style={{ color: '#94a3b8' }}>/app/api/</code>.
          No authentication required for public endpoints. All data is real — no mocks.
        </p>

        {/* Endpoints */}
        {ENDPOINTS.map(ep => (
          <div key={ep.path} style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, marginBottom: '1.5rem', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#00d4aa', background: '#00d4aa1a', padding: '3px 10px', borderRadius: 4 }}>
                {ep.method}
              </span>
              <code style={{ fontSize: '0.95rem', color: '#e2e8f0', fontWeight: 600 }}>{ep.path}</code>
              <button
                onClick={() => copy(ep.path, ep.path)}
                style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#475569', cursor: 'pointer' }}
                title="Copy path"
              >
                {copied === ep.path ? <Check size={15} color="#00d4aa" /> : <Copy size={15} />}
              </button>
            </div>
            <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #1e293b', fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.6 }}>
              {ep.description}
            </div>
            <div style={{ position: 'relative' }}>
              <pre style={{ margin: 0, padding: '1rem 1.25rem', fontSize: '0.78rem', color: '#64748b', overflowX: 'auto', lineHeight: 1.6 }}>
                {ep.response}
              </pre>
              <button
                onClick={() => copy(ep.response, `resp-${ep.path}`)}
                style={{ position: 'absolute', top: 10, right: 14, background: 'transparent', border: 'none', color: '#475569', cursor: 'pointer' }}
                title="Copy response"
              >
                {copied === `resp-${ep.path}` ? <Check size={14} color="#00d4aa" /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        ))}

        {/* External APIs */}
        <section style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: '1rem' }}>
            External APIs Used (all free, no key)
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '0.75rem' }}>
            {[
              { name: 'CoinGecko', url: 'https://api.coingecko.com/api/v3/simple/price', desc: 'Crypto prices' },
              { name: 'Open-Meteo', url: 'https://api.open-meteo.com/v1/forecast', desc: 'Weather forecast' },
              { name: 'HN Algolia', url: 'https://hn.algolia.com/api/v1/search', desc: 'Tech news feed' },
            ].map(a => (
              <div key={a.name} style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 10, padding: '1rem' }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{a.name}</div>
                <div style={{ fontSize: '0.78rem', color: '#475569', marginBottom: 6 }}>{a.desc}</div>
                <code style={{ fontSize: '0.72rem', color: '#64748b', wordBreak: 'break-all' }}>{a.url}</code>
              </div>
            ))}
          </div>
        </section>

        <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
          <Link href="/ultra-saas/dashboard" style={{ color: '#475569', fontSize: '0.85rem' }}>
            ← Back to Dashboard
          </Link>
        </div>

      </div>
    </div>
  );
}
