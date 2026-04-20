import { NextResponse } from 'next/server'
import { fetchJsonFromCandidates } from "../../_lib/upstream";

export async function GET() {
  try {
    const { data, source } = await fetchJsonFromCandidates<Record<string, unknown>>({
      group: "api",
      path: "/asi/status",
    })
    return NextResponse.json({ ...data, source }, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ASI status unavailable" },
      { status: 503 },
    )
  }
}
