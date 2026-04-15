import { NextResponse } from 'next/server'

export const dynamic = "force-dynamic";

const DEFAULT_API_BASE =
  process.env.NODE_ENV === "production"
    ? "http://clisonix-api:8000"
    : "http://127.0.0.1:8000";
const DEFAULT_REPORTING_BASE =
  process.env.NODE_ENV === "production"
    ? "http://clisonix-reporting:8001"
    : "http://127.0.0.1:8001";

function normalizeBaseUrl(value?: string | null) {
  return value?.trim().replace(/\/+$/, "") || null;
}

function toNullableNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const API_CANDIDATES = Array.from(
  new Set(
    [
      normalizeBaseUrl(process.env.API_INTERNAL_URL),
      DEFAULT_API_BASE,
      process.env.NODE_ENV === "production" ? "http://localhost:8000" : null,
    ].filter((value): value is string => Boolean(value)),
  ),
);

const REPORTING_CANDIDATES = Array.from(
  new Set(
    [
      normalizeBaseUrl(process.env.REPORTING_INTERNAL_URL),
      normalizeBaseUrl(process.env.API_INTERNAL_URL),
      DEFAULT_REPORTING_BASE,
      DEFAULT_API_BASE,
      process.env.NODE_ENV === "production" ? "http://localhost:8001" : null,
      process.env.NODE_ENV === "production" ? "http://localhost:8000" : null,
    ].filter((value): value is string => Boolean(value)),
  ),
);

async function fetchJsonFromCandidates(path: string, candidates: string[]) {
  let lastError = `No source responded for ${path}`;

  for (const base of candidates) {
    const target = `${base}${path}`;
    try {
      const res = await fetch(target, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        next: { revalidate: 0 },
      });

      if (!res.ok) {
        lastError = `${target} -> ${res.status}`;
        continue;
      }

      return await res.json();
    } catch (error) {
      lastError = `${target} -> ${error instanceof Error ? error.message : "unknown error"}`;
    }
  }

  throw new Error(lastError);
}

export async function GET() {
  try {
    const [statusData, dockerData] = await Promise.all([
      fetchJsonFromCandidates("/api/system-status", API_CANDIDATES),
      fetchJsonFromCandidates(
        "/api/reporting/docker-containers",
        REPORTING_CANDIDATES,
      ).catch(() => null),
    ]);

    const system = statusData?.system || {};
    const containerList = Array.isArray(dockerData?.containers)
      ? dockerData.containers
      : [];
    const totalContainers =
      typeof dockerData?.total === "number"
        ? dockerData.total
        : typeof dockerData?.count === "number"
          ? dockerData.count
          : containerList.length;
    const activeContainers =
      typeof dockerData?.running === "number"
        ? dockerData.running
        : containerList.filter((container: Record<string, unknown>) => {
            const raw =
              `${container?.status ?? container?.state ?? ""}`.toLowerCase();
            return (
              !/(exited|stopped|dead|unhealthy)/.test(raw) &&
              /(running|up|healthy)/.test(raw)
            );
          }).length;

    return NextResponse.json({
      system: {
        cpu: toNullableNumber(
          system.cpu_percent ?? system.cpu ?? statusData?.cpu,
        ),
        memory: toNullableNumber(
          system.memory_percent ?? system.memory ?? statusData?.memory,
        ),
        disk: toNullableNumber(
          system.disk_percent ?? system.disk ?? statusData?.disk,
        ),
        containers: totalContainers > 0 ? totalContainers : null,
        active_containers: totalContainers > 0 ? activeContainers : null,
      },
      stats: {
        data_sources_count: toNullableNumber(statusData?.data_sources_count),
        active_sources: toNullableNumber(statusData?.active_sources),
        total_data_points: toNullableNumber(statusData?.total_data_points),
        tracked_metrics: toNullableNumber(statusData?.tracked_metrics),
        storage_used_gb: toNullableNumber(statusData?.storage_used_gb),
        api_calls_today: toNullableNumber(
          statusData?.api_calls_today ?? statusData?.api_requests_24h,
        ),
      },
    });
  } catch (error) {
    console.error("MyMirror live metrics fetch error:", error);
    return NextResponse.json(
      {
        error: "System metrics upstream is unavailable",
        details: error instanceof Error ? error.message : "unknown error",
      },
      { status: 503 },
    );
  }
}
