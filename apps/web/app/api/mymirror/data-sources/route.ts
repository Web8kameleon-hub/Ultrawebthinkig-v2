import { NextRequest, NextResponse } from 'next/server'

import {
  getMymirrorDataSources,
  getMymirrorStats,
} from "@/lib/mymirror-data-catalog";

const API_URL = process.env.NODE_ENV === 'production' ? 'http://clisonix-api:8000' : 'http://127.0.0.1:8000'

export async function GET(request: NextRequest) {
  const userId = request.headers.get("X-User-ID") || "anonymous-user";
  try {
    const res = await fetch(`${API_URL}/api/user/data-sources`, {
      cache: "no-store",
      headers: { Accept: "application/json", "X-User-ID": userId },
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          error: "User data sources upstream returned a non-200 status",
          upstreamStatus: res.status,
        },
        { status: res.status >= 500 ? 503 : res.status },
      );
    }

    const data = await res.json().catch(() => ({}));
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
    const res = await fetch(`${API_URL}/api/user/data-sources`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-User-ID": userId,
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({ ok: true }));
      return NextResponse.json(data, { status: 200 });
    }

    const error = await res.json().catch(() => null);
    return NextResponse.json(
      {
        error:
          error?.detail ||
          error?.error ||
          "Failed to create data source upstream",
        upstreamStatus: res.status,
      },
      { status: res.status >= 500 ? 503 : res.status },
    );
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
