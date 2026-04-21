import { NextRequest, NextResponse } from 'next/server'
import { fetchFromCandidates } from "../../_lib/upstream";

function resolveUserId(request: NextRequest): string | null {
  const headerValue = request.headers.get("X-User-ID")?.trim();
  if (headerValue) return headerValue;

  const queryValue = request.nextUrl.searchParams.get("userId")?.trim();
  if (queryValue) return queryValue;

  return null;
}

function mapSourceType(value: unknown) {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "nodesms") return "gsm";
  if (
    ["iot", "api", "lora", "gsm", "mqtt", "webhook", "database"].includes(
      normalized,
    )
  ) {
    return normalized;
  }
  return "api";
}

function mapSourceStatus(value: unknown) {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "active" || normalized === "connected") return "connected";
  if (normalized === "inactive" || normalized === "disconnected")
    return "disconnected";
  if (normalized === "error") return "error";
  if (normalized === "syncing") return "syncing";
  return "disconnected";
}

function normalizeSources(payload: unknown) {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { sources?: unknown[] } | null)?.sources)
      ? (payload as { sources: unknown[] }).sources
      : [];

  return rows
    .filter(
      (row): row is Record<string, unknown> =>
        Boolean(row) && typeof row === "object",
    )
    .map((row) => {
      const dataPointsValue = Number(row.data_points ?? row.dataPoints ?? 0);
      const dataPoints = Number.isFinite(dataPointsValue)
        ? Math.max(0, dataPointsValue)
        : 0;
      return {
        id: String(row.id ?? ""),
        name: String(row.name ?? row.id ?? "Unnamed source"),
        type: mapSourceType(row.type),
        status: mapSourceStatus(row.status),
        endpoint: typeof row.endpoint === "string" ? row.endpoint : undefined,
        lastSync:
          typeof row.last_sync === "string"
            ? row.last_sync
            : typeof row.lastSync === "string"
              ? row.lastSync
              : "",
        dataPoints,
        throughput: typeof row.throughput === "string" ? row.throughput : "N/A",
        latency: Number.isFinite(Number(row.latency)) ? Number(row.latency) : 0,
        createdAt:
          typeof row.created_at === "string"
            ? row.created_at
            : typeof row.createdAt === "string"
              ? row.createdAt
              : "",
      };
    })
    .filter((source) => Boolean(source.id));
}

export async function GET(request: NextRequest) {
  try {
    const userId = resolveUserId(request);
    if (!userId) {
      return NextResponse.json(
        {
          error:
            "Missing required identity: provide X-User-ID header or ?userId=",
        },
        { status: 422 },
      );
    }

    const { response, source } = await fetchFromCandidates({
      group: "api",
      path: "/api/user/data-sources",
      headers: {
        "X-User-ID": userId,
      },
    });

    const data = await response.json().catch(() => null);
    const sources = normalizeSources(data);
    const connected = sources.filter(
      (source) => source.status === "connected",
    ).length;
    const totalDataPoints = sources.reduce(
      (sum, source) => sum + source.dataPoints,
      0,
    );

    return NextResponse.json({
      sources,
      count: sources.length,
      active: connected,
      total_data_points: totalDataPoints,
      source,
    });
  } catch (error) {
    console.error('User data sources fetch error:', error)
    return NextResponse.json(
      {
        error: "User data sources upstream is unavailable",
        details: error instanceof Error ? error.message : "unknown error",
      },
      { status: 503 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = resolveUserId(request);
    if (!userId) {
      return NextResponse.json(
        {
          error:
            "Missing required identity: provide X-User-ID header or ?userId=",
        },
        { status: 422 },
      );
    }
    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }

    const normalizedType =
      typeof body.type === "string" && body.type.trim()
        ? body.type.trim().toLowerCase()
        : "api";

    const normalizedName =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : "playground-source";

    const normalizedPayload = {
      name: normalizedName,
      type: normalizedType,
      endpoint:
        typeof body.endpoint === "string" && body.endpoint.trim()
          ? body.endpoint.trim()
          : normalizedType === "api"
            ? "https://example.com"
            : null,
      api_key:
        typeof body.api_key === "string" && body.api_key.trim()
          ? body.api_key.trim()
          : null,
      config:
        body.config &&
        typeof body.config === "object" &&
        !Array.isArray(body.config)
          ? body.config
          : null,
    };

    const { response } = await fetchFromCandidates({
      group: "api",
      path: "/api/user/data-sources",
      init: {
        method: "POST",
        body: JSON.stringify(normalizedPayload),
      },
      headers: {
        "Content-Type": "application/json",
        "X-User-ID": userId,
      },
    });

    const data = await response.json().catch(() => null);
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('User data source create error:', error)
    return NextResponse.json(
      {
        error: "User data source upstream is unavailable",
        details: error instanceof Error ? error.message : "unknown error",
      },
      { status: 503 },
    );
  }
}
