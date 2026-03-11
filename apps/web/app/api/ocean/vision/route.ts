import { NextRequest, NextResponse } from "next/server";

/**
 * Vision Analysis API Proxy
 * Proxies vision/analyze requests to Ocean-Core backend
 * This runs server-side so it can reach the internal Docker network
 */

const OCEAN_INTERNAL_URL =
  process.env.OCEAN_INTERNAL_URL || "http://clisonix-ocean-core:8030";
const OCEAN_CORE_URL = process.env.OCEAN_CORE_URL;

function resolveOceanUpstream(): string {
  const upstream = (OCEAN_INTERNAL_URL || OCEAN_CORE_URL || "").trim();
  if (!upstream) {
    throw new Error("Ocean vision upstream is not configured");
  }
  return upstream.replace(/\/+$/, "");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Forward auth headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const clerkUserId = request.headers.get("X-Clerk-User-Id");
    if (clerkUserId) {
      headers["X-Clerk-User-Id"] = clerkUserId;
      headers["X-User-ID"] = clerkUserId;
    }

    const upstream = resolveOceanUpstream();
    const response = await fetch(`${upstream}/api/v1/vision/analyze`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (response.status === 404) {
      return NextResponse.json(
        {
          status: "error",
          message: "Ocean vision module not found.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[Vision Proxy] Error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Vision analysis service unavailable. Please try again.",
      },
      { status: 502 }
    );
  }
}
