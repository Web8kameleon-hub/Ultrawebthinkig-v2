/**
 * OCEAN STREAMING API - Real-time AI responses
 *
 * This endpoint streams responses from Ocean-Core,
 * so text appears immediately (2-3 seconds) instead of waiting 60+ seconds.
 */

const PRIMARY_OCEAN_URL = process.env.OCEAN_CORE_URL;
const OCEAN_INTERNAL_URL =
  process.env.OCEAN_INTERNAL_URL || "http://clisonix-ocean-core:8030";
const OCEAN_LOCAL_URL = "http://localhost:8030";
const PUBLIC_OCEAN_URL = process.env.NEXT_PUBLIC_OCEAN_API_URL;

function buildUpstreamCandidates(): string[] {
  const ordered = [
    OCEAN_INTERNAL_URL,
    PRIMARY_OCEAN_URL,
    OCEAN_LOCAL_URL,
    PUBLIC_OCEAN_URL,
  ]
    .filter((url): url is string => Boolean(url && url.trim()))
    .map((url) => url.replace(/\/+$/, ""));

  return [...new Set(ordered)];
}

export async function POST(request: Request) {
  try {
    // Parse body with error handling
    let parsedBody: Record<string, unknown>;
    let message: string;
    let language: string | undefined;
    let clerkUserId: string | undefined;
    let userName: string | undefined;
    try {
      const text = await request.text();
      if (!text || text.trim() === "") {
        return new Response("Empty request body", { status: 400 });
      }
      parsedBody = JSON.parse(text);
      message = String(parsedBody.message || parsedBody.query || "");
      language =
        typeof parsedBody.language === "string"
          ? parsedBody.language
          : undefined;
      clerkUserId =
        typeof parsedBody.clerk_user_id === "string"
          ? parsedBody.clerk_user_id
          : undefined;
      userName =
        typeof parsedBody.user_name === "string"
          ? parsedBody.user_name
          : undefined;
    } catch {
      return new Response("Invalid JSON body", { status: 400 });
    }

    if (!message?.trim()) {
      return new Response("Message required", { status: 400 });
    }

    const candidates = buildUpstreamCandidates();
    let response: Response | null = null;
    let lastError = "No upstream candidates configured";

    for (const upstream of candidates) {
      try {
        console.log(
          `[Stream] Connecting to ${upstream}/api/v1/chat/stream with message: ${message.substring(0, 50)}...`,
        );

        const candidateResponse = await fetch(
          `${upstream}/api/v1/chat/stream`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "text/plain, text/event-stream, application/json",
            },
            body: JSON.stringify({
              message,
              query: message,
              language,
              clerk_user_id: clerkUserId,
              user_name: userName,
            }),
          },
        );

        if (candidateResponse.ok) {
          response = candidateResponse;
          break;
        }

        const errorText = await candidateResponse.text();
        lastError = `Ocean-Core error ${candidateResponse.status}: ${errorText}`;
        console.error(`[Stream] ${upstream} failed: ${lastError}`);
      } catch (upstreamError) {
        lastError =
          upstreamError instanceof Error
            ? upstreamError.message
            : "Unknown upstream connection error";
        console.error(`[Stream] ${upstream} fetch failed:`, upstreamError);
      }
    }

    if (!response) {
      return new Response(`Ocean-Core unavailable: ${lastError}`, {
        status: 502,
      });
    }

    if (!response.body) {
      return new Response("Ocean-Core stream body missing", { status: 502 });
    }

    // Stream the response directly to the client
    const headers = new Headers({
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
      "X-Accel-Buffering": "no",
    });

    return new Response(response.body, { headers });
  } catch (error) {
    console.error("Streaming error:", error);
    return new Response(
      `Streaming failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      { status: 500 },
    );
  }
}
