import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function upstreamUrl(method: 'GET' | 'POST'): string {
  const value = method === 'GET'
    ? process.env.AGI_ADVANCED_STATUS_URL || process.env.AGI_ADVANCED_URL
    : process.env.AGI_ADVANCED_URL
  if (!value?.trim()) throw new Error('AGI_ADVANCED_URL is not configured')
  return value.trim()
}

function headers(): HeadersInit {
  const result: Record<string, string> = { accept: 'application/json', 'content-type': 'application/json' }
  if (process.env.AGI_ADVANCED_API_KEY) result.authorization = `Bearer ${process.env.AGI_ADVANCED_API_KEY}`
  return result
}

async function proxy(method: 'GET' | 'POST', request?: NextRequest) {
  try {
    const upstream = await fetch(upstreamUrl(method), {
      method,
      headers: headers(),
      body: method === 'POST' && request ? JSON.stringify(await request.json()) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(Number(process.env.AGI_ADVANCED_TIMEOUT_MS || '15000')),
    })
    const contentType = upstream.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ success: false, error: 'AGI upstream returned non-JSON data' }, { status: 502 })
    }
    const payload: unknown = await upstream.json()
    if (!upstream.ok) {
      return NextResponse.json(
        { success: false, error: 'AGI upstream rejected the request', upstreamStatus: upstream.status },
        { status: 502 }
      )
    }
    return NextResponse.json({
      success: true,
      provider: process.env.AGI_ADVANCED_PROVIDER_NAME?.trim() || 'configured-agi-upstream',
      data: payload,
      receivedAt: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AGI upstream is unavailable'
    return NextResponse.json({ success: false, error: message }, { status: message.includes('not configured') ? 503 : 502 })
  }
}

export async function GET() {
  return proxy('GET')
}

export async function POST(request: NextRequest) {
  return proxy('POST', request)
}
