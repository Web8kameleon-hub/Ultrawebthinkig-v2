import { NextResponse } from 'next/server'

const API_URL = process.env.NODE_ENV === 'production' ? 'http://clisonix-api:8000' : 'http://127.0.0.1:8000'

export async function GET() {
  try {
    const res = await fetch(`${API_URL}/api/system-status`, { cache: 'no-store' })
    if (!res.ok) {
      return NextResponse.json({ system: {}, stats: {} }, { status: 200 })
    }
    const data = await res.json()
    return NextResponse.json({
      system: data.system || {},
      stats: {
        api_requests_24h: data.api_requests_24h || 0,
        api_errors_24h: data.api_errors_24h || 0,
        data_sources_count: data.data_sources_count || 0,
        active_sources: data.active_sources || 0,
      },
    })
  } catch {
    return NextResponse.json({ system: {}, stats: {} }, { status: 200 })
  }
}
