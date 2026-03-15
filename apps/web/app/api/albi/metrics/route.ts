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
    const albiData = data.trinity?.albi

    if (!albiData) {
      return NextResponse.json(
        { error: 'ALBI service not available', success: false },
        { status: 503 }
      )
    }

    return NextResponse.json({
      success: true,
      service: 'ALBI',
      role: 'Neural Processor',
      data: {
        operational: albiData.operational,
        health: albiData.health,
        metrics: {
          goroutines: albiData.metrics?.goroutines || 0,
          neural_patterns: albiData.metrics?.neural_patterns || 0,
          processing_efficiency: albiData.metrics?.processing_efficiency || 0,
          gc_operations: albiData.metrics?.gc_operations || 0,
        },
        timestamp: data.timestamp,
      }
    })
  } catch (error) {
    console.error('[ALBI metrics] Error:', error)
    return NextResponse.json(
      { error: 'Service error', success: false, details: String(error) },
      { status: 500 }
    )
  }
}
