import { NextResponse } from 'next/server'
import { fetchJsonFromCandidates } from "../../_lib/upstream";

const REPORTING_PATH = "/api/reporting/docker-containers";

async function fetchDockerContainers() {
  const { data, source } = await fetchJsonFromCandidates<Record<string, unknown>>({
    group: "reporting",
    path: REPORTING_PATH,
  });

  if (
    typeof data?.running === "number" ||
    Array.isArray(data?.containers)
  ) {
    return { data, source };
  }

  throw new Error(`${source} -> invalid payload`);
}

export async function GET() {
  try {
    const { data, source } = await fetchDockerContainers();
    return NextResponse.json({ ...data, source }, { status: 200 });
  } catch (error) {
    console.error("Docker containers fetch error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "unknown error",
      },
      { status: 503 },
    );
  }
}
