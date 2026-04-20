import { NextRequest, NextResponse } from 'next/server'
import { fetchFromCandidates } from "../../../_lib/upstream";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = request.headers.get("X-User-ID") || "anonymous-user";

  try {
    const { response } = await fetchFromCandidates({
      group: "api",
      path: `/api/user/data-sources/${id}`,
      init: { method: "DELETE" },
      headers: { "X-User-ID": userId },
    });

    if (response.ok) {
      const data = await response.json().catch(() => ({ ok: true, deleted: id }));
      return NextResponse.json(data, { status: 200 });
    }

    const error = await response.json().catch(() => null);
    return NextResponse.json(
      {
        error:
          error?.detail ||
          error?.error ||
          "Failed to delete data source upstream",
        upstreamStatus: response.status,
      },
      { status: response.status >= 500 ? 503 : response.status },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "User data source delete upstream is unavailable",
        details: error instanceof Error ? error.message : "unknown error",
      },
      { status: 503 },
    );
  }
}
