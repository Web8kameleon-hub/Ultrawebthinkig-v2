import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

async function fetchFromProxy(path: string) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/proxy/${path}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' }
  })
  return response.ok ? response.json() : null
}

export async function GET() {
  try {
    const [system, docker, live] = await Promise.all([
      fetchFromProxy('system-metrics'),
      fetchFromProxy('docker-containers'),
      fetchFromProxy('mymirror/live-metrics')
    ])

    // Friendly transformation for UI
    const bridgeStatus = system && docker ? 'connected-monitored' : 'checking'
    const sovereignStatus = live?.system ? 'ready' : 'initializing'
    const oceanStatus = live?.stats?.data_sources_count ? 'synchronized' : 'building'
    const readyStatus = bridgeStatus === 'connected-monitored' && sovereignStatus === 'ready' && oceanStatus === 'synchronized' ? 'ready' : 'almost'
    const totalDataPoints = Number(live?.stats?.total_data_points || 0)
    const activeSources = Number(live?.stats?.active_sources || 0)
    const runningContainers = Number(docker?.running || 0)

    // Real-data-first metric: use live data points, then deterministic fallback.
    const activityUpdates = totalDataPoints > 0
      ? totalDataPoints
      : (activeSources * runningContainers)

    return NextResponse.json({
      status: {
        bridge: bridgeStatus,
        sovereign: sovereignStatus,
        ocean: oceanStatus,
        ready: readyStatus
      },
      metrics: {
        activity_updates: activityUpdates,
        containers_running: runningContainers,
        containers_total: docker?.total || 0,
        data_sources_active: activeSources,
        system_cpu: system?.cpu_percent || null,
        system_memory: system?.memory_percent || null
      },
      human_readable: {
        status: bridgeStatus === 'connected-monitored' ? 'Connected and monitored' : 'Checking connectivity...',
        sync: 'Real-time synchronized',
        updates: new Intl.NumberFormat('en', { notation: 'compact' }).format(activityUpdates),
        uptime: system?.uptime || 'Live'
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({ error: 'Kloud Bridge data unavailable', status: 'error' }, { status: 503 })
  }
}

