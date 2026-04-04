import { NextRequest, NextResponse } from 'next/server'

import {
  addRuntimeMymirrorSource,
  getMymirrorDataSources,
  getMymirrorStats,
} from '@/lib/mymirror-data-catalog'

const API_URL = process.env.NODE_ENV === 'production' ? 'http://clisonix-api:8000' : 'http://127.0.0.1:8000'

export async function GET(request: NextRequest) {
  const userId = request.headers.get('X-User-ID') || 'demo-user'
  let upstreamSources: unknown[] = []

  try {
    const res = await fetch(`${API_URL}/api/user/data-sources`, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json', 'X-User-ID': userId },
    })

    if (res.ok) {
      const data = await res.json().catch(() => ({}))
      upstreamSources = Array.isArray(data.sources) ? data.sources : []
    }
  } catch {
    upstreamSources = []
  }

  const sources = getMymirrorDataSources(upstreamSources)
  const stats = getMymirrorStats(sources)

  return NextResponse.json(
    {
      sources,
      count: stats.data_sources_count,
      active: stats.active_sources,
      stats,
    },
    { status: 200 },
  )
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get('X-User-ID') || 'demo-user'
  const body = await request.json().catch(() => ({}))

  try {
    const res = await fetch(`${API_URL}/api/user/data-sources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-User-ID': userId,
      },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      const data = await res.json().catch(() => ({ ok: true }))
      return NextResponse.json(data, { status: 200 })
    }
  } catch {
    // Fall through to runtime catalog mode.
  }

  const source = addRuntimeMymirrorSource(body)
  return NextResponse.json({ ok: true, source, fallback: true }, { status: 200 })
}
