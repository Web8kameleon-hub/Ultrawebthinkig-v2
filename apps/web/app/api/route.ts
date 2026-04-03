import { NextResponse } from 'next/server';

/**
 * Root API endpoint - Returns API info and available endpoints
 */
export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const documentationUrl = appUrl
    ? `${appUrl.replace(/\/$/, "")}/developers`
    : "/developers";
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "";

  return NextResponse.json({
    name: "Clisonix Cloud API",
    version: "1.0.0",
    status: "operational",
    timestamp: new Date().toISOString(),
    documentation: documentationUrl,
    endpoints: {
      health: {
        "GET /api/ping": "Frontend health ping",
        "GET /api/system-status": "Full system status",
        "GET /api/asi/health": "ASI Trinity health status",
        "GET /api/alba/metrics": "ALBA engine metrics",
      },
      ocean: {
        "POST /api/ocean": "Curiosity Ocean AI chat",
        "POST /api/ocean/vision": "Vision analysis",
        "POST /api/ocean/audio": "Audio transcription",
        "POST /api/ocean/document": "Document analysis",
        "GET /api/ocean/web-reader?url=...": "Web content reader",
      },
    },
    support: supportEmail || null,
  });
}
