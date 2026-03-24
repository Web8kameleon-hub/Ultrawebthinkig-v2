/**
 * SERVICE DISCOVERY API
 * ====================
 * Gateway endpoint for frontend to discover services dynamically
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiError, apiSuccess } from "@/lib/api/response";

const isDev = process.env.NODE_ENV === "development";
const API_BASE =
  process.env.API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  (isDev ? "http://localhost:8000" : "http://clisonix-api:8000");
const OCEAN_BASE =
  process.env.OCEAN_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_OCEAN_URL ||
  process.env.OCEAN_CORE_URL ||
  (isDev ? "http://localhost:8030" : "http://ocean-core:8030");

type KnownService = {
  id: string;
  name: string;
  url: string;
  category: string;
  capabilities: string[];
  health?: string;
  source: "catalog";
};

const REGISTRY_LIST_PATHS = ["/api/v1/services", "/api/services", "/services"];
const REGISTRY_DISCOVERY_PATHS = [
  "/api/v1/service-discovery",
  "/api/service-discovery",
];

function getKnownServices(): KnownService[] {
  const services: KnownService[] = [
    {
      id: "main-api",
      name: "Main API",
      url: API_BASE,
      category: "core",
      capabilities: ["excel", "kitchen", "reporting", "metrics", "api-gateway"],
      health: `${API_BASE}/health`,
      source: "catalog",
    },
    {
      id: "ocean-core",
      name: "Ocean Core",
      url: OCEAN_BASE,
      category: "ai",
      capabilities: [
        "nlp-generation",
        "multilingual",
        "reasoning",
        "chat",
        "web-reader",
      ],
      health: `${OCEAN_BASE}/api/v1/status`,
      source: "catalog",
    },
  ];

  return services.filter((service) => Boolean(service.url));
}

function normalizeService(service: Record<string, unknown>, index: number) {
  return {
    id: String(service.id || service.name || `service-${index + 1}`),
    name: String(service.name || service.id || `service-${index + 1}`),
    url: typeof service.url === "string" ? service.url : "",
    category:
      typeof service.category === "string" ? service.category : "discovered",
    capabilities: Array.isArray(service.capabilities)
      ? service.capabilities.map((value) => String(value))
      : [],
    metadata: service,
    source: "registry" as const,
  };
}

async function tryListServicesFromRegistry() {
  for (const path of REGISTRY_LIST_PATHS) {
    const upstream = `${API_BASE}${path}`;
    try {
      const response = await fetch(upstream, {
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      });

      if (!response.ok) {
        continue;
      }

      const payload = await response.json();
      const servicesValue = payload?.services;
      if (!Array.isArray(servicesValue)) {
        continue;
      }

      return {
        services: servicesValue
          .filter((service: unknown) => service && typeof service === "object")
          .map((service: unknown, index: number) =>
            normalizeService(service as Record<string, unknown>, index),
          ),
        upstream,
      };
    } catch {
      continue;
    }
  }

  return null;
}

async function tryDiscoverCapability(capability: string) {
  for (const path of REGISTRY_DISCOVERY_PATHS) {
    const upstream = `${API_BASE}${path}?capability=${encodeURIComponent(capability)}`;
    try {
      const response = await fetch(upstream, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(4000),
      });

      if (!response.ok) {
        continue;
      }

      const payload = await response.json();
      return { payload, upstream };
    } catch {
      continue;
    }
  }

  return null;
}

function findKnownServiceByCapability(capability: string) {
  const normalizedCapability = capability.trim().toLowerCase();
  return getKnownServices().find((service) =>
    service.capabilities.some(
      (candidate) => candidate.toLowerCase() === normalizedCapability,
    ),
  );
}

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

    const discovered = await tryDiscoverCapability(capability);
    if (discovered) {
      return apiSuccess(discovered.payload, {
        meta: {
          capability,
          upstream: discovered.upstream,
        },
      });
    }

    const knownService = findKnownServiceByCapability(capability);
    if (knownService) {
      return apiSuccess(
        {
          service: knownService.name,
          capability,
          url: knownService.url,
          metadata: {
            source: knownService.source,
            category: knownService.category,
            health: knownService.health,
          },
        },
        {
          meta: {
            capability,
            fallback: true,
            source: knownService.source,
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
    const discovered = await tryListServicesFromRegistry();
    if (discovered) {
      return apiSuccess(
        {
          count: discovered.services.length,
          services: discovered.services,
        },
        {
          meta: {
            upstream: discovered.upstream,
            source: "registry",
          },
        },
      );
    }

    const services = getKnownServices();
    return apiSuccess(
      {
        count: services.length,
        services,
      },
      {
        meta: {
          source: "catalog",
          upstream: null,
          degraded: true,
        },
      },
    );
  } catch (error) {
    console.error('[Service Discovery] Error listing services:', error);
    return apiError("UPSTREAM_UNAVAILABLE", "Service listing failed", {
      status: 503,
      details: String(error),
    });
  }
}
