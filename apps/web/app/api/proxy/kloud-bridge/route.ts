import { NextResponse } from 'next/server'
import { fetchJsonFromCandidates } from "../../_lib/upstream";

export const dynamic = 'force-dynamic'

const ACTIVE_STATUS_KEYWORDS = [
  "active",
  "connected",
  "online",
  "healthy",
  "streaming",
  "running",
  "synced",
  "synchronized",
];

function looksActive(source: Record<string, unknown>): boolean {
  const status = `${source.status ?? source.state ?? ""}`.toLowerCase();
  if (ACTIVE_STATUS_KEYWORDS.some((keyword) => status.includes(keyword))) {
    return true;
  }

  const hasRecentData =
    source.last_data != null ||
    source.last_sync != null ||
    source.lastSeen != null ||
    source.last_seen != null ||
    source.updated_at != null;

  const pointsCandidates = [
    source.data_points,
    source.dataPoints,
    source.total_data_points,
    source.totalDataPoints,
    source.points,
  ];
  const hasPositivePoints = pointsCandidates.some((value) => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) && parsed > 0;
  });

  return hasRecentData || hasPositivePoints;
}

function getSourcePoints(source: Record<string, unknown>): number {
  const pointsCandidates = [
    source.data_points,
    source.dataPoints,
    source.total_data_points,
    source.totalDataPoints,
    source.points,
  ];

  for (const value of pointsCandidates) {
    const parsed = Number(value ?? 0);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return 0;
}

function normalizePercent(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.min(parsed, 100);
}

export async function GET() {
  const [systemSettled, dockerSettled, sourcesSettled] = await Promise.allSettled([
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

  const systemResult = systemSettled.status === "fulfilled" ? systemSettled.value : null;
  const dockerResult = dockerSettled.status === "fulfilled" ? dockerSettled.value : null;
  const sourcesResult = sourcesSettled.status === "fulfilled" ? sourcesSettled.value : null;

  const degradedReasons: string[] = [];
  if (!systemResult) degradedReasons.push("system-status unavailable");
  if (!dockerResult) degradedReasons.push("docker telemetry unavailable");
  if (!sourcesResult) degradedReasons.push("user data sources unavailable");

  const canRenderBridge = Boolean(systemResult || dockerResult);
  if (!canRenderBridge) {
    return NextResponse.json(
      {
        error: "Kloud Bridge data unavailable",
        status: "error",
        details: degradedReasons,
      },
      { status: 503 },
    )
  }

    const system =
      (systemResult?.data.system as Record<string, unknown> | undefined) || {};
    const dockerContainers = Array.isArray(dockerResult?.data.containers)
      ? dockerResult.data.containers
      : [];
    const totalContainers =
      typeof dockerResult?.data.total === "number"
        ? dockerResult.data.total
        : dockerContainers.length;
    const runningContainers =
      typeof dockerResult?.data.running === "number"
        ? dockerResult.data.running
        : dockerContainers.filter((container) => {
            const raw = `${(container as Record<string, unknown>)?.status ?? (container as Record<string, unknown>)?.state ?? ""}`.toLowerCase();
            return /(running|up|healthy)/.test(raw) && !/(exited|stopped|dead|unhealthy)/.test(raw);
          }).length;

    const rawSources = Array.isArray(sourcesResult?.data)
      ? sourcesResult.data
      : Array.isArray(sourcesResult?.data.sources)
        ? sourcesResult.data.sources
        : [];

    const sources = rawSources.filter(
      (source): source is Record<string, unknown> =>
        source != null && typeof source === "object",
    );

    const summaryActive = Number((sourcesResult?.data as Record<string, unknown> | undefined)?.active ?? 0);
    const derivedActive = sources.filter((source) => looksActive(source)).length;
    const activeSources = Number.isFinite(summaryActive) && summaryActive > 0
      ? Math.max(summaryActive, derivedActive)
      : derivedActive;

    const summaryTotalPoints = Number(
      (sourcesResult?.data as Record<string, unknown> | undefined)?.total_data_points ??
      (sourcesResult?.data as Record<string, unknown> | undefined)?.totalDataPoints ??
      0,
    );
    const derivedTotalPoints = sources.reduce((sum, source) => sum + getSourcePoints(source), 0);
    const totalDataPoints = Number.isFinite(summaryTotalPoints) && summaryTotalPoints > 0
      ? Math.max(summaryTotalPoints, derivedTotalPoints)
      : derivedTotalPoints;

    const bridgeStatus = "connected-monitored";
    const sovereignStatus = degradedReasons.length === 0 ? "ready" : "initializing";
    const allContainersHealthy =
      totalContainers > 0 && runningContainers >= totalContainers;
    const hasActiveStreams = activeSources > 0 || totalDataPoints > 0;
    const oceanStatus = hasActiveStreams ? "synchronized" : (sourcesResult ? "building" : "checking");
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
          : degradedReasons.length > 0
            ? "Connectivity live with partial telemetry"
            : allContainersHealthy
              ? "Connectivity live, awaiting data streams"
            : "Checking connectivity...",
        sync:
          oceanStatus === "synchronized"
            ? "Real-time synchronized"
            : oceanStatus === "checking"
              ? "Data sources telemetry unavailable"
            : "Awaiting active data sources",
        updates:
          typeof activityUpdates === "number"
            ? new Intl.NumberFormat("en", { notation: "compact" }).format(
                activityUpdates,
              )
            : "No data",
        uptime: (systemResult?.data.uptime as string | null | undefined) ?? null,
      },
      data_source: {
        system: systemResult?.source ?? null,
        docker: dockerResult?.source ?? null,
        user_data_sources: sourcesResult?.source ?? null,
      },
      degraded: degradedReasons.length > 0,
      degraded_reasons: degradedReasons,
      timestamp: new Date().toISOString(),
    });
}

