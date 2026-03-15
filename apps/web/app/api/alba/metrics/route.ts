import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Get REAL data from backend Trinity service
    const upstream = await fetch(`http://api:8000/asi/status`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })

    if (!upstream.ok) {
      return NextResponse.json(
        { error: 'Backend unavailable', success: false },
        { status: 503 }
      )
    }

    const data = await upstream.json()
    const albaData = data.trinity?.alba

    if (!albaData) {
      return NextResponse.json(
        { error: 'ALBA service not available', success: false },
        { status: 503 }
      )
    }

    return NextResponse.json({
      success: true,
      service: 'ALBA',
      role: 'Network Monitor',
      data: {
        operational: albaData.operational,
        health: albaData.health,
        metrics: {
          cpu_percent: albaData.metrics?.cpu_percent || 0,
          memory_mb: albaData.metrics?.memory_mb || 0,
          latency_ms: albaData.metrics?.latency_ms || 0,
        },
        timestamp: data.timestamp,
      }
    })
  } catch (error) {
    console.error('[ALBA metrics] Error:', error)
    return NextResponse.json(
      { error: 'Service error', success: false, details: String(error) },
      { status: 500 }
    )
  }
}
