import { NextResponse } from 'next/server'

import {
  getMymirrorDataSources,
  getMymirrorStats,
} from "@/lib/mymirror-data-catalog";

const API_URL = process.env.NODE_ENV === 'production' ? 'http://clisonix-api:8000' : 'http://127.0.0.1:8000'

export async function GET() {
  const fallbackSources = getMymirrorDataSources();
  const fallbackStats = getMymirrorStats(fallbackSources);

  try {
    const res = await fetch(`${API_URL}/api/system-status`, { cache: 'no-store' })
    if (!res.ok) {
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

    const data = await res.json()
    const system = data.system || {};

    return NextResponse.json({
      system: {
        cpu: Number(system.cpu ?? data.cpu ?? 0),
        memory: Number(system.memory ?? data.memory ?? 0),
        disk: Number(system.disk ?? data.disk ?? 0),
        containers: Number(system.containers ?? data.containers ?? 0),
        active_containers: Number(
          system.active_containers ?? data.active_containers ?? 0,
        ),
      },
      stats: {
        data_sources_count: Number(
          data.data_sources_count ?? fallbackStats.data_sources_count,
        ),
        active_sources: Number(
          data.active_sources ?? fallbackStats.active_sources,
        ),
        total_data_points: Number(
          data.total_data_points ?? fallbackStats.total_data_points,
        ),
        tracked_metrics: Number(
          data.tracked_metrics ?? fallbackStats.tracked_metrics,
        ),
        storage_used_gb: Number(
          data.storage_used_gb ?? fallbackStats.storage_used_gb,
        ),
        api_calls_today: Number(
          data.api_calls_today ??
            data.api_requests_24h ??
            fallbackStats.api_calls_today,
        ),
      },
    });
  } catch {
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
