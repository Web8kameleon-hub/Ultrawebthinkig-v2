'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Brain, AlertTriangle, Shield, TrendingUp, Award, Languages, RefreshCw, Globe } from 'lucide-react';
import styles from '../dashboard/dashboard.module.css';

interface EvaluationData {
  timestamp: string;
  summary: {
    totalModules: number;
    activeModules: number;
    activePct: number;
    systemLoad: number;
    ramPct: number;
    uptimeDays: number;
    uptimePct: number;
    newModules: number;
    betaModules: number;
    zeroActiveCats: number;
  };
  categoryStats: Array<{
    id: string;
    title: string;
    total: number;
    active: number;
    pct: number;
  }>;
  risks: Array<{
    risk: string;
    probability: string;
    impact: string;
    action: string;
  }>;
  strengths: string[];
  weaknesses: Array<{dobësi: string; niveli: string; rekomandim: string}>;
  score: {value: number; grade: string; label: string};
  recommendations: {
    urgent24h: string[];
    next48h: string[];
    scoreImprove: string[];
  };
}

const AlbanianMode = {
  summary: {
    title: 'PËRMBLEDHJE EKZEKUTIVE',
    total: 'Total Module',
    active: 'Aktive',
    load: 'System Load',
    ram: 'RAM Usage',
    uptime: 'Uptime'
  },
  strengths: 'FORCAT ✅',
  weaknesses: 'DOBËSITË ⚠️',
  risks: 'RREZIQET 🔴',
  score: 'Nota e përgjithshme',
  recUrgent: 'URGJENTE (24h)',
  recNext: '48h',
  pct: '%'
} as const;

const EnglishMode = {
  summary: {
    title: 'EXECUTIVE SUMMARY',
    total: 'Total Modules',
    active: 'Active',
    load: 'System Load',
    ram: 'RAM Usage',
    uptime: 'Server Uptime'
  },
  strengths: 'STRENGTHS ✅',
  weaknesses: 'WEAKNESSES ⚠️',
  risks: 'RISKS 🔴',
  score: 'Overall Score',
  recUrgent: 'URGENT (24h)',
  recNext: 'NEXT 48h',
  pct: '%'
} as const;

type Lang = 'sq' | 'en';
type Labels = typeof AlbanianMode | typeof EnglishMode;

export default function EvaluationPage() {
  const [data, setData] = useState<EvaluationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<Lang>('sq'); // Default Albanian
  const [error, setError] = useState<string | null>(null);
  const labels = lang === 'sq' ? AlbanianMode : EnglishMode;

  const refetch = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/ultra-saas/evaluation');
      if (!res.ok) throw new Error('API error');
      const json = await res.json();
      setData(json.data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refetch();
  }, []);

  if (loading) return <div className={styles.dashboard}><div>Loading evaluation...</div></div>;
  if (error || !data) return <div className={styles.dashboard}><div>Error: {error}</div></div>;

  const { summary, categoryStats, risks, strengths, weaknesses, score, recommendations } = data;

  return (
    <div className={styles.dashboard}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>
            <Brain className={styles.titleIcon} size={28} />
            {lang === 'sq' ? 'Vlerësimi i Plotë – Ultra SaaS' : 'Full Evaluation – Ultra SaaS'}
          </h1>
          <p className={styles.subtitle}>Real-time system analysis • {new Date(data.timestamp).toLocaleString()}</p>
        </div>
        <div className={styles.headerRight}>
          <button onClick={() => setLang(lang === 'sq' ? 'en' : 'sq')} className={styles.notificationBtn} title="Toggle Language">
            <Languages size={18} /> {lang.toUpperCase()}
          </button>
          <button onClick={refetch} className={styles.notificationBtn}>
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      {/* 1. Executive Summary */}
      <section className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}><TrendingUp size={24} /></div>
          <div>
            <h3>{labels.summary.total}</h3>
            <div className={styles.statValue}>{summary.totalModules}</div>
            <div>{summary.activeModules} {labels.summary.active} ({summary.activePct}{labels.pct})</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}><Shield size={24} /></div>
          <div>
            <h3>{labels.summary.load}</h3>
            <div className={styles.statValue}>{summary.systemLoad}%</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}><Award size={24} /></div>
          <div>
            <h3>{labels.summary.ram}</h3>
            <div className={styles.statValue}>{summary.ramPct}%</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}><Globe size={24} /></div>
          <div>
            <h3>{labels.summary.uptime}</h3>
            <div className={styles.statValue}>{summary.uptimeDays}d</div>
            <div>{summary.uptimePct}{labels.pct} of 30d</div>
          </div>
        </div>
      </section>

      {/* Score */}
      <section style={{ margin: '2rem 0', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{score.grade}</div>
        <div style={{ fontSize: '1.2rem', opacity: 0.8 }}>{score.label}</div>
      </section>

      {/* 2. Strengths */}
      <section>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <span style={{ fontSize: '1.5rem' }}>✅</span> {labels.strengths}
        </h2>
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {strengths.map((s, i) => (
            <div key={i} style={{ padding: '0.75rem', background: 'rgba(34,197,94,0.1)', borderRadius: 8, borderLeft: '4px solid #22c55e' }}>
              {s}
            </div>
          ))}
        </div>
      </section>

      {/* 3. Weaknesses Table */}
      <section>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '2rem 0 1rem 0' }}>
          <AlertTriangle size={24} /> {labels.weaknesses}
        </h2>
        <div className={styles.performanceGrid}>
          {weaknesses.map((w, i) => (
            <div key={i} style={{ padding: '1rem', borderRadius: 8, background: 'rgba(251,191,36,0.1)' }}>
              <strong>{w.dobësi}</strong><br />
              <span style={{ color: '#d97706' }}>{w.niveli}</span><br />
              <em>{w.rekomandim}</em>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Risks Table */}
      <section>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '2rem 0 1rem 0' }}>
          <AlertTriangle size={24} color="#ef4444" /> {labels.risks}
        </h2>
        <div style={{ display: 'grid', gap: '1rem' }}>
          {risks.map((r, i) => (
            <div key={i} style={{ background: 'rgba(239,68,68,0.1)', padding: '1rem', borderRadius: 8, borderLeft: '4px solid #ef4444' }}>
              <strong>{r.risk}</strong>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                <span>Probabiliteti</span><span style={{ color: '#f87171' }}>{r.probability}</span>
                <span>Nikimi</span><span>{r.impact}</span>
                <span>Veprim</span><span>{r.action}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Category Analysis */}
      <section>
        <h2 style={{ margin: '2rem 0 1rem 0' }}>Kategoria Analizë / Category Analysis</h2>
        <div className={styles.statsGrid}>
          {categoryStats.map((cat, i) => (
            <div key={i} className={styles.statCard}>
              <div>{cat.title}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{cat.pct}%</div>
              <div>{cat.active}/{cat.total} active</div>
              {cat.pct === 0 && <div style={{ color: '#ef4444' }}>⚠️ Zero active</div>}
            </div>
          ))}
        </div>
      </section>

      {/* Recommendations */}
      <section>
        <h2>Rekomandime / Recommendations</h2>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <h3 style={{ color: '#ef4444' }}>{labels.recUrgent}</h3>
            <ul>{recommendations.urgent24h.map((r, i) => <li key={i}>{r}</li>)}</ul>
          </div>
          <div>
            <h3 style={{ color: '#f59e0b' }}>{labels.recNext}</h3>
            <ul>{recommendations.next48h.map((r, i) => <li key={i}>{r}</li>)}</ul>
          </div>
        </div>
      </section>

      <footer style={{ marginTop: '3rem', textAlign: 'center', opacity: 0.6 }}>
        <Link href="/ultra-saas/dashboard">← Back to Dashboard</Link>
      </footer>
    </div>
  );
}


