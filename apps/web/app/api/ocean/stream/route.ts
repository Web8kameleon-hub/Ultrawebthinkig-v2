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
              Accept: "text/event-stream",
            },
            body: JSON.stringify({
              message,
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

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    const upstreamIsSSE = contentType.includes("text/event-stream");
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = response!.body!.getReader();
        let pending = "";

        try {
          if (!upstreamIsSSE) {
            controller.enqueue(
              encoder.encode('data: {"status":"stream_started"}\n\n'),
            );
          }

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value) continue;

            if (upstreamIsSSE) {
              controller.enqueue(value);
              continue;
            }

            pending += decoder.decode(value, { stream: true });
            while (pending.length >= 24) {
              const chunk = pending.slice(0, 24);
              pending = pending.slice(24);
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ chunk })}\n\n`,
                ),
              );
            }
          }

          if (!upstreamIsSSE && pending.length > 0) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ chunk: pending })}\n\n`,
              ),
            );
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          }
        } catch (streamError) {
          const errorMessage =
            streamError instanceof Error
              ? streamError.message
              : "Unknown stream error";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`),
          );
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
