import { NextResponse } from 'next/server'
import { fetchJsonFromCandidates } from "../../_lib/upstream";

function normalizePercent(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.min(parsed, 100);
}

export async function GET() {
  try {
    const { data, source } = await fetchJsonFromCandidates<Record<string, unknown>>({
      group: "api",
      path: "/api/system-status",
    });
    const system = (data.system as Record<string, unknown> | undefined) || {};

    return NextResponse.json({
      cpu_percent: normalizePercent(system.cpu_percent),
      memory_percent: normalizePercent(system.memory_percent),
      disk_percent: normalizePercent(system.disk_percent),
      uptime: data.uptime ?? null,
      hostname: system.hostname ?? null,
      source,
    });
  } catch (error) {
    console.error("System metrics fetch error:", error);
    return NextResponse.json(
      {
        error: "System metrics upstream is unavailable",
        details: error instanceof Error ? error.message : "unknown error",
      },
      { status: 503 },
    );
  }
}
