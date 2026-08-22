import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const REQUEST_TIMEOUT_MS = Number(process.env.AI_MANAGER_TIMEOUT_MS || '15000')

function configuredUrl(kind: 'chat' | 'status'): string {
  const explicit = kind === 'chat'
    ? process.env.AI_MANAGER_URL
    : process.env.AI_MANAGER_STATUS_URL
  if (explicit?.trim()) return explicit.trim()

  const clisonix = process.env.CLISONIX_URL?.trim().replace(/\/+$/, '')
  if (!clisonix) {
    throw new Error(
      kind === 'chat'
        ? 'AI_MANAGER_URL or CLISONIX_URL is not configured'
        : 'AI_MANAGER_STATUS_URL or CLISONIX_URL is not configured'
    )
  }
  return kind === 'chat' ? `${clisonix}/api/ocean` : `${clisonix}/api/system-status`
}

function upstreamHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    accept: 'application/json',
    'content-type': 'application/json',
  }
  if (process.env.AI_MANAGER_API_KEY) {
    headers.authorization = `Bearer ${process.env.AI_MANAGER_API_KEY}`
  }
  return headers
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw new Error('AI Manager upstream returned a non-JSON response')
  }
  return response.json() as Promise<Record<string, unknown>>
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { message?: unknown; clientId?: unknown; language?: unknown }
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    if (!message) {
      return NextResponse.json({ success: false, error: 'Message is required' }, { status: 400 })
    }

    const upstream = await fetch(configuredUrl('chat'), {
      method: 'POST',
      headers: upstreamHeaders(),
      body: JSON.stringify({
        message,
        language: typeof body.language === 'string' ? body.language : 'sq',
        model: 'ocean-core',
        ...(typeof body.clientId === 'string' ? { clientId: body.clientId } : {}),
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    const payload = await readJson(upstream)
    if (!upstream.ok) {
      return NextResponse.json(
        { success: false, error: 'AI Manager upstream rejected the request', upstreamStatus: upstream.status },
        { status: 502 }
      )
    }

    const response =
      (typeof payload.response === 'string' && payload.response.trim()) ||
      (typeof payload.message === 'string' && payload.message.trim()) ||
      ''
    if (!response) {
      return NextResponse.json({ success: false, error: 'AI Manager upstream returned no message' }, { status: 502 })
    }

    return NextResponse.json({
      success: true,
      response,
      provider: 'clisonix-ocean',
      model: typeof payload.model === 'string' ? payload.model : null,
      confidence: typeof payload.confidence === 'number' ? payload.confidence : null,
      upstreamTimestamp: typeof payload.timestamp === 'string' ? payload.timestamp : null,
      receivedAt: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI Manager upstream is unavailable'
    const status = message.includes('not configured') ? 503 : 502
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

export async function GET() {
  try {
    const upstream = await fetch(configuredUrl('status'), {
      headers: upstreamHeaders(),
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    const telemetry = await readJson(upstream)
    if (!upstream.ok) {
      return NextResponse.json(
        { available: false, error: 'AI Manager status upstream rejected the request', upstreamStatus: upstream.status },
        { status: 502 }
      )
    }
    return NextResponse.json({
      available: true,
      provider: 'clisonix',
      telemetry,
      checkedAt: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI Manager status is unavailable'
    const status = message.includes('not configured') ? 503 : 502
    return NextResponse.json({ available: false, error: message }, { status })
  }
}
