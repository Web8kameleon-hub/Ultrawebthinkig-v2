import { NextResponse } from 'next/server';
import os from 'os';
import { moduleCategories, getTotalModules, getActiveModules, getCategoryStats } from '../../../../lib/modules';

// In-memory counter (resets on deploy)
let requestCount = 0;

// Thresholds for dynamic evaluation
const THRESHOLDS = {
  highRiskLoad: 80,
  criticalRam: 90,
  lowUptimePct: 10, // % of 30 days
  newModuleWarn: 10,
  betaInProdWarn: 2,
  zeroActiveCatWarn: 0
} as const;

export async function GET() {
  requestCount += 1;

  // Get system metrics (reuse dashboard logic)
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const ramPct = Math.round((usedMem / totalMem) * 100);
  const load = os.loadavg()[0] || 0;
  const cpuCount = os.cpus().length || 1;
  const loadPct = Math.min(100, Math.round((load / cpuCount) * 100));
  const uptimeSeconds = os.uptime();
  const thirtyDaysSec = 30 * 24 * 3600;
  const uptimePct = Math.min(100, Math.round((uptimeSeconds / thirtyDaysSec) * 100));
  const uptimeDays = Math.round(uptimeSeconds / 86400 * 10) / 10;

  const totalModules = getTotalModules();
  const activeModules = getActiveModules();
  const activePct = Math.round((activeModules / totalModules) * 100);

  const categoryStats = getCategoryStats();

  // Dynamic risks (from prompt)
  const risks = [
    {
      risk: 'Crash nga high load + new modules',
      probability: loadPct > THRESHOLDS.highRiskLoad || activeModules < 30 ? 'Lartë' : 'Mesatar',
      impact: '🔴 I lartë',
      action: loadPct > 80 ? 'Auto-scaling + optimizim' : 'Monitor 24/7'
    },
    {
      risk: 'Tokyo Mesh (node-311) offline (NodeSMS)',
      probability: 'Lartë',
      impact: '🟡 Mesatar',
      action: 'Rinisje + retry logic'
    },
    {
      risk: 'RAM >90%',
      probability: ramPct > THRESHOLDS.criticalRam ? 'Lartë' : 'Mesatar',
      impact: ramPct > 90 ? '🔴 I lartë' : '🟡 Mesatar',
      action: 'Optimizim memory leaks'
    },
    {
      risk: 'Infrastructure 0% active',
      probability: categoryStats.find(c => c.id === 'infrastructure')?.pct === 0 ? 'Lartë' : 'Ulët',
      impact: '🔴 Kritik',
      action: 'Aktivizoni API Gateway'
    }
  ];

  // Weaknesses count
  const newModules = moduleCategories.reduce((acc, cat) => acc + cat.modules.filter(m => m.status === 'new').length, 0);
  const betaModules = moduleCategories.reduce((acc, cat) => acc + cat.modules.filter(m => m.status === 'beta').length, 0);
  const zeroCat = categoryStats.filter(c => c.pct === 0).length;

  // Score calculation (0-100 → grade)
  const score = Math.round(
    (activePct / 100 * 30) + // modules
    ((100 - ramPct) / 100 * 20) + // ram
    (uptimePct / 100 * 20) + // uptime
    (loadPct < 70 ? 20 : 0) + // load
    10 // base ASI
  );
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'C+' : 'D';

  const evaluation = {
    timestamp: new Date().toISOString(),
    summary: {
      totalModules,
      activeModules,
      activePct,
      systemLoad: loadPct,
      ramPct,
      uptimeDays,
      uptimePct,
      newModules,
      betaModules,
      zeroActiveCats: zeroCat
    },
    categoryStats,
    risks,
    strengths: [
      'Integrimi ASI ✅',
      `${activeModules} module aktive`,
      'LoRaWAN fallback (NodeSMS)',
      'Real APIs (Weather, Crypto, News)'
    ],
    weaknesses: [
      ...(loadPct > 80 ? [{ dobësi: 'System Load >80%', niveli: '🔴 Kritik', rekomandim: 'Shto burime' }] : []),
      ...(ramPct > 90 ? [{ dobësi: 'RAM >90%', niveli: '🔴 Kritik', rekomandim: 'Optimizim memory' }] : []),
      ...(newModules > 10 ? [{ dobësi: `${newModules} module të reja`, niveli: '🟡 Mesatar', rekomandim: 'Testo gradualisht' }] : []),
      ...(zeroCat > 0 ? [{ dobësi: `${zeroCat} kategori 0% aktive`, niveli: '🔴 Kritik', rekomandim: 'Aktivizo prioritar' }] : [])
    ],
    score: { value: score, grade, label: `${grade} (${score}/100)` },
    recommendations: {
      urgent24h: ['Ul RAM/load', 'Aktivizo API Gateway', 'Rinis node-311'],
      next48h: ['Test new modules', 'Auto health checks'],
      scoreImprove: score < 80 ? ['>80% active modules', '<70% load'] : []
    }
  };

  return NextResponse.json({ data: evaluation, requestCount }, { status: 200 });
}
