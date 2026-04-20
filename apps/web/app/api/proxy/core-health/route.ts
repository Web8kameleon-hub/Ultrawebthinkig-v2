import { NextResponse } from 'next/server';
import { fetchJsonFromCandidates } from "../../_lib/upstream";

export async function GET() {
  try {
    const { data, source } = await fetchJsonFromCandidates<Record<string, unknown>>({
      group: "api",
      path: "/health",
    });
    return NextResponse.json({ ...data, source }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to connect to Core Service', details: String(error) },
      { status: 503 }
    );
  }
}
