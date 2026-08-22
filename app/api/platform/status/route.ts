import { NextResponse } from 'next/server';
import os from 'node:os';

export const dynamic = 'force-dynamic';

const backendOrigin = process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:3001';

async function backendHealth() {
  const started = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_500);
  try {
    const response = await fetch(new URL('/api/health', backendOrigin), {
      cache: 'no-store',
      signal: controller.signal,
    });
    return {
      status: response.ok ? 'online' : 'degraded',
      responseMs: Math.round(performance.now() - started),
      httpStatus: response.status,
    };
  } catch {
    return { status: 'offline', responseMs: null, httpStatus: null };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  const totalMemory = os.totalmem();
  const usedMemory = totalMemory - os.freemem();
  const backend = await backendHealth();
  return NextResponse.json({
    ok: true,
    measuredAt: new Date().toISOString(),
    backend,
    system: {
      platform: os.platform(),
      hostname: os.hostname(),
      uptimeSeconds: os.uptime(),
      memoryUsedPercent: totalMemory > 0
        ? Number(((usedMemory / totalMemory) * 100).toFixed(2))
        : null,
      cpuLoadPercent: os.platform() === 'win32'
        ? null
        : Number(Math.min(100, (os.loadavg()[0] / Math.max(os.cpus().length, 1)) * 100).toFixed(2)),
    },
  });
}
