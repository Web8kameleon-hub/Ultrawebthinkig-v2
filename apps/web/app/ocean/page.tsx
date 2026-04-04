'use client'
/**
 * CURIOSITY OCEAN - Interactive AI Chat
 * =====================================
 *
 * Full integration with Ocean Core API via Next.js API route
 * Features:
 * - Real-time chat with AI Orchestrator
 * - Streaming responses
 * - Real-time date/time awareness
 * - Wikipedia, Weather, GitHub integration
 */

import { useState, useEffect, useRef, useCallback } from 'react'

interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  persona?: string
  sources?: string[]
  confidence?: number
}

interface OceanStatus {
  service: string
  version: string
  status: string
  timestamp: string
}

interface RuntimeCard {
  label: string
  state: 'live' | 'limited' | 'offline'
  detail: string
}

interface FabricStatus {
  alphabet: RuntimeCard
  nanogrid: RuntimeCard
  kloud: RuntimeCard
}

// Use Next.js API route as proxy to Ocean-Core (works from browser!)
const OCEAN_API = '/api/ocean'

function runtimeBadgeClass(state: RuntimeCard['state']): string {
  if (state === 'live') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
  if (state === 'limited') return 'border-amber-500/40 bg-amber-500/10 text-amber-300'
  return 'border-slate-700/60 bg-slate-800/80 text-slate-300'
}

function normalizeSSEText(text: string): string {
  if (!text || !text.includes('data:')) return text
  const lines = text.split(/\r?\n/)
  let rebuilt = ''
  let foundData = false

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || !line.startsWith('data:')) continue
    foundData = true
    const payload = line.slice(5).trim()
    if (!payload || payload === '[DONE]') continue
    try {
      const parsed = JSON.parse(payload)
      if (typeof parsed?.chunk === 'string') rebuilt += parsed.chunk
      else if (typeof parsed?.response === 'string') rebuilt += parsed.response
      else if (typeof parsed?.text === 'string') rebuilt += parsed.text
    } catch {
      rebuilt += payload
    }
  }

  return foundData && rebuilt ? rebuilt : text
}

function extractSSEValue(value: unknown): string {
  if (typeof value !== 'string' || !value) return ''
  return normalizeSSEText(value)
}

export default function OceanPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [chatLoading, setChatLoading] = useState(false)
  const [status, setStatus] = useState<OceanStatus | null>(null)
  const [fabricStatus, setFabricStatus] = useState<FabricStatus>({
    alphabet: { label: 'Alphabet', state: 'live', detail: '61 layers • multi-script aware' },
    nanogrid: { label: 'NanoGrid', state: 'offline', detail: 'waiting for live status' },
    kloud: { label: 'Kloud Bridge', state: 'offline', detail: 'waiting for live status' },
  })
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const warmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ─── Human-thinking: warm Ocean while the user is still typing ───────────
  // After 400ms of no new keystrokes (human "pauses") Ocean starts pre-reading
  // the message and building external context so the response is instant on Enter.
  const warmOcean = useCallback((text: string) => {
    if (warmTimerRef.current) clearTimeout(warmTimerRef.current)
    if (!text.trim() || text.trim().length < 6) return
    warmTimerRef.current = setTimeout(() => {
      fetch('/api/ocean/stream/warm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim() }),
      }).catch(() => { /* silent — warm is best-effort */ })
    }, 400)
  }, [])

  useEffect(() => () => {
    if (warmTimerRef.current) clearTimeout(warmTimerRef.current)
  }, [])

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Check Ocean Core + live fabric status
  const checkStatus = useCallback(async () => {
    try {
      const [oceanResponse, nanogridResponse, kloudResponse] = await Promise.all([
        fetch(OCEAN_API, { cache: 'no-store' }).catch(() => null),
        fetch('/api/ocean/nanogrid/status', { cache: 'no-store' }).catch(() => null),
        fetch('/api/kloud-bridge/status', { cache: 'no-store' }).catch(() => null),
      ])

      const oceanData = oceanResponse && oceanResponse.ok ? await oceanResponse.json() : null
      const nanogridData = nanogridResponse && nanogridResponse.ok ? await nanogridResponse.json() : null
      const kloudData = kloudResponse && kloudResponse.ok ? await kloudResponse.json() : null

      setStatus({
        service: 'Ocean Core',
        version: '2.0',
        status: oceanData?.status || 'connected',
        timestamp: new Date().toISOString(),
      })

      const nanoLive = Boolean(nanogridData?.available)
      const kloudReachable = Boolean(kloudData?.upstream?.reachable)
      const kloudConfigured = Boolean(kloudData?.upstream?.configured)

      setFabricStatus({
        alphabet: {
          label: 'Alphabet',
          state: 'live',
          detail: '61 layers • AL/GR + AR/ZH signal',
        },
        nanogrid: {
          label: 'NanoGrid',
          state: nanoLive ? 'live' : 'offline',
          detail: nanoLive ? 'vision + support layer online' : 'support layer waiting',
        },
        kloud: {
          label: 'Kloud Bridge',
          state: kloudReachable ? 'live' : kloudConfigured ? 'limited' : 'offline',
          detail: kloudReachable ? 'fabric route monitored' : kloudConfigured ? 'configured, upstream limited' : 'bridge offline',
        },
      })

      setError(null)

      const now = new Date()
      setMessages((prev) => prev.length > 0 ? prev : [{
        id: 1,
        role: 'assistant',
        content: `🌊 **Mirë se vini në Curiosity Ocean!**

📅 Sot është ${now.toLocaleDateString('sq-AL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
🕐 Ora: ${now.toLocaleTimeString('sq-AL')}

Jam i fuqizuar nga Clisonix AI me:
- 🔤 61 Alphabet Layers + multi-script signal
- 🛰️ NanoGrid + Kloud fabric visibility
- 📖 Wikipedia & Arxiv
- 💻 GitHub API
- 🌍 Weather API

Çfarë dëshironi të dini sot?`,
        timestamp: now,
      }])
    } catch (err) {
      setStatus({
        service: 'Ocean Core',
        version: '2.0',
        status: 'ready',
        timestamp: new Date().toISOString(),
      })
      setFabricStatus({
        alphabet: { label: 'Alphabet', state: 'live', detail: '61 layers active' },
        nanogrid: { label: 'NanoGrid', state: 'offline', detail: 'status unavailable' },
        kloud: { label: 'Kloud Bridge', state: 'offline', detail: 'status unavailable' },
      })
      setError(null)

      const now = new Date()
      setMessages((prev) => prev.length > 0 ? prev : [{
        id: 1,
        role: 'assistant',
        content: `🌊 **Mirë se vini në Curiosity Ocean!**

📅 Sot është ${now.toLocaleDateString('sq-AL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

Çfarë dëshironi të dini sot?`,
        timestamp: now,
      }])
      console.error('Ocean Core connection error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    checkStatus()
    const interval = setInterval(checkStatus, 20000)
    return () => clearInterval(interval)
  }, [checkStatus])

// Send message to Ocean Core with STREAMING via Next.js API route
  const sendMessage = async () => {
    if (!inputMessage.trim() || chatLoading) return

    const userMessage: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setChatLoading(true)

    // Add empty assistant message that we'll fill with streaming content
    const assistantMessageId = Date.now() + 1
    setMessages(prev => [...prev, {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date()
    }])

    try {
      // Use STREAMING endpoint - starts writing immediately!
      const response = await fetch('/api/ocean/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: inputMessage })
      })

      if (!response.ok) throw new Error('API error')
      if (!response.body) throw new Error('No response body')

      // Read streaming response
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      let pending = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        pending += decoder.decode(value, { stream: true })
        const lines = pending.split('\n')
        pending = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed.startsWith('data:')) {
            const data = trimmed.slice(5).trim()
            if (data === '[DONE]') continue

            try {
              const json = JSON.parse(data)
              const parsedText = extractSSEValue(json.chunk) || extractSSEValue(json.response) || extractSSEValue(json.text)
              if (parsedText) {
                fullContent += parsedText
                // Update message in real-time as chunks arrive
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: fullContent }
                    : msg
                ))
              }
            } catch {
              // Not JSON, might be raw text
              fullContent += extractSSEValue(data)
              setMessages(prev => prev.map(msg =>
                msg.id === assistantMessageId
                  ? { ...msg, content: fullContent }
                  : msg
              ))
            }
          }
        }
      }

      const trailing = pending.trim()
      if (trailing.startsWith('data:')) {
        const data = trailing.slice(5).trim()
        if (data && data !== '[DONE]') {
          try {
            const json = JSON.parse(data)
            const parsedText = extractSSEValue(json.chunk) || extractSSEValue(json.response) || extractSSEValue(json.text)
            if (parsedText) fullContent += parsedText
          } catch {
            fullContent += extractSSEValue(data)
          }
        }
      }

      // Ensure final content is set
      if (fullContent) {
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: fullContent }
            : msg
        ))
      }

    } catch (err) {
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? { ...msg, content: '❌ Gabim lidhjeje. Provoni përsëri.' }
          : msg
      ))
      console.error('Chat error:', err)
    } finally {
      setChatLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 to-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-violet-400 mx-auto"></div>
          <p className="mt-4 text-violet-300">Connecting to Ocean Core...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 to-red-900">
        <div className="text-center max-w-md p-8">
          <div className="text-6xl mb-4">🌊</div>
          <h1 className="text-2xl font-bold text-white mb-4">Ocean Core Offline</h1>
          <p className="text-red-300 mb-6">{error}</p>
          <div className="bg-slate-800 rounded-lg p-4 text-left text-sm text-gray-300">
            <p className="mb-2">Try these commands:</p>
            <code className="block bg-black/50 p-2 rounded mb-2">docker-compose up -d ocean-core</code>
            <code className="block bg-black/50 p-2 rounded">curl http://localhost:8030/api/v1/status</code>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-6 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-800/50 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🌊</span>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-violet-400 bg-clip-text text-transparent">
                Curiosity Ocean
              </h1>
              <p className="text-xs text-gray-400">AI Orchestrator • 14 Personas • 23 Labs • 61 Layers</p>
            </div>
          </div>
          {status && (
            <div className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              <span className="text-green-400">v{status.version}</span>
            </div>
          )}
        </div>
      </header>

      {/* Live runtime strip */}
      <section className="max-w-6xl mx-auto px-4 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {Object.values(fabricStatus).map((card) => (
          <div key={card.label} className={`rounded-2xl border px-4 py-3 ${runtimeBadgeClass(card.state)}`}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">{card.label}</span>
              <span className="text-[10px] uppercase tracking-[0.2em]">{card.state}</span>
            </div>
            <p className="mt-1 text-xs opacity-90">{card.detail}</p>
          </div>
        ))}
      </section>

      {/* Chat Container */}
      <main className="max-w-4xl mx-auto px-4 py-6 flex flex-col h-[calc(100vh-210px)]">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 pb-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-violet-600 text-white rounded-br-md'
                    : 'bg-slate-800 text-gray-100 rounded-bl-md border border-slate-800/30'
                }`}
              >
                {/* Message content with markdown-like formatting */}
                <div className="whitespace-pre-wrap">
                  {msg.content.split('\n').map((line, i) => {
                    const trimmed = line.trim()
                    if (trimmed === '---') {
                      return <hr key={i} className="my-3 border-slate-700/70" />
                    }

                    const isSignalHeading = trimmed.includes('Alphabet Signal') || trimmed.includes('Fabric Signal')
                    const isSignalBullet = trimmed.startsWith('- ')
                    const boldParsed = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')

                    return (
                      <p
                        key={i}
                        className={isSignalHeading ? 'mt-2 font-semibold text-cyan-300' : isSignalBullet ? 'ml-2 text-sm text-slate-200' : line.startsWith('•') ? 'ml-2' : ''}
                        dangerouslySetInnerHTML={{ __html: boldParsed }}
                      />
                    )
                  })}
                </div>

                {/* Metadata for assistant messages */}
                {msg.role === 'assistant' && (msg.sources?.length || msg.confidence) && (
                  <div className="mt-2 pt-2 border-t border-slate-800/30 text-xs text-gray-400 flex gap-4">
                    {msg.confidence && (
                      <span>Confidence: {Math.round(msg.confidence * 100)}%</span>
                    )}
                    {msg.sources && msg.sources.length > 0 && (
                      <span>Sources: {msg.sources.slice(0, 3).join(', ')}</span>
                    )}
                  </div>
                )}

                <div className="text-xs opacity-50 mt-1">
                  {msg.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {chatLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3 border border-slate-800/30">
                <div className="flex items-center gap-2">
                  <div className="animate-pulse flex gap-1">
                    <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></span>
                    <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                  </div>
                  <span className="text-violet-300 text-sm">Orchestrator is thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-slate-800/50 pt-4">
          <div className="flex gap-3">
            <textarea
              value={inputMessage}
              onChange={(e) => {
                setInputMessage(e.target.value)
                warmOcean(e.target.value)  // ← Ocean "reads" while you type!
              }}
              onKeyDown={handleKeyPress}
              placeholder="Ask anything... (Press Enter to send)"
              className="flex-1 bg-slate-800 border border-slate-800/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
              rows={2}
              disabled={chatLoading}
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || chatLoading}
              className="px-6 bg-gradient-to-r from-violet-500 to-violet-500 hover:from-violet-600 hover:to-violet-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all"
            >
              {chatLoading ? '...' : 'Send'}
            </button>
          </div>
          <p className="text-center text-xs text-gray-500 mt-2">
            Powered by Clisonix Ocean Core • 61 Alphabet Layers • Real Knowledge Integration
          </p>
        </div>
      </main>
    </div>
  )
}







