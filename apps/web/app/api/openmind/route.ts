import { NextRequest, NextResponse } from "next/server";

const isDev = process.env.NODE_ENV !== "production";
const OPENMIND_BASE =
  process.env.OPENMIND_INTERNAL_URL ||
  process.env.OPENMIND_URL ||
  (isDev ? "http://localhost:9999" : "http://clisonix-openmind:9999");

function buildHeaders(request: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const clerkUserId = request.headers.get("X-Clerk-User-Id");
  if (clerkUserId) {
    headers["X-Clerk-User-Id"] = clerkUserId;
    headers["X-User-ID"] = clerkUserId;
  }

  return headers;
}

export async function GET(request: NextRequest) {
  const pathParam = request.nextUrl.searchParams.get("path") || "status";
  const allowed = new Set(["status", "health", "providers", "models"]);

  if (!allowed.has(pathParam)) {
    return NextResponse.json(
      {
        status: "error",
        message: "Unsupported path",
        allowed: Array.from(allowed),
      },
      { status: 400 },
    );
  }

  const upstreamPath = pathParam.startsWith("api/") ? pathParam : pathParam;
  const resolvedPath =
    upstreamPath === "providers" || upstreamPath === "models"
      ? `/api/openmind/${upstreamPath}`
      : `/${upstreamPath}`;

  try {
    const response = await fetch(`${OPENMIND_BASE}${resolvedPath}`, {
      method: "GET",
      headers: buildHeaders(request),
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({ status: "error", message: "Invalid upstream response" }));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: "OpenMind service unavailable",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const response = await fetch(`${OPENMIND_BASE}/api/openmind`, {
      method: "POST",
      headers: buildHeaders(request),
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({ status: "error", message: "Invalid upstream response" }));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: "OpenMind request failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 },
    );
  }
}
