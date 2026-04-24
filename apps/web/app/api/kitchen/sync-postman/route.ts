import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    thunder: {
      connected: true,
      status: "publish_only",
      message:
        "Thunder Client is the primary public tool. Runtime sync stays disabled; export-only collections remain available.",
    },
    postman: {
      connected: false,
      status: "publish_only",
      message: "Postman stays limited to export/publish compatibility only.",
    },
    kitchen: {
      linked: false,
      message:
        "Kitchen no longer syncs runtime collections; Thunder/export flow is publish-only.",
    },
    timestamp: new Date().toISOString(),
  });
}
