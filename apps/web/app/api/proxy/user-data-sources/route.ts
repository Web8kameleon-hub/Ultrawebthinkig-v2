import { NextRequest, NextResponse } from 'next/server'
import { fetchFromCandidates } from "../../_lib/upstream";

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get("X-User-ID") || "anonymous-user";

    const { response, source } = await fetchFromCandidates({
      group: "api",
      path: "/api/user/data-sources",
      headers: {
        "X-User-ID": userId,
      },
    });

    const data = await response.json()
    return NextResponse.json({ ...data, source })
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
    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }

    const normalizedType =
      typeof body.type === "string" && body.type.trim()
        ? body.type.trim().toLowerCase()
        : "api";

    const normalizedName =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : "playground-source";

    const normalizedPayload = {
      name: normalizedName,
      type: normalizedType,
      endpoint:
        typeof body.endpoint === "string" && body.endpoint.trim()
          ? body.endpoint.trim()
          : normalizedType === "api"
            ? "https://example.com"
            : null,
      api_key:
        typeof body.api_key === "string" && body.api_key.trim()
          ? body.api_key.trim()
          : null,
      config:
        body.config &&
        typeof body.config === "object" &&
        !Array.isArray(body.config)
          ? body.config
          : null,
    };

    const { response } = await fetchFromCandidates({
      group: "api",
      path: "/api/user/data-sources",
      init: {
        method: "POST",
        body: JSON.stringify(normalizedPayload),
      },
      headers: {
        "Content-Type": "application/json",
        "X-User-ID": userId,
      },
    });

    const data = await response.json().catch(() => null);
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
