import { NextResponse } from 'next/server'
import { fetchJsonFromCandidates } from "../../_lib/upstream";

export const dynamic = 'force-dynamic'

function normalizePercent(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.min(parsed, 100);
}

export async function GET() {
  try {
    const [systemResult, dockerResult, sourcesResult] = await Promise.all([
      fetchJsonFromCandidates<Record<string, unknown>>({
        group: "api",
        path: "/api/system-status",
      }),
      fetchJsonFromCandidates<Record<string, unknown>>({
        group: "reporting",
        path: "/api/reporting/docker-containers",
      }),
      fetchJsonFromCandidates<Record<string, unknown>>({
        group: "api",
        path: "/api/user/data-sources",
      }),
    ]);

    const system =
      (systemResult.data.system as Record<string, unknown> | undefined) || {};
    const dockerContainers = Array.isArray(dockerResult.data.containers)
      ? dockerResult.data.containers
      : [];
    const totalContainers =
      typeof dockerResult.data.total === "number"
        ? dockerResult.data.total
        : dockerContainers.length;
    const runningContainers =
      typeof dockerResult.data.running === "number"
        ? dockerResult.data.running
        : dockerContainers.filter((container) => {
            const raw = `${(container as Record<string, unknown>)?.status ?? (container as Record<string, unknown>)?.state ?? ""}`.toLowerCase();
            return /(running|up|healthy)/.test(raw) && !/(exited|stopped|dead|unhealthy)/.test(raw);
          }).length;

    const sources = Array.isArray(sourcesResult.data.sources)
      ? sourcesResult.data.sources
      : [];
    const activeSources = sources.filter((source) => {
      const status = `${(source as Record<string, unknown>)?.status ?? ""}`.toLowerCase();
      return status === "active";
    }).length;
    const totalDataPoints = sources.reduce((sum, source) => {
      const points = Number((source as Record<string, unknown>)?.data_points ?? 0);
      return Number.isFinite(points) && points > 0 ? sum + points : sum;
    }, 0);

    const bridgeStatus = "connected-monitored";
    const sovereignStatus = "ready";
    const allContainersHealthy =
      totalContainers > 0 && runningContainers >= totalContainers;
    const hasActiveStreams = activeSources > 0 || totalDataPoints > 0;
    const oceanStatus = hasActiveStreams ? "synchronized" : "building";
    const infraReady =
      bridgeStatus === "connected-monitored" &&
      sovereignStatus === "ready" &&
      allContainersHealthy &&
      hasActiveStreams;
    const readyStatus = infraReady ? "ready" : "almost";
    const cpuPercent = normalizePercent(
      system.cpu_percent,
    );
    const memoryPercent = normalizePercent(
      system.memory_percent,
    );
    const activityUpdates = totalDataPoints > 0 ? totalDataPoints : null;

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
          : allContainersHealthy
            ? "Connectivity live, awaiting data streams"
            : "Checking connectivity...",
        sync:
          oceanStatus === "synchronized"
            ? "Real-time synchronized"
            : "Awaiting active data sources",
        updates:
          typeof activityUpdates === "number"
            ? new Intl.NumberFormat("en", { notation: "compact" }).format(
                activityUpdates,
              )
            : "No data",
        uptime: (systemResult.data.uptime as string | null | undefined) ?? null,
      },
      data_source: {
        system: systemResult.source,
        docker: dockerResult.source,
        user_data_sources: sourcesResult.source,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Kloud Bridge data unavailable',
        status: 'error',
      },
      { status: 503 },
    )
  }
}

