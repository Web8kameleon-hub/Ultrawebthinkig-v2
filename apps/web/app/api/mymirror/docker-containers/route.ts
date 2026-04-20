import { NextResponse } from 'next/server'
import { fetchJsonFromCandidates } from "../../_lib/upstream";

export const dynamic = "force-dynamic";

const REPORTING_PATH = "/api/reporting/docker-containers";

function toNumber(value: unknown, defaultValue = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}


type RawContainer = Record<string, unknown>;

function normalizeContainer(container: RawContainer, index: number) {
  const rawStatus = `${
    container?.status ??
    container?.state ??
    container?.Status ??
    container?.State ??
    ""
  }`;
  const lowered = rawStatus.toLowerCase();
  const isRunning =
    !/(exited|stopped|dead|unhealthy)/.test(lowered) &&
    /(running|up|healthy)/.test(lowered);

  return {
    id: String(
      container?.id ??
        container?.container_id ??
        container?.Id ??
        `${container?.name ?? container?.container_name ?? "container"}-${index}`,
    ),
    name: String(
      container?.name ??
        container?.container_name ??
        container?.Names ??
        `container-${index + 1}`,
    ),
    image: String(container?.image ?? container?.Image ?? "unknown"),
    status: isRunning ? "running" : rawStatus || "unknown",
    cpu: toNumber(container?.cpu ?? container?.cpu_percent ?? 0),
    memory: toNumber(
      container?.memory ??
        container?.memory_percent ??
        container?.mem_percent ??
        0,
    ),
    ports: String(container?.ports ?? container?.Ports ?? "-"),
    healthy:
      typeof container?.healthy === "boolean" ? container.healthy : isRunning,
    uptime: container?.uptime ?? null,
  };
}

async function fetchDockerContainers() {
  const { data, source } = await fetchJsonFromCandidates<Record<string, unknown>>({
    group: "reporting",
    path: REPORTING_PATH,
  });

  if (Array.isArray(data?.containers)) {
    return {
      data: data as Record<string, unknown> & { containers: unknown[] },
      source,
    };
  }

  throw new Error(`${source} -> invalid payload`);
}

export async function GET() {
  try {
    const { data, source } = await fetchDockerContainers();
    const containers = Array.isArray(data.containers)
      ? data.containers.map((container: RawContainer, index: number) =>
          normalizeContainer(container, index),
        )
      : [];

    const running =
      typeof data?.running === "number"
        ? data.running
        : containers.filter((container) => container.status === "running")
            .length;
    const total =
      typeof data?.total === "number"
        ? data.total
        : typeof data?.count === "number"
          ? data.count
          : containers.length;

    return NextResponse.json(
      {
        timestamp: data.timestamp ?? new Date().toISOString(),
        total,
        running,
        containers,
        source,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("MyMirror docker containers fetch error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "unknown error",
      },
      { status: 503 },
    );
  }
}
