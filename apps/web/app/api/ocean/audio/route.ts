import { NextRequest, NextResponse } from "next/server";

/**
 * Audio Transcription API Proxy
 * Proxies audio/transcribe requests to the real Ocean stack.
 */

const OCEAN_INTERNAL_URL =
  process.env.OCEAN_INTERNAL_URL || "http://clisonix-ocean-core:8030";
const OCEAN_CORE_URL = process.env.OCEAN_CORE_URL;
const OCEAN_MULTIMODAL_URL =
  process.env.OCEAN_MULTIMODAL_URL || "http://clisonix-ocean-core-multimodal:8033";

function buildOceanCandidates(): string[] {
  return [...new Set(
    [OCEAN_MULTIMODAL_URL, OCEAN_INTERNAL_URL, OCEAN_CORE_URL]
      .filter((url): url is string => Boolean(url && url.trim()))
      .map((url) => url.replace(/\/+$/, ""))
  )];
}

async function normalizeAudioPayload(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const payload = { ...body };
  if (typeof payload.language !== "string" || !payload.language.trim()) {
    payload.language = "en";
  }

  const hasAudioBase64 = typeof payload.audio_base64 === "string" && payload.audio_base64.trim().length > 0;
  const audioUrl = typeof payload.audio_url === "string" ? payload.audio_url.trim() : "";

  if (!hasAudioBase64 && audioUrl) {
    const remote = await fetch(audioUrl, { cache: "no-store" });
    if (remote.ok) {
      const buffer = Buffer.from(await remote.arrayBuffer());
      payload.audio_base64 = buffer.toString("base64");
      if (typeof payload.filename !== "string") {
        payload.filename = audioUrl.split("/").pop() || "sample-audio.wav";
      }
    }
  }

  return payload;
}

async function postToAudioUpstream(payload: Record<string, unknown>, headers: Record<string, string>): Promise<Response> {
  const paths = ["/api/v1/audio/transcribe", "/api/v1/audio"];
  let lastResponse: Response | null = null;

  for (const upstream of buildOceanCandidates()) {
    for (const path of paths) {
      const response = await fetch(`${upstream}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      lastResponse = response;
      if (response.status !== 404) {
        return response;
      }
    }
  }

  return lastResponse || new Response(
    JSON.stringify({ status: "error", message: "Audio upstream unavailable." }),
    { status: 502, headers: { "Content-Type": "application/json" } },
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    if (
      typeof body.audio_base64 !== "string" &&
      typeof body.audio_url !== "string"
    ) {
      return NextResponse.json(
        {
          status: "error",
          message: "Provide `audio_base64` or `audio_url` for transcription.",
        },
        { status: 400 },
      );
    }

    const payload = await normalizeAudioPayload(body);

    if (typeof payload.audio_base64 !== "string" || !payload.audio_base64.trim()) {
      return NextResponse.json(
        {
          status: "error",
          message: "Unable to load audio content from the provided input.",
        },
        { status: 400 },
      );
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    const clerkUserId = request.headers.get("X-Clerk-User-Id");
    if (clerkUserId) {
      headers["X-Clerk-User-Id"] = clerkUserId;
      headers["X-User-ID"] = clerkUserId;
    }

    const response = await postToAudioUpstream(payload, headers);
    const data = await response.json().catch(() => ({ status: response.ok ? "ok" : "error" }));

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
