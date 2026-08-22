'use client'

import React, { useState, useEffect, useRef } from 'react'

/**
 * Industrial Grade AI Manager Chat (Production)
 * Displays only verified upstream responses and availability.
 */

interface AIMessage {
  id: string
  type: 'client' | 'ai' | 'system' | 'alert'
  content: string
  timestamp: string
  confidence?: number
  category?: string
  handledBy?: string
}

interface AIManagerChatProps {
  clientId?: string
  endpoint?: string
  className?: string
  onSystemAlert?: (alert: any) => void
}

export const AIManagerChat: React.FC<AIManagerChatProps> = ({
  clientId,
  endpoint = '/api/ai-manager',
  className = '',
  onSystemAlert = (alert: any) => { console.log('System Alert:', alert) }
}) => {
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [input, setInput] = useState('')
  const [processing, setProcessing] = useState(false)
  const [health, setHealth] = useState<'CHECKING' | 'AVAILABLE' | 'UNAVAILABLE'>('CHECKING')
  const [resolvedClientId] = useState(() => clientId || crypto.randomUUID())
  const endRef = useRef<HTMLDivElement>(null)

  /** Auto-scroll */
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  /** Confirm the real upstream before showing service availability. */
  useEffect(() => {
    let active = true
    fetch(endpoint, { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok || data.available !== true) throw new Error(data.error || 'Service unavailable')
        if (active) setHealth('AVAILABLE')
      })
      .catch(() => { if (active) setHealth('UNAVAILABLE') })
    return () => { active = false }
  }, [endpoint])

  /** Send message to AGI Manager Backend */
  const sendMessage = async () => {
    if (!input.trim() || processing) return
    const userMsg: AIMessage = {
      id: `client-${Date.now()}`,
      type: 'client',
      content: input.trim(),
      timestamp: new Date().toISOString()
    }
    setMessages((prev: AIMessage[]) => [...prev, userMsg])
    setInput('')
    setProcessing(true)

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: resolvedClientId, message: userMsg.content })
      })

      const data = await res.json()
      if (!res.ok || data.success !== true || typeof data.response !== 'string') {
        throw new Error(data.error || `AI Manager returned HTTP ${res.status}`)
      }
      const aiMsg: AIMessage = {
        id: `ai-${Date.now()}`,
        type: 'ai',
        content: data.response,
        timestamp: data.upstreamTimestamp || data.receivedAt,
        confidence: typeof data.confidence === 'number' ? data.confidence : undefined,
        handledBy: typeof data.provider === 'string' ? data.provider : undefined
      }

      if (data.category === 'emergency') onSystemAlert?.(data)
      setMessages((prev: AIMessage[]) => [...prev, aiMsg])
    } catch (err: any) {
      console.error('AI Manager Error:', err)
      setMessages((prev: AIMessage[]) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          type: 'system',
          content: `⚠️ Connection Error\n${String(err)}\nSystem attempting recovery...`,
          timestamp: new Date().toISOString()
        }
      ])
      setHealth('UNAVAILABLE')
    } finally {
      setProcessing(false)
    }
  }

  /** Handle Enter key */
  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  /** Get message class name by type */
  const getMessageClassName = (msg: AIMessage): string => {
    const baseClass = 'aim-message'
    switch (msg.type) {
      case 'client':
        return `${baseClass} aim-message-client`
      case 'ai':
        return `${baseClass} aim-message-ai`
      case 'system':
        return `${baseClass} aim-message-system`
      default:
        return baseClass
    }
  }

  return (
    <div className={`aim-container ${className}`}>
      {/* Header */}
      <div className="aim-header">
        <div>
          <strong>AGI Neural Manager</strong>
          <p className="aim-header-text">Client {resolvedClientId} • {health}</p>
        </div>
        <div
          className={`aim-health-indicator ${
            health === 'AVAILABLE' ? 'operational' : 'degraded'
          }`}
        />
      </div>

      {/* Messages */}
      <div className="aim-messages-container">
        {messages.map((m: AIMessage) => (
          <div key={m.id} className={getMessageClassName(m)}>
            <div className="aim-message-content">{m.content}</div>
            <div className="aim-message-meta">
              {new Date(m.timestamp).toLocaleTimeString()} {m.handledBy ? `• ${m.handledBy}` : ''}
            </div>
          </div>
        ))}
        {processing && (
          <div className="aim-processing-indicator">
            Processing request via AGI networks...
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="aim-input-container">
        <input
          value={input}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Send command to AGI Manager..."
          className="aim-input"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || processing}
          className="aim-button"
        >
          {processing ? '...' : 'Send'}
        </button>
      </div>
    </div>
  )
}

export default AIManagerChat
