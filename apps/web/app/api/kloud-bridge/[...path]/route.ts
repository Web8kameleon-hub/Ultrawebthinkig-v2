import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const KLOUD_BRIDGE_CANDIDATES = Array.from(
  new Set(
    [
      process.env.KLOUD_BRIDGE_INTERNAL_URL,
      'http://clisonix-kloud-bridge:8889',
      'http://kloud-bridge:8889',
      process.env.KLOUD_BRIDGE_URL,
      'http://localhost:8889',
    ]
      .filter((url): url is string => Boolean(url && url.trim()))
      .map((url) => url.replace(/\/+$/, '')),
  ),
)

let preferredUpstream: string | null = null

function getOrderedCandidates() {
  if (!preferredUpstream) {
    return KLOUD_BRIDGE_CANDIDATES
  }

  return [preferredUpstream, ...KLOUD_BRIDGE_CANDIDATES.filter((base) => base !== preferredUpstream)]
}

function getTimeoutMs(pathname: string, method: string) {
  if (method === 'GET' && /^\/(health|status)$/.test(pathname)) {
    return 1200
  }

  if (method === 'GET') {
    return 2000
  }

  return 3500
}

function sanitizeKloudPayload(pathname: string, rawText: string, contentType: string) {
  if (!contentType.includes('application/json')) {
    return rawText
  }

  try {
    const payload = JSON.parse(rawText)

    if (pathname === '/health') {
      return JSON.stringify({
        status: payload?.status ?? 'unknown',
        service: payload?.service ?? 'kloud-bridge',
        uptime_seconds: payload?.uptime_seconds ?? null,
      })
    }

    if (pathname === '/status') {
      const configured = Boolean(payload?.upstream?.configured)
      const reachable = Boolean(payload?.upstream?.reachable)

      return JSON.stringify({
        service: payload?.service ?? 'kloud-bridge',
        version: payload?.version ?? null,
        availability: reachable ? 'connected' : configured ? 'limited' : 'setup-required',
        upstream: {
          configured,
          reachable,
        },
      })
    }

    if (pathname === '/fabric/sync') {
      return JSON.stringify({
        status: payload?.status ?? 'unknown',
        live_only: Boolean(payload?.live_only),
        synchronized: payload?.status === 'synchronized',
      })
    }
  } catch {
    return rawText
  }

  return rawText
}

async function proxyToKloudBridge(pathname: string, request: NextRequest) {
  const search = request.nextUrl.search || ''
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`
  const body = request.method === 'GET' ? undefined : await request.text()
  const timeoutMs = getTimeoutMs(path, request.method)
  const candidates = getOrderedCandidates()

  let lastError = 'No Kloud Bridge upstream configured'

  for (const base of candidates) {
    try {
      const target = `${base}${path}${search}`
      const res = await fetch(target, {
        method: request.method,
        headers: {
          'Content-Type': request.headers.get('content-type') || 'application/json',
          Accept: request.headers.get('accept') || 'application/json',
        },
        body,
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
      })

      preferredUpstream = base
      const contentType = res.headers.get('content-type') || 'application/json'
      const text = await res.text()
      const safeText = sanitizeKloudPayload(path, text, contentType)
      const responseContentType = contentType.includes('application/json') ? 'application/json' : contentType

      return new NextResponse(safeText, {
        status: res.status,
        headers: {
          'Content-Type': responseContentType,
          'Cache-Control': 'no-store',
        },
      })
    } catch (error) {
      lastError = `${base}: ${error instanceof Error ? error.message : 'Unknown upstream error'}`
    }
  }

  console.warn('[kloud-bridge] public proxy unavailable', { path, lastError })

  return NextResponse.json(
    {
      success: false,
      error: 'Kloud Bridge API temporarily unavailable.',
    },
    {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  return proxyToKloudBridge(`/${path.join('/')}`, request)
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  return proxyToKloudBridge(`/${path.join('/')}`, request)
}
