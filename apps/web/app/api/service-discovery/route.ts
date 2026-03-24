/**
 * SERVICE DISCOVERY API
 * ====================
 * Gateway endpoint for frontend to discover services dynamically
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiError, apiSuccess } from "@/lib/api/response";

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
      return apiError("VALIDATION_ERROR", "capability is required", {
        status: 400,
      });
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
        return apiSuccess(
          { url, fallback: true },
          {
            meta: {
              fallback: true,
              capability,
            },
          },
        );
      }

      return apiError(
        "NOT_FOUND",
        `No service found for capability: ${capability}`,
        {
          status: 404,
          details: {
            capability,
          },
        },
      );
    }

    const data = await response.json();
    return apiSuccess(data, {
      meta: {
        capability,
        upstream: `${API_BASE}/api/v1/service-discovery`,
      },
    });
  } catch (error) {
    console.error('[Service Discovery] Error:', error);
    return apiError("UPSTREAM_UNAVAILABLE", "Service discovery failed", {
      status: 503,
      details: String(error),
    });
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
      return apiError("UPSTREAM_STATUS_ERROR", "Failed to list services", {
        status: 503,
        details: {
          upstream: `${API_BASE}/api/v1/services`,
          upstreamStatus: response.status,
        },
      });
    }

    const services = await response.json();
    return apiSuccess(services, {
      meta: {
        upstream: `${API_BASE}/api/v1/services`,
      },
    });
  } catch (error) {
    console.error('[Service Discovery] Error listing services:', error);
    return apiError("UPSTREAM_UNAVAILABLE", "Service listing failed", {
      status: 503,
      details: String(error),
    });
  }
}
