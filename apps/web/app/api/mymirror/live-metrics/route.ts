import { NextResponse } from 'next/server'
import { fetchJsonFromCandidates } from "../../_lib/upstream";

export const dynamic = "force-dynamic";

function toNullableNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET() {
  try {
    const [statusData, dockerData] = await Promise.all([
      fetchJsonFromCandidates<Record<string, unknown>>({
        group: "api",
        path: "/api/system-status",
      }).then((result) => result.data),
      fetchJsonFromCandidates<Record<string, unknown>>({
        group: "reporting",
        path: "/api/reporting/docker-containers",
      })
        .then((result) => result.data)
        .catch(() => null),
    ]);

    const system =
      statusData?.system && typeof statusData.system === "object"
        ? (statusData.system as Record<string, unknown>)
        : {};
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
