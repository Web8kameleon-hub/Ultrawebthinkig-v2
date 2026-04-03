import { NextRequest, NextResponse } from "next/server";

/**
 * Vision Analysis API Proxy
 * Proxies vision/analyze requests to Ocean-Core backend
 * This runs server-side so it can reach the internal Docker network
 */

const OCEAN_INTERNAL_URL =
  process.env.OCEAN_INTERNAL_URL || "http://clisonix-ocean-core:8030";
const OCEAN_CORE_URL = process.env.OCEAN_CORE_URL;
const OCEAN_MULTIMODAL_URL =
  process.env.OCEAN_MULTIMODAL_URL || "http://clisonix-ocean-core-multimodal:8033";

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
  upstreamCandidates: string[],
  body: Record<string, unknown>,
  clerkUserId: string | null,
): Promise<Response> {
  const { default: cbor } = await import("cbor");
  const visionPaths = ["/api/v1/vision", "/api/v1/vision/analyze"];

  const cborHeaders: Record<string, string> = {
    "Content-Type": "application/cbor",
    Accept: "application/cbor, application/json",
  };

  if (clerkUserId) {
    cborHeaders["X-Clerk-User-Id"] = clerkUserId;
    cborHeaders["X-User-ID"] = clerkUserId;
  }

  let lastResponse: Response | null = null;

  for (const upstream of upstreamCandidates) {
    for (const path of visionPaths) {
      const cborResponse = await fetch(`${upstream}${path}`, {
        method: "POST",
        headers: cborHeaders,
        body: new Uint8Array(cbor.encode(body)),
      });

      lastResponse = cborResponse;

      if (cborResponse.status === 404) {
        continue;
      }

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

      const jsonResponse = await fetch(`${upstream}${path}`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify(body),
      });

      lastResponse = jsonResponse;
      if (jsonResponse.status !== 404) {
        return jsonResponse;
      }
    }
  }

  return lastResponse || new Response(JSON.stringify({ message: "Vision upstream unavailable" }), { status: 502 });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const hasVisionPayload = Boolean(
      (typeof body?.image_base64 === "string" && body.image_base64.trim()) ||
        (typeof body?.image_url === "string" && body.image_url.trim()) ||
        (typeof body?.content_base64 === "string" && body.content_base64.trim()),
    );

    if (!hasVisionPayload) {
      return NextResponse.json(
        {
          status: "ok",
          module: "vision",
          mode: "readiness",
          message:
            "Vision endpoint is reachable. Provide `image_base64` for a real image analysis run.",
          accepted_inputs: ["image_base64", "image_url"],
        },
        { status: 200 },
      );
    }

    const clerkUserId = request.headers.get("X-Clerk-User-Id");

    const upstream = resolveOceanUpstream();
    const candidates = [
      OCEAN_MULTIMODAL_URL,
      upstream,
    ]
      .filter((url): url is string => Boolean(url && url.trim()))
      .map((url) => url.replace(/\/+$/, ""));

    const response = await postVisionWithCborFirst(candidates, body, clerkUserId);
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
