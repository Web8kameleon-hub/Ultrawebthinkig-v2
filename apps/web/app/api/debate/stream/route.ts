import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const OCEAN_CANDIDATES = Array.from(
  new Set(
    [
      process.env.OCEAN_INTERNAL_URL,
      process.env.OCEAN_CORE_URL,
      'http://clisonix-ocean-core:8030',
      'http://ocean-core:8030',
      'http://localhost:8030',
    ]
      .filter((url): url is string => Boolean(url && url.trim()))
      .map((url) => url.replace(/\/+$/, '')),
  ),
)

let preferredUpstream: string | null = null

function getOrderedCandidates() {
  if (!preferredUpstream) {
    return OCEAN_CANDIDATES
  }

  return [preferredUpstream, ...OCEAN_CANDIDATES.filter((base) => base !== preferredUpstream)]
}

export async function GET() {
  return NextResponse.json({ detail: 'Method Not Allowed' }, { status: 405, headers: { Allow: 'POST' } })
}

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') || 'application/json'
  const accept = request.headers.get('accept') || 'text/event-stream'
  const body = await request.text()

  let lastError = 'No debate stream upstream configured'

  for (const base of getOrderedCandidates()) {
    try {
      const response = await fetch(`${base}/api/v1/debate/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': contentType,
          Accept: accept,
        },
        body,
        cache: 'no-store',
      })

      preferredUpstream = base

      if (!response.body) {
        const text = await response.text()
        return new NextResponse(text, {
          status: response.status,
          headers: {
            'Content-Type': response.headers.get('content-type') || 'application/json',
            'Cache-Control': 'no-store',
          },
        })
      }

      return new NextResponse(response.body, {
        status: response.status,
        headers: {
          'Content-Type': response.headers.get('content-type') || 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      })
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown upstream error'
    }
  }

  return NextResponse.json(
    {
      ok: false,
      error: 'Debate engine is temporarily unavailable.',
      detail: process.env.NODE_ENV !== 'production' ? lastError : undefined,
    },
    { status: 502 },
  )
}
