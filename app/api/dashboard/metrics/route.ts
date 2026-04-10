import { NextResponse } from 'next/server';
import os from 'os';

// ── in-memory request counter (resets on cold start) ──────────────────────
let requestCount = 0;

// ── helpers ────────────────────────────────────────────────────────────────

async function fetchCrypto() {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd,eur',
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchWeather() {
  try {
    // Athens, GR – no API key required
    const res = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=37.98&longitude=23.73&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto',
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchNews() {
  try {
    const res = await fetch(
      'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=5',
      { next: { revalidate: 120 } }
    );
    if (!res.ok) return [];
    const json = await res.json();
    return (json.hits || []).map((h: { title?: string; url?: string; created_at?: string }) => ({
      title: h.title || '(no title)',
      source: h.url ? new URL(h.url).hostname : 'news.ycombinator.com',
      timestamp: h.created_at || new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

function getSystemInfo() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memoryPct = Math.round((usedMem / totalMem) * 100);

  // Load average (1-min) as CPU proxy; Windows always returns 0,0,0 — use 0 gracefully
  const load = os.loadavg()[0];
  const cpuCount = os.cpus().length || 1;
  const cpuPct = Math.min(100, Math.round((load / cpuCount) * 100));

  // Server uptime as % of 30 days (capped at 100)
  const uptimeSeconds = os.uptime();
  const thirtyDaySeconds = 30 * 24 * 3600;
  const uptimePct = Math.min(100, parseFloat(((uptimeSeconds / thirtyDaySeconds) * 100).toFixed(2)));
  const uptimeDays = parseFloat((uptimeSeconds / 86400).toFixed(1));

  return {
    cpu: cpuPct,
    memory: memoryPct,
    uptime: uptimeDays,
    uptimePct,
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    totalMemGB: (totalMem / 1073741824).toFixed(2),
    freeMemGB: (freeMem / 1073741824).toFixed(2),
    usedMemGB: (usedMem / 1073741824).toFixed(2),
  };
}

// ── route handler ──────────────────────────────────────────────────────────

export async function GET() {
  requestCount += 1;

  const [crypto, weather, latestScrapes] = await Promise.all([
    fetchCrypto(),
    fetchWeather(),
    fetchNews(),
  ]);

  const system = getSystemInfo();

  const payload = {
    scrapedData: latestScrapes.length,
    latestScrapes,
    requestCount,
    weather: weather
      ? {
          temperature: weather.current?.temperature_2m ?? null,
          humidity: weather.current?.relative_humidity_2m ?? null,
          windSpeed: weather.current?.wind_speed_10m ?? null,
          weatherCode: weather.current?.weather_code ?? null,
          timezone: weather.timezone ?? null,
        }
      : null,
    crypto,
    system,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json({ data: payload }, { status: 200 });
}
