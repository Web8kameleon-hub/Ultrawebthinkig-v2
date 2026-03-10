import { NextResponse } from 'next/server'

const API_URL = process.env.NODE_ENV === 'production' ? 'http://clisonix-api:8000' : 'http://127.0.0.1:8000'

export async function GET() {
  try {
    const res = await fetch(`${API_URL}/api/reporting/docker-containers`, { cache: 'no-store' })
    if (!res.ok) {
      return NextResponse.json({ containers: [], total: 0, running: 0 }, { status: 200 })
    }
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ containers: [], total: 0, running: 0 }, { status: 200 })
  }
}
