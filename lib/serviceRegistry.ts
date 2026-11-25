/**
 * Service Registry — Regjistri i shërbimeve të brendshme të OpenMind
 *
 * Regjistron të gjitha shërbimet e disponueshme të platformës dhe
 * i thërret me HTTP interne për të grumbulluar të dhëna reale.
 *
 * @author Ledjan Ahmati
 * @version 8.0.0-WEB8
 */

// ─── Tipi i shërbimit ────────────────────────────────────────────────────────

export interface ServiceDefinition {
  id: string;
  name: string;
  description: string;
  endpoint: string;    // path relativ i brendshëm p.sh. /api/mesh/status
  category: 'ai' | 'network' | 'security' | 'data' | 'payments' | 'analytics';
  version: string;
  status: 'active' | 'degraded' | 'offline';
}

export interface ServiceQueryResult {
  serviceId: string;
  type: 'data' | 'search_results' | 'status' | 'error';
  data: any;
  respondedAt: number;
  latencyMs: number;
}

export interface SystemOverview {
  totalServices: number;
  activeServices: number;
  degradedServices: number;
  offlineServices: number;
  lastChecked: number;
}

// ─── Shërbimet e regjistruara ────────────────────────────────────────────────

const REGISTERED_SERVICES: ServiceDefinition[] = [
  {
    id: 'mesh',
    name: 'Mesh Gateway',
    description: 'LoRa / Clisonix mesh network status dhe routing',
    endpoint: '/api/mesh/status',
    category: 'network',
    version: '2.0',
    status: 'active',
  },
  {
    id: 'lora-mesh',
    name: 'LoRa Mesh Network',
    description: 'IoT LoRa mesh topology dhe nyjat aktive',
    endpoint: '/api/lora-mesh',
    category: 'network',
    version: '1.5',
    status: 'active',
  },
  {
    id: 'dashboard-metrics',
    name: 'Dashboard Metrics',
    description: 'Metrikat kryesore të platformës në kohë reale',
    endpoint: '/api/dashboard/metrics',
    category: 'analytics',
    version: '3.0',
    status: 'active',
  },
  {
    id: 'payments',
    name: 'Fiat Token Gateway',
    description: 'EUR/USD/ALB/SOL pagesa dhe bridge ndër-rrjet',
    endpoint: '/api/payments',
    category: 'payments',
    version: '1.0',
    status: 'active',
  },
  {
    id: 'quantum-processing',
    name: 'Quantum Processing',
    description: 'Llogaritja kuantike dhe operacionet paralele',
    endpoint: '/api/quantum-processing',
    category: 'ai',
    version: '4.2',
    status: 'active',
  },
  {
    id: 'security-guardian',
    name: 'Guardian Security',
    description: 'Mbrojtja e platformës — firewall, rate-limit, threat detection',
    endpoint: '/api/guardian',
    category: 'security',
    version: '2.1',
    status: 'active',
  },
  {
    id: 'neural-search',
    name: 'Neural Search',
    description: 'Kërkimi semantik i brendshëm i bazuar në vektorë',
    endpoint: '/api/neural-search',
    category: 'ai',
    version: '1.3',
    status: 'active',
  },
  {
    id: 'analytics',
    name: 'Analytics Engine',
    description: 'Analitika e përdoruesve dhe ngjarjeve të platformës',
    endpoint: '/api/analytics',
    category: 'analytics',
    version: '2.0',
    status: 'active',
  },
  {
    id: 'nodesms',
    name: 'NodeSMS Messaging',
    description: 'Dërgimi i SMS-ve dhe notifikimeve',
    endpoint: '/api/nodesms/send',
    category: 'data',
    version: '1.0',
    status: 'active',
  },
];

// ─── ServiceRegistry ─────────────────────────────────────────────────────────

export class ServiceRegistry {
  private static instance: ServiceRegistry;
  private services: ServiceDefinition[] = [...REGISTERED_SERVICES];

  /** Bazë URL-ja e brendshme — Next.js e gjen vetë kur jemi server-side */
  private baseUrl: string;

  private constructor() {
    // Env var has priority; fall back to production domain
    this.baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.APP_URL ??
      'https://www.kameleon.life';
  }

  static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  /** Kthen listën e plotë të shërbimeve */
  getAllServices(): ServiceDefinition[] {
    return this.services;
  }

  /** Kthen pasqyrën e gjendjes së sistemit */
  getSystemOverview(): SystemOverview {
    const active = this.services.filter((s) => s.status === 'active').length;
    const degraded = this.services.filter((s) => s.status === 'degraded').length;
    const offline = this.services.filter((s) => s.status === 'offline').length;
    return {
      totalServices: this.services.length,
      activeServices: active,
      degradedServices: degraded,
      offlineServices: offline,
      lastChecked: Date.now(),
    };
  }

  /**
   * Thërret të gjitha shërbimet aktive me pyetjen e dhënë.
   * Vetëm shërbime me kategori "ai", "data", "analytics" përgjigjen
   * ndaj një query gjuhësor; të tjerët kthejnë statusin e tyre.
   */
  async queryAllServices(query: string): Promise<Record<string, ServiceQueryResult>> {
    const results: Record<string, ServiceQueryResult> = {};

    // Shërbime që kuptojnë query gjuhësor
    const queryableCategories: ServiceDefinition['category'][] = ['ai', 'data', 'analytics'];

    await Promise.allSettled(
      this.services
        .filter((s) => s.status === 'active')
        .map(async (service) => {
          const t0 = Date.now();
          try {
            const url = queryableCategories.includes(service.category)
              ? `${this.baseUrl}${service.endpoint}?q=${encodeURIComponent(query)}`
              : `${this.baseUrl}${service.endpoint}`;

            const res = await fetch(url, {
              method: 'GET',
              headers: { 'Content-Type': 'application/json', 'x-internal': '1' },
              signal: AbortSignal.timeout(5_000),
            });

            const body = res.ok ? await res.json().catch(() => ({})) : {};

            results[service.id] = {
              serviceId: service.id,
              type: Array.isArray(body?.data ?? body?.results)
                ? 'search_results'
                : 'data',
              data: body,
              respondedAt: Date.now(),
              latencyMs: Date.now() - t0,
            };
          } catch {
            results[service.id] = {
              serviceId: service.id,
              type: 'error',
              data: null,
              respondedAt: Date.now(),
              latencyMs: Date.now() - t0,
            };
          }
        })
    );

    return results;
  }

  /** Regjistro shërbim të ri në kohë ekzekutimi */
  register(service: ServiceDefinition): void {
    const existing = this.services.findIndex((s) => s.id === service.id);
    if (existing >= 0) {
      this.services[existing] = service;
    } else {
      this.services.push(service);
    }
  }

  /** Ndrysho statusin e një shërbimi */
  setStatus(id: string, status: ServiceDefinition['status']): void {
    const svc = this.services.find((s) => s.id === id);
    if (svc) svc.status = status;
  }
}

export default ServiceRegistry;
