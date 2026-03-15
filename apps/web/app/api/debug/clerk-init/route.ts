import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type ClerkDebugPayload = {
  event?: string;
  message?: string;
  stack?: string;
  route?: string;
  userAgent?: string;
  source?: string;
  timestamp?: string;
  extra?: Record<string, unknown>;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ClerkDebugPayload;

    console.error("[ClerkInitDebug]", {
      event: body.event ?? "unknown",
      message: body.message ?? "",
      stack: body.stack ?? "",
      route: body.route ?? "",
      source: body.source ?? "auth-page",
      userAgent: body.userAgent ?? request.headers.get("user-agent") ?? "",
      timestamp: body.timestamp ?? new Date().toISOString(),
      extra: body.extra ?? {},
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[ClerkInitDebug] parse_error", error);
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "debug/clerk-init",
    timestamp: new Date().toISOString(),
  });
}
