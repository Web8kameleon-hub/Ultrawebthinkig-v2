/**
 * SERVICE DISCOVERY API
 * ====================
 * Gateway endpoint for frontend to discover services dynamically
 */

import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NODE_ENV === 'production'
  ? 'http://clisonix-api:8000'
  : 'http://localhost:8000';

/**
 * POST /api/service-discovery
 * Query registry for capability
 */
export async function POST(request: NextRequest) {
  try {
    const { capability } = await request.json();

    if (!capability) {
      return NextResponse.json(
        { error: 'capability required' },
        { status: 400 }
      );
    }

    // Query backend for service discovery
    const response = await fetch(`${API_BASE}/api/v1/service-discovery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capability }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      // Fallback to environment variables
      const fallbacks: Record<string, string> = {
        'nlp-generation': process.env.NEXT_PUBLIC_OCEAN_URL || 'http://localhost:8030',
        'multilingual': process.env.NEXT_PUBLIC_OCEAN_URL || 'http://localhost:8030',
        'reasoning': process.env.NEXT_PUBLIC_OCEAN_URL || 'http://localhost:8030',
        'excel': API_BASE,
        'kitchen': API_BASE,
      };

      const url = fallbacks[capability];
      if (url) {
        return NextResponse.json({ url, fallback: true });
      }

      return NextResponse.json(
        { error: `No service found for capability: ${capability}` },
        { status: 404 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Service Discovery] Error:', error);
    return NextResponse.json(
      { error: 'Service discovery failed' },
      { status: 503 }
    );
  }
}

/**
 * GET /api/service-discovery
 * List all available services
 */
export async function GET() {
  try {
    const response = await fetch(`${API_BASE}/api/v1/services`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to list services' },
        { status: 503 }
      );
    }

    const services = await response.json();
    return NextResponse.json(services);
  } catch (error) {
    console.error('[Service Discovery] Error listing services:', error);
    return NextResponse.json(
      { error: 'Service listing failed' },
      { status: 503 }
    );
  }
}
