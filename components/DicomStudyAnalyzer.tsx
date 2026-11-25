'use client';

import React, { useState } from 'react';

export default function DicomStudyAnalyzer() {
  const [uid, setUid] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  async function analyze(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true); setError(null); setResult(null);
    try {
      const response = await fetch('/api/diagnostics/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ studyInstanceUid: uid }) });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || `Analysis failed (${response.status})`);
      setResult(payload.result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Diagnostics unavailable');
    } finally { setLoading(false); }
  }

  return (
    <section className="rounded-xl border border-gray-700 bg-black/40 p-5">
      <h3 className="mb-3 text-lg font-semibold">🔬 PACS/DICOM Study</h3>
      <form onSubmit={analyze} className="flex flex-col gap-3 md:flex-row">
        <input required value={uid} onChange={(e) => setUid(e.target.value)} placeholder="StudyInstanceUID" className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 font-mono" />
        <button disabled={loading} className="rounded-lg bg-blue-700 px-4 py-2 disabled:opacity-50">{loading ? 'Duke analizuar…' : 'Analizo nga PACS real'}</button>
      </form>
      {error ? <div className="mt-3 text-sm text-red-300">{error}</div> : null}
      {result ? <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-black p-3 text-xs text-gray-300">{JSON.stringify(result, null, 2)}</pre> : null}
    </section>
  );
}
