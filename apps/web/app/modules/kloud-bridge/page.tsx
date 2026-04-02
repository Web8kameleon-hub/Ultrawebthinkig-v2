'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Database,
  Lock,
  Network,
  RefreshCw,
  Shield,
  Sparkles,
  Workflow,
} from 'lucide-react';

type HealthPayload = {
  status?: string;
  service?: string;
  port?: number;
  isolated?: boolean;
  upstream_configured?: boolean;
  live_only?: boolean;
  uptime_seconds?: number;
};

type UpstreamPayload = {
  configured?: boolean;
  reachable?: boolean;
  url?: string;
  message?: string;
  error?: string;
  status?: Record<string, unknown>;
};

type StatusPayload = {
  service?: string;
  version?: string;
  instance?: string;
  isolated?: boolean;
  live_only?: boolean;
  port?: number;
  upstream?: UpstreamPayload;
};

type ActionPayload = {
  status?: string;
  route?: string;
  error?: string;
  detail?: string;
  snapshot?: Record<string, unknown>;
  live_only?: boolean;
};

const API_BASE = '/api/kloud-bridge';

function getErrorMessage(payload: ActionPayload | null | undefined, fallback: string) {
  return payload?.detail || payload?.error || fallback;
}

export default function KloudBridgePage() {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [syncResult, setSyncResult] = useState<ActionPayload | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);

    try {
      const [healthRes, statusRes] = await Promise.all([
        fetch(`${API_BASE}/health`, { cache: 'no-store' }),
        fetch(`${API_BASE}/status`, { cache: 'no-store' }),
      ]);

      const healthPayload = (await healthRes.json()) as HealthPayload;
      const statusPayload = (await statusRes.json()) as StatusPayload;

      if (!healthRes.ok || !statusRes.ok) {
        throw new Error(`Live bridge unavailable (${healthRes.status}/${statusRes.status})`);
      }

      setHealth(healthPayload);
      setStatus(statusPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load live Kloud Bridge status');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const syncFabric = useCallback(async () => {
    setIsSyncing(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/fabric/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          include_status: true,
          include_peers: true,
          include_state: true,
        }),
      });

      const payload = (await response.json()) as ActionPayload;
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, `Live fabric sync failed (${response.status})`));
      }

      setSyncResult(payload);
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync live Kloud fabric snapshot');
    } finally {
      setIsSyncing(false);
    }
  }, [loadStatus]);

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 15000);
    return () => clearInterval(interval);
  }, [loadStatus]);

  const upstreamLabel = useMemo(() => {
    if (!status?.upstream?.configured) return 'Activation pending';
    return status?.upstream?.reachable ? 'Connected and monitored' : 'Temporarily limited';
  }, [status]);

  const liveNote = useMemo(() => {
    if (status?.upstream?.reachable) return 'Real service connectivity is active and monitored.';
    if (status?.upstream?.configured) return 'The service is live, but connectivity is temporarily limited.';
    return 'Live service activation is pending until the upstream connection is enabled.';
  }, [status]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        <header className="rounded-3xl border border-cyan-500/30 bg-gradient-to-r from-slate-900 via-cyan-950/40 to-violet-950/40 p-6 shadow-2xl shadow-cyan-500/10">
          <div className="flex flex-wrap items-center gap-3 text-cyan-300">
            <Shield className="h-6 w-6" />
            <span className="text-sm font-semibold uppercase tracking-[0.2em]">Kloud Bridge</span>
            <span className="rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-xs">Real user services</span>
            <span className="rounded-full border border-violet-400/40 bg-violet-500/10 px-3 py-1 text-xs">Live connectivity</span>
            <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs">User-friendly view</span>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
            <div>
              <h1 className="text-3xl font-bold md:text-4xl">A cleaner live service view for real users</h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-300 md:text-base">
                This module shows the real operating state of the <strong>Kloud Bridge</strong> with useful service information,
                live connectivity feedback, and synchronization readiness — without turning the page into a static debug panel.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Current posture</p>
              <p className="mt-2 text-lg font-semibold text-cyan-200">{upstreamLabel}</p>
              <p className="mt-2 text-xs text-slate-400">Live service state with simplified, useful customer feedback.</p>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
            <div className="flex items-center gap-2 text-emerald-300">
              <Activity className="h-4 w-4" />
              <h2 className="text-sm font-semibold">Service health</h2>
            </div>
            <div className="mt-3 space-y-1 text-sm text-slate-100">
              <p>Status: <span className="font-semibold">{health?.status ?? 'unknown'}</span></p>
              <p>Service: {health?.service ?? '—'}</p>
              <p>Uptime: {health?.uptime_seconds ? `${health.uptime_seconds}s` : '—'}</p>
            </div>
          </article>

          <article className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-5">
            <div className="flex items-center gap-2 text-cyan-300">
              <Lock className="h-4 w-4" />
              <h2 className="text-sm font-semibold">Security</h2>
            </div>
            <div className="mt-3 space-y-1 text-sm text-slate-100">
              <p>Access model: <span className="font-semibold">controlled bridge</span></p>
              <p>Exposure: minimal</p>
              <p>Data view: user-safe</p>
            </div>
          </article>

          <article className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-5">
            <div className="flex items-center gap-2 text-violet-300">
              <Network className="h-4 w-4" />
              <h2 className="text-sm font-semibold">Connectivity</h2>
            </div>
            <div className="mt-3 space-y-1 text-sm text-slate-100">
              <p>State: <span className="font-semibold">{upstreamLabel}</span></p>
              <p>Reachable: {status?.upstream?.reachable ? 'yes' : 'no'}</p>
              <p>Sync status: {syncResult?.status ?? 'waiting'}</p>
            </div>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
            <div className="flex items-center gap-2 text-cyan-300">
              <Workflow className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Real service actions</h2>
            </div>
            <p className="mt-2 text-sm text-slate-400">
              Check live service status and synchronization readiness in a simpler, more human-friendly way.
            </p>

            <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                <div>
                  <p className="font-semibold">Live note</p>
                  <p className="mt-1 text-amber-50/90">{liveNote}</p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={loadStatus}
                disabled={isRefreshing}
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing…' : 'Refresh live status'}
              </button>

              <button
                onClick={syncFabric}
                disabled={isSyncing}
                className="inline-flex items-center gap-2 rounded-xl border border-violet-400/40 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 disabled:opacity-50"
              >
                <Database className="h-4 w-4" />
                {isSyncing ? 'Syncing…' : 'Check synchronization'}
              </button>
            </div>

            {error && <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Users get</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-200">
                  <li>• live service visibility</li>
                  <li>• connection readiness</li>
                  <li>• real sync confirmation</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Protected by design</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-200">
                  <li>• no fake values</li>
                  <li>• no raw infrastructure noise</li>
                  <li>• only useful service signals</li>
                </ul>
              </div>
            </div>
          </article>

          <article className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">User service summary</h2>
              <Link href="/developers" className="inline-flex items-center gap-1 text-sm text-cyan-300 hover:text-cyan-200">
                Developer docs <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-5 space-y-4 text-sm text-slate-300">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <div className="flex items-center gap-2 text-slate-100">
                  <Sparkles className="h-4 w-4 text-cyan-300" />
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Service state</p>
                </div>
                <p className="mt-2 text-base font-semibold text-slate-100">{health?.status ?? 'unknown'}</p>
                <p className="mt-2">The page stays focused on real service health and verified availability.</p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Connectivity</p>
                <p className="mt-2 text-base font-semibold text-slate-100">{upstreamLabel}</p>
                <p className="mt-2">Users see the real connection outcome without internal technical clutter.</p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Synchronization</p>
                <p className="mt-2 text-base font-semibold text-slate-100">{syncResult?.status ?? 'Not synchronized yet'}</p>
                <p className="mt-2">Live responses confirm readiness and continuity using real service data.</p>
              </div>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
