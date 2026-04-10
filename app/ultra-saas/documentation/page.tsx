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

interface EndpointSection {
  id: string;
  title: string;
  description: string;
  endpoints: Endpoint[];
}

const ENDPOINT_SECTIONS: EndpointSection[] = [
  {
    id: 'metrics',
    title: 'Core Metrics Service',
    description: 'Observability and runtime service telemetry.',
    endpoints: [
      {
        method: 'GET',
        path: '/api/dashboard/metrics',
        description: 'Returns live system metrics, crypto prices, weather, and tech feed.',
        response: `{
  "data": {
    "requestCount": 42,
    "weather": { "temperature": 18, "humidity": 62, "windSpeed": 14 },
    "crypto": { "bitcoin": { "eur": 78000 } },
    "system": { "cpu": 0, "memory": 72, "uptimePct": 10.7 },
    "timestamp": "2026-04-10T12:00:00.000Z"
  }
}`,
      },
    ],
  },
  {
    id: 'evaluation',
    title: 'Evaluation Service',
    description: 'Platform scoring, risks, and operational recommendations.',
    endpoints: [
      {
        method: 'GET',
        path: '/api/ultra-saas/evaluation',
        description: 'Returns evaluation summary, strengths/weaknesses, risks, and score.',
        response: `{
  "data": {
    "summary": { "totalModules": 46, "activePct": 78, "ramPct": 72 },
    "score": { "value": 81, "grade": "B", "label": "B (81/100)" },
    "recommendations": { "urgent24h": ["..."] }
  }
}`,
      },
    ],
  },
  {
    id: 'nodesms',
    title: 'NodeSMS Messaging Service',
    description: 'Phone-first messaging with HTTP and LoRaWAN fallback transport.',
    endpoints: [
      {
        method: 'POST',
        path: '/api/nodesms/send',
        description: 'Sends a NodeSMS payload and optionally enqueues LoRaWAN packet.',
        response: `{
  "ok": true,
  "data": {
    "id": "nodesms_...",
    "channel": "lorawan",
    "encoding": "cbor",
    "queue": { "queued": true, "queueDepth": 4 }
  }
}`,
      },
      {
        method: 'POST',
        path: '/api/nodesms/adaptor',
        description: 'Decodes transport payload (`payloadBase64` or `bytes`) to JSON envelope.',
        response: `{
  "ok": true,
  "encoding": "cbor",
  "byteLength": 192,
  "data": { "to": "+15551234567", "message": "hello" }
}`,
      },
    ],
  },
  {
    id: 'signals',
    title: 'Signal Aggregation Service',
    description: 'Aggregated external market/news signals.',
    endpoints: [
      {
        method: 'GET',
        path: '/api/signals/all',
        description: 'Returns all active market signal feeds (under construction).',
        response: `{ "signals": [] }`,
      },
    ],
  },
  {
    id: 'mesh-gateway',
    title: 'Mesh Gateway Service',
    description: 'LoRa mesh status, topology intelligence, and gateway operations.',
    endpoints: [
      {
        method: 'GET',
        path: '/api/mesh/status',
        description: 'Returns real network interface telemetry, connectivity checks, and mesh health.',
        response: `{
  "success": true,
  "data": {
    "network": { "connectivity": { "status": "healthy", "averageLatency": 12 } },
    "mesh": { "nodes": 3, "activeConnections": 3, "networkHealth": 95 }
  },
  "source": "real-network-monitoring"
}`,
      },
      {
        method: 'GET',
        path: '/api/lora-mesh',
        description: 'Returns LoRa mesh gateway data, node metrics, and optimization state.',
        response: `{
  "success": true,
  "data": {
    "metrics": { "meshConnectivity": 78.9 },
    "nodes": [{ "name": "Mesh Repeater Gamma" }]
  }
}`,
      },
    ],
  },
  {
    id: 'payments-gateway',
    title: 'Fiat Token Gateway Service',
    description: 'Bank transaction rails, fiat/token settlement, and bridge orchestration.',
    endpoints: [
      {
        method: 'GET',
        path: '/api/payments',
        description: 'Returns supported payment methods, currencies, fees, networks, and gateway limits.',
        response: `{
  "status": "active",
  "platform": "EuroWeb Payments Gateway",
  "supportedMethods": ["stripe", "alb", "solana", "bridge"],
  "supportedCurrencies": ["EUR", "USD", "ALB", "SOL"]
}`,
      },
      {
        method: 'POST',
        path: '/api/payments',
        description: 'Processes fiat, token, or bridge transactions through the unified payment gateway.',
        response: `{
  "success": true,
  "transactionId": "stripe_...",
  "method": "stripe",
  "amount": 250,
  "currency": "EUR"
}`,
      },
      {
        method: 'POST',
        path: '/api/bridgeway',
        description: 'Executes fiat-to-crypto or crypto-to-fiat bridge transactions.',
        response: `{
  "success": true,
  "transaction": {
    "type": "onramp",
    "status": "processing"
  }
}`,
      },
    ],
  },
  {
    id: 'bandwidth',
    title: 'Infinite Bandwidth Module',
    description: 'Premium network throughput frontend module exposed in the platform.',
    endpoints: [
      {
        method: 'GET',
        path: '/infinite-bandwidth',
        description: 'Frontend route for the premium throughput module already present in the repository.',
        response: `{
  "route": "/infinite-bandwidth",
  "service": "premium-network-module"
}`,
      },
    ],
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

        <div style={{ marginBottom: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {ENDPOINT_SECTIONS.map(section => (
            <a
              key={section.id}
              href={`#${section.id}`}
              style={{
                fontSize: '0.78rem',
                color: '#93c5fd',
                border: '1px solid #1e293b',
                borderRadius: 999,
                padding: '0.35rem 0.75rem',
                textDecoration: 'none',
              }}
            >
              {section.title}
            </a>
          ))}
          <a
            href="/openapi.json"
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: '0.78rem',
              color: '#10b981',
              border: '1px solid #14532d',
              borderRadius: 999,
              padding: '0.35rem 0.75rem',
              textDecoration: 'none',
            }}
          >
            Open Swagger JSON
          </a>
        </div>

        {/* Endpoints */}
        {ENDPOINT_SECTIONS.map(section => (
          <section key={section.id} id={section.id} style={{ marginBottom: '1.75rem' }}>
            <h2 style={{ margin: '0 0 0.45rem 0', fontSize: '1rem', color: '#e2e8f0' }}>{section.title}</h2>
            <p style={{ margin: '0 0 0.85rem 0', color: '#64748b', fontSize: '0.82rem' }}>{section.description}</p>
            {section.endpoints.map(ep => (
              <div key={`${section.id}-${ep.path}-${ep.method}`} style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, marginBottom: '1rem', overflow: 'hidden' }}>
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
                    onClick={() => copy(ep.response, `resp-${section.id}-${ep.path}`)}
                    style={{ position: 'absolute', top: 10, right: 14, background: 'transparent', border: 'none', color: '#475569', cursor: 'pointer' }}
                    title="Copy response"
                  >
                    {copied === `resp-${section.id}-${ep.path}` ? <Check size={14} color="#00d4aa" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            ))}
          </section>
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
