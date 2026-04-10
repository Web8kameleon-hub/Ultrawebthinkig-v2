'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Activity, Cpu, HardDrive, Globe, Bitcoin, Thermometer, RefreshCw } from 'lucide-react';

interface MetricsPayload {
  system: { cpu: number; memory: number; uptimeDays: number; uptimePct: number; totalMemGB: string; usedMemGB: string; hostname: string; platform: string };
  crypto: { bitcoin?: { usd?: number; eur?: number }; ethereum?: { usd?: number; eur?: number }; solana?: { usd?: number; eur?: number } } | null;
  weather: { temperature: number | null; humidity: number | null; windSpeed: number | null } | null;
  requestCount: number;
  latestScrapes: Array<{ title: string; source: string; timestamp: string }>;
  timestamp: string;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<MetricsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState('');

  const load = async () => {
    try {
      const res = await fetch('/api/dashboard/metrics', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
        setLastFetch(new Date().toLocaleTimeString());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>

      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <Link href="/ultra-saas/dashboard" style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowLeft size={18} /> Dashboard
          </Link>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>
            <Activity size={22} style={{ marginRight: 8, verticalAlign: 'middle', color: '#00d4aa' }} />
            Live Analytics
          </h1>
          <button onClick={() => void load()} style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid #334155', color: '#94a3b8', borderRadius: 8, padding: '0.4rem 0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={14} /> Refresh
          </button>
          {lastFetch && <span style={{ fontSize: '0.78rem', color: '#475569' }}>Updated {lastFetch}</span>}
        </div>

        {loading && <p style={{ color: '#64748b' }}>Loading real-time data…</p>}

        {data && (
          <>
            {/* Crypto */}
            <section style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1rem', color: '#94a3b8', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: 1 }}>
                <Bitcoin size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />Cryptocurrency · CoinGecko
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                {[
                  { name: 'Bitcoin', data: data.crypto?.bitcoin },
                  { name: 'Ethereum', data: data.crypto?.ethereum },
                  { name: 'Solana', data: data.crypto?.solana },
                ].map(({ name, data: cd }) => (
                  <div key={name} style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: '1.2rem' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 4 }}>{name}</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{cd?.eur ? `€${cd.eur.toLocaleString()}` : '—'}</div>
                    <div style={{ fontSize: '0.78rem', color: '#475569' }}>${cd?.usd ? cd.usd.toLocaleString() : '—'} USD</div>
                  </div>
                ))}
              </div>
            </section>

            {/* System */}
            <section style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1rem', color: '#94a3b8', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: 1 }}>
                <Cpu size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />System · {data.system.hostname} ({data.system.platform})
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                {[
                  { label: 'CPU Load', value: `${data.system.cpu}%`, sub: data.system.platform === 'win32' ? 'N/A on Windows' : '' },
                  { label: 'RAM Usage', value: `${data.system.memory}%`, sub: `${data.system.usedMemGB} / ${data.system.totalMemGB} GB` },
                  { label: 'Uptime', value: `${data.system.uptimeDays}d`, sub: `${data.system.uptimePct}% of 30 days` },
                  { label: 'API Requests', value: data.requestCount.toLocaleString(), sub: 'since last deploy' },
                ].map(({ label, value, sub }) => (
                  <div key={label} style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: '1.2rem' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{value}</div>
                    {sub && <div style={{ fontSize: '0.78rem', color: '#475569' }}>{sub}</div>}
                  </div>
                ))}
              </div>
            </section>

            {/* Weather */}
            {data.weather && (
              <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1rem', color: '#94a3b8', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: 1 }}>
                  <Thermometer size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />Weather · Athens, GR · Open-Meteo
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                  {[
                    { label: 'Temperature', value: data.weather.temperature !== null ? `${data.weather.temperature}°C` : '—' },
                    { label: 'Humidity', value: data.weather.humidity !== null ? `${data.weather.humidity}%` : '—' },
                    { label: 'Wind Speed', value: data.weather.windSpeed !== null ? `${data.weather.windSpeed} km/h` : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: '1.2rem' }}>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{value}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* News Feed */}
            <section>
              <h2 style={{ fontSize: '1rem', color: '#94a3b8', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: 1 }}>
                <Globe size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />Live Tech Feed · Hacker News
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {data.latestScrapes.map((item, i) => (
                  <div key={i} style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 10, padding: '1rem' }}>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>{item.title}</div>
                    <div style={{ fontSize: '0.78rem', color: '#475569' }}>{item.source} · {new Date(item.timestamp).toLocaleTimeString()}</div>
                  </div>
                ))}
              </div>
            </section>

            <div style={{ marginTop: '2rem', fontSize: '0.75rem', color: '#334155', textAlign: 'center' }}>
              Last updated: {new Date(data.timestamp).toLocaleString()} · Auto-refresh every 30s
            </div>
          </>
        )}
      </div>
    </div>
  );
}
