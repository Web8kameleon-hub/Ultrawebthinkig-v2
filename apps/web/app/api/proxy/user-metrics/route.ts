import { NextRequest, NextResponse } from 'next/server'
import { fetchFromCandidates } from "../../_lib/upstream";

function normalizeMetrics(payload: unknown) {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { metrics?: unknown[] } | null)?.metrics)
      ? (payload as { metrics: unknown[] }).metrics
      : [];

  return rows.filter(
    (row): row is Record<string, unknown> =>
      Boolean(row) && typeof row === "object",
  );
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get("X-User-ID") || "anonymous-user";

    const { response, source } = await fetchFromCandidates({
      group: "api",
      path: "/api/user/metrics",
      headers: {
        "X-User-ID": userId,
      },
    });

    const data = await response.json().catch(() => null);
    const metrics = normalizeMetrics(data);
    return NextResponse.json({
      metrics,
      count: metrics.length,
      source,
    });
  } catch (error) {
    console.error('User metrics fetch error:', error)
    return NextResponse.json(
      {
        error: "User metrics upstream is unavailable",
        details: error instanceof Error ? error.message : "unknown error",
      },
      { status: 503 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get("X-User-ID") || "anonymous-user";
    const body = await request.json()

    const { response } = await fetchFromCandidates({
      group: "api",
      path: "/api/user/metrics",
      init: {
        method: "POST",
        body: JSON.stringify(body),
      },
      headers: {
        "Content-Type": "application/json",
        "X-User-ID": userId,
      },
    });

    const data = await response.json().catch(() => null);
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('User metric create error:', error)
    return NextResponse.json(
      {
        error: "User metrics upstream is unavailable",
        details: error instanceof Error ? error.message : "unknown error",
      },
      { status: 503 },
    );
  }
}
