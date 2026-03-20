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

async function decodeUpstreamPayload(
  response: Response,
): Promise<Record<string, unknown>> {
  const contentType = (
    response.headers.get("content-type") || ""
  ).toLowerCase();

  if (contentType.includes("application/cbor")) {
    try {
      const { default: cbor } = await import("cbor");
      const raw = Buffer.from(await response.arrayBuffer());
      const decoded = cbor.decodeFirstSync(raw);
      if (decoded && typeof decoded === "object") {
        return decoded as Record<string, unknown>;
      }
    } catch {
      return {};
    }
    return {};
  }

  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function postVisionWithCborFirst(
  upstream: string,
  body: Record<string, unknown>,
  clerkUserId: string | null,
): Promise<Response> {
  const { default: cbor } = await import("cbor");

  const cborHeaders: Record<string, string> = {
    "Content-Type": "application/cbor",
    Accept: "application/cbor, application/json",
  };

  if (clerkUserId) {
    cborHeaders["X-Clerk-User-Id"] = clerkUserId;
    cborHeaders["X-User-ID"] = clerkUserId;
  }

  const cborResponse = await fetch(`${upstream}/api/v1/vision/analyze`, {
    method: "POST",
    headers: cborHeaders,
    body: new Uint8Array(cbor.encode(body)),
  });

  if (![400, 415, 422].includes(cborResponse.status)) {
    return cborResponse;
  }

  const jsonHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (clerkUserId) {
    jsonHeaders["X-Clerk-User-Id"] = clerkUserId;
    jsonHeaders["X-User-ID"] = clerkUserId;
  }

  return fetch(`${upstream}/api/v1/vision/analyze`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const clerkUserId = request.headers.get("X-Clerk-User-Id");

    const upstream = resolveOceanUpstream();
    const response = await postVisionWithCborFirst(upstream, body, clerkUserId);
    const data = await decodeUpstreamPayload(response);

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
      { status: 502 },
    );
  }
}
