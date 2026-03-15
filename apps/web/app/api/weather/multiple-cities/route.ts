import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const upstream = await fetch(`http://api:8000/api/weather/multiple-cities`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })

    if (!upstream.ok) {
      throw new Error(`Upstream responded with ${upstream.status}`)
    }

    const payload = await upstream.json()
    return NextResponse.json({ success: true, data: payload })
  } catch (error) {
    console.error('[weather/multiple-cities] fallback engaged:', error)
    const fallback = [
      { city: 'New York', temperature: 18, condition: 'Rainy' },
      { city: 'London', temperature: 12, condition: 'Cloudy' },
      { city: 'Tokyo', temperature: 25, condition: 'Sunny' },
    ]
    return NextResponse.json({ success: false, data: fallback }, { status: 200 })
  }
}
