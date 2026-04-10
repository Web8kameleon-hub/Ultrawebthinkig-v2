'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Settings, Globe, Bell, Shield, Database, Save } from 'lucide-react';

interface Setting {
  key: string;
  label: string;
  description: string;
  value: boolean;
}

const DEFAULTS: Setting[] = [
  { key: 'autoRefresh', label: 'Auto-refresh metrics', description: 'Poll /api/dashboard/metrics every 30 seconds', value: true },
  { key: 'liveNews', label: 'Live tech feed', description: 'Fetch top stories from Hacker News Algolia API', value: true },
  { key: 'cryptoPrices', label: 'Crypto prices', description: 'Fetch BTC/ETH/SOL prices from CoinGecko (no key required)', value: true },
  { key: 'weatherData', label: 'Weather data', description: 'Fetch Athens weather from Open-Meteo (no key required)', value: true },
  { key: 'alertsEnabled', label: 'System alerts', description: 'Show live feed items as dashboard alerts', value: true },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>(DEFAULTS);
  const [saved, setSaved] = useState(false);

  const toggle = (key: string) => {
    setSettings(prev => prev.map(s => s.key === key ? { ...s, value: !s.value } : s));
    setSaved(false);
  };

  const save = () => {
    // In production: persist to DB or env config
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <Link href="/ultra-saas/dashboard" style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowLeft size={18} /> Dashboard
          </Link>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>
            <Settings size={22} style={{ marginRight: 8, verticalAlign: 'middle', color: '#a78bfa' }} />
            Platform Settings
          </h1>
        </div>

        {/* Feature toggles */}
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: '1rem' }}>
            <Bell size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Live Data Sources
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {settings.map(s => (
              <div key={s.key} style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 10, padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{s.label}</div>
                  <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: 2 }}>{s.description}</div>
                </div>
                <button
                  onClick={() => toggle(s.key)}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: s.value ? '#00d4aa' : '#334155',
                    position: 'relative', flexShrink: 0, transition: 'background 0.2s',
                  }}
                  aria-label={`Toggle ${s.label}`}
                >
                  <span style={{
                    display: 'block', width: 18, height: 18, borderRadius: '50%', background: '#fff',
                    position: 'absolute', top: 3, transition: 'left 0.2s',
                    left: s.value ? 23 : 3,
                  }} />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* API info */}
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: '1rem' }}>
            <Database size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Active API Endpoints
          </h2>
          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 10, overflow: 'hidden' }}>
            {[
              { method: 'GET', path: '/api/dashboard/metrics', desc: 'System + crypto + weather + news' },
              { method: 'GET', path: 'api.coingecko.com', desc: 'BTC/ETH/SOL prices — no key' },
              { method: 'GET', path: 'api.open-meteo.com', desc: 'Athens weather — no key' },
              { method: 'GET', path: 'hn.algolia.com/api/v1', desc: 'HN front page — no key' },
            ].map((ep, i) => (
              <div key={ep.path} style={{ padding: '0.85rem 1.25rem', borderBottom: i < 3 ? '1px solid #1e293b' : 'none', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#00d4aa', background: '#00d4aa1a', padding: '2px 8px', borderRadius: 4 }}>{ep.method}</span>
                <code style={{ fontSize: '0.8rem', color: '#94a3b8', flex: 1 }}>{ep.path}</code>
                <span style={{ fontSize: '0.78rem', color: '#475569' }}>{ep.desc}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Security note */}
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: '1rem' }}>
            <Shield size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Security
          </h2>
          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 10, padding: '1rem 1.25rem', fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.6 }}>
            All API calls are server-side (Next.js Route Handlers). No API keys are exposed to the client.
            External services used: CoinGecko, Open-Meteo, Hacker News — all public, no authentication required.
          </div>
        </section>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={save}
            style={{ background: '#00d4aa', color: '#0a0a0f', border: 'none', borderRadius: 8, padding: '0.6rem 1.5rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Save size={16} /> Save Settings
          </button>
          {saved && <span style={{ color: '#00d4aa', fontSize: '0.85rem' }}>✓ Saved</span>}
          <Link href="/ultra-saas/dashboard" style={{ color: '#475569', fontSize: '0.85rem', marginLeft: 'auto' }}>
            <Globe size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />Back to Dashboard
          </Link>
        </div>

      </div>
    </div>
  );
}
