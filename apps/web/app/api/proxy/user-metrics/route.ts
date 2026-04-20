import { NextRequest, NextResponse } from 'next/server'
import { fetchFromCandidates } from "../../_lib/upstream";

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get("X-User-ID") || "anonymous-user";

    const { response, source } = await fetchFromCandidates({
      group: "api",
      path: "/api/user/metrics",
      headers: {
        "X-User-ID": userId,
      },
    });

    const data = await response.json()
    return NextResponse.json({ ...data, source })
  } catch (error) {
    console.error('User metrics fetch error:', error)
    return NextResponse.json(
      {
        error: "User metrics upstream is unavailable",
        details: error instanceof Error ? error.message : "unknown error",
      },
      { status: 503 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get("X-User-ID") || "anonymous-user";
    const body = await request.json()

    const { response } = await fetchFromCandidates({
      group: "api",
      path: "/api/user/metrics",
      init: {
        method: "POST",
        body: JSON.stringify(body),
      },
      headers: {
        "Content-Type": "application/json",
        "X-User-ID": userId,
      },
    });

    const data = await response.json().catch(() => null);
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('User metric create error:', error)
    return NextResponse.json(
      {
        error: "User metrics upstream is unavailable",
        details: error instanceof Error ? error.message : "unknown error",
      },
      { status: 503 },
    );
  }
}
