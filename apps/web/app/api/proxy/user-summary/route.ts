import { NextRequest, NextResponse } from 'next/server'
import { fetchFromCandidates } from "../../_lib/upstream";

async function fetchJsonForUser(path: string, userId: string) {
  const { response, source } = await fetchFromCandidates({
    group: "api",
    path,
    headers: {
      "X-User-ID": userId,
    },
  });
  const data = await response.json().catch(() => null);
  return { data, source };
}

function asObjects(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload.filter(
      (row): row is Record<string, unknown> =>
        Boolean(row) && typeof row === "object",
    );
  }
  if (Array.isArray((payload as { sources?: unknown[] } | null)?.sources)) {
    return (payload as { sources: unknown[] }).sources.filter(
      (row): row is Record<string, unknown> =>
        Boolean(row) && typeof row === "object",
    );
  }
  return [];
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get("X-User-ID") || "anonymous-user";
    const [sourcesResult, metricsResult, systemResult] =
      await Promise.allSettled([
        fetchJsonForUser("/api/user/data-sources", userId),
        fetchJsonForUser("/api/user/metrics", userId),
        fetchJsonForUser("/api/system-status", userId),
      ]);

    const sourcesPayload =
      sourcesResult.status === "fulfilled" ? sourcesResult.value.data : null;
    const metricsPayload =
      metricsResult.status === "fulfilled" ? metricsResult.value.data : null;
    const systemPayload =
      systemResult.status === "fulfilled" ? systemResult.value.data : null;

    const sources = asObjects(sourcesPayload);
    const metrics = asObjects(metricsPayload);

    const connectedSources = sources.filter((source) => {
      const status = String(source.status ?? "").toLowerCase();
      return status === "active" || status === "connected";
    }).length;

    const totalRequests = sources.reduce((sum, source) => {
      const value = Number(source.data_points ?? source.dataPoints ?? 0);
      return sum + (Number.isFinite(value) ? Math.max(0, value) : 0);
    }, 0);

    const latencies = metrics
      .map((metric) => Number(metric.latency_ms ?? metric.latency ?? null))
      .filter((value) => Number.isFinite(value) && value >= 0);
    const avgLatency =
      latencies.length > 0
        ? Math.round(
            latencies.reduce((sum, value) => sum + value, 0) / latencies.length,
          )
        : null;

    const system =
      systemPayload && typeof systemPayload === "object"
        ? ((systemPayload as { system?: Record<string, unknown> }).system ?? {})
        : {};

    const responseSource = {
      sources:
        sourcesResult.status === "fulfilled"
          ? sourcesResult.value.source
          : null,
      metrics:
        metricsResult.status === "fulfilled"
          ? metricsResult.value.source
          : null,
      system:
        systemResult.status === "fulfilled" ? systemResult.value.source : null,
    };

    return NextResponse.json({
      total_sources: sources.length,
      connected_sources: connectedSources,
      total_requests: totalRequests,
      requests_today: null,
      disk_used:
        typeof system.disk_percent === "number"
          ? `${system.disk_percent}%`
          : null,
      api_calls: metrics.length > 0 ? metrics.length : null,
      avg_latency: avgLatency,
      uptime:
        typeof (systemPayload as { uptime?: unknown } | null)?.uptime ===
        "string"
          ? (systemPayload as { uptime: string }).uptime
          : null,
      source: responseSource,
    });
  } catch (error) {
    console.error("User summary fetch error:", error);
    return NextResponse.json(
      {
        error: "User summary upstream is unavailable",
        details: error instanceof Error ? error.message : "unknown error",
      },
      { status: 503 },
    );
  }
}
