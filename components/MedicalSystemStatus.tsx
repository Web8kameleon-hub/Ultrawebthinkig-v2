'use client';

import React, { useCallback, useEffect, useState } from 'react';

type MedicalSystem = { id: string; name: string; status: string; accuracy: number | null; description: string | null; lastUpdate: string | null };

export default function MedicalSystemStatus() {
  const [systems, setSystems] = useState<MedicalSystem[]>([]);
  const [state, setState] = useState<'loading' | 'online' | 'unavailable'>('loading');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/agi-systems', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || `Status request failed (${response.status})`);
      setSystems(Array.isArray(payload.systems) ? payload.systems : []);
      setState('online');
      setError(null);
    } catch (cause) {
      setSystems([]);
      setState('unavailable');
      setError(cause instanceof Error ? cause.message : 'AGI Med service unavailable');
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">🧠 Sistemet AGI×Med</h3>
        <span className={`text-xs ${state === 'online' ? 'text-emerald-400' : state === 'loading' ? 'text-yellow-400' : 'text-red-400'}`}>{state}</span>
      </div>
      {error ? <div className="rounded-lg border border-red-800 bg-red-950/30 p-3 text-sm text-red-300">{error}</div> : null}
      {state === 'loading' ? <div className="rounded-lg border border-gray-700 p-3 text-sm text-gray-400">Duke lexuar statusin real…</div> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {systems.map((system) => (
          <div key={system.id} className="rounded-xl border border-gray-700 bg-gray-900/60 p-4">
            <div className="flex justify-between gap-3"><strong>{system.name}</strong><span className="text-xs text-gray-300">{system.status}</span></div>
            {system.description ? <p className="mt-2 text-sm text-gray-400">{system.description}</p> : null}
            <div className="mt-2 flex justify-between text-xs text-gray-500">
              <span>{system.accuracy === null ? 'Accuracy: unavailable' : `Accuracy: ${system.accuracy}%`}</span>
              <span>{system.lastUpdate ? new Date(system.lastUpdate).toLocaleString() : 'No timestamp'}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
