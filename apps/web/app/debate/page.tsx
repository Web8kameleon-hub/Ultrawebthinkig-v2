'use client'

import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

interface DebateResponse {
  persona: string
  name: string
  emoji: string
  role: string
  response: string
  status: 'success' | 'error' | 'partial'
  tokens?: number
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  sq: 'Albanian',
  de: 'German',
  fr: 'French',
  it: 'Italian',
  es: 'Spanish',
  pt: 'Portuguese',
  tr: 'Turkish',
}

function detectLanguageHint(input: string): string {
  const text = input.toLowerCase()

  if (/[çë]/i.test(input) || /\b(është|jam|nuk|dhe|që|si|për|një|kjo|këtë|mirë|faleminderit)\b/i.test(text)) return 'sq'
  if (/\b(und|nicht|ist|wie|warum|danke|bitte|über)\b/i.test(text)) return 'de'
  if (/\b(le|la|les|est|pourquoi|merci|avec|être)\b/i.test(text)) return 'fr'
  if (/\b(il|lo|gli|è|perché|grazie|con|sono)\b/i.test(text)) return 'it'
  if (/\b(el|la|los|las|porque|gracias|con|está|cómo)\b/i.test(text)) return 'es'
  if (/\b(ve|bir|bu|için|neden|teşekkür|nasıl)\b/i.test(text)) return 'tr'
  if (/\b(o|a|os|as|porque|obrigado|como|está)\b/i.test(text)) return 'pt'

  return 'en'
}

const PERSONAS = [
  { id: 'alba', name: 'Alba', emoji: '🌅', role: 'Optimist' },
  { id: 'albi', name: 'Albi', emoji: '🔧', role: 'Pragmatist' },
  { id: 'jona', name: 'Jona', emoji: '🔍', role: 'Skeptic' },
  { id: 'blerina', name: 'Blerina', emoji: '💡', role: 'Analyst' },
  { id: 'asi', name: 'ASI', emoji: '🧠', role: 'Meta-Thinker' },
]

export default function DebatePage() {
  const searchParams = useSearchParams()
  const [topic, setTopic] = useState('')
  const [responses, setResponses] = useState<DebateResponse[]>([])
  const [streamingText, setStreamingText] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const pendingTokensRef = useRef<Record<string, string>>({})
  const streamingTextRef = useRef<Record<string, string>>({})
  const flushTimerRef = useRef<number | null>(null)
  const autoStartedRef = useRef(false)
  const sessionIdRef = useRef(`debate_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`)
  const conversationRef = useRef<string[]>([])

  useEffect(() => {
    return () => {
      if (flushTimerRef.current) {
        window.clearInterval(flushTimerRef.current)
        flushTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const topicFromUrl = searchParams.get('topic')
    if (topicFromUrl && topicFromUrl.trim()) {
      setTopic(topicFromUrl.trim())
    }
  }, [searchParams])

  const startTokenFlushLoop = () => {
    if (flushTimerRef.current) return
    flushTimerRef.current = window.setInterval(() => {
      const pending = pendingTokensRef.current
      const personaIds = Object.keys(pending)
      if (personaIds.length === 0) return

      setStreamingText(prev => {
        const next = { ...prev }
        for (const personaId of personaIds) {
          const chunk = pending[personaId]
          if (!chunk) continue
          next[personaId] = (next[personaId] || '') + chunk
          streamingTextRef.current[personaId] = next[personaId]
        }
        pendingTokensRef.current = {}
        return next
      })
    }, 40)
  }

  const stopTokenFlushLoop = () => {
    if (flushTimerRef.current) {
      window.clearInterval(flushTimerRef.current)
      flushTimerRef.current = null
    }
  }

  const startDebate = async () => {
    if (!topic.trim()) return

    // Cancel previous request if any
    if (abortRef.current) {
      abortRef.current.abort()
    }
    abortRef.current = new AbortController()

    setLoading(true)
    setError(null)
    setResponses([])
    setStreamingText({})
    setProgress(0)
    streamingTextRef.current = {}
    pendingTokensRef.current = {}
    startTokenFlushLoop()

    const explicitLang = (searchParams.get('lang') || '').trim().toLowerCase()
    const preferredLanguage = explicitLang || detectLanguageHint(topic)
    const languageName = LANGUAGE_NAMES[preferredLanguage] || preferredLanguage.toUpperCase()
    const conversationContext = conversationRef.current.slice(-8)

    try {
      // Use streaming endpoint for elastic responses
      const res = await fetch('/api/debate/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          stream_mode: 'compact',
          preferred_language: preferredLanguage,
          language_name: languageName,
          quality_profile: 'high',
          language_layers: 4,
          session_id: sessionIdRef.current,
          conversation_context: conversationContext,
        }),
        signal: abortRef.current.signal
      })

      if (!res.ok) throw new Error('Debate failed')

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('No stream available')

      let completedCount = 0
      let sseBuffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        sseBuffer += decoder.decode(value, { stream: true })
        const events = sseBuffer.split('\n\n')
        sseBuffer = events.pop() || ''

        for (const event of events) {
          const eventType = (event.split('\n').find(line => line.startsWith('event:')) || '').replace('event:', '').trim()
          const dataLines = event
            .split('\n')
            .filter(line => line.startsWith('data:'))
            .map(line => line.replace(/^data:\s?/, ''))

          if (dataLines.length === 0) continue

          const payload = dataLines.join('\n')

          if (eventType === 't') {
            try {
              const sep = payload.indexOf(':')
              if (sep > 0) {
                const personaId = payload.slice(0, sep)
                const encoded = payload.slice(sep + 1)
                const token = decodeURIComponent(escape(atob(encoded)))
                pendingTokensRef.current[personaId] = (pendingTokensRef.current[personaId] || '') + token
              }
            } catch {
            }
            continue
          }

          if (eventType === 'thinking') {
            try {
              const info = JSON.parse(payload)
              setActiveSpeaker(info.persona)
              setStreamingText(prev => {
                if (prev[info.persona] !== undefined) return prev
                const next = { ...prev, [info.persona]: '' }
                streamingTextRef.current[info.persona] = ''
                return next
              })
            } catch {
            }
            continue
          }

          if (eventType === 'response') {
            try {
              const meta = JSON.parse(payload)
              const personaId = meta.persona
              const fromStream = `${streamingTextRef.current[personaId] || ''}${pendingTokensRef.current[personaId] || ''}`

              setResponses(prev => [...prev, {
                persona: personaId,
                name: meta.name,
                emoji: meta.emoji,
                role: meta.role,
                response: fromStream,
                status: meta.status,
                tokens: meta.tokens
              }])

              setStreamingText(prev => {
                const newState = { ...prev }
                delete newState[personaId]
                delete streamingTextRef.current[personaId]
                delete pendingTokensRef.current[personaId]
                return newState
              })

              completedCount++
              setProgress((completedCount / PERSONAS.length) * 100)
              setActiveSpeaker(null)
            } catch {
            }
            continue
          }

          if (eventType === 'done') {
            setActiveSpeaker(null)
            continue
          }

          try {
            const data = JSON.parse(payload)

            if (data.type === 'thinking') {
              setActiveSpeaker(data.persona)
              setStreamingText(prev => {
                if (prev[data.persona] !== undefined) return prev
                const next = { ...prev, [data.persona]: '' }
                streamingTextRef.current[data.persona] = ''
                return next
              })
            } else if (data.type === 'token') {
              pendingTokensRef.current[data.persona] = (pendingTokensRef.current[data.persona] || '') + data.token
            } else if (data.type === 'response') {
              const personaId = data.data.persona
              const fromStream = `${streamingTextRef.current[personaId] || ''}${pendingTokensRef.current[personaId] || ''}`
              const finalResponse = (data.data.response && String(data.data.response).trim().length > 0)
                ? data.data.response
                : fromStream

              setResponses(prev => [...prev, { ...data.data, response: finalResponse }])
              setStreamingText(prev => {
                const newState = { ...prev }
                delete newState[personaId]
                delete streamingTextRef.current[personaId]
                delete pendingTokensRef.current[personaId]
                return newState
              })
              completedCount++
              setProgress((completedCount / PERSONAS.length) * 100)
              setActiveSpeaker(null)
            } else if (data.type === 'done') {
              setActiveSpeaker(null)
            }
          } catch {
            // Skip parse errors
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setError('Debate cancelled')
      } else {
        // Fallback to non-streaming
        try {
          const res = await fetch('/api/debate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              topic,
              preferred_language: preferredLanguage,
              language_name: languageName,
              quality_profile: 'high',
              language_layers: 4,
              session_id: sessionIdRef.current,
              conversation_context: conversationContext,
            })
          })
          if (res.ok) {
            const data = await res.json()
            setResponses(data.responses || [])
          } else {
            setError('Failed to connect to debate engine')
          }
        } catch {
          setError('Failed to connect to debate engine')
        }
      }
    } finally {
      if (topic.trim()) {
        conversationRef.current = [...conversationRef.current, topic.trim()].slice(-12)
      }
      stopTokenFlushLoop()
      setActiveSpeaker(null)
      setLoading(false)
      abortRef.current = null
    }
  }

  useEffect(() => {
    const topicFromUrl = searchParams.get('topic')
    const shouldAutostart = searchParams.get('autostart') === '1'
    if (!shouldAutostart || autoStartedRef.current) return
    if (!topicFromUrl || !topicFromUrl.trim()) return
    if (loading) return

    autoStartedRef.current = true
    setTopic(topicFromUrl.trim())
    window.setTimeout(() => {
      void startDebate()
    }, 0)
  }, [searchParams, loading])

  const cancelDebate = () => {
    if (abortRef.current) {
      abortRef.current.abort()
    }
  }

  const getResponseForPersona = (personaId: string) => {
    return responses.find(r => r.persona === personaId)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-700/70 bg-slate-900/40 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center text-lg">
              🎭
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-100">Debati i Trinitetit</h1>
              <p className="text-xs text-slate-300">5 perspektiva AI • Streaming elastik • Memorie bisede + i18n</p>
            </div>
          </div>
          <a href="/modules" className="text-sm text-slate-300 hover:text-white">
            ← Mbrapa
          </a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">

        {/* Progress Bar */}
        {loading && (
          <div className="mb-6">
            <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-slate-300 mt-2 text-center">
              {activeSpeaker ? `${PERSONAS.find(p => p.id === activeSpeaker)?.name} po mendon...` : 'Duke përpunuar...'}
            </p>
          </div>
        )}

        {/* Personas */}
        <div className="grid grid-cols-5 gap-3 mb-8">
          {PERSONAS.map((p) => {
            const resp = getResponseForPersona(p.id)
            const isActive = activeSpeaker === p.id
            const hasResponse = !!resp

            return (
              <div
                key={p.id}
                className={`text-center p-4 rounded-xl border transition-all ${
                  isActive
                    ? 'bg-blue-900/20 border-blue-600 animate-pulse'
                    : hasResponse
                      ? resp.status === 'success'
                        ? 'bg-green-900/10 border-green-800'
                        : 'bg-yellow-900/10 border-yellow-800'
                          : 'bg-slate-800/70 border-slate-600'
                }`}
              >
                <div className="text-2xl mb-2">{p.emoji}</div>
                <div className="text-sm font-medium text-slate-100">{p.name}</div>
                <div className="text-xs text-slate-300">{p.role}</div>
                {isActive && (
                  <div className="mt-2 flex justify-center gap-1">
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
                  </div>
                )}
                {hasResponse && !isActive && (
                  <div className="mt-2 text-xs text-slate-300">
                    {resp.tokens ? `${resp.tokens} words` : '✓'}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Input */}
        <div className="bg-slate-800/80 rounded-xl p-5 border border-slate-600 mb-6">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && startDebate()}
            placeholder="Futni një temë për debat..."
            className="w-full bg-transparent text-slate-100 placeholder-slate-300 focus:outline-none text-sm"
            disabled={loading}
          />
          <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-600">
            <div className="flex flex-wrap gap-2">
              {['E ardhmja e AI', 'Në distancë vs zyrë', 'Privatësia vs Siguria', 'Veprimi për klimën'].map((t) => (
                <button
                  key={t}
                  onClick={() => setTopic(t)}
                  disabled={loading}
                  className="px-3 py-1.5 bg-slate-700 text-slate-200 text-xs rounded-lg hover:bg-slate-600 hover:text-white transition-colors disabled:opacity-50"
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {loading && (
                <button
                  onClick={cancelDebate}
                  className="px-4 py-2 bg-red-900/25 text-red-300 text-sm font-medium rounded-lg hover:bg-red-900/40 transition-colors"
                >
                  Ndalo
                </button>
              )}
              <button
                onClick={startDebate}
                disabled={loading || !topic.trim()}
                className="px-5 py-2 bg-white text-slate-900 text-sm font-medium rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Duke transmetuar...' : 'Filloni debatin'}
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm mb-6">
            {error}
          </div>
        )}

        {/* LIVE Streaming Response */}
        {activeSpeaker && streamingText[activeSpeaker] && (
          <div className="bg-slate-800/80 rounded-xl p-5 border border-blue-500/60 mb-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-blue-900/30 rounded-lg flex items-center justify-center text-xl flex-shrink-0">
                {PERSONAS.find(p => p.id === activeSpeaker)?.emoji || '🤖'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-blue-400">
                    {PERSONAS.find(p => p.id === activeSpeaker)?.name}
                  </span>
                  <span className="text-xs text-blue-500/70">Streaming live...</span>
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                </div>
                <p className="text-slate-100 text-sm leading-relaxed whitespace-pre-wrap">
                  {streamingText[activeSpeaker]}
                  <span className="inline-block w-1.5 h-4 bg-blue-400 ml-0.5 animate-blink" />
                </p>
              </div>
            </div>
          </div>
        )}
        {/* Debate Results - Real-time streaming */}
        {responses.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-200">Tema: <span className="text-white">{topic}</span></span>
              <span className="text-slate-300">{responses.filter(r => r.status === 'success').length}/{PERSONAS.length} përgjigje</span>
            </div>

            {responses.map((r, idx) => (
              <div
                key={r.persona}
                className="bg-slate-800/80 rounded-xl p-5 border border-slate-600 animate-fadeIn"
                style={{animationDelay: `${idx * 100}ms`}}
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center text-xl flex-shrink-0">
                    {r.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-slate-100">{r.name}</span>
                      <span className="text-xs text-slate-300">{r.role}</span>
                      {r.status === 'partial' && (
                        <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-400 text-xs rounded">
                          Partial
                        </span>
                      )}
                      {r.status === 'error' && (
                        <span className="px-2 py-0.5 bg-red-500/10 text-red-400 text-xs rounded">
                          Error
                        </span>
                      )}
                      {r.tokens && (
                        <span className="px-2 py-0.5 bg-slate-700 text-slate-200 text-xs rounded">
                          {r.tokens} words
                        </span>
                      )}
                    </div>
                    <p className="text-slate-100 text-sm leading-relaxed whitespace-pre-wrap">
                      {r.response || 'No response'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {responses.length === 0 && !loading && !error && (
          <div className="text-center py-20 text-slate-300">
            <div className="text-5xl mb-4">🎭</div>
            <p className="text-sm">Futni një temë për të filluar një debat me shumë perspektiva</p>
            <p className="text-xs text-slate-300 mt-1">5 persona AI • Streaming elastik • Ruan rrjedhën e bisedës</p>
          </div>
        )}
      </main>

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  )
}
