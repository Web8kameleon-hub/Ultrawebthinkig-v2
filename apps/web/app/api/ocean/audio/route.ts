import { NextRequest, NextResponse } from "next/server";

/**
 * Audio Transcription API Proxy
 * Proxies audio/transcribe requests to Ocean-Core backend (Faster-Whisper)
 * This runs server-side so it can reach the internal Docker network
 */

const OCEAN_INTERNAL_URL =
  process.env.OCEAN_INTERNAL_URL || "http://clisonix-ocean-core:8030";
const OCEAN_CORE_URL = process.env.OCEAN_CORE_URL;

function resolveOceanUpstream(): string {
  const upstream = (OCEAN_INTERNAL_URL || OCEAN_CORE_URL || "").trim();
  if (!upstream) {
    throw new Error("Ocean audio upstream is not configured");
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
    const response = await fetch(`${upstream}/api/v1/audio/transcribe`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (response.status === 404) {
      return NextResponse.json(
        {
          status: "error",
          message: "Ocean audio module not found.",
        },
        { status: 404 },
      );
    }

    const accept = request.headers.get("accept") || "";
    if (accept.includes("application/cbor")) {
      const { default: cbor } = await import("cbor");
      const encoded = cbor.encode(data);
      return new NextResponse(encoded as unknown as BodyInit, {
        status: response.status,
        headers: { "Content-Type": "application/cbor" },
      });
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[Audio Proxy] Error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Audio transcription service unavailable. Please try again.",
      },
      { status: 502 }
    );
  }
}
