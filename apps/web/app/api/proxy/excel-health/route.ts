import { NextResponse } from "next/server";
import { fetchJsonFromCandidates } from "../../_lib/upstream";

const EXCEL_API = process.env.EXCEL_API_URL || null;

export async function GET() {
  if (EXCEL_API) {
    try {
      const response = await fetch(`${EXCEL_API}/health`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return NextResponse.json(
          { error: "API returned non-200 status", status: response.status },
          { status: response.status },
        );
      }

      const data = await response.json();
      return NextResponse.json(data, { status: 200 });
    } catch (error) {
      return NextResponse.json(
        { error: "Failed to connect to Excel Service", details: String(error) },
        { status: 503 },
      );
    }
  }

  try {
    const { data, source } = await fetchJsonFromCandidates<Record<string, unknown>>({
      group: "api",
      path: "/api/reporting/excel-health",
    });
    return NextResponse.json({ ...data, source }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Excel service unavailable",
        details: String(error),
      },
      { status: 503 },
    );
  }
}
