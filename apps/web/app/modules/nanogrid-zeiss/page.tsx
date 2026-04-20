"use client";

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Brain, Camera, Zap, Gauge, ArrowRight, Activity } from 'lucide-react';

const presets = [
  {
    title: 'Neural Synthesis • 2026 Ultra Mode',
    description: 'ZEISS ultra camera + voice-assisted neural analysis with high-fidelity precision.',
    topic: 'Run NanoGrid-ZEISS 2026 ultra analysis for Neural Synthesis with camera, microphone, and document fusion',
  },
  {
    title: 'ALBI EEG • 2026 Clinical Ultra',
    description: 'Clinical-grade multimodal inspection for EEG quality, artifacts, and guided conversation.',
    topic: 'Run NanoGrid-ZEISS 2026 clinical ultra analysis for ALBI EEG quality, artifact detection, and guided voice review',
  },
  {
    title: 'Fitness Dashboard • 2026 Athlete Ultra',
    description: 'Motion, posture, and vocal coaching pipeline tuned for athlete performance review.',
    topic: 'Run NanoGrid-ZEISS 2026 athlete ultra analysis for Fitness Dashboard using camera and microphone intelligence',
  },
];

type HealthPayload = {
  status?: string;
  active_sessions?: number;
  timestamp?: string;
};

type SessionMetricsPayload = {
  quality_score?: number;
  dominant_band?: string;
  dominant_band_power?: number;
  duration_seconds?: number;
  samples_received?: number;
  channels_count?: number;
  state_interpretation?: string;
};

export default function NanoGridZeissPage() {
  const [profile, setProfile] = useState<'balanced' | 'clinical' | 'athlete'>('balanced');
  const [intensity, setIntensity] = useState(92);
  const [precision, setPrecision] = useState(97);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [isStoppingSession, setIsStoppingSession] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [serviceHealth, setServiceHealth] = useState<HealthPayload | null>(null);
  const [sessionMetrics, setSessionMetrics] = useState<SessionMetricsPayload | null>(null);

  const ALBI_API_BASE = '/api/albi-user';

  const resolvedProfileLabel = useMemo(() => {
    if (profile === 'clinical') return 'Clinical';
    if (profile === 'athlete') return 'Athlete';
    return 'Balanced';
  }, [profile]);

  const buildPresetHref = (topic: string) => {
    const params = new URLSearchParams({
      topic,
      lang: 'auto',
      intensity: String(intensity),
      precision: String(precision),
      profile,
      mode: 'limit',
      vision: 'zeiss_ultra',
      grid: 'nanogrid_plus',
    });

    return `/modules/curiosity-ocean?${params.toString()}`;
  };

  const fetchServiceHealth = useCallback(async () => {
    try {
      const response = await fetch(`${ALBI_API_BASE}/health`, { cache: 'no-store' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.detail || payload?.error || `ALBI health failed (${response.status})`);
      }

      const payload: HealthPayload = await response.json();
      setServiceHealth(payload);
      setStatusError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch ALBI health';
      setStatusError(message);
    }
  }, []);

  const fetchSessionMetrics = useCallback(async (activeSessionId: string) => {
    try {
      const response = await fetch(`${ALBI_API_BASE}/session/${activeSessionId}/metrics`, { cache: 'no-store' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.detail || payload?.error || `Session metrics failed (${response.status})`);
      }

      const payload: SessionMetricsPayload = await response.json();
      setSessionMetrics(payload);
      setSessionError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch session metrics';
      setSessionError(message);
    }
  }, []);

  const startAlbiSession = useCallback(async () => {
    setIsStartingSession(true);
    setSessionError(null);

    try {
      const params = new URLSearchParams({
        user_id: 'nanogrid_zeiss_operator',
        session_name: `NanoGrid-${resolvedProfileLabel}`,
      });

      const response = await fetch(`${ALBI_API_BASE}/session/start?${params.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.detail || payload?.error || `Failed to start ALBI session (${response.status})`);
      }

      const payload = await response.json();
      const nextSessionId = payload?.session_id as string | undefined;
      if (!nextSessionId) throw new Error('ALBI start response missing session_id');

      setSessionId(nextSessionId);
      await fetchSessionMetrics(nextSessionId);
      await fetchServiceHealth();
    } catch (err) {
      setSessionError(err instanceof Error ? err.message : 'Failed to start ALBI session');
    } finally {
      setIsStartingSession(false);
    }
  }, [ALBI_API_BASE, fetchServiceHealth, fetchSessionMetrics, resolvedProfileLabel]);

  const stopAlbiSession = useCallback(async () => {
    if (!sessionId) return;

    setIsStoppingSession(true);
    setSessionError(null);

    try {
      const response = await fetch(`${ALBI_API_BASE}/session/${sessionId}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.detail || payload?.error || `Failed to stop ALBI session (${response.status})`);
      }

      setSessionId(null);
      setSessionMetrics(null);
      await fetchServiceHealth();
    } catch (err) {
      setSessionError(err instanceof Error ? err.message : 'Failed to stop ALBI session');
    } finally {
      setIsStoppingSession(false);
    }
  }, [ALBI_API_BASE, fetchServiceHealth, sessionId]);

  useEffect(() => {
    fetchServiceHealth();
    const interval = setInterval(fetchServiceHealth, 10000);
    return () => clearInterval(interval);
  }, [fetchServiceHealth]);

  useEffect(() => {
    if (!sessionId) return;
    fetchSessionMetrics(sessionId);
    const interval = setInterval(() => fetchSessionMetrics(sessionId), 2000);
    return () => clearInterval(interval);
  }, [fetchSessionMetrics, sessionId]);

  const serviceOnline = serviceHealth?.status === 'operational';
  const canStart = serviceOnline && !sessionId && !isStartingSession;
  const canStop = !!sessionId && !isStoppingSession;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        <header className="rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-violet-500/10 p-6">
          <div className="flex items-center gap-3 text-cyan-300">
            <Brain className="h-6 w-6" />
            <span className="text-sm font-semibold tracking-wide">NANOGRID PLUS ZEISS</span>
          </div>
          <h1 className="mt-3 text-3xl font-bold">NanoGrid + ZEISS 2026 Ultra Control</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Unified launch surface to run NanoGrid-ZEISS 2026 ultra workflows with camera, microphone, document intelligence, and real-time guided conversation.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-2 py-1">ZEISS Vision Ultra</span>
            <span className="rounded-lg border border-violet-400/40 bg-violet-500/10 px-2 py-1">2450px+</span>
            <span className="rounded-lg border border-blue-400/40 bg-blue-500/10 px-2 py-1">2026 Ultra Mode Active</span>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-xl border border-slate-700 bg-slate-900/80 p-4">
            <div className="flex items-center gap-2 text-cyan-300">
              <Camera className="h-4 w-4" />
              <h2 className="text-sm font-semibold">Vision Stack</h2>
            </div>
            <p className="mt-2 text-sm text-slate-300">Adaptive high-resolution capture with ZEISS-oriented routing through Curiosity Ocean.</p>
          </article>
          <article className="rounded-xl border border-slate-700 bg-slate-900/80 p-4">
            <div className="flex items-center gap-2 text-violet-300">
              <Zap className="h-4 w-4" />
              <h2 className="text-sm font-semibold">Neural Orchestration</h2>
            </div>
            <p className="mt-2 text-sm text-slate-300">One-click launch presets for Neural Synthesis, ALBI EEG, and Fitness workflows.</p>
          </article>
          <article className="rounded-xl border border-slate-700 bg-slate-900/80 p-4">
            <div className="flex items-center gap-2 text-emerald-300">
              <Gauge className="h-4 w-4" />
              <h2 className="text-sm font-semibold">Performance Focus</h2>
            </div>
            <p className="mt-2 text-sm text-slate-300">Designed for aggressive quality targets with production-safe routing and fallbacks.</p>
          </article>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">ALBI Service Status</h2>
              <span className={`text-xs font-semibold ${serviceOnline ? 'text-emerald-300' : 'text-red-300'}`}>
                {serviceOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
            <div className="mt-3 space-y-1 text-sm text-slate-200">
              <p>Status: {serviceHealth?.status || 'unknown'}</p>
              <p>Active Sessions: {serviceHealth?.active_sessions ?? '—'}</p>
              <p>Updated: {serviceHealth?.timestamp ? new Date(serviceHealth.timestamp).toLocaleString() : '—'}</p>
            </div>
            {statusError && <p className="mt-3 text-xs text-red-300">{statusError}</p>}
          </article>

          <article className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">EEG Session Control</h2>
              <span className="text-xs text-cyan-200">{sessionId ? `Session: ${sessionId}` : 'No active session'}</span>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={startAlbiSession}
                disabled={!canStart}
                className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isStartingSession ? 'Starting...' : 'Start Session'}
              </button>
              <button
                onClick={stopAlbiSession}
                disabled={!canStop}
                className="rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isStoppingSession ? 'Stopping...' : 'Stop Session'}
              </button>
            </div>
            {sessionError && <p className="mt-3 text-xs text-red-300">{sessionError}</p>}
          </article>
        </section>

        <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-violet-300" />
            <h2 className="text-base font-semibold">Live ALBI EEG Metrics</h2>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm">
            <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-3">
              <div className="text-slate-400 text-xs">Quality Score</div>
              <div className="mt-1 text-lg font-semibold">{sessionMetrics?.quality_score ?? '—'}</div>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-3">
              <div className="text-slate-400 text-xs">Dominant Band</div>
              <div className="mt-1 text-lg font-semibold">{sessionMetrics?.dominant_band || '—'}</div>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-3">
              <div className="text-slate-400 text-xs">Band Power</div>
              <div className="mt-1 text-lg font-semibold">{sessionMetrics?.dominant_band_power ?? '—'}</div>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-3">
              <div className="text-slate-400 text-xs">Duration (sec)</div>
              <div className="mt-1 text-lg font-semibold">{sessionMetrics?.duration_seconds ?? '—'}</div>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-3">
              <div className="text-slate-400 text-xs">Samples</div>
              <div className="mt-1 text-lg font-semibold">{sessionMetrics?.samples_received ?? '—'}</div>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-3">
              <div className="text-slate-400 text-xs">Channels</div>
              <div className="mt-1 text-lg font-semibold">{sessionMetrics?.channels_count ?? '—'}</div>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">{sessionMetrics?.state_interpretation || 'Start a real ALBI session to stream live metrics here.'}</p>
        </section>

        <section className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-5">
          <h2 className="text-base font-semibold">Limit Controls</h2>
          <p className="mt-1 text-xs text-slate-300">Set active profile and precision envelope before launching a preset.</p>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="space-y-1">
              <span className="text-xs text-slate-300">Profile</span>
              <select
                value={profile}
                onChange={(event) => setProfile(event.target.value as 'balanced' | 'clinical' | 'athlete')}
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
              >
                <option value="balanced">Balanced</option>
                <option value="clinical">Clinical</option>
                <option value="athlete">Athlete</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs text-slate-300">Intensity ({intensity})</span>
              <input
                type="range"
                min={60}
                max={100}
                step={1}
                value={intensity}
                onChange={(event) => setIntensity(Number(event.target.value))}
                className="w-full"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-slate-300">Precision ({precision})</span>
              <input
                type="range"
                min={70}
                max={100}
                step={1}
                value={precision}
                onChange={(event) => setPrecision(Number(event.target.value))}
                className="w-full"
              />
            </label>
          </div>

          <div className="mt-4 text-xs text-violet-200">
            Active Mode: {resolvedProfileLabel} • Intensity {intensity} • Precision {precision}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Launch Presets</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {presets.map((preset) => (
              <Link
                key={preset.title}
                href={buildPresetHref(preset.topic)}
                className="group rounded-xl border border-slate-700 bg-slate-900 p-4 hover:border-cyan-400/60 hover:bg-slate-900/80"
              >
                <h3 className="text-sm font-semibold text-slate-100">{preset.title}</h3>
                <p className="mt-2 text-xs text-slate-300">{preset.description}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-cyan-300">
                  Open preset <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
