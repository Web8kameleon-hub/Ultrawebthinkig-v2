import { NextRequest, NextResponse } from "next/server";
import { getUpstreamCandidates } from "../../_lib/upstream";

const BACKEND_URL = getUpstreamCandidates("api")[0] || null;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const params = await context.params;
  const path = params.path?.join("/") || "";

  try {
    if (!BACKEND_URL) {
      return NextResponse.json(
        { success: false, error: "Missing upstream config: set API_INTERNAL_URL" },
        { status: 503 },
      );
    }

    const upstream = await fetch(`${BACKEND_URL}/api/jona/${path}`, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { success: false, error: "Backend unavailable" },
        { status: upstream.status },
      );
    }

    const data = await upstream.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[JONA API Proxy] Error:", error);
    return NextResponse.json(
      { success: false, error: "Connection failed", details: String(error) },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const params = await context.params;
  const path = params.path?.join("/") || "";

  try {
    if (!BACKEND_URL) {
      return NextResponse.json(
        { success: false, error: "Missing upstream config: set API_INTERNAL_URL" },
        { status: 503 },
      );
    }

    let body = null;
    try {
      body = await request.json();
    } catch {
      // No body or invalid JSON - that's ok for some endpoints
    }

    const upstream = await fetch(`${BACKEND_URL}/api/jona/${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });

    if (!upstream.ok) {
      const errorData = await upstream
        .json()
        .catch(() => ({ error: "Unknown error" }));
      return NextResponse.json(
        { success: false, ...errorData },
        { status: upstream.status },
      );
    }

    const data = await upstream.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[JONA API Proxy] POST Error:", error);
    return NextResponse.json(
      { success: false, error: "Connection failed", details: String(error) },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const params = await context.params;
  const path = params.path?.join("/") || "";

  try {
    if (!BACKEND_URL) {
      return NextResponse.json(
        { success: false, error: "Missing upstream config: set API_INTERNAL_URL" },
        { status: 503 },
      );
    }

    const upstream = await fetch(`${BACKEND_URL}/api/jona/${path}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { success: false, error: "Delete failed" },
        { status: upstream.status },
      );
    }

    const data = await upstream.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[JONA API Proxy] DELETE Error:", error);
    return NextResponse.json(
      { success: false, error: "Connection failed", details: String(error) },
      { status: 500 },
    );
  }
}
