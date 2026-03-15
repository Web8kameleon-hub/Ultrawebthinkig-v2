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
    const jonaData = data.trinity?.jona

    if (!jonaData) {
      return NextResponse.json(
        { error: 'JONA service not available', success: false },
        { status: 503 }
      )
    }

    return NextResponse.json({
      success: true,
      service: 'JONA',
      role: 'Data Coordinator',
      data: {
        operational: jonaData.operational,
        health: jonaData.health,
        metrics: {
          requests_5m: jonaData.metrics?.requests_5m || 0,
          infinite_potential: jonaData.metrics?.infinite_potential || 0,
          audio_synthesis: jonaData.metrics?.audio_synthesis || false,
          coordination_score: jonaData.metrics?.coordination_score || 0,
        },
        timestamp: data.timestamp,
      }
    })
  } catch (error) {
    console.error('[JONA metrics] Error:', error)
    return NextResponse.json(
      { error: 'Service error', success: false, details: String(error) },
      { status: 500 }
    )
  }
}
