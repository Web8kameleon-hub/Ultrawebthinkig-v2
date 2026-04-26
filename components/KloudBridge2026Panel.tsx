'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type KloudStatus = {
  ok: boolean
  source: string
  standard: string
  health: 'healthy' | 'degraded' | 'offline'
  targetUrl: string
  statusCode?: number
  latencyMs?: number
  recommendation?: string
  lastCheckedAt?: string
  error?: string
  details?: string
}

const HEALTH_STYLES: Record<KloudStatus['health'], string> = {
  healthy: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
  degraded: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
  offline: 'bg-rose-500/20 text-rose-300 border-rose-400/30'
}

export default function KloudBridge2026Panel() {
  const [data, setData] = useState<KloudStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadStatus = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    else setLoading(true)

    try {
      const res = await fetch('/api/bridgeway?action=kloud-status', { cache: 'no-store' })
      const json = await res.json()
      setData(json)
    } catch {
      setData({
        ok: false,
        source: 'ultra-kloud-bridge-proxy',
        standard: '2026-enterprise',
        health: 'offline',
        targetUrl: 'https://www.clisonix.com/modules/kloud-bridge',
        error: 'Network error',
        details: 'Unable to load integration status.'
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadStatus(false)
    const id = setInterval(() => void loadStatus(false), 30000)
    return () => clearInterval(id)
  }, [loadStatus])

  const healthBadge = useMemo(() => {
    const health = data?.health || 'offline'
    return HEALTH_STYLES[health]
  }, [data?.health])

  return (
    <section className="relative overflow-hidden rounded-2xl border border-cyan-400/20 bg-slate-950 p-6 text-slate-100 shadow-[0_0_80px_-30px_rgba(34,211,238,0.45)]">
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -left-12 -bottom-12 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />

      <div className="relative z-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/80">Ultra Integration Layer</p>
            <h1 className="text-2xl font-semibold tracking-tight">Kloud Bridge Control • 2026 Standard</h1>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${healthBadge}`}>
            {data?.health?.toUpperCase() || 'CHECKING'}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-4">
            <p className="text-xs text-slate-400">Latency</p>
            <p className="text-xl font-semibold">{data?.latencyMs ?? '--'} ms</p>
          </div>
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-4">
            <p className="text-xs text-slate-400">HTTP Status</p>
            <p className="text-xl font-semibold">{data?.statusCode ?? '--'}</p>
          </div>
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-4">
            <p className="text-xs text-slate-400">Source</p>
            <p className="truncate text-sm font-medium">{data?.source || 'ultra-kloud-bridge-proxy'}</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-700/70 bg-slate-900/70 p-4">
          <p className="text-xs text-slate-400">Target URL</p>
          <a
            href={data?.targetUrl || 'https://www.clisonix.com/modules/kloud-bridge'}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-sm text-cyan-300 hover:text-cyan-200"
          >
            {data?.targetUrl || 'https://www.clisonix.com/modules/kloud-bridge'}
          </a>
          <p className="mt-2 text-sm text-slate-300">
            {data?.recommendation || 'Monitoring and optimization recommendations will appear here.'}
          </p>
          {data?.error && <p className="mt-2 text-sm text-rose-300">{data.error}: {data.details}</p>}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={() => void loadStatus(true)}
            disabled={loading || refreshing}
            className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? 'Refreshing...' : 'Refresh Status'}
          </button>
          <a
            href={data?.targetUrl || 'https://www.clisonix.com/modules/kloud-bridge'}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-cyan-400/40 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/10"
          >
            Open External Kloud Bridge
          </a>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Last checked: {data?.lastCheckedAt ? new Date(data.lastCheckedAt).toLocaleString() : '--'}
        </p>
      </div>
    </section>
  )
}
