/**
 * OCEAN STREAMING API - Real-time AI responses
 *
 * This endpoint streams responses from Ocean-Core,
 * so text appears immediately (2-3 seconds) instead of waiting 60+ seconds.
 */

const PRIMARY_OCEAN_URL = process.env.OCEAN_CORE_URL;
const OCEAN_INTERNAL_URL =
  process.env.OCEAN_INTERNAL_URL || "http://clisonix-ocean-core:8030";

function buildOceanPrompt(question: string, language?: string): string {
  // Pass question as-is — language handling is done by Ocean Core orchestrator
  return question;
}

function resolveOceanUpstream(): string {
  const upstream = (OCEAN_INTERNAL_URL || PRIMARY_OCEAN_URL || "").trim();
  if (!upstream) {
    throw new Error("Ocean upstream is not configured");
  }
  return upstream.replace(/\/+$/, "");
}

async function parseIncomingBody(
  request: Request,
): Promise<Record<string, unknown>> {
  const contentType = (request.headers.get("content-type") || "").toLowerCase();

  if (contentType.includes("application/cbor")) {
    try {
      const { default: cbor } = await import("cbor");
      const raw = await request.arrayBuffer();
      const decoded = cbor.decodeFirstSync(Buffer.from(raw));
      if (decoded && typeof decoded === "object") {
        return decoded as Record<string, unknown>;
      }
      return {};
    } catch (error) {
      throw new Error(
        `CBOR decode failed: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  }

  const text = await request.text();
  if (!text || text.trim() === "") {
    throw new Error("Empty request body");
  }

  return JSON.parse(text) as Record<string, unknown>;
}

export async function POST(request: Request) {
  try {
    let parsedBody: Record<string, unknown>;
    let message: string;
    let messages: Array<{ role?: string; content?: string }> | undefined;
    let language: string | undefined;
    let clerkUserId: string | undefined;
    let userName: string | undefined;
    try {
      parsedBody = await parseIncomingBody(request);
      message = String(parsedBody.message || parsedBody.query || "");
      messages = Array.isArray(parsedBody.messages)
        ? (
            parsedBody.messages as Array<{ role?: string; content?: string }>
          ).filter(
            (item) =>
              item &&
              typeof item === "object" &&
              typeof item.content === "string" &&
              item.content.trim().length > 0,
          )
        : undefined;
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
    } catch (parseError) {
      return new Response(
        `Invalid request body: ${parseError instanceof Error ? parseError.message : "unknown"}`,
        { status: 400 },
      );
    }

    if (!message?.trim()) {
      return new Response("Message required", { status: 400 });
    }

    const prompt = buildOceanPrompt(message, language);

    const upstream = resolveOceanUpstream();
    console.log(
      `[Stream] Connecting to ${upstream}/api/v1/chat/stream with message: ${message.substring(0, 50)}...`,
    );

    const response = await fetch(`${upstream}/api/v1/chat/stream`, {
      method: "POST",
      signal: AbortSignal.timeout(120000),
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        message: prompt,
        query: prompt,
        messages,
        language,
        user_language: language,
        clerk_user_id: clerkUserId,
        user_name: userName,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(errorText || "Ocean-Core stream failed", {
        status: response.status,
      });
    }

    if (!response.body) {
      return new Response("Ocean-Core stream body missing", { status: 502 });
    }

    // Stream with immediate start signal (<~2s perceived startup)
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const upstreamReader = response.body.getReader();
    const upstreamContentType = response.headers.get("content-type") || "";
    const upstreamIsSSE = upstreamContentType
      .toLowerCase()
      .includes("text/event-stream");

    const merged = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(
          encoder.encode('data: {"status":"stream_started"}\n\n'),
        );

        const readEventBlock = (
          buffer: string,
        ): { eventBlock: string; rest: string } | null => {
          const boundaries = [
            buffer.indexOf("\n\n"),
            buffer.indexOf("\r\n\r\n"),
          ]
            .filter((idx) => idx >= 0)
            .sort((a, b) => a - b);

          if (boundaries.length === 0) {
            return null;
          }

          const boundary = boundaries[0];
          const isCrLf = buffer.slice(boundary, boundary + 4) === "\r\n\r\n";
          const separatorLength = isCrLf ? 4 : 2;

          return {
            eventBlock: buffer.slice(0, boundary),
            rest: buffer.slice(boundary + separatorLength),
          };
        };

        const emitChunk = (chunk: string) => {
          if (!chunk) return;
          const size = 24;
          if (chunk.length <= size) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`),
            );
            return;
          }
          for (let i = 0; i < chunk.length; i += size) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ chunk: chunk.slice(i, i + size) })}\n\n`,
              ),
            );
          }
        };

        try {
          let sseBuffer = "";
          while (true) {
            const { done, value } = await upstreamReader.read();
            if (done) break;
            if (!value) continue;

            if (upstreamIsSSE) {
              sseBuffer += decoder.decode(value, { stream: true });

              while (true) {
                const nextEvent = readEventBlock(sseBuffer);
                if (!nextEvent) break;

                const eventBlock = nextEvent.eventBlock;
                sseBuffer = nextEvent.rest;

                const lines = eventBlock
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean);

                for (const line of lines) {
                  if (!line.startsWith("data:")) continue;

                  const payload = line.slice(5).trim();
                  if (!payload) continue;

                  if (payload === "[DONE]") {
                    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                    continue;
                  }

                  try {
                    const parsed = JSON.parse(payload) as {
                      status?: string;
                      chunk?: string;
                      error?: string;
                      metadata?: unknown;
                    };

                    if (
                      parsed?.status === "stream_started" ||
                      parsed?.status === "connected" ||
                      parsed?.status === "complete" ||
                      typeof parsed?.metadata !== "undefined"
                    ) {
                      continue;
                    }

                    if (typeof parsed?.error === "string") {
                      controller.enqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({ chunk: `⚠️ ${parsed.error}` })}\n\n`,
                        ),
                      );
                      continue;
                    }

                    if (typeof parsed?.chunk === "string") {
                      emitChunk(parsed.chunk);
                      continue;
                    }
                  } catch {
                    emitChunk(payload);
                    continue;
                  }

                  emitChunk(payload);
                }
              }

              continue;
            }

            const textChunk = decoder.decode(value, { stream: true });
            if (textChunk) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ chunk: textChunk })}\n\n`,
                ),
              );
            }
          }

          if (upstreamIsSSE) {
            if (sseBuffer.trim()) {
              try {
                const parsed = JSON.parse(
                  sseBuffer.replace(/^data:\s*/, "").trim(),
                ) as {
                  status?: string;
                  chunk?: string;
                  error?: string;
                  metadata?: unknown;
                };
                if (
                  parsed?.status !== "stream_started" &&
                  parsed?.status !== "connected" &&
                  parsed?.status !== "complete" &&
                  typeof parsed?.metadata === "undefined" &&
                  typeof parsed?.chunk === "string"
                ) {
                  emitChunk(parsed.chunk);
                } else if (typeof parsed?.error === "string") {
                  emitChunk(`⚠️ ${parsed.error}`);
                }
              } catch {
                const cleaned = sseBuffer
                  .replace(/^data:\s*/gm, "")
                  .replace(/\n+/g, " ")
                  .trim();
                emitChunk(cleaned);
              }
            }
          } else {
            const remaining = decoder.decode();
            if (remaining) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ chunk: remaining })}\n\n`,
                ),
              );
            }
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } finally {
          controller.close();
        }
      },
      cancel() {
        upstreamReader.cancel().catch(() => undefined);
      },
    });

    const headers = new Headers({
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    return new Response(merged, { headers });
  } catch (error) {
    console.error("Streaming error:", error);
    return new Response(
      `Streaming failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      { status: 500 },
    );
  }
}
