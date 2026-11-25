import { NextRequest, NextResponse } from 'next/server'
import { searchOpenData } from '@/lib/open-data/federated-agent'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim() || '*:*'
  const rows = Number(request.nextUrl.searchParams.get('rows') || '20')
  const start = Number(request.nextUrl.searchParams.get('start') || '0')
  const catalogs = await searchOpenData(query, rows, start)
  const available = catalogs.filter((item) => !item.error)

  return NextResponse.json({
    success: available.length > 0,
    query,
    verifiedSourceCount: available.reduce((sum, item) => sum + item.total, 0),
    returnedDatasetCount: available.reduce((sum, item) => sum + item.datasets.length, 0),
    catalogs,
    measuredAt: new Date().toISOString(),
  }, { status: available.length > 0 ? 200 : 503 })
}
