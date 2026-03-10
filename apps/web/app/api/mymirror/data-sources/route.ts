import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.NODE_ENV === 'production' ? 'http://clisonix-api:8000' : 'http://127.0.0.1:8000'

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('X-User-ID') || 'demo-user'
    const res = await fetch(`${API_URL}/api/user/data-sources`, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json', 'X-User-ID': userId },
    })
    if (!res.ok) return NextResponse.json({ sources: [], count: 0, active: 0 }, { status: 200 })
    const data = await res.json()
    const sources = data.sources || []
    return NextResponse.json({ sources, count: sources.length, active: sources.filter((s: { active?: boolean }) => s.active !== false).length })
  } catch {
    return NextResponse.json({ sources: [], count: 0, active: 0 }, { status: 200 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('X-User-ID') || 'demo-user'
    const body = await request.json()
    const res = await fetch(`${API_URL}/api/user/data-sources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-User-ID': userId,
      },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({ ok: false }))
    return NextResponse.json(data, { status: res.ok ? 200 : 500 })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to create source' }, { status: 500 })
  }
}
