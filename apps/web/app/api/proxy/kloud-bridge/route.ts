import { NextResponse } from "next/server";
import { fetchJsonFromCandidates } from "../../_lib/upstream";

export const dynamic = "force-dynamic";

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

async function fetchBridgeStatusFromWeb() {
  const internalBase =
    process.env.WEB_INTERNAL_URL?.trim().replace(/\/+$/, "") ||
    "http://127.0.0.1:3000";
  const source = `${internalBase}/api/kloud-bridge/status`;

  const response = await fetch(source, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`${source} -> ${response.status}`);
  }

  try {
    const data = (await response.json()) as Record<string, unknown>;
    return { data, source };
  } catch {
    throw new Error(`${source} -> invalid JSON payload`);
  }
}

export async function GET() {
  const [bridgeSettled, systemSettled, dockerSettled, sourcesSettled] =
    await Promise.allSettled([
      fetchBridgeStatusFromWeb(),
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
        path: "/api/mymirror/data-sources",
      }),
    ]);

  const bridgeResult =
    bridgeSettled.status === "fulfilled" ? bridgeSettled.value : null;
  const systemResult =
    systemSettled.status === "fulfilled" ? systemSettled.value : null;
  const dockerResult =
    dockerSettled.status === "fulfilled" ? dockerSettled.value : null;
  const sourcesResult =
    sourcesSettled.status === "fulfilled" ? sourcesSettled.value : null;

  const degradedReasons: string[] = [];
  if (!bridgeResult) degradedReasons.push("kloud-bridge status unavailable");
  if (!systemResult) degradedReasons.push("system-status unavailable");
  if (!dockerResult) degradedReasons.push("docker telemetry unavailable");
  if (!sourcesResult) degradedReasons.push("mymirror data sources unavailable");

  const canRenderBridge = Boolean(bridgeResult || systemResult || dockerResult);
  if (!canRenderBridge) {
    return NextResponse.json(
      {
        error: "Kloud Bridge data unavailable",
        status: "error",
        details: degradedReasons,
      },
      { status: 503 },
    );
  }

  const bridgeData =
    (bridgeResult?.data as Record<string, unknown> | undefined) || {};
  const bridgeSummary =
    (bridgeData.summary as Record<string, unknown> | undefined) || {};
  const bridgeServiceTruth =
    (bridgeData.service_truth as Record<string, unknown> | undefined) ||
    (bridgeSummary.service_truth as Record<string, unknown> | undefined) ||
    {};
  const hardware =
    (bridgeData.hardware as Record<string, unknown> | undefined) || {};
  const hardwareSummary =
    (hardware.summary as Record<string, unknown> | undefined) ||
    (bridgeSummary.hardware_nodes as Record<string, unknown> | undefined) ||
    {};

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
          const raw =
            `${(container as Record<string, unknown>)?.status ?? (container as Record<string, unknown>)?.state ?? ""}`.toLowerCase();
          return (
            /(running|up|healthy)/.test(raw) &&
            !/(exited|stopped|dead|unhealthy)/.test(raw)
          );
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

  const summaryActive = Number(
    (sourcesResult?.data as Record<string, unknown> | undefined)?.active ?? 0,
  );
  const derivedActive = sources.filter((source) => looksActive(source)).length;
  const onlineNodes = Number(hardwareSummary.online_nodes ?? 0);
  const registeredNodes = Number(hardwareSummary.registered_nodes ?? 0);
  const activeSources =
    Number.isFinite(summaryActive) && summaryActive > 0
      ? Math.max(summaryActive, derivedActive, onlineNodes)
      : Math.max(derivedActive, onlineNodes);

  const summaryTotalPoints = Number(
    (sourcesResult?.data as Record<string, unknown> | undefined)
      ?.total_data_points ??
      (sourcesResult?.data as Record<string, unknown> | undefined)
        ?.totalDataPoints ??
      0,
  );
  const derivedTotalPoints = sources.reduce(
    (sum, source) => sum + getSourcePoints(source),
    0,
  );
  const bridgePulses = Number(hardwareSummary.total_pulses ?? 0);
  const totalDataPoints =
    Number.isFinite(summaryTotalPoints) && summaryTotalPoints > 0
      ? Math.max(summaryTotalPoints, derivedTotalPoints, bridgePulses)
      : Math.max(derivedTotalPoints, bridgePulses);

  const bridgeConnectivity =
    `${bridgeData.availability ?? bridgeSummary.connectivity ?? bridgeServiceTruth.connectivity ?? "unknown"}`.toLowerCase();
  const bridgeState =
    `${bridgeSummary.state ?? bridgeServiceTruth.state ?? bridgeData.state ?? "unknown"}`.toLowerCase();
  const bridgeSync =
    `${bridgeSummary.sync_status ?? bridgeServiceTruth.sync_status ?? "unknown"}`.toLowerCase();
  const bridgeProofOfLife =
    `${hardwareSummary.proof_of_life ?? bridgeServiceTruth.proof_of_life ?? "unknown"}`.toLowerCase();
  const hardwareHealth =
    `${hardwareSummary.network_health ?? bridgeServiceTruth.hardware_network_health ?? "unknown"}`.toLowerCase();

  const bridgeStatus =
    bridgeConnectivity === "connected"
      ? "connected-monitored"
      : bridgeConnectivity === "degraded"
        ? "checking"
        : "error";
  const sovereignStatus =
    bridgeState === "ready"
      ? "ready"
      : bridgeConnectivity === "connected"
        ? "initializing"
        : "checking";
  const allContainersHealthy =
    totalContainers > 0 && runningContainers >= totalContainers;
  const hasActiveStreams = activeSources > 0 || totalDataPoints > 0;
  const oceanStatus =
    bridgeSync === "synchronized"
      ? "synchronized"
      : hasActiveStreams
        ? "synchronized"
        : bridgeResult
          ? "building"
          : "checking";
  const infraReady =
    bridgeConnectivity === "connected" &&
    bridgeState === "ready" &&
    (totalContainers === 0 || allContainersHealthy);
  const readyStatus = infraReady ? "ready" : "almost";
  const cpuPercent = normalizePercent(system.cpu_percent);
  const memoryPercent = normalizePercent(system.memory_percent);
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
        : bridgeConnectivity === "connected"
          ? "Connectivity live"
          : degradedReasons.length > 0
            ? "Connectivity live with partial telemetry"
            : allContainersHealthy
              ? "Connectivity live, awaiting data streams"
              : "Checking connectivity...",
      sync:
        bridgeSync === "synchronized"
          ? hasActiveStreams
            ? "Real-time synchronized"
            : registeredNodes > 0
              ? "Bridge synchronized, awaiting live pulses"
              : hardwareHealth === "no-nodes"
                ? "Bridge synchronized, no hardware nodes registered"
                : bridgeProofOfLife === "pending"
                  ? "Bridge synchronized, proof-of-life pending"
                  : "Bridge synchronized"
          : oceanStatus === "checking"
            ? "Data sources telemetry unavailable"
            : "Awaiting active data sources",
      updates:
        typeof activityUpdates === "number"
          ? new Intl.NumberFormat("en", { notation: "compact" }).format(
              activityUpdates,
            )
          : registeredNodes > 0
            ? "No pulses yet"
            : "No data",
      uptime: (systemResult?.data.uptime as string | null | undefined) ?? null,
    },
    data_source: {
      bridge_status: bridgeResult?.source ?? null,
      system: systemResult?.source ?? null,
      docker: dockerResult?.source ?? null,
      mymirror_data_sources: sourcesResult?.source ?? null,
    },
    hardware: {
      registered_nodes: Number.isFinite(registeredNodes) ? registeredNodes : 0,
      online_nodes: Number.isFinite(onlineNodes) ? onlineNodes : 0,
      total_pulses: Number.isFinite(bridgePulses) ? bridgePulses : 0,
      proof_of_life: bridgeProofOfLife,
      network_health: hardwareHealth,
    },
    degraded: degradedReasons.length > 0,
    degraded_reasons: degradedReasons,
    timestamp: new Date().toISOString(),
  });
}
