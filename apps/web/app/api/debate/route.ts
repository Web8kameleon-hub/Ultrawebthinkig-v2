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

async function proxyDebate(request: Request, path: string) {
  const contentType = request.headers.get('content-type') || 'application/json'
  const accept = request.headers.get('accept') || 'application/json'
  const body = request.method === 'GET' ? undefined : await request.text()

  let lastError = 'No debate upstream configured'

  for (const base of getOrderedCandidates()) {
    try {
      const response = await fetch(`${base}${path}`, {
        method: request.method,
        headers: {
          'Content-Type': contentType,
          Accept: accept,
        },
        body,
        cache: 'no-store',
      })

      preferredUpstream = base
      const text = await response.text()
      return new NextResponse(text, {
        status: response.status,
        headers: {
          'Content-Type': response.headers.get('content-type') || 'application/json',
          'Cache-Control': 'no-store',
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

export async function POST(request: Request) {
  return proxyDebate(request, '/api/v1/debate')
}
