import { NextRequest, NextResponse } from 'next/server'

const API_URL =
  process.env.NODE_ENV === "production"
    ? "http://clisonix-api:8000"
    : "http://127.0.0.1:8000";

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get("X-User-ID") || "anonymous-user";

    const response = await fetch(`${API_URL}/api/user/data-sources`, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "X-User-ID": userId,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "User data sources upstream returned a non-200 status",
          upstreamStatus: response.status,
        },
        { status: response.status >= 500 ? 503 : response.status },
      );
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('User data sources fetch error:', error)
    return NextResponse.json(
      {
        error: "User data sources upstream is unavailable",
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

    const response = await fetch(`${API_URL}/api/user/data-sources`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-User-ID": userId,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            data?.detail ||
            data?.error ||
            "Failed to create data source upstream",
          upstreamStatus: response.status,
        },
        { status: response.status >= 500 ? 503 : response.status },
      );
    }

    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('User data source create error:', error)
    return NextResponse.json(
      {
        error: "User data source upstream is unavailable",
        details: error instanceof Error ? error.message : "unknown error",
      },
      { status: 503 },
    );
  }
}
