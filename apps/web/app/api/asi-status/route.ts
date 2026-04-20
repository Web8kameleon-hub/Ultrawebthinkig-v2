import { NextResponse } from 'next/server'
import { fetchJsonFromCandidates } from "../_lib/upstream";

// Suppress repetitive error logging
let lastErrorTime = 0
const ERROR_LOG_INTERVAL = 30000 // 30 seconds

export async function GET() {
  try {
    const { data } = await fetchJsonFromCandidates<Record<string, unknown>>({
      group: "api",
      path: "/asi/status",
    })

    const payload = data
    return NextResponse.json({ success: true, asi_status: payload.trinity ? payload : { trinity: payload } })
  } catch (error) {
    // Only log errors every 30 seconds to prevent spam
    const now = Date.now()
    if (now - lastErrorTime > ERROR_LOG_INTERVAL) {
      console.warn('[asi-status] Backend not available:', (error as Error).message)
      lastErrorTime = now
    }

    // NO MOCK DATA - Return real error status
    return NextResponse.json({
      success: false,
      error: 'Backend unavailable',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
      asi_status: null
    }, { status: 503 })
  }
}
