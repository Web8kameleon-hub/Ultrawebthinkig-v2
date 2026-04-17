import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function normalizePercent(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.min(parsed, 100);
}

async function fetchFromProxy(path: string) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/proxy/${path}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' }
  })
  return response.ok ? response.json() : null
}

async function fetchFromApi(path: string) {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/${path}`,
    {
      cache: "no-store",
      headers: { Accept: "application/json" },
    },
  );
  return response.ok ? response.json() : null;
}

export async function GET() {
  try {
    const [system, docker, live, sources] = await Promise.all([
      fetchFromProxy("system-metrics"),
      fetchFromProxy("docker-containers"),
      fetchFromApi("mymirror/live-metrics"),
      fetchFromApi("mymirror/data-sources"),
    ]);

    // Friendly transformation for UI
    const bridgeStatus = system && docker ? 'connected-monitored' : 'checking'
    const sovereignStatus = live?.system ? "ready" : "initializing";
    const totalDataPoints = Number(live?.stats?.total_data_points || 0)
    const activeSources = Number(
      live?.stats?.active_sources ??
        live?.stats?.data_sources_count ??
        sources?.active ??
        sources?.stats?.active_sources ??
        0,
    );
    const runningContainers = Number(
      docker?.running ?? live?.system?.active_containers ?? 0,
    );
    const totalContainers = Number(
      docker?.total ?? live?.system?.containers ?? 0,
    );
    const allContainersHealthy =
      totalContainers > 0 && runningContainers >= totalContainers;
    const oceanStatus =
      activeSources > 0 || totalDataPoints > 0 ? "synchronized" : "building";
    const infraReady =
      bridgeStatus === "connected-monitored" &&
      sovereignStatus === "ready" &&
      allContainersHealthy;
    const readyStatus = infraReady ? "ready" : "almost";
    const cpuPercent = normalizePercent(
      system?.cpu_percent ?? live?.system?.cpu ?? 0,
    );
    const memoryPercent = normalizePercent(
      system?.memory_percent ?? live?.system?.memory ?? 0,
    );

    // Real-data-first metric: use live data points, then deterministic fallback.
    const activityUpdates = totalDataPoints > 0
      ? totalDataPoints
      : (activeSources * runningContainers)

    return NextResponse.json({
      status: {
        bridge: bridgeStatus,
        sovereign: sovereignStatus,
        ocean: oceanStatus,
        ready: readyStatus,
      },
      metrics: {
        activity_updates: activityUpdates,
        containers_running: runningContainers,
        containers_total: totalContainers,
        data_sources_active: activeSources,
        system_cpu: cpuPercent,
        system_memory: memoryPercent,
      },
      human_readable: {
        status: infraReady
          ? "Connected and monitored"
          : "Checking connectivity...",
        sync:
          oceanStatus === "synchronized"
            ? "Real-time synchronized"
            : "Awaiting active data sources",
        updates: new Intl.NumberFormat("en", { notation: "compact" }).format(
          activityUpdates,
        ),
        uptime: system?.uptime || "Live",
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: 'Kloud Bridge data unavailable', status: 'error' }, { status: 503 })
  }
}

