import { NextResponse } from 'next/server';
import { fetchJsonFromCandidates } from "../../_lib/upstream";

export async function GET() {
  try {
    const { data } = await fetchJsonFromCandidates<Record<string, unknown>>({
      group: "reporting",
      path: "/api/reporting/dashboard",
    });
    const errors = Array.isArray(data?.errors)
      ? data.errors
      : Array.isArray(data?.alerts)
        ? data.alerts
        : Array.isArray(data?.recent_errors)
          ? data.recent_errors
          : [];

    const errorTypes = errors.reduce(
      (acc: Record<string, number>, item: any) => {
        const key = String(item?.error_type || item?.type || "unknown");
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {},
    );

    const functionCounts = errors.reduce(
      (acc: Record<string, number>, item: any) => {
        const key = String(item?.function_name || item?.function || "unknown");
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {},
    );

    const mostCommonFunction =
      Object.entries(functionCounts).sort(
        (a, b) => Number(b[1]) - Number(a[1]),
      )[0]?.[0] || "unknown";

    return NextResponse.json(
      {
        total_errors: errors.length,
        error_types: errorTypes,
        most_common_function: mostCommonFunction,
        source: "dashboard-derived",
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to connect to reporting service', details: String(error) },
      { status: 503 }
    );
  }
}
