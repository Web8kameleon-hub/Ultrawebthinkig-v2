import { NextRequest, NextResponse } from 'next/server'
import { fetchFromCandidates } from "../../_lib/upstream";

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get("X-User-ID") || "anonymous-user";

    const { response, source } = await fetchFromCandidates({
      group: "api",
      path: "/api/user/summary",
      headers: {
        "X-User-ID": userId,
      },
    });

    const data = await response.json()
    return NextResponse.json({ ...data, source })
  } catch (error) {
    console.error('User summary fetch error:', error)
    return NextResponse.json(
      {
        error: "User summary upstream is unavailable",
        details: error instanceof Error ? error.message : "unknown error",
      },
      { status: 503 },
    );
  }
}
