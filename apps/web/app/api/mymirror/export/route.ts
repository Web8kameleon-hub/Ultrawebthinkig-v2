import { NextRequest, NextResponse } from 'next/server'
import { fetchArrayBufferFromCandidates } from "../../_lib/upstream";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const format = body?.format === 'pptx' ? 'pptx' : 'excel'
    const endpoint = format === 'pptx' ? '/api/reporting/export-pptx' : '/api/reporting/export-excel'

    const { data } = await fetchArrayBufferFromCandidates({
      group: 'reporting',
      path: endpoint,
      init: {
        method: 'POST',
        body: JSON.stringify(body || {}),
      },
      headers: { 'Content-Type': 'application/json' },
    })

    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': format === 'pptx'
          ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Export failed' },
      { status: 503 },
    )
  }
}
