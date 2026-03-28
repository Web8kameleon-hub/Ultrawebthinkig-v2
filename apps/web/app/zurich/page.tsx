'use client'

import Link from 'next/link'
import { useState } from 'react'

interface ZurichResponse {
  ok: boolean
  output: string
  confidence: number
  strategy: string
  domains: string[]
  processing_time_ms: number
  engine: string
}

const STAGES = [
  { num: 1, name: 'Parse' },
  { num: 2, name: 'Classify' },
  { num: 3, name: 'Decompose' },
  { num: 4, name: 'Retrieve' },
  { num: 5, name: 'Apply' },
  { num: 6, name: 'Synthesize' },
  { num: 7, name: 'Validate' },
  { num: 8, name: 'Format' },
  { num: 9, name: 'Output' },
]

export default function ZurichPage() {
  const [query, setQuery] = useState('')
  const [response, setResponse] = useState<ZurichResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeStage, setActiveStage] = useState(-1)
  const [error, setError] = useState<string | null>(null)

  const processQuery = async () => {
    if (!query.trim()) return

    setLoading(true)
    setError(null)
    setResponse(null)

    for (let i = 0; i < 9; i++) {
      setActiveStage(i)
      await new Promise(r => setTimeout(r, 80))
    }

    try {
      const res = await fetch('/api/zurich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: query })
      })

      if (!res.ok) throw new Error('Engine error')

      const data = await res.json()
      setResponse(data)
    } catch {
      setError('Connection failed')
    } finally {
      setActiveStage(-1)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-32 left-1/4 h-72 w-72 rounded-full bg-emerald-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 right-1/4 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />

      <header className="border-b border-zinc-800/90 backdrop-blur-sm sticky top-0 z-10 bg-zinc-950/80">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl border border-emerald-500/30 bg-zinc-900 flex items-center justify-center text-xl shadow-lg shadow-emerald-900/20">
              ⚙️
            </div>
            <div>
              <h1 className="text-lg font-semibold text-zinc-100 tracking-wide">Zürich Engine</h1>
              <p className="text-xs text-zinc-400">Deterministic 9-Stage Reasoning • Clisonix Ultra Stack</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-md text-[11px] border border-emerald-400/30 text-emerald-300 bg-emerald-500/10">
              Deterministic
            </span>
            <span className="px-2.5 py-1 rounded-md text-[11px] border border-cyan-400/30 text-cyan-300 bg-cyan-500/10">
              No Randomness
            </span>
            <Link href="/modules" className="text-sm text-zinc-400 hover:text-zinc-200">
              ← Back
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-5 gap-8">

          {/* Pipeline */}
          <div className="lg:col-span-2 space-y-5">
            <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Pipeline
            </div>
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 space-y-1.5">
              {STAGES.map((stage, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors border ${
                    activeStage === i
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : activeStage > i
                        ? 'text-zinc-300 border-zinc-700 bg-zinc-800/60'
                        : 'text-zinc-600 border-transparent'
                  }`}
                >
                  <span className={`w-5 h-5 rounded text-xs flex items-center justify-center ${
                    activeStage === i
                      ? 'bg-emerald-500 text-zinc-950 font-semibold'
                      : activeStage > i
                        ? 'bg-zinc-700 text-zinc-200'
                        : 'bg-zinc-800 text-zinc-600'
                  }`}>
                    {activeStage > i ? '✓' : stage.num}
                  </span>
                  <span>{stage.name}</span>
                  {activeStage === i && (
                    <span className="ml-auto w-1.5 h-1.5 bg-emerald-300 rounded-full animate-pulse" />
                  )}
                </div>
              ))}
            </div>

            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500 uppercase tracking-wider">Execution state</span>
                <span className={loading ? 'text-emerald-300' : 'text-zinc-400'}>{loading ? 'Running' : 'Idle'}</span>
              </div>
              <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-200"
                  style={{ width: `${loading ? Math.max(0, ((activeStage + 1) / 9) * 100) : 0}%` }}
                />
              </div>
              <div className="text-xs text-zinc-500">
                Stable reasoning chain with explicit stage gating and deterministic output assembly.
              </div>
            </div>
          </div>

          {/* Main */}
          <div className="lg:col-span-3 space-y-6">

            <div className="grid sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-3">
                <div className="text-[11px] uppercase tracking-wider text-zinc-500">Engine Mode</div>
                <div className="text-sm text-zinc-200 mt-1">9-Stage Deterministic</div>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-3">
                <div className="text-[11px] uppercase tracking-wider text-zinc-500">Context</div>
                <div className="text-sm text-zinc-200 mt-1">Clisonix Zürich Core</div>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-3">
                <div className="text-[11px] uppercase tracking-wider text-zinc-500">Randomness</div>
                <div className="text-sm text-emerald-300 mt-1">Disabled</div>
              </div>
            </div>

            {/* Input */}
            <div className="bg-zinc-900/85 rounded-2xl p-5 border border-zinc-800 shadow-xl shadow-emerald-950/10">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), processQuery())}
                placeholder="Enter your query for high-fidelity deterministic analysis..."
                className="w-full h-28 bg-transparent text-zinc-100 placeholder-zinc-600 focus:outline-none resize-none text-sm"
              />
              <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
                <span className="text-xs text-zinc-600">{query.length} chars</span>
                <button
                  onClick={processQuery}
                  disabled={loading || !query.trim()}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-400 to-cyan-400 text-zinc-950 text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Processing...' : 'Analyze'}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Output */}
            {response && (
              <div className="bg-zinc-900/85 rounded-2xl border border-zinc-800 overflow-hidden shadow-xl shadow-cyan-950/10">
                <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-300">Result</span>
                  <div className="flex items-center gap-4 text-xs text-zinc-500">
                    <span>{response.processing_time_ms.toFixed(2)}ms</span>
                    <span>{(response.confidence * 100).toFixed(0)}% confidence</span>
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="px-2 py-1 bg-zinc-800 text-zinc-400 text-xs rounded">
                      {response.strategy}
                    </span>
                    {response.domains.map(d => (
                      <span key={d} className="px-2 py-1 bg-zinc-800 text-zinc-400 text-xs rounded">
                        {d}
                      </span>
                    ))}
                  </div>
                  <pre className="whitespace-pre-wrap text-zinc-200 text-sm font-mono leading-relaxed">
                    {response.output}
                  </pre>
                </div>
              </div>
            )}

            {/* Empty */}
            {!response && !loading && !error && (
              <div className="text-center py-16 text-zinc-600">
                <div className="text-4xl mb-3">🎯</div>
                <p className="text-sm">Enter a query for deterministic analysis</p>
                <p className="text-xs text-zinc-700 mt-1">No AI randomness • Reproducible results</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
