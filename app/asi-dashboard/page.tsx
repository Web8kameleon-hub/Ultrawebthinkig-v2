'use client'

import * as React from 'react'

type ASIStatusResponse = {
  available: boolean
  telemetry?: unknown
  latencyMs?: number
  checkedAt?: string
  error?: string
}

export default function ASIDashboard() {
  const [data, setData] = React.useState<ASIStatusResponse | null>(null)
  const [loading, setLoading] = React.useState(true)

  const refresh = React.useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/asi-status', { cache: 'no-store' })
      const payload = await response.json() as ASIStatusResponse
      setData(response.ok ? payload : { ...payload, available: false })
    } catch (error) {
      setData({ available: false, error: error instanceof Error ? error.message : 'Status request failed' })
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { void refresh() }, [refresh])

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold">🇦🇱 ASI Runtime Dashboard</h1>
          <p className="mt-2 text-slate-400">Only telemetry received from the configured ASI service is displayed.</p>
        </header>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm text-slate-400">Verified connection state</div>
              <div className={`mt-1 text-xl font-semibold ${data?.available ? 'text-emerald-400' : 'text-amber-400'}`}>
                {loading ? 'CHECKING' : data?.available ? 'AVAILABLE' : 'UNAVAILABLE'}
              </div>
            </div>
            <button onClick={() => void refresh()} disabled={loading} className="rounded-lg bg-blue-600 px-4 py-2 disabled:opacity-50">
              {loading ? 'Checking…' : 'Refresh'}
            </button>
          </div>
          {typeof data?.latencyMs === 'number' && <p className="mt-4 text-sm">Measured proxy latency: {data.latencyMs} ms</p>}
          {data?.checkedAt && <p className="text-sm text-slate-400">Checked: {new Date(data.checkedAt).toLocaleString()}</p>}
          {!data?.available && data?.error && <p className="mt-4 rounded bg-amber-950 p-3 text-amber-300">{data.error}</p>}
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-xl font-semibold">Upstream telemetry</h2>
          {data?.available ? (
            <pre className="mt-4 max-h-[60vh] overflow-auto rounded bg-black/40 p-4 text-xs text-emerald-200">
              {JSON.stringify(data.telemetry, null, 2)}
            </pre>
          ) : (
            <p className="mt-3 text-slate-400">No telemetry is displayed because no real upstream response was verified.</p>
          )}
        </section>
      </div>
    </main>
  )
}
