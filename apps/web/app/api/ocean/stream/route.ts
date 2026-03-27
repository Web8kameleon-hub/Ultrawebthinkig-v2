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
const isDev = process.env.NODE_ENV !== "production";

function buildUpstreamCandidates(): string[] {
  const ordered = [
    OCEAN_INTERNAL_URL,
    PRIMARY_OCEAN_URL,
    isDev ? OCEAN_LOCAL_URL : undefined,
    PUBLIC_OCEAN_URL,
  ]
    .filter((url): url is string => Boolean(url && url.trim()))
    .map((url) => url.replace(/\/+$/, ""));

  return [...new Set(ordered)];
}

export async function POST(request: Request) {
  try {
    let body: {
      message?: string;
      question?: string;
      query?: string;
      language?: string;
      clerk_user_id?: string;
      user_name?: string;
      [key: string]: unknown;
    } = {};

    const rawBody = await request.text();

    if (rawBody.trim()) {
      try {
        body = JSON.parse(rawBody) as typeof body;
      } catch {
        try {
          body = JSON.parse(rawBody.replace(/\\"/g, '"')) as typeof body;
        } catch {
          const params = new URLSearchParams(rawBody);
          const formMessage =
            params.get("message") ||
            params.get("question") ||
            params.get("query");
          if (formMessage) {
            body = { message: formMessage };
          } else {
            body = { message: rawBody };
          }
        }
      }
    }

    const message = String(body.message || body.question || body.query || "").trim();
    const language = typeof body.language === "string" ? body.language : undefined;
    const clerkUserId =
      typeof body.clerk_user_id === "string" ? body.clerk_user_id : undefined;
    const userName = typeof body.user_name === "string" ? body.user_name : undefined;

    if (!message) {
      return new Response("message or question required", { status: 422 });
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
              Accept: "text/event-stream",
            },
            body: JSON.stringify({
              message,
              query: message,
              language,
              clerk_user_id: clerkUserId,
              user_name: userName,
              enable_companion: false,
              enable_feeling_layer: false,
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
        const messageText =
          upstreamError instanceof Error
            ? upstreamError.message
            : "Unknown upstream connection error";
        const code =
          typeof upstreamError === "object" &&
          upstreamError !== null &&
          "cause" in upstreamError &&
          typeof (upstreamError as { cause?: unknown }).cause === "object" &&
          (upstreamError as { cause?: { code?: string } }).cause?.code
            ? (upstreamError as { cause: { code: string } }).cause.code
            : undefined;

        lastError = messageText;
        const retriableNetworkError =
          messageText.includes("ENOTFOUND") ||
          messageText.includes("ECONNREFUSED") ||
          messageText.includes("ECONNRESET") ||
          messageText.includes("ETIMEDOUT") ||
          messageText.toLowerCase().includes("fetch failed") ||
          code === "ENOTFOUND" ||
          code === "ECONNREFUSED" ||
          code === "ECONNRESET" ||
          code === "ETIMEDOUT";

        if (!retriableNetworkError) {
          throw upstreamError;
        }

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

    const headers = new Headers({
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Content-Encoding": "identity",
    });

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = response!.body!.getReader();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value) continue;
            controller.enqueue(value);
          }
        } catch (streamError) {
          const errorMessage =
            streamError instanceof Error
              ? streamError.message
              : "Unknown stream error";
          console.error("[Stream] relay error:", errorMessage);
        } finally {
          controller.close();
          reader.releaseLock();
        }
      },
    });

    return new Response(stream, { headers });
  } catch (error) {
    console.error("Streaming error:", error);
    return new Response(
      `Streaming failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      { status: 500 },
    );
  }
}
