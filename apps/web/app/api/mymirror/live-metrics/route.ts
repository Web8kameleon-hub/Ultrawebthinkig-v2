import { NextResponse } from 'next/server'

import {
  getMymirrorDataSources,
  getMymirrorStats,
} from "@/lib/mymirror-data-catalog";

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

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
  const fallbackSources = getMymirrorDataSources();
  const fallbackStats = getMymirrorStats(fallbackSources);

  try {
    const [statusData, dockerData] = await Promise.all([
      fetchJsonFromCandidates("/api/system-status", API_CANDIDATES).catch(
        () => null,
      ),
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
        cpu: toNumber(system.cpu_percent ?? system.cpu ?? statusData?.cpu ?? 0),
        memory: toNumber(
          system.memory_percent ?? system.memory ?? statusData?.memory ?? 0,
        ),
        disk: toNumber(
          system.disk_percent ?? system.disk ?? statusData?.disk ?? 0,
        ),
        containers: totalContainers,
        active_containers: activeContainers,
      },
      stats: {
        data_sources_count: toNumber(
          statusData?.data_sources_count ?? fallbackStats.data_sources_count,
          fallbackStats.data_sources_count,
        ),
        active_sources: toNumber(
          statusData?.active_sources ?? fallbackStats.active_sources,
          fallbackStats.active_sources,
        ),
        total_data_points: toNumber(
          statusData?.total_data_points ?? fallbackStats.total_data_points,
          fallbackStats.total_data_points,
        ),
        tracked_metrics: toNumber(
          statusData?.tracked_metrics ?? fallbackStats.tracked_metrics,
          fallbackStats.tracked_metrics,
        ),
        storage_used_gb: toNumber(
          statusData?.storage_used_gb ?? fallbackStats.storage_used_gb,
          fallbackStats.storage_used_gb,
        ),
        api_calls_today: toNumber(
          statusData?.api_calls_today ??
            statusData?.api_requests_24h ??
            fallbackStats.api_calls_today,
          fallbackStats.api_calls_today,
        ),
      },
    });
  } catch (error) {
    console.error("MyMirror live metrics fetch error:", error);
    return NextResponse.json(
      {
        system: {
          cpu: 0,
          memory: 0,
          disk: 0,
          containers: 0,
          active_containers: 0,
        },
        stats: fallbackStats,
      },
      { status: 200 },
    );
  }
}
