'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Landmark, Coins, ArrowRightLeft, ShieldCheck } from 'lucide-react';

interface PaymentsInfo {
  status: string;
  platform: string;
  version: string;
  supportedMethods: string[];
  supportedCurrencies: string[];
  exchangeRates: Record<string, number>;
  limits: Record<string, { min: number; max: number; currency: string }>;
  fees: Record<string, string>;
  networks: Record<string, string>;
  timestamp: string;
}

export default function PaymentsPage() {
  const [data, setData] = useState<PaymentsInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/payments');
        if (!response.ok) {
          throw new Error('Failed to load payments gateway');
        }
        const json = (await response.json()) as PaymentsInfo;
        setData(json);
        setError(null);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #06111f 0%, #0f172a 50%, #111827 100%)',
        color: '#e5eefb',
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: '2rem',
      }}
    >
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <Link
          href="/ultra-saas/dashboard"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#7dd3fc', textDecoration: 'none', marginBottom: '1.5rem' }}
        >
          <ArrowLeft size={18} /> Back to Dashboard
        </Link>

        <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '1rem', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
              <Landmark size={28} color="#38bdf8" /> Fiat Token Gateway
            </h1>
            <p style={{ marginTop: '0.5rem', color: '#94a3b8', maxWidth: 720 }}>
              Unified bank transaction gateway for fiat rails, token settlement, and bridge operations over the existing `/api/payments` service.
            </p>
          </div>
          <div style={{ minWidth: 240, padding: '1rem 1.25rem', borderRadius: 16, border: '1px solid #1e293b', background: 'rgba(15, 23, 42, 0.75)' }}>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Gateway Status</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: 4 }}>{data?.status ?? (loading ? 'Loading…' : 'Unavailable')}</div>
            <div style={{ fontSize: '0.78rem', color: '#38bdf8', marginTop: 8 }}>{data?.platform ?? 'EuroWeb Payments Gateway'}</div>
          </div>
        </header>

        {loading && <div style={{ color: '#94a3b8' }}>Loading real payment gateway capabilities…</div>}
        {error && <div style={{ color: '#fca5a5' }}>Error: {error}</div>}

        {data && (
          <>
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '1rem', borderRadius: 16, border: '1px solid #1e293b', background: '#0f172a' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Supported Methods</div>
                <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {data.supportedMethods.map((method) => (
                    <span key={method} style={{ padding: '0.35rem 0.6rem', borderRadius: 999, background: '#082f49', color: '#7dd3fc', fontSize: '0.8rem' }}>{method}</span>
                  ))}
                </div>
              </div>
              <div style={{ padding: '1rem', borderRadius: 16, border: '1px solid #1e293b', background: '#0f172a' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Currencies</div>
                <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {data.supportedCurrencies.map((currency) => (
                    <span key={currency} style={{ padding: '0.35rem 0.6rem', borderRadius: 999, background: '#052e16', color: '#86efac', fontSize: '0.8rem' }}>{currency}</span>
                  ))}
                </div>
              </div>
              <div style={{ padding: '1rem', borderRadius: 16, border: '1px solid #1e293b', background: '#0f172a' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Networks</div>
                <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                  {Object.entries(data.networks).map(([name, value]) => (
                    <div key={name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: '0.9rem' }}>
                      <span style={{ color: '#cbd5e1' }}>{name}</span>
                      <span style={{ color: '#f8fafc' }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ padding: '1rem', borderRadius: 16, border: '1px solid #1e293b', background: '#0f172a' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Version</div>
                <div style={{ marginTop: 8, fontSize: '1.4rem', fontWeight: 700 }}>{data.version}</div>
                <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#64748b' }}>{new Date(data.timestamp).toLocaleString()}</div>
              </div>
            </section>

            <section style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: '1rem', alignItems: 'start' }}>
              <div style={{ padding: '1rem 1.2rem', borderRadius: 16, border: '1px solid #1e293b', background: '#0f172a' }}>
                <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Coins size={20} color="#f59e0b" /> Fees & Limits
                </h2>
                <div style={{ display: 'grid', gap: 12 }}>
                  {Object.entries(data.limits).map(([method, limit]) => (
                    <div key={method} style={{ padding: '0.9rem', borderRadius: 12, background: 'rgba(30, 41, 59, 0.65)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                        <strong style={{ textTransform: 'uppercase' }}>{method}</strong>
                        <span style={{ color: '#38bdf8' }}>{data.fees[method]}</span>
                      </div>
                      <div style={{ fontSize: '0.88rem', color: '#cbd5e1' }}>
                        Min: {limit.min} {limit.currency} • Max: {limit.max} {limit.currency}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding: '1rem 1.2rem', borderRadius: 16, border: '1px solid #1e293b', background: '#0f172a' }}>
                <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ArrowRightLeft size={20} color="#22c55e" /> Bridge & Settlement
                </h2>
                <div style={{ display: 'grid', gap: 10, fontSize: '0.92rem', color: '#cbd5e1' }}>
                  <div>Uses `/api/payments` as unified entry point for `stripe`, `alb`, `solana`, and `bridge`.</div>
                  <div>Supports fiat ↔ token operations through the existing `/api/bridgeway` backend.</div>
                  <div>Frontend gateway is intentionally conservative and surfaces only verified capabilities from live route data.</div>
                </div>
                <div style={{ marginTop: 16, padding: '0.85rem', borderRadius: 12, background: 'rgba(8, 47, 73, 0.65)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <ShieldCheck size={18} color="#7dd3fc" style={{ marginTop: 2 }} />
                  <div style={{ fontSize: '0.86rem', color: '#bae6fd' }}>
                    Recommended for bank-grade rollout: add PSP secrets, webhook validation, ledger persistence, and audit trail before production settlement.
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
