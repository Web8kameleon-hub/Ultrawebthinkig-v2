import { NextResponse } from 'next/server'
import { fetchJsonFromCandidates } from "../../_lib/upstream";

export async function GET() {
  try {
    const { data, source } = await fetchJsonFromCandidates<Record<string, unknown>>({
      group: "reporting",
      path: "/api/reporting/docker-stats",
    });
    return NextResponse.json({ ...data, source })
  } catch (error) {
    console.error('Docker stats fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "unknown error" },
      { status: 503 },
    )
  }
}
