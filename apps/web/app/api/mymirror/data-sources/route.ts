import { NextRequest, NextResponse } from 'next/server'
import { fetchFromCandidates } from "../../_lib/upstream";

import {
  getMymirrorDataSources,
  getMymirrorStats,
} from "@/lib/mymirror-data-catalog";

export async function GET(request: NextRequest) {
  const userId = request.headers.get("X-User-ID") || "anonymous-user";
  try {
    const { response, source } = await fetchFromCandidates({
      group: "api",
      path: "/api/user/data-sources",
      headers: { "X-User-ID": userId },
    });

    const data = await response.json().catch(() => ({}));
    const upstreamSources = Array.isArray(data.sources) ? data.sources : [];

    const sources = getMymirrorDataSources(upstreamSources);
    const stats = getMymirrorStats(sources);

    return NextResponse.json(
      {
        sources,
        count: stats.data_sources_count,
        active: stats.active_sources,
        stats: {
          ...stats,
          storage_used_gb: null,
          api_calls_today: null,
        },
        source,
      },
      { status: 200 },
    );
  } catch (error) {
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
  const userId = request.headers.get("X-User-ID") || "anonymous-user";
  const body = await request.json().catch(() => ({}))

  try {
    const { response } = await fetchFromCandidates({
      group: "api",
      path: "/api/user/data-sources",
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
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: "User data source upstream is unavailable",
        details: error instanceof Error ? error.message : "unknown error",
      },
      { status: 503 },
    );
  }
}
