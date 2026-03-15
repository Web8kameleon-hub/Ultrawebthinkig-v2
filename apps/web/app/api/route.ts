import { NextResponse } from 'next/server';

/**
 * Root API endpoint - Returns API info and available endpoints
 */
export async function GET() {
  return NextResponse.json({
    name: "Clisonix Cloud API",
    version: "1.0.0",
    status: "operational",
    timestamp: new Date().toISOString(),
    documentation: "https://clisonix.com/developers",
    endpoints: {
      health: {
        "GET /api/asi/health": "ASI Trinity health status",
        "GET /api/asi/trinity": "Full ASI Trinity metrics",
        "GET /api/reporting/health": "Reporting service health",
        "GET /api/reporting/dashboard": "Dashboard metrics",
      },
      modules: {
        "GET /api/ocean": "Curiosity Ocean AI chat",
        "GET /api/pulse": "Pulse real-time data",
        "GET /api/vision": "Vision AI processing",
        "GET /api/grid": "Grid computing status",
      },
    },
    support: "clisonix@pm.me",
  });
}
