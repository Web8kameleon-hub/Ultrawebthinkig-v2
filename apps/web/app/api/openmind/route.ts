import { NextRequest, NextResponse } from "next/server";

const OPENMIND_BASE =
  process.env.OPENMIND_INTERNAL_URL || process.env.OPENMIND_URL;
function getOpenmindBase(): string | null {
  if (!OPENMIND_BASE || !OPENMIND_BASE.trim()) {
    return null;
  }
  return OPENMIND_BASE.replace(/\/+$/, "");
}

function buildHeaders(request: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const userId =
    request.headers.get("X-User-ID") || request.headers.get("X-User-Id");
  if (userId) {
    headers["X-User-ID"] = userId;
    headers["X-User-Id"] = userId;
  }

  return headers;
}

export async function GET(request: NextRequest) {
  const baseUrl = getOpenmindBase();
  if (!baseUrl) {
    return NextResponse.json(
      {
        status: "error",
        message: "OpenMind upstream is not configured",
      },
      { status: 503 },
    );
  }

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

  try {
    const endpoint =
      pathParam === "models"
        ? `${baseUrl}/api/openmind/models`
        : pathParam === "providers"
          ? `${baseUrl}/api/openmind/providers`
          : pathParam === "status"
            ? `${baseUrl}/status`
            : `${baseUrl}/health`;

    const response = await fetch(endpoint, {
      method: "GET",
      headers: buildHeaders(request),
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          status: "error",
          message: `OpenMind upstream returned ${response.status}`,
        },
        { status: response.status >= 500 ? 503 : response.status },
      );
    }

    const data = await response.json().catch(() => ({
      status: "error",
      message: "Invalid upstream response",
    }));

    if (pathParam === "status" || pathParam === "health") {
      const modelsCount =
        typeof data?.models_available === "number" ? data.models_available : 0;
      const models = Array.isArray(data?.models)
        ? data.models
        : Array.isArray(data)
          ? data
          : [];

      return NextResponse.json({
        service: "openmind",
        ready: Boolean(
          data?.ready ?? data?.ollama_reachable ?? data?.status === "healthy",
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
          ? data.models.map((item: any) => item?.name || item).filter(Boolean)
          : [];

      return NextResponse.json({ models: modelList });
    }

    const providerList = Array.isArray(data?.providers) ? data.providers : [];
    return NextResponse.json({ providers: providerList });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: "OpenMind service unavailable",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 },
    );
  }
}

export async function POST(request: NextRequest) {
  const baseUrl = getOpenmindBase();
  if (!baseUrl) {
    return NextResponse.json(
      {
        status: "error",
        message: "OpenMind upstream is not configured",
      },
      { status: 503 },
    );
  }

  try {
    const body = await request.json();
    const endpoint = `${baseUrl}/api/openmind`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: buildHeaders(request),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          status: "error",
          message: `OpenMind upstream returned ${response.status}`,
        },
        { status: response.status >= 500 ? 503 : response.status },
      );
    }

    const data = await response.json().catch(() => ({
      status: "error",
      message: "Invalid upstream response",
    }));

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: "OpenMind request failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 },
    );
  }
}
