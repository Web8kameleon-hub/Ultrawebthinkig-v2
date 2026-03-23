"use client";

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Brain, Camera, Zap, Gauge, ArrowRight } from 'lucide-react';

const presets = [
  {
    title: 'Neural Synthesis • Limit Mode',
    description: 'Ultra-precision visual readout for waveform + session quality.',
    topic: 'Run NanoGrid Plus ZEISS analysis for Neural Synthesis with maximum precision',
  },
  {
    title: 'ALBI EEG • Limit Mode',
    description: 'High-resolution inspection for EEG signal quality and artifacts.',
    topic: 'Run NanoGrid Plus ZEISS analysis for ALBI EEG signal quality and artifact detection',
  },
  {
    title: 'Fitness Dashboard • Limit Mode',
    description: 'Motion and posture-centric ZEISS review for training sessions.',
    topic: 'Run NanoGrid Plus ZEISS analysis for Fitness Dashboard training session quality',
  },
];

export default function NanoGridZeissPage() {
  const [profile, setProfile] = useState<'balanced' | 'clinical' | 'athlete'>('balanced');
  const [intensity, setIntensity] = useState(92);
  const [precision, setPrecision] = useState(97);

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

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        <header className="rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-violet-500/10 p-6">
          <div className="flex items-center gap-3 text-cyan-300">
            <Brain className="h-6 w-6" />
            <span className="text-sm font-semibold tracking-wide">NANOGRID PLUS ZEISS</span>
          </div>
          <h1 className="mt-3 text-3xl font-bold">NanoGrid + ZEISS Base Control</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Unified launch surface to run ZEISS Vision Ultra workflows at maximum operational limits across neural, EEG, and training modules.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-2 py-1">ZEISS Vision Ultra</span>
            <span className="rounded-lg border border-violet-400/40 bg-violet-500/10 px-2 py-1">2450px+</span>
            <span className="rounded-lg border border-blue-400/40 bg-blue-500/10 px-2 py-1">Limit Mode Active</span>
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
