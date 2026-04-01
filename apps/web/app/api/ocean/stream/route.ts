/**
 * OCEAN STREAMING API - Real-time AI responses
 *
 * This endpoint streams responses from Ocean-Core,
 * so text appears immediately (2-3 seconds) instead of waiting 60+ seconds.
 */

// Allow up to 120s for ocean-core LLM processing
export const maxDuration = 120;

import {
  buildOceanStreamFallback,
  buildProjectSystemMessage,
  getProjectContext,
  hasProjectContext,
} from "../../../../lib/agent.js";
import { buildHumanThinkingSystemPrompt } from "../../../../lib/oceanHumanThinking";
import {
  buildWebResearchSystemMessage,
  performWebResearch,
  shouldUseWebResearch,
} from "../../../../lib/oceanResearch";
import {
  buildDecisionSupport,
  buildDecisionSystemMessage,
  shouldUseDecisionMode,
} from "../../../../lib/oceanDecisionSupport";

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

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function normalizeIncomingMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      const role =
        item && typeof item === "object" && "role" in item
          ? String((item as { role?: unknown }).role || "")
          : "";
      const content =
        item && typeof item === "object" && "content" in item
          ? String((item as { content?: unknown }).content || "")
          : "";

      if (!content.trim()) return null;

      const normalizedRole: ChatMessage["role"] =
        role === "system" || role === "assistant" || role === "user"
          ? role
          : "user";

      return { role: normalizedRole, content: content.trim() };
    })
    .filter((item): item is ChatMessage => Boolean(item));
}

function makeSsePayload(text: string): Uint8Array {
  const payload = `data: ${JSON.stringify({ chunk: text })}\n\n`;
  return new TextEncoder().encode(payload);
}

function makeDoneSsePayload(): Uint8Array {
  return new TextEncoder().encode("data: [DONE]\\n\\n");
}

function sseHeaders(): Headers {
  return new Headers({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    "Content-Encoding": "identity",
  });
}

function makeFallbackSseResponse(message: string): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(makeSsePayload(message));
      controller.enqueue(makeDoneSsePayload());
      controller.close();
    },
  });

  return new Response(stream, { headers: sseHeaders() });
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
    const incomingMessages = normalizeIncomingMessages(body.messages);

    if (!message) {
      return new Response("message or question required", { status: 422 });
    }

    let projectContext = await getProjectContext();
    if (!hasProjectContext(projectContext)) {
      projectContext = await getProjectContext({ forceRefresh: true });
    }

    const contextSystemMessage: ChatMessage = {
      role: "system",
      content: buildProjectSystemMessage(projectContext),
    };
    const humanThinkingSystemMessage: ChatMessage = {
      role: "system",
      content: buildHumanThinkingSystemPrompt(language),
    };
    const webResearchRequested =
      body.web_research === true ||
      body.use_web === true ||
      shouldUseWebResearch(message);
    const researchPacket = webResearchRequested
      ? await performWebResearch(message)
      : null;
    const webResearchSystemMessage =
      buildWebResearchSystemMessage(researchPacket);
    const decisionSupport =
      body.decision_mode === true || shouldUseDecisionMode(message)
        ? buildDecisionSupport(message, researchPacket)
        : null;
    const decisionSystemMessage = buildDecisionSystemMessage(
      message,
      decisionSupport,
    );

    const stitchedMessages = [
      contextSystemMessage,
      humanThinkingSystemMessage,
      ...(webResearchSystemMessage
        ? ([
            {
              role: "system" as const,
              content: webResearchSystemMessage,
            },
          ] as const)
        : []),
      ...(decisionSystemMessage
        ? ([
            {
              role: "system" as const,
              content: decisionSystemMessage,
            },
          ] as const)
        : []),
      ...incomingMessages.slice(-16),
    ];

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
              messages: stitchedMessages,
              project_context: {
                project_name: projectContext.projectName,
                project_version: projectContext.projectVersion,
                branch: projectContext.git?.branch,
                commit: projectContext.git?.commit,
                generated_at: projectContext.generatedAt,
              },
              clerk_user_id: clerkUserId,
              user_name: userName,
              enable_companion: true,
              enable_feeling_layer: true,
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
      const fallback = buildOceanStreamFallback({
        reason: lastError,
        userMessage: message,
        context: projectContext,
      });
      return makeFallbackSseResponse(fallback);
    }

    if (!response.body) {
      const fallback = buildOceanStreamFallback({
        reason: "stream body missing",
        userMessage: message,
        context: projectContext,
      });
      return makeFallbackSseResponse(fallback);
    }

    const headers = sseHeaders();
    const relayFallback = buildOceanStreamFallback({
      reason: lastError,
      userMessage: message,
      context: projectContext,
    });

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = response!.body!.getReader();
        let emittedChunk = false;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value) continue;
            emittedChunk = true;
            controller.enqueue(value);
          }
        } catch (streamError) {
          const errorMessage =
            streamError instanceof Error
              ? streamError.message
              : "Unknown stream error";
          console.error("[Stream] relay error:", errorMessage);
          if (!emittedChunk) {
            controller.enqueue(makeSsePayload(relayFallback));
            controller.enqueue(makeDoneSsePayload());
          }
        } finally {
          controller.close();
          reader.releaseLock();
        }
      },
    });

    return new Response(stream, { headers });
  } catch (error) {
    console.error("Streaming error:", error);
    const projectContext = await getProjectContext({
      forceRefresh: true,
    }).catch(() => null);
    const fallback = buildOceanStreamFallback({
      reason: error instanceof Error ? error.message : "Unknown error",
      userMessage: undefined,
      context: projectContext,
    });
    return makeFallbackSseResponse(fallback);
  }
}
