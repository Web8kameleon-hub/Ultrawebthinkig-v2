'use client';

import React, { useState } from 'react';

type VerifiedDoctor = { name: string | null; specialty: string | null; licenseNumber: string; expirationDate: string | null; verifiedAt: string };

export default function MedicalLicenseVerification() {
  const [form, setForm] = useState({ licenseNumber: '', doctorNid: '', email: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doctor, setDoctor] = useState<VerifiedDoctor | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true); setError(null); setDoctor(null);
    try {
      const response = await fetch('/api/verify-license', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) });
      const payload = await response.json();
      if (!response.ok || !payload.accessGranted) throw new Error(payload.error || `Verification failed (${response.status})`);
      setDoctor(payload.doctor);
      window.setTimeout(() => window.location.reload(), 800);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Registry unavailable');
    } finally { setLoading(false); }
  }

  return (
    <section className="rounded-xl border border-gray-700 bg-gray-900/60 p-5">
      <h3 className="mb-4 text-lg font-semibold text-emerald-400">🔐 Verifikim licence profesionale</h3>
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-3">
        <input aria-label="Numri i licencës" required value={form.licenseNumber} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })} placeholder="Numri i licencës" className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2" />
        <input aria-label="NID i mjekut" required value={form.doctorNid} onChange={(e) => setForm({ ...form, doctorNid: e.target.value })} placeholder="NID" className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2" />
        <input aria-label="Email profesional" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email profesional" className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2" />
        <button disabled={loading} className="rounded-lg bg-emerald-700 px-4 py-2 font-medium disabled:opacity-50 md:col-span-3">{loading ? 'Duke verifikuar…' : 'Verifiko me regjistrin real'}</button>
      </form>
      {error ? <div className="mt-3 rounded-lg border border-red-800 bg-red-950/30 p-3 text-sm text-red-300">{error}</div> : null}
      {doctor ? <div className="mt-3 rounded-lg border border-emerald-800 bg-emerald-950/30 p-3 text-sm text-emerald-200">Licencë aktive{doctor.name ? ` — ${doctor.name}` : ''}{doctor.specialty ? ` · ${doctor.specialty}` : ''}{doctor.expirationDate ? ` · skadon ${new Date(doctor.expirationDate).toLocaleDateString()}` : ''}</div> : null}
    </section>
  );
}
