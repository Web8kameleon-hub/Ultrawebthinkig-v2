'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { trackEconomy } from '@/lib/economy/track'

const SOCIAL_HERO_IMAGE = '/icons/icon-512x512.png'
const SOCIAL_DEMO_VIDEO = process.env.NEXT_PUBLIC_SOCIAL_DEMO_VIDEO_URL || process.env.NEXT_PUBLIC_NEWS_DEMO_VIDEO_URL || ''
const SOCIAL_AMBIENT_AUDIO = process.env.NEXT_PUBLIC_SOCIAL_AMBIENT_AUDIO_URL || ''
const STORAGE_AUDIO_CONSENT_KEY = 'clisonix.social.audioConsent.v1'
const STORAGE_AMBIENT_MUTED_KEY = 'clisonix.social.ambientMuted.v1'
const STORAGE_PULSE_ENABLED_KEY = 'clisonix.social.pulseEnabled.v1'
const STORAGE_REGISTERED_KEY = 'clisonix.social.googleRegistered.v1'
const STORAGE_AUTH_SUCCESS_TRACKED_KEY = 'clisonix.social.googleAuthSuccessTracked.v1'

type MediaType = 'all' | 'video' | 'image' | 'photo' | 'status'

interface SearchResult {
  platform: string
  mediaType: MediaType
  url: string
}

interface PlatformNode {
  id: string
  label: string
  icon: string
}

interface NodeSignal extends PlatformNode {
  hits: number
  media: string[]
}

const PLATFORM_NODES: PlatformNode[] = [
  { id: 'youtube', label: 'YouTube', icon: 'YT' },
  { id: 'tiktok', label: 'TikTok', icon: 'TT' },
  { id: 'instagram', label: 'Instagram', icon: 'IG' },
  { id: 'x', label: 'X', icon: 'X' },
  { id: 'linkedin', label: 'LinkedIn', icon: 'IN' },
  { id: 'facebook', label: 'Facebook', icon: 'FB' },
]

function normalizePlatform(platform: string): string {
  const key = platform.trim().toLowerCase()
  if (key.includes('you')) return 'youtube'
  if (key.includes('tik')) return 'tiktok'
  if (key.includes('insta')) return 'instagram'
  if (key === 'x' || key.includes('twitter')) return 'x'
  if (key.includes('linkedin')) return 'linkedin'
  if (key.includes('facebook') || key.includes('meta')) return 'facebook'
  return key
}

function clampBpm(value: number): number {
  if (value < 52) return 52
  if (value > 156) return 156
  return value
}

function sparklinePoints(values: number[]): string {
  const width = 92
  const height = 28
  const len = values.length || 1
  const max = Math.max(...values, 1)

  return values
    .map((value, idx) => {
      const x = len === 1 ? 0 : (idx / (len - 1)) * width
      const y = height - (value / max) * (height - 2) - 1
      return `${x},${y}`
    })
    .join(' ')
}

export default function SocialIntelligencePage() {
  const { status } = useSession()
  const isAuthenticated = status === 'authenticated'
  const [query, setQuery] = useState('')
  const [mediaType, setMediaType] = useState<MediaType>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [audioConsent, setAudioConsent] = useState(false)
  const [ambientMuted, setAmbientMuted] = useState(true)
  const [pulseEnabled, setPulseEnabled] = useState(true)
  const [beatFrame, setBeatFrame] = useState(0)
  const [nodeHistory, setNodeHistory] = useState<Record<string, number[]>>(() =>
    PLATFORM_NODES.reduce<Record<string, number[]>>((acc, node) => {
      acc[node.id] = []
      return acc
    }, {})
  )

  const ambientAudioRef = useRef<HTMLAudioElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const pulseTimerRef = useRef<number | null>(null)
  const lastTrackRef = useRef<Record<string, number>>({})

  const mediaTypes: MediaType[] = useMemo(() => ['all', 'video', 'image', 'photo', 'status'], [])

  const nodeSignals: NodeSignal[] = useMemo(() => {
    const buckets = new Map<string, { hits: number; media: Set<string> }>()

    for (const item of results) {
      const key = normalizePlatform(item.platform)
      const current = buckets.get(key) || { hits: 0, media: new Set<string>() }
      current.hits += 1
      current.media.add(item.mediaType)
      buckets.set(key, current)
    }

    return PLATFORM_NODES.map((node) => {
      const nodeData = buckets.get(node.id)
      return {
        ...node,
        hits: nodeData?.hits || 0,
        media: nodeData ? Array.from(nodeData.media) : [],
      }
    })
  }, [results])

  const activeNodeCount = useMemo(() => nodeSignals.filter((n) => n.hits > 0).length, [nodeSignals])
  const totalSignals = useMemo(() => nodeSignals.reduce((sum, node) => sum + node.hits, 0), [nodeSignals])
  const pulseBpm = useMemo(() => clampBpm(56 + totalSignals * 5 + activeNodeCount * 3), [totalSignals, activeNodeCount])
  const beatOn = beatFrame % 2 === 0

  function trackOccasional(placementId: string, minIntervalMs = 90_000) {
    const now = Date.now()
    const prev = lastTrackRef.current[placementId] || 0
    if (now - prev < minIntervalMs) return

    lastTrackRef.current[placementId] = now
    void trackEconomy({
      economy_code: 'CTR',
      slot: 'auth',
      placement_id: placementId,
      page: '/modules/social-intelligence',
      metadata: {
        module: 'social-intelligence',
      },
    })
  }

  useEffect(() => {
    if (status === 'unauthenticated') {
      trackOccasional('social-intelligence-auth-wall-view', 120_000)
      setAudioConsent(false)
    }
  }, [status])

  useEffect(() => {
    try {
      const storedConsent = localStorage.getItem(STORAGE_AUDIO_CONSENT_KEY)
      const storedMuted = localStorage.getItem(STORAGE_AMBIENT_MUTED_KEY)
      const storedPulse = localStorage.getItem(STORAGE_PULSE_ENABLED_KEY)

      if (storedConsent === 'true') setAudioConsent(true)
      if (storedConsent === 'false') setAudioConsent(false)
      if (storedMuted === 'true') setAmbientMuted(true)
      if (storedMuted === 'false') setAmbientMuted(false)
      if (storedPulse === 'true') setPulseEnabled(true)
      if (storedPulse === 'false') setPulseEnabled(false)
    } catch {
      // Ignore storage errors to keep UX functional.
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_AMBIENT_MUTED_KEY, String(ambientMuted))
    } catch {
      // Ignore storage errors to keep UX functional.
    }
  }, [ambientMuted])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PULSE_ENABLED_KEY, String(pulseEnabled))
    } catch {
      // Ignore storage errors to keep UX functional.
    }
  }, [pulseEnabled])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_AUDIO_CONSENT_KEY, String(audioConsent))
    } catch {
      // Ignore storage errors to keep UX functional.
    }
  }, [audioConsent])

  useEffect(() => {
    if (!isAuthenticated) return

    try {
      localStorage.setItem(STORAGE_REGISTERED_KEY, new Date().toISOString())

      const authSuccessTracked = localStorage.getItem(STORAGE_AUTH_SUCCESS_TRACKED_KEY)
      if (authSuccessTracked !== 'true') {
        void trackEconomy({
          economy_code: 'CTR',
          slot: 'auth',
          placement_id: 'social-intelligence-google-auth-success',
          page: '/modules/social-intelligence',
          metadata: {
            module: 'social-intelligence',
          },
        })
        localStorage.setItem(STORAGE_AUTH_SUCCESS_TRACKED_KEY, 'true')
      }
    } catch {
      // Ignore storage errors to keep UX functional.
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (results.length === 0) return

    setNodeHistory((prev) => {
      const next: Record<string, number[]> = { ...prev }
      for (const node of nodeSignals) {
        const series = next[node.id] || []
        next[node.id] = [...series, node.hits].slice(-16)
      }
      return next
    })
  }, [results, nodeSignals])

  useEffect(() => {
    if (!audioConsent) {
      if (pulseTimerRef.current !== null) {
        window.clearInterval(pulseTimerRef.current)
        pulseTimerRef.current = null
      }

      if (audioContextRef.current) {
        void audioContextRef.current.suspend()
      }

      return
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }

    void audioContextRef.current.resume()

    return () => {
      if (pulseTimerRef.current !== null) {
        window.clearInterval(pulseTimerRef.current)
        pulseTimerRef.current = null
      }
    }
  }, [audioConsent])

  useEffect(() => {
    if (!audioConsent || !pulseEnabled) {
      if (pulseTimerRef.current !== null) {
        window.clearInterval(pulseTimerRef.current)
        pulseTimerRef.current = null
      }
      return
    }

    const context = audioContextRef.current
    if (!context) return

    const beat = () => {
      const osc = context.createOscillator()
      const gain = context.createGain()

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(170 + totalSignals * 7, context.currentTime)
      gain.gain.setValueAtTime(0.0001, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.017, context.currentTime + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.09)

      osc.connect(gain)
      gain.connect(context.destination)
      osc.start(context.currentTime)
      osc.stop(context.currentTime + 0.1)
      setBeatFrame((frame) => frame + 1)
    }

    beat()

    pulseTimerRef.current = window.setInterval(() => {
      beat()
    }, Math.max(220, Math.floor(60000 / pulseBpm)))

    return () => {
      if (pulseTimerRef.current !== null) {
        window.clearInterval(pulseTimerRef.current)
        pulseTimerRef.current = null
      }
    }
  }, [audioConsent, pulseBpm, pulseEnabled, totalSignals])

  useEffect(() => {
    const el = ambientAudioRef.current
    if (!el) return

    if (!audioConsent) {
      el.pause()
      return
    }

    el.muted = ambientMuted
    const playPromise = el.play()
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        setError((prev) => prev || 'Ambient audio autoplay blocked by browser settings.')
      })
    }
  }, [audioConsent, ambientMuted])

  function pulseClass(hits: number): string {
    if (hits > 4) return 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200 animate-pulse'
    if (hits > 0) return 'border-amber-400/40 bg-amber-500/15 text-amber-100'
    return 'border-white/10 bg-white/5 text-white/60'
  }

  async function handleSearch(e: FormEvent) {
    e.preventDefault()
    if (!isAuthenticated) {
      setError('Please continue with Google to use Social Intelligence search.')
      trackOccasional('social-intelligence-unauth-search', 60_000)
      return
    }
    if (!query.trim()) return

    setLoading(true)
    setError('')
    setResults([])

    try {
      const res = await fetch('/api/ocean/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'search', query, mediaType }),
      })

      const json = await res.json()
      if (!res.ok || json.status !== 'ok') {
        setError(json.message || 'Search failed')
        return
      }

      setResults(Array.isArray(json.results) ? json.results : [])
    } catch {
      setError('Connection error while querying social media routes')
    } finally {
      setLoading(false)
    }
  }

  async function enableAudioExperience() {
    if (!isAuthenticated) {
      setError('Please continue with Google to enable the audio experience.')
      trackOccasional('social-intelligence-unauth-audio', 60_000)
      return
    }

    setAudioConsent(true)
    setAmbientMuted(true)
    setError('')

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }

    await audioContextRef.current.resume()
  }

  function nodeBeatStyle(hits: number): React.CSSProperties | undefined {
    if (hits <= 0) return undefined

    const intensity = Math.min(1, hits / 7)
    const glowAlpha = beatOn ? 0.12 + intensity * 0.2 : 0.08 + intensity * 0.12
    const glowRadius = beatOn ? 9 + hits * 2.3 : 6 + hits * 1.4
    const scale = beatOn ? 1.006 + intensity * 0.012 : 1

    return {
      boxShadow: `0 0 ${glowRadius}px rgba(56, 189, 248, ${glowAlpha})`,
      transform: `scale(${scale}) translateY(${beatOn ? '-1px' : '0px'})`,
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/modules" className="text-violet-400 hover:text-violet-300 transition-colors">
              ← Modules
            </Link>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <span className="text-3xl">📡</span> Social Intelligence
            </h1>
          </div>
          <span className="px-3 py-1 text-xs rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            Video • Image • Photo • Status
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <section className="mb-5 overflow-hidden rounded-2xl border border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-900/35 via-slate-900/65 to-indigo-900/35 p-4">
          <div className="grid gap-4 md:grid-cols-[1.25fr,1fr]">
            <div className="overflow-hidden rounded-xl border border-fuchsia-400/20 bg-black/40">
              {SOCIAL_DEMO_VIDEO ? (
                <video
                  src={SOCIAL_DEMO_VIDEO}
                  controls
                  preload="metadata"
                  poster={SOCIAL_HERO_IMAGE}
                  className="h-56 w-full object-cover md:h-72"
                />
              ) : (
                <img
                  src={SOCIAL_HERO_IMAGE}
                  alt="Social intelligence visual"
                  className="h-56 w-full object-cover md:h-72"
                />
              )}
            </div>
            <div className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">100% Audiovisual Product Direction</p>
              <h2 className="text-xl font-semibold text-white">Cross-platform social intelligence in motion</h2>
              <p className="text-sm text-gray-300">
                Social Intelligence is now framed as a media-native workspace with visual discovery, video-first comparison, and platform-ready story capture.
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-200">
                <span className="rounded-lg border border-fuchsia-400/20 bg-fuchsia-500/10 px-2 py-1">Video trend scan</span>
                <span className="rounded-lg border border-blue-400/20 bg-blue-500/10 px-2 py-1">Image signal map</span>
                <span className="rounded-lg border border-violet-400/20 bg-violet-500/10 px-2 py-1">Photo evidence</span>
                <span className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-2 py-1">Status pulse</span>
              </div>
              {SOCIAL_AMBIENT_AUDIO ? (
                <div className="rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-3 py-2">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Ambient audio channel</p>
                  <audio ref={ambientAudioRef} controls preload="none" loop autoPlay muted={ambientMuted} playsInline className="w-full">
                    <source src={SOCIAL_AMBIENT_AUDIO} />
                    Your browser does not support the audio element.
                  </audio>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {!audioConsent ? (
                      <button
                        type="button"
                        onClick={() => {
                          void enableAudioExperience()
                        }}
                        className="rounded-md border border-cyan-300/40 bg-cyan-500/20 px-3 py-1 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/30"
                      >
                        Enable audio experience
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setAmbientMuted((prev) => !prev)}
                          className="rounded-md border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/15"
                        >
                          {ambientMuted ? 'Unmute ambience' : 'Mute ambience'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPulseEnabled((prev) => !prev)}
                          className="rounded-md border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/15"
                        >
                          {pulseEnabled ? 'Pulse on' : 'Pulse off'}
                        </button>
                      </>
                    )}
                    <span className="text-xs text-cyan-100/85">Status pulse BPM: {pulseBpm}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-white/55">No ambient audio URL configured.</p>
              )}
            </div>
          </div>
        </section>

        <div className="mb-5 text-white/80">
          Search directly across YouTube, TikTok, Instagram, X, LinkedIn and Facebook with one query.
        </div>

        {!isAuthenticated ? (
          <div className="mb-5 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4">
            <p className="text-sm text-amber-100">Google authentication is required for this module.</p>
            <button
              type="button"
              onClick={() => {
                trackOccasional('social-intelligence-google-sign-in-click', 10_000)
                void signIn('google', { callbackUrl: '/modules/social-intelligence' })
              }}
              className="mt-3 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-slate-200"
            >
              Continue with Google
            </button>
          </div>
        ) : null}

        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search videos, photos, figures, posts, trends..."
              disabled={!isAuthenticated}
              className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={loading || !isAuthenticated}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-white font-medium transition-all"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {mediaTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setMediaType(type)}
                disabled={!isAuthenticated}
                className={`px-3 py-1.5 rounded-lg border text-sm transition ${
                  mediaType === type
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-white/5 border-white/20 text-white/80 hover:bg-white/10'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </form>

        <section className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-300">Image signal map</h3>
            <div className="text-xs text-white/70">Active nodes: {activeNodeCount}/6 | Total signals: {totalSignals}</div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {nodeSignals.map((node) => (
              <div key={node.id} className={`rounded-xl border p-3 transition duration-150 ${pulseClass(node.hits)}`} style={nodeBeatStyle(node.hits)}>
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/30 text-xs font-semibold tracking-wide">
                    {node.icon}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{node.label}</p>
                    <p className="text-xs opacity-80">{node.hits > 0 ? `${node.hits} live hits` : 'No live signal'}</p>
                  </div>
                </div>
                <div className="mt-2 rounded-md border border-white/10 bg-black/25 px-2 py-1">
                  <svg viewBox="0 0 92 28" className="h-7 w-full">
                    <polyline
                      fill="none"
                      stroke={beatOn ? '#67e8f9' : '#a5f3fc'}
                      strokeOpacity={beatOn ? 0.95 : 0.55}
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={sparklinePoints(nodeHistory[node.id]?.length ? nodeHistory[node.id] : [0, 0])}
                    />
                  </svg>
                </div>
                <p className="mt-2 text-xs opacity-85">{node.media.length > 0 ? node.media.join(' • ') : 'Awaiting node feed...'}</p>
              </div>
            ))}
          </div>
        </section>

        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {results.length > 0 && (
          <div className="mt-6 grid gap-3">
            {results.map((item) => (
              <a
                key={`${item.platform}-${item.url}`}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 rounded-xl bg-white/5 border border-white/10 hover:border-indigo-400 transition"
              >
                <div className="text-white font-medium">{item.platform.toUpperCase()}</div>
                <div className="text-xs text-indigo-300 uppercase tracking-wide mt-1">{item.mediaType}</div>
                <div className="text-sm text-white/70 mt-2 break-all">{item.url}</div>
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
