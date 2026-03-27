import { NextRequest, NextResponse } from "next/server";

const isDev = process.env.NODE_ENV !== "production";
const OPENMIND_BASE =
  process.env.OPENMIND_INTERNAL_URL || process.env.OPENMIND_URL;
const OPENMIND_FALLBACK = isDev
  ? "http://localhost:9999"
  : "http://clisonix-openmind:9999";
const OLLAMA_MULTI_BASE =
  process.env.OPENMIND_OLLAMA_URL ||
  process.env.OLLAMA_MULTI_API_URL ||
  (isDev ? "http://localhost:4444" : "http://clisonix-ollama-multi-api:4444");

function getCandidates(): string[] {
  return [OPENMIND_BASE, OPENMIND_FALLBACK, OLLAMA_MULTI_BASE]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map((value) => value.replace(/\/+$/, ""));
}

function buildHeaders(request: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const clerkUserId = request.headers.get("X-Clerk-User-Id");
  if (clerkUserId) {
    headers["X-Clerk-User-Id"] = clerkUserId;
    headers["X-User-ID"] = clerkUserId;
  }

  return headers;
}

export async function GET(request: NextRequest) {
  const pathParam = request.nextUrl.searchParams.get("path") || "status";
  const allowed = new Set(["status", "health", "providers", "models"]);

  if (!allowed.has(pathParam)) {
    return NextResponse.json(
      {
        status: "error",
        message: "Unsupported path",
        allowed: Array.from(allowed),
      },
      { status: 400 },
    );
  }

  let lastError = "OpenMind service unavailable";

  for (const baseUrl of getCandidates()) {
    try {
      const endpointForPath =
        pathParam === "models"
          ? [`${baseUrl}/api/openmind/models`, `${baseUrl}/models`]
          : pathParam === "providers"
            ? [`${baseUrl}/api/openmind/providers`, `${baseUrl}/models`]
            : [`${baseUrl}/status`, `${baseUrl}/health`];

      for (const endpoint of endpointForPath) {
        const response = await fetch(endpoint, {
          method: "GET",
          headers: buildHeaders(request),
          cache: "no-store",
        });

        if (!response.ok) {
          lastError = `${endpoint} returned ${response.status}`;
          continue;
        }

        const data = await response
          .json()
          .catch(() => ({
            status: "error",
            message: "Invalid upstream response",
          }));

        if (pathParam === "status" || pathParam === "health") {
          const modelsCount =
            typeof data?.models_available === "number"
              ? data.models_available
              : 0;
          const models = Array.isArray(data?.models)
            ? data.models
            : Array.isArray(data)
              ? data
              : [];

          return NextResponse.json({
            service: "openmind",
            ready: Boolean(
              data?.ready ??
              data?.ollama_reachable ??
              data?.status === "healthy",
            ),
            default_model:
              data?.default_model ||
              (Array.isArray(models) && models.length > 0
                ? typeof models[0] === "string"
                  ? models[0]
                  : models[0]?.name || "llama3.1:8b"
                : "llama3.1:8b"),
            ollama_reachable: Boolean(
              data?.ollama_reachable ?? data?.status === "healthy",
            ),
            models_available:
              modelsCount || (Array.isArray(models) ? models.length : 0),
          });
        }

        if (pathParam === "models") {
          const modelList = Array.isArray(data)
            ? data.map((item: any) => item?.name || item).filter(Boolean)
            : Array.isArray(data?.models)
              ? data.models
                  .map((item: any) => item?.name || item)
                  .filter(Boolean)
              : [];

          return NextResponse.json({ models: modelList });
        }

        if (pathParam === "providers") {
          return NextResponse.json({ providers: ["ollama", "openmind"] });
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown error";
    }
  }

  return NextResponse.json(
    {
      status: "error",
      message: "OpenMind service unavailable",
      details: lastError,
    },
    { status: 502 },
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let lastError = "OpenMind request failed";

    for (const baseUrl of getCandidates()) {
      const endpoints = [
        `${baseUrl}/api/openmind`,
        `${baseUrl}/api/v1/generate`,
      ];

      for (const endpoint of endpoints) {
        try {
          const payload = endpoint.endsWith("/api/v1/generate")
            ? {
                prompt: body?.message || body?.prompt || "",
                strategy: "balanced",
                force_model: body?.model,
              }
            : body;

          const response = await fetch(endpoint, {
            method: "POST",
            headers: buildHeaders(request),
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            lastError = `${endpoint} returned ${response.status}`;
            continue;
          }

          const data = await response
            .json()
            .catch(() => ({
              status: "error",
              message: "Invalid upstream response",
            }));

          if (endpoint.endsWith("/api/v1/generate")) {
            return NextResponse.json(
              {
                response: data?.content || "",
                model: data?.model || body?.model || "llama3.1:8b",
                provider: body?.provider || "ollama",
              },
              { status: 200 },
            );
          }

          return NextResponse.json(data, { status: response.status });
        } catch (error) {
          lastError = error instanceof Error ? error.message : "Unknown error";
        }
      }
    }

    return NextResponse.json(
      {
        status: "error",
        message: "OpenMind request failed",
        details: lastError,
      },
      { status: 502 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: "OpenMind request failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 },
    );
  }
}
