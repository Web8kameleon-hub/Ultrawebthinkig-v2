/**
 * SERVICE INFO API
 * ===============
 * Get detailed info about a specific service
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchFromCandidates } from "../_lib/upstream";

export async function POST(request: NextRequest) {
  try {
    const { service } = await request.json();

    if (!service) {
      return NextResponse.json(
        { error: 'service name required' },
        { status: 400 }
      );
    }

    // Query backend for service details
    const { response } = await fetchFromCandidates({
      group: "api",
      path: "/api/v1/service-info",
      init: {
        method: "POST",
        body: JSON.stringify({ service }),
      },
      headers: { "Content-Type": "application/json" },
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Service Info] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get service info' },
      { status: 503 }
    );
  }
}
