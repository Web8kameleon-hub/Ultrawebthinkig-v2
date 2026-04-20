import { NextRequest, NextResponse } from "next/server";
import { fetchFromCandidates } from "../../../../_lib/upstream";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: sourceId } = await params;
    const userId = request.headers.get("X-User-ID") || "anonymous-user";

    const { response } = await fetchFromCandidates({
      group: "api",
      path: `/api/user/data-sources/${sourceId}/test`,
      init: {
        method: "POST",
      },
      headers: {
        "Content-Type": "application/json",
        "X-User-ID": userId,
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Connection test error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Test service unavailable",
      },
      { status: 500 },
    );
  }
}
