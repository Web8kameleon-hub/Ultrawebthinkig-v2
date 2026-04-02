'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Database,
  Lock,
  Network,
  RefreshCw,
  Shield,
  Workflow,
} from 'lucide-react';

type HealthPayload = {
  status?: string;
  service?: string;
  uptime_seconds?: number | null;
};

type UpstreamPayload = {
  configured?: boolean;
  reachable?: boolean;
};

type StatusPayload = {
  service?: string;
  version?: string | null;
  availability?: string;
  upstream?: UpstreamPayload;
};

type ActionPayload = {
  status?: string;
  live_only?: boolean;
  synchronized?: boolean;
};

const API_BASE = '/api/kloud-bridge';

function getErrorMessage(fallback: string) {
  return fallback;
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
      const [healthResult, statusResult] = await Promise.allSettled([
        fetch(`${API_BASE}/health`, { cache: 'no-store' }),
        fetch(`${API_BASE}/status`, { cache: 'no-store' }),
      ]);

      const issues: string[] = [];

      if (healthResult.status === 'fulfilled') {
        const healthPayload = (await healthResult.value.json()) as HealthPayload;
        if (healthResult.value.ok) {
          setHealth(healthPayload);
        } else {
          issues.push('Live health is temporarily unavailable');
        }
      } else {
        issues.push('Live health is temporarily unavailable');
      }

      if (statusResult.status === 'fulfilled') {
        const statusPayload = (await statusResult.value.json()) as StatusPayload;
        if (statusResult.value.ok) {
          setStatus(statusPayload);
        } else {
          issues.push('Connection status is temporarily unavailable');
        }
      } else {
        issues.push('Connection status is temporarily unavailable');
      }

      if (issues.length > 0) {
        setError(issues.join(' • '));
      }
    } catch {
      setError('Client-safe live status is temporarily unavailable.');
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
        throw new Error(getErrorMessage('Live synchronization is temporarily unavailable.'));
      }

      setSyncResult(payload);
      await loadStatus();
    } catch {
      setError('Live synchronization is temporarily unavailable.');
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
    if (status?.upstream?.reachable) return 'Clients see only verified live status and sync confirmation.';
    if (status?.upstream?.configured) return 'The service is active, but live connectivity is temporarily limited.';
    return 'Client access remains minimal until live connectivity is enabled.';
  }, [status]);

  const syncLabel = useMemo(() => {
    if (!syncResult) return 'Not synchronized yet';
    if (syncResult.status === 'synchronized' || syncResult.synchronized) return 'Synchronized';
    if (syncResult.status === 'partial') return 'Partially synchronized';
    return syncResult.status ?? 'Updated';
  }, [syncResult]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        <header className="rounded-3xl border border-cyan-500/30 bg-gradient-to-r from-slate-900 via-cyan-950/40 to-violet-950/40 p-6 shadow-2xl shadow-cyan-500/10">
          <div className="flex flex-wrap items-center gap-3 text-cyan-300">
            <Shield className="h-6 w-6" />
            <span className="text-sm font-semibold uppercase tracking-[0.2em]">Kloud Bridge</span>
            <span className="rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-xs">Protected client view</span>
            <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs">Live status only</span>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
            <div>
              <h1 className="text-3xl font-bold md:text-4xl">Clear visibility without unnecessary technical noise</h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-300 md:text-base">
                This view keeps the <strong>customer-facing signal</strong> clear: availability, secure connectivity, and
                synchronization state — without exposing internal infrastructure details.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Current posture</p>
              <p className="mt-2 text-lg font-semibold text-cyan-200">{upstreamLabel}</p>
              <p className="mt-2 text-xs text-slate-400">Minimal exposure. Verified status. Client-safe by design.</p>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
            <div className="flex items-center gap-2 text-emerald-300">
              <Activity className="h-4 w-4" />
              <h2 className="text-sm font-semibold">Availability</h2>
            </div>
            <div className="mt-3 space-y-1 text-sm text-slate-100">
              <p>Status: <span className="font-semibold">{health?.status ?? 'unknown'}</span></p>
              <p>Visibility: live verified status</p>
              <p>Refresh: automatic every 15s</p>
            </div>
          </article>

          <article className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-5">
            <div className="flex items-center gap-2 text-cyan-300">
              <Lock className="h-4 w-4" />
              <h2 className="text-sm font-semibold">Security posture</h2>
            </div>
            <div className="mt-3 space-y-1 text-sm text-slate-100">
              <p>Exposure: <span className="font-semibold">minimal</span></p>
              <p>Access model: controlled bridge</p>
              <p>Client view: sanitized</p>
            </div>
          </article>

          <article className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-5">
            <div className="flex items-center gap-2 text-violet-300">
              <Network className="h-4 w-4" />
              <h2 className="text-sm font-semibold">Connection</h2>
            </div>
            <div className="mt-3 space-y-1 text-sm text-slate-100">
              <p>State: <span className="font-semibold">{upstreamLabel}</span></p>
              <p>Reachable: {status?.upstream?.reachable ? 'yes' : 'no'}</p>
              <p>Sync: {syncLabel}</p>
            </div>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
            <div className="flex items-center gap-2 text-cyan-300">
              <Workflow className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Operations console</h2>
            </div>
            <p className="mt-2 text-sm text-slate-400">
              This panel is intentionally simplified for clients: it confirms service state and sync readiness without revealing internal routing or infrastructure metadata.
            </p>

            <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                <div>
                  <p className="font-semibold">Visibility note</p>
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
                {isRefreshing ? 'Refreshing…' : 'Refresh status'}
              </button>

              <button
                onClick={syncFabric}
                disabled={isSyncing}
                className="inline-flex items-center gap-2 rounded-xl border border-violet-400/40 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 disabled:opacity-50"
              >
                <Database className="h-4 w-4" />
                {isSyncing ? 'Syncing…' : 'Refresh sync state'}
              </button>
            </div>

            {error && <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Clients see</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-200">
                  <li>• verified availability</li>
                  <li>• secure connection state</li>
                  <li>• current synchronization result</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Not exposed</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-200">
                  <li>• internal URLs and ports</li>
                  <li>• raw infrastructure payloads</li>
                  <li>• debug-level bridge metadata</li>
                </ul>
              </div>
            </div>
          </article>

          <article className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
            <h2 className="text-lg font-semibold">Customer-safe summary</h2>

            <div className="mt-5 space-y-4 text-sm text-slate-300">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Service state</p>
                <p className="mt-2 text-base font-semibold text-slate-100">{health?.status ?? 'unknown'}</p>
                <p className="mt-2">The client view stays focused on service health and verified availability.</p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Connectivity</p>
                <p className="mt-2 text-base font-semibold text-slate-100">{upstreamLabel}</p>
                <p className="mt-2">Only the current connection outcome is shown, without underlying network details.</p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Synchronization</p>
                <p className="mt-2 text-base font-semibold text-slate-100">{syncLabel}</p>
                <p className="mt-2">Updates confirm readiness and continuity while keeping the underlying payload private.</p>
              </div>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
