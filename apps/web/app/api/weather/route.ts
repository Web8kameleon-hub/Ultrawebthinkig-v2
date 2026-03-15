import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const upstream = await fetch(`http://api:8000/api/weather`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })

    if (!upstream.ok) {
      throw new Error(`Upstream responded with ${upstream.status}`)
    }

    const payload = await upstream.json()
    return NextResponse.json({ success: true, data: payload })
  } catch (error) {
    console.error('[weather] fallback engaged:', error)
    const fallback = {
      temperature: 22,
      humidity: 65,
      condition: 'Cloudy',
      location: 'Local',
      timestamp: new Date().toISOString(),
    }
    return NextResponse.json({ success: false, data: fallback }, { status: 200 })
  }
}
