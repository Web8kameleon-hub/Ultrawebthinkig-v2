'use client';

import React, { useEffect, useState } from 'react';

interface PatientRecord {
  id: string;
  name: string;
  age: number;
  condition: string;
  status: 'stable' | 'monitoring' | 'critical';
  lastUpdate: string;
}

const STATUS_COLOR: Record<PatientRecord['status'], string> = {
  stable: 'text-green-400 bg-green-400/10',
  monitoring: 'text-yellow-400 bg-yellow-400/10',
  critical: 'text-red-400 bg-red-400/10',
};

export default function AlbaMed() {
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [selected, setSelected] = useState<PatientRecord | null>(null);
  const [systemStatus, setSystemStatus] = useState<{ ai?: string; db?: string } | null>(null);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    fetch('/api/albamed')
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        const data = payload?.data;
        const records = Array.isArray(data?.patients) ? (data.patients as PatientRecord[]) : [];

        setPatients(records);
        setSystemStatus(data?.systemStatus ?? null);
        setHasData(records.length > 0 || !!data?.systemStatus);
      })
      .catch(() => {
        setPatients([]);
        setSystemStatus(null);
        setHasData(false);
      });
  }, []);

  const monitoringCount = patients.filter((patient) => patient.status === 'monitoring').length;
  const stableCount = patients.filter((patient) => patient.status === 'stable').length;

  return (
    <div className="space-y-6 text-white">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-emerald-400">🏥 AlbaMed Platform</h2>
          <p className="text-sm text-gray-400 mt-1">Sistemi i integruar i shëndetit digjital — vetëm data reale</p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400">
            {systemStatus?.ai ?? 'AI: no data'}
          </span>
          <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400">
            {systemStatus?.db ?? 'DB: no data'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pacientë aktivë', value: hasData ? String(patients.length) : 'no data' },
          { label: 'Monitorim', value: hasData ? String(monitoringCount) : 'no data' },
          { label: 'Stabil', value: hasData ? String(stableCount) : 'no data' },
        ].map((stat) => (
          <div key={stat.label} className="p-4 rounded-xl bg-gray-900/60 border border-gray-700">
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-xs text-gray-400 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {!hasData ? (
        <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-700 text-sm text-gray-300">
          no data
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-800">
                <tr>
                  {['ID', 'Emri', 'Mosha', 'Gjendja', 'Statusi', 'Ora'].map((header) => (
                    <th key={header} className="px-4 py-3 text-left text-gray-400 font-medium">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {patients.map((patient) => (
                  <tr
                    key={patient.id}
                    className="border-t border-gray-800 hover:bg-gray-800/50 cursor-pointer"
                    onClick={() => setSelected(selected?.id === patient.id ? null : patient)}
                  >
                    <td className="px-4 py-3 font-mono text-gray-500">{patient.id}</td>
                    <td className="px-4 py-3 font-medium">{patient.name}</td>
                    <td className="px-4 py-3 text-gray-400">{patient.age}</td>
                    <td className="px-4 py-3 text-gray-300">{patient.condition}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOR[patient.status]}`}>
                        {patient.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{patient.lastUpdate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selected && (
            <div className="p-4 rounded-xl bg-gray-800 border border-emerald-500/30">
              <h3 className="font-semibold text-emerald-400 mb-2">📋 Detajet — {selected.name}</h3>
              <div className="grid grid-cols-2 gap-2 text-sm text-gray-300">
                <span>ID: <strong>{selected.id}</strong></span>
                <span>Gjendja: <strong>{selected.condition}</strong></span>
                <span>
                  Statusi: <strong className={STATUS_COLOR[selected.status].split(' ')[0]}>{selected.status}</strong>
                </span>
                <span>Përditësim: <strong>{selected.lastUpdate}</strong></span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
