'use client'

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
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center text-lg">
              🎯
            </div>
            <div>
              <h1 className="text-lg font-semibold text-zinc-100">Zürich Engine</h1>
              <p className="text-xs text-zinc-500">Deterministic 9-Stage Reasoning</p>
            </div>
          </div>
          <a href="/modules" className="text-sm text-zinc-500 hover:text-zinc-300">
            ← Back
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          
          {/* Pipeline */}
          <div className="lg:col-span-1">
            <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-4">
              Pipeline
            </div>
            <div className="space-y-1">
              {STAGES.map((stage, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeStage === i 
                      ? 'bg-blue-500/10 text-blue-400' 
                      : activeStage > i 
                        ? 'text-zinc-400' 
                        : 'text-zinc-600'
                  }`}
                >
                  <span className={`w-5 h-5 rounded text-xs flex items-center justify-center ${
                    activeStage === i 
                      ? 'bg-blue-500 text-white' 
                      : activeStage > i 
                        ? 'bg-zinc-700 text-zinc-400' 
                        : 'bg-zinc-800 text-zinc-600'
                  }`}>
                    {activeStage > i ? '✓' : stage.num}
                  </span>
                  <span>{stage.name}</span>
                  {activeStage === i && (
                    <span className="ml-auto w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Main */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Input */}
            <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), processQuery())}
                placeholder="Enter your query for deterministic analysis..."
                className="w-full h-28 bg-transparent text-zinc-100 placeholder-zinc-600 focus:outline-none resize-none text-sm"
              />
              <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
                <span className="text-xs text-zinc-600">{query.length} chars</span>
                <button
                  onClick={processQuery}
                  disabled={loading || !query.trim()}
                  className="px-5 py-2 bg-zinc-100 text-zinc-900 text-sm font-medium rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
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
                  <pre className="whitespace-pre-wrap text-zinc-300 text-sm font-mono leading-relaxed">
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
