import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const upstream = await fetch(`http://api:8000/api/crypto/market`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })

    if (!upstream.ok) {
      throw new Error(`Upstream responded with ${upstream.status}`)
    }

    const payload = await upstream.json()
    return NextResponse.json({ success: true, data: payload })
  } catch (error) {
    console.error('[crypto/market] fallback engaged:', error)
    const fallback = [
      { symbol: 'BTC', price: 45000, change: 2.5 },
      { symbol: 'ETH', price: 2800, change: -1.2 },
      { symbol: 'ADA', price: 0.45, change: 5.1 },
    ]
    return NextResponse.json({ success: false, data: fallback }, { status: 200 })
  }
}
