import { NextRequest, NextResponse } from 'next/server'

import { removeRuntimeMymirrorSource } from "@/lib/mymirror-data-catalog";

const API_URL = process.env.NODE_ENV === 'production' ? 'http://clisonix-api:8000' : 'http://127.0.0.1:8000'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = request.headers.get("X-User-ID") || "demo-user";

  try {
    const res = await fetch(`${API_URL}/api/user/data-sources/${id}`, {
      method: "DELETE",
      headers: { Accept: "application/json", "X-User-ID": userId },
    });

    if (res.ok) {
      removeRuntimeMymirrorSource(id);
      const data = await res.json().catch(() => ({ ok: true, deleted: id }));
      return NextResponse.json(data, { status: 200 });
    }
  } catch {
    // Fall through to runtime catalog mode.
  }

  removeRuntimeMymirrorSource(id);
  return NextResponse.json(
    { ok: true, deleted: id, fallback: true },
    { status: 200 },
  );
}
