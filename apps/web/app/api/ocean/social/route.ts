import { NextRequest, NextResponse } from "next/server";
import { fetchFromCandidates } from "../../_lib/upstream";

type MediaType = "all" | "video" | "image" | "photo" | "status";
type NodeId = "focus" | "trend" | "visual" | "evidence" | "status" | "discovery";

interface UserDataSource {
  id?: string;
  name?: string;
  type?: string;
  status?: string;
  endpoint?: string | null;
  data_points?: number;
  dataPoints?: number;
  last_sync?: string | null;
  last_data?: string | null;
  updated_at?: string | null;
}

interface RankedResult {
  platform: NodeId;
  mediaType: MediaType;
  url: string;
  score: number;
  reason: string;
  sourceName: string;
}

function parseDataPoints(source: UserDataSource): number {
  const points = Number(source.data_points ?? source.dataPoints ?? 0);
  return Number.isFinite(points) && points > 0 ? points : 0;
}

function hasRecentActivity(source: UserDataSource): boolean {
  const dateValue = source.last_sync ?? source.last_data ?? source.updated_at;
  if (!dateValue) return false;

  const timestamp = Date.parse(dateValue);
  if (!Number.isFinite(timestamp)) return false;

  const ageMs = Date.now() - timestamp;
  return ageMs >= 0 && ageMs <= 7 * 24 * 60 * 60 * 1000;
}

function inferMediaType(source: UserDataSource, requested: MediaType): MediaType {
  if (requested !== "all") return requested;

  const key = `${source.type ?? ""} ${source.name ?? ""} ${source.endpoint ?? ""}`.toLowerCase();
  if (/(image|photo|jpg|jpeg|png)/.test(key)) return "image";
  if (/(video|stream|mp4|webm|hls)/.test(key)) return "video";
  if (/(status|health|state|uptime)/.test(key)) return "status";
  return "all";
}

function inferNode(source: UserDataSource, query: string, requestedMedia: MediaType): NodeId {
  const key = `${source.type ?? ""} ${source.name ?? ""} ${source.endpoint ?? ""} ${query}`.toLowerCase();

  if (requestedMedia === "status" || /(status|health|state|uptime|monitor)/.test(key)) return "status";
  if (requestedMedia === "photo" || /(photo|gallery|evidence|snapshot)/.test(key)) return "evidence";
  if (requestedMedia === "image" || /(image|figure|chart|visual|map)/.test(key)) return "visual";
  if (/(trend|pulse|timeline|history|series)/.test(key)) return "trend";
  if (/(intent|focus|priority|target)/.test(key)) return "focus";
  return "discovery";
}

function scoreSource(source: UserDataSource, queryTerms: string[], requestedMedia: MediaType): { score: number; reasons: string[] } {
  const haystack = `${source.name ?? ""} ${source.type ?? ""} ${source.endpoint ?? ""}`.toLowerCase();
  const reasons: string[] = [];
  let score = 0;

  if ((source.status ?? "").toLowerCase() === "active") {
    score += 20;
    reasons.push("active source");
  }

  const points = parseDataPoints(source);
  if (points > 0) {
    score += Math.min(30, Math.log10(points + 1) * 12);
    reasons.push(`data points ${points}`);
  }

  if (hasRecentActivity(source)) {
    score += 10;
    reasons.push("recent activity");
  }

  let queryMatches = 0;
  for (const term of queryTerms) {
    if (term.length < 2) continue;
    if (haystack.includes(term)) {
      queryMatches += 1;
    }
  }
  if (queryMatches > 0) {
    score += Math.min(45, queryMatches * 12);
    reasons.push(`matched ${queryMatches} query terms`);
  }

  if (requestedMedia !== "all") {
    const inferred = inferMediaType(source, "all");
    if (requestedMedia === inferred || (requestedMedia === "photo" && inferred === "image")) {
      score += 8;
      reasons.push(`media fit ${requestedMedia}`);
    }
  }

  return { score, reasons };
}

function normalizeSourcesPayload(payload: unknown): UserDataSource[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is UserDataSource => item != null && typeof item === "object");
  }

  if (payload && typeof payload === "object") {
    const wrapped = payload as { sources?: unknown };
    if (Array.isArray(wrapped.sources)) {
      return wrapped.sources.filter((item): item is UserDataSource => item != null && typeof item === "object");
    }
  }

  return [];
}

export async function GET(request: NextRequest) {
  const userId = request.headers.get("X-User-ID");

  try {
    const { response, source } = await fetchFromCandidates({
      group: "api",
      path: "/api/user/data-sources",
      headers: userId ? { "X-User-ID": userId } : undefined,
    });

    const payload = await response.json().catch(() => null);
    const sources = normalizeSourcesPayload(payload);
    const active = sources.filter((item) => `${item.status ?? ""}`.toLowerCase() === "active").length;

    return NextResponse.json({
      status: "ok",
      mode: "user-intent",
      source,
      data_sources_total: sources.length,
      data_sources_active: active,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        mode: "user-intent",
        message: error instanceof Error ? error.message : "Unable to load user data sources",
      },
      { status: 503 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action !== "search" && typeof body.query !== "string") {
      return NextResponse.json(
        {
          status: "error",
          mode: "user-intent",
          message: "Only action=search is supported without external platform contracts",
        },
        { status: 422 },
      );
    }

    const query = String(body.query || "").trim();
    const mediaType = String(body.mediaType || "all").toLowerCase() as MediaType;
    const supportedMedia: MediaType[] = ["all", "video", "image", "photo", "status"];

    if (!query) {
      return NextResponse.json({ status: "error", message: "Query is required" }, { status: 400 });
    }

    if (!supportedMedia.includes(mediaType)) {
      return NextResponse.json(
        { status: "error", message: "Unsupported mediaType", supportedMedia },
        { status: 400 },
      );
    }

    const userId = request.headers.get("X-User-ID");
    const { response, source } = await fetchFromCandidates({
      group: "api",
      path: "/api/user/data-sources",
      headers: userId ? { "X-User-ID": userId } : undefined,
    });

    const payload = await response.json().catch(() => null);
    const sources = normalizeSourcesPayload(payload);
    if (sources.length === 0) {
      return NextResponse.json({
        status: "ok",
        mode: "user-intent",
        query,
        mediaType,
        total: 0,
        results: [],
        message: "No connected user data sources found",
        source,
      });
    }

    const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const ranked: RankedResult[] = sources
      .map((item) => {
        const { score, reasons } = scoreSource(item, queryTerms, mediaType);
        const node = inferNode(item, query, mediaType);
        const inferredMedia = inferMediaType(item, mediaType);
        const url = item.endpoint && item.endpoint.trim() ? item.endpoint.trim() : "/modules/user-data";

        return {
          platform: node,
          mediaType: inferredMedia,
          url,
          score,
          reason: reasons.join(" • ") || "matched source context",
          sourceName: item.name?.trim() || item.id || "user-source",
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);

    return NextResponse.json({
      status: "ok",
      mode: "user-intent",
      query,
      mediaType,
      total: ranked.length,
      results: ranked,
      source,
    });
  } catch {
    return NextResponse.json(
      { status: "error", message: "Invalid request body" },
      { status: 400 },
    );
  }
}
