import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const statusUrl = process.env.ASI_STATUS_URL?.trim()
  if (!statusUrl) {
    return NextResponse.json(
      { available: false, error: 'ASI_STATUS_URL is not configured' },
      { status: 503 }
    )
  }

  const headers: Record<string, string> = { accept: 'application/json' }
  if (process.env.ASI_STATUS_API_KEY) {
    headers.authorization = `Bearer ${process.env.ASI_STATUS_API_KEY}`
  }

  try {
    const startedAt = performance.now()
    const upstream = await fetch(statusUrl, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(Number(process.env.ASI_STATUS_TIMEOUT_MS || '10000')),
    })
    if (!upstream.ok) {
      return NextResponse.json(
        { available: false, error: 'ASI status upstream rejected the request', upstreamStatus: upstream.status },
        { status: 502 }
      )
    }
    const contentType = upstream.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ available: false, error: 'ASI status upstream returned non-JSON data' }, { status: 502 })
    }
    const telemetry: unknown = await upstream.json()
    return NextResponse.json({
      available: true,
      telemetry,
      latencyMs: Math.round(performance.now() - startedAt),
      checkedAt: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      { available: false, error: error instanceof Error ? error.message : 'ASI status upstream is unavailable' },
      { status: 502 }
    )
  }
}
