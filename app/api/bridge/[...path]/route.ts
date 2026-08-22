import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const backendOrigin = process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:3001';
const allowedRoots = new Set(['health', 'system']);

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const normalizedPath = path.filter(Boolean);
  const root = normalizedPath[0];

  if (!root || !allowedRoots.has(root)) {
    return NextResponse.json({ ok: false, error: 'Bridge route is not allowed' }, { status: 404 });
  }

  const backendPath = root === 'health' ? '/api/health' : `/api/${normalizedPath.join('/')}`;
  const target = new URL(backendPath, backendOrigin);
  target.search = request.nextUrl.search;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_000);

  try {
    const body = request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : await request.arrayBuffer();
    const upstream = await fetch(target, {
      method: request.method,
      headers: {
        accept: request.headers.get('accept') || 'application/json',
        'content-type': request.headers.get('content-type') || 'application/json',
      },
      body,
      cache: 'no-store',
      signal: controller.signal,
    });
    const responseBody = await upstream.arrayBuffer();

    return new NextResponse(responseBody, {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') || 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'Backend request timed out'
      : 'Backend service is unavailable';
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  } finally {
    clearTimeout(timeout);
  }
}

export const GET = proxy;
export const POST = proxy;
