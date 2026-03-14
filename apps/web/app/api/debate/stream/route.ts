const PRIMARY_OCEAN_URL = process.env.OCEAN_CORE_URL;
const OCEAN_INTERNAL_URL =
  process.env.OCEAN_INTERNAL_URL || "http://clisonix-ocean-core:8030";
const OCEAN_LOCAL_URL = "http://localhost:8030";
const PUBLIC_OCEAN_URL = process.env.NEXT_PUBLIC_OCEAN_API_URL;
const isDev = process.env.NODE_ENV !== "production";

const DEBATE_PERSONAS = [
  { id: "alba", name: "Alba", emoji: "🌅", role: "Optimist" },
  { id: "albi", name: "Albi", emoji: "🔧", role: "Pragmatist" },
  { id: "jona", name: "Jona", emoji: "🔍", role: "Skeptic" },
  { id: "blerina", name: "Blerina", emoji: "💡", role: "Analyst" },
  { id: "asi", name: "ASI", emoji: "🧠", role: "Meta-Thinker" },
] as const;

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  sq: "Albanian",
  de: "German",
  fr: "French",
  it: "Italian",
  es: "Spanish",
  pt: "Portuguese",
  tr: "Turkish",
  nl: "Dutch",
  pl: "Polish",
};

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

function extractChatText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const data = payload as Record<string, unknown>;
  const candidate =
    data.response ||
    data.ocean_response ||
    data.persona_answer ||
    data.answer ||
    data.text;
  return typeof candidate === "string" ? candidate.trim() : "";
}

async function fetchPersonaResponse(
  upstream: string,
  persona: (typeof DEBATE_PERSONAS)[number],
  topic: string,
  languageCode: string,
  languageName: string,
  conversationContext: string,
  binaryPreferred: boolean,
): Promise<string> {
  const prompt = [
    `You are ${persona.name} (${persona.role}).`,
    `Debate topic: ${topic}`,
    `Respond in ${languageName} (${languageCode}).`,
    conversationContext ? `Conversation memory: ${conversationContext}` : "",
    "Provide one clear perspective with practical reasoning, adapting response depth to topic complexity.",
  ].join("\n");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000);

  try {
    let res: Response;

    if (binaryPreferred) {
      const { default: cbor } = await import("cbor");
      res = await fetch(`${upstream}/api/v1/chat/binary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/cbor",
          Accept: "application/cbor, application/json",
        },
        body: new Uint8Array(
          cbor.encode({
          message: prompt,
          query: prompt,
          language: languageCode,
          response_format: "cbor2",
          long_response: true,
          }),
        ),
        signal: controller.signal,
      });
    } else {
      res = await fetch(`${upstream}/api/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          query: prompt,
          language: languageCode,
          long_response: true,
        }),
        signal: controller.signal,
      });
    }

    if (!res.ok) return `Service returned ${res.status}`;

    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("application/cbor")) {
      const { default: cbor } = await import("cbor");
      const decoded = cbor.decodeFirstSync(Buffer.from(await res.arrayBuffer()));
      return extractChatText(decoded) || "No response";
    }

    const text = await res.text();
    try {
      return extractChatText(JSON.parse(text)) || text.trim() || "No response";
    } catch {
      return text.trim() || "No response";
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(request: Request) {
  try {
    let parsedBody: Record<string, unknown>;
    let topic: string;

    try {
      const text = await request.text();
      if (!text || text.trim() === "") {
        return new Response("Empty request body", { status: 400 });
      }
      parsedBody = JSON.parse(text);
      topic = String(
        parsedBody.topic || parsedBody.prompt || parsedBody.message || "",
      );
    } catch {
      return new Response("Invalid JSON body", { status: 400 });
    }

    if (!topic?.trim()) {
      return new Response("Topic required", { status: 400 });
    }

    const payload = {
      ...parsedBody,
      topic,
      preferred_language:
        typeof parsedBody.preferred_language === "string"
          ? parsedBody.preferred_language
          : typeof parsedBody.language === "string"
            ? parsedBody.language
            : undefined,
    };

    const binaryPreferred =
      parsedBody.response_format === "cbor" ||
      parsedBody.response_format === "cbor2" ||
      parsedBody.response_format === "binary" ||
      parsedBody.binary === true;

    const candidates = buildUpstreamCandidates();
    let upstreamResponse: Response | null = null;
    let lastError = "No upstream candidates configured";

    for (const upstream of candidates) {
      try {
        const candidateResponse = await fetch(`${upstream}/api/v1/debate/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify(payload),
        });

        if (candidateResponse.ok && candidateResponse.body) {
          upstreamResponse = candidateResponse;
          break;
        }

        const errorText = await candidateResponse.text();
        lastError = `Debate stream upstream ${upstream} returned ${candidateResponse.status}: ${errorText}`;
      } catch (upstreamError) {
        lastError =
          upstreamError instanceof Error
            ? upstreamError.message
            : "Unknown upstream connection error";
      }
    }

    if (!upstreamResponse || !upstreamResponse.body) {
      const languageCode =
        typeof parsedBody.preferred_language === "string" && parsedBody.preferred_language.trim()
          ? parsedBody.preferred_language.trim().toLowerCase()
          : "en";
      const languageName =
        typeof parsedBody.language_name === "string" && parsedBody.language_name.trim()
          ? parsedBody.language_name.trim()
          : LANGUAGE_NAMES[languageCode] || languageCode.toUpperCase();
      const conversationContext = Array.isArray(parsedBody.conversation_context)
        ? parsedBody.conversation_context
            .map((item) => String(item || "").trim())
            .filter(Boolean)
            .slice(-8)
            .join(" | ")
        : "";

      const encoder = new TextEncoder();
      const fallbackStream = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for (const upstream of candidates) {
              let succeeded = 0;

              for (const persona of DEBATE_PERSONAS) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: "thinking", persona: persona.id })}\n\n`),
                );

                try {
                  const answer = await fetchPersonaResponse(
                    upstream,
                    persona,
                    topic,
                    languageCode,
                    languageName,
                    conversationContext,
                    binaryPreferred,
                  );

                  const words = answer.split(/\s+/).filter(Boolean);
                  for (const word of words) {
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({ type: "token", persona: persona.id, token: `${word} ` })}\n\n`,
                      ),
                    );
                  }

                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "response",
                        data: {
                          persona: persona.id,
                          name: persona.name,
                          emoji: persona.emoji,
                          role: persona.role,
                          response: answer,
                          status: "success",
                          tokens: words.length,
                        },
                      })}\n\n`,
                    ),
                  );
                  succeeded += 1;
                } catch (error) {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "response",
                        data: {
                          persona: persona.id,
                          name: persona.name,
                          emoji: persona.emoji,
                          role: persona.role,
                          response: error instanceof Error ? error.message : "Fallback failed",
                          status: "error",
                          tokens: 0,
                        },
                      })}\n\n`,
                    ),
                  );
                }
              }

              if (succeeded > 0) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
                return;
              }
            }

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "error", message: `Debate stream unavailable: ${lastError}` })}\n\n`),
            );
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });

      const headers = new Headers({
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      return new Response(fallbackStream, { headers });
    }

    const headers = new Headers({
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    return new Response(upstreamResponse.body, { headers });
  } catch (error) {
    return new Response(
      `Debate stream failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      { status: 500 },
    );
  }
}
