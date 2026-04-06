'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Database,
  Lock,
  Network,
  RefreshCw,
  Shield,
  Sparkles,
  Workflow,
} from 'lucide-react';

type HealthPayload = {
  status?: string;
  service?: string;
  port?: number;
  isolated?: boolean;
  upstream_configured?: boolean;
  live_only?: boolean;
  uptime_seconds?: number;
};

type UpstreamPayload = {
  configured?: boolean;
  reachable?: boolean;
  url?: string;
  message?: string;
  error?: string;
  status?: Record<string, unknown>;
};

type ServiceTruthPayload = {
  state?: string;
  connectivity?: string;
  sync_status?: string;
  proof_of_life?: string;
  live_flow?: string;
  hardware_network_health?: string;
  confidence?: string;
  estimated_recovery?: string | null;
  peer_count?: number;
  last_upstream_error?: string | null;
};

type HardwareSummaryPayload = {
  registered_nodes?: number;
  online_nodes?: number;
  stale_nodes?: number;
  offline_nodes?: number;
  network_health?: string;
  cluster_mode?: string;
  coordinator_node_id?: string | null;
  total_pulses?: number;
  proof_of_life?: string;
};

type BridgeSummaryPayload = {
  peer_count?: number;
  upstream_status?: string;
  state?: string;
  connectivity?: string;
  sync_status?: string;
  estimated_recovery?: string | null;
  hardware_nodes?: HardwareSummaryPayload | null;
  service_truth?: ServiceTruthPayload | null;
};

type StatusPayload = {
  service?: string;
  version?: string;
  instance?: string;
  isolated?: boolean;
  live_only?: boolean;
  port?: number;
  availability?: string;
  message?: string;
  upstream?: UpstreamPayload;
  ocean_core?: UpstreamPayload;
  summary?: BridgeSummaryPayload | null;
  service_truth?: ServiceTruthPayload;
  hardware?: {
    summary?: HardwareSummaryPayload | null;
  };
};

type MeshStatusPayload = {
  mesh?: {
    mode?: string;
    coordinator_node_id?: string | null;
    heartbeat_ttl_seconds?: number;
    offline_grace_seconds?: number;
  };
  summary?: HardwareSummaryPayload | null;
};

type ActionPayload = {
  status?: string;
  route?: string;
  error?: string;
  detail?: string;
  snapshot?: Record<string, unknown>;
  live_only?: boolean;
};

type DockerContainerInfo = {
  name?: string;
  container_name?: string;
  state?: string;
  status?: string;
  State?: string;
  Status?: string;
  healthy?: boolean;
};

type DockerContainersPayload = {
  running?: number;
  total?: number;
  containers?: DockerContainerInfo[];
  source?: string;
};

type DiscoveryService = {
  id?: string;
  name?: string;
  category?: string;
  capabilities?: string[];
  source?: string;
  stack?: string;
  url?: string;
  health?: string;
};

type FleetSummary = {
  totalServices: number;
  runningContainers: number;
  totalContainers: number;
  categoryCount: number;
  capabilityCount: number;
  kloudNodes: number;
};

const API_BASE = '/api/kloud-bridge';

function normalizeServiceName(value?: string | null) {
  return (value ?? '').toLowerCase().trim();
}

function getServiceGlyph(service: DiscoveryService) {
  const normalized = `${service.name || ''} ${service.category || ''}`.toLowerCase();

  if (normalized.includes('kloud') || normalized.includes('node')) return '☁️';
  if (normalized.includes('ocean') || normalized.includes('ai')) return '🧠';
  if (normalized.includes('report')) return '📊';
  if (normalized.includes('market') || normalized.includes('business')) return '💳';
  if (normalized.includes('analytic') || normalized.includes('alba')) return '📈';
  if (normalized.includes('albi')) return '✨';
  if (normalized.includes('jona')) return '🛡️';
  if (normalized.includes('data') || normalized.includes('postgres') || normalized.includes('redis')) return '🗄️';
  return '🔹';
}

function getErrorMessage(payload: ActionPayload | null | undefined, fallback: string) {
  return payload?.detail || payload?.error || fallback;
}

function formatUptime(uptimeSeconds?: number | null) {
  if (!uptimeSeconds || uptimeSeconds <= 0) return '—';
  if (uptimeSeconds < 60) return `${Math.round(uptimeSeconds)}s`;
  if (uptimeSeconds < 3600) return `${Math.floor(uptimeSeconds / 60)}m ${Math.round(uptimeSeconds % 60)}s`;
  return `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m`;
}

function isRunningContainer(container: DockerContainerInfo) {
  const statusText = `${container.state ?? container.State ?? container.status ?? container.Status ?? ''}`.toLowerCase();

  if (typeof container.healthy === 'boolean') {
    return container.healthy || statusText.includes('running') || statusText.includes('up');
  }

  if (statusText.includes('exited') || statusText.includes('stopped') || statusText.includes('dead') || statusText.includes('unhealthy')) {
    return false;
  }

  return statusText.includes('running') || statusText.includes('up') || statusText.includes('healthy');
}

export default function KloudBridgePage() {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [meshStatus, setMeshStatus] = useState<MeshStatusPayload | null>(null);
  const [syncResult, setSyncResult] = useState<ActionPayload | null>(null);
  const [fleetServices, setFleetServices] = useState<DiscoveryService[]>([]);
  const [fleetSummary, setFleetSummary] = useState<FleetSummary | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);

    try {
      const [healthRes, statusRes, meshRes, discoveryRes, containersRes] = await Promise.all([
        fetch(`${API_BASE}/health`, { cache: 'no-store' }),
        fetch(`${API_BASE}/status`, { cache: 'no-store' }),
        fetch(`${API_BASE}/hardware/mesh/status`, { cache: 'no-store' }).then((response) => response.ok ? response.json() : null).catch(() => null),
        fetch('/api/service-discovery', { cache: 'no-store' }).then((response) => response.json()).catch(() => null),
        fetch('/api/proxy/docker-containers', { cache: 'no-store' }).then((response) => response.json()).catch(() => null),
      ]);

      const healthPayload = (await healthRes.json()) as HealthPayload;
      const statusPayload = (await statusRes.json()) as StatusPayload;
      const meshPayload = (meshRes ?? null) as MeshStatusPayload | null;
      const liveHardwareSummary = (statusPayload?.hardware?.summary ?? meshPayload?.summary ?? null) as HardwareSummaryPayload | null;

      setHealth({
        status: healthPayload?.status ?? 'unknown',
        service: healthPayload?.service ?? 'kloud-bridge',
        port: healthPayload?.port,
        isolated: healthPayload?.isolated,
        live_only: healthPayload?.live_only,
        upstream_configured: healthPayload?.upstream_configured,
        uptime_seconds: healthPayload?.uptime_seconds,
      });

      setStatus({
        service: statusPayload?.service ?? 'kloud-bridge',
        version: statusPayload?.version,
        instance: statusPayload?.instance,
        isolated: statusPayload?.isolated,
        live_only: statusPayload?.live_only,
        port: statusPayload?.port,
        availability: statusPayload?.availability,
        message: statusPayload?.message,
        upstream: {
          configured: Boolean(statusPayload?.upstream?.configured),
          reachable: Boolean(statusPayload?.upstream?.reachable),
          url: statusPayload?.upstream?.url,
          message: statusPayload?.upstream?.message,
          error: statusPayload?.upstream?.error,
          status: statusPayload?.upstream?.status,
        },
        ocean_core: {
          configured: Boolean(statusPayload?.ocean_core?.configured),
          reachable: Boolean(statusPayload?.ocean_core?.reachable),
          url: statusPayload?.ocean_core?.url,
          message: statusPayload?.ocean_core?.message,
          error: statusPayload?.ocean_core?.error,
          status: statusPayload?.ocean_core?.status,
        },
        summary: statusPayload?.summary ?? null,
        service_truth: statusPayload?.service_truth,
        hardware: {
          summary: liveHardwareSummary,
        },
      });

      setMeshStatus(meshPayload ?? {
        mesh: {
          mode: liveHardwareSummary?.cluster_mode,
          coordinator_node_id: liveHardwareSummary?.coordinator_node_id,
        },
        summary: liveHardwareSummary,
      });

      const discoveryData = discoveryRes?.data || discoveryRes || {};
      const discoveredServices = Array.isArray(discoveryData?.services)
        ? (discoveryData.services as DiscoveryService[])
        : [];
      const summary = discoveryData?.summary || {};
      const relevantServices = discoveredServices.filter((service) => {
        const haystack = `${service.id || ''} ${service.name || ''} ${(service.capabilities || []).join(' ')} ${service.category || ''}`.toLowerCase();
        return ['kloud', 'bridge', 'ocean', 'api', 'report', 'market', 'analytic', 'alba', 'albi', 'jona', 'asi'].some((keyword) => haystack.includes(keyword));
      }).slice(0, 12);
      const containerPayload = (containersRes ?? null) as DockerContainersPayload | null;
      const containerList = Array.isArray(containerPayload?.containers)
        ? containerPayload.containers
        : [];
      const runningContainers = typeof containerPayload?.running === 'number'
        ? containerPayload.running
        : containerList.filter(isRunningContainer).length;
      const totalContainers = typeof containerPayload?.total === 'number'
        ? containerPayload.total
        : containerList.length;

      setFleetServices(relevantServices);
      setFleetSummary({
        totalServices: typeof summary?.totalServices === 'number' ? summary.totalServices : Number(discoveryData?.count || discoveredServices.length || 0),
        runningContainers,
        totalContainers,
        categoryCount: typeof summary?.categories === 'number' ? summary.categories : new Set(discoveredServices.map((service) => service.category || 'unknown')).size,
        capabilityCount: typeof summary?.capabilities === 'number' ? summary.capabilities : new Set(discoveredServices.flatMap((service) => Array.isArray(service.capabilities) ? service.capabilities : [])).size,
        kloudNodes: typeof liveHardwareSummary?.registered_nodes === 'number'
          ? liveHardwareSummary.registered_nodes
          : typeof summary?.kloudNodes === 'number'
            ? summary.kloudNodes
            : discoveredServices.filter((service) => {
                const normalized = normalizeServiceName(service.id || service.name);
                return normalized.startsWith('node') || normalizeServiceName(service.category).includes('kloud');
              }).length,
      });

      if (!healthRes.ok || !statusRes.ok) {
        setError('Live status is currently limited, so the page is showing the safest verified service view.');
      }
    } catch (err) {
      setHealth({ status: 'unknown', service: 'kloud-bridge' });
      setStatus({
        service: 'kloud-bridge',
        availability: 'setup-required',
        message: 'Live activation is pending or temporarily unavailable.',
        upstream: { configured: false, reachable: false },
      });
      setFleetServices([]);
      setFleetSummary(null);
      setMeshStatus(null);
      setError(err instanceof Error ? err.message : 'Failed to load live Kloud Bridge status');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const syncFabric = useCallback(async () => {
    setIsSyncing(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/fabric/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          include_status: true,
          include_peers: true,
          include_state: true,
        }),
      });

      const payload = (await response.json()) as ActionPayload;
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, `Live fabric sync failed (${response.status})`));
      }

      setSyncResult(payload);
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync live Kloud fabric snapshot');
    } finally {
      setIsSyncing(false);
    }
  }, [loadStatus]);

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 15000);
    return () => clearInterval(interval);
  }, [loadStatus]);

  const kloudRuntime = useMemo(() => {
    const summary = meshStatus?.summary ?? status?.hardware?.summary ?? null;
    const serviceHealth = (health?.status ?? '').toLowerCase();
    const bridgeLive = ['ok', 'healthy', 'live'].includes(serviceHealth)
      || status?.availability === 'connected'
      || status?.availability === 'limited'
      || summary?.proof_of_life === 'active'
      || (summary?.online_nodes ?? 0) > 0;

    return {
      state: status?.upstream?.reachable
        ? status?.service_truth?.state ?? 'ready'
        : bridgeLive
          ? 'monitoring'
          : status?.service_truth?.state ?? (status?.upstream?.configured ? 'temporarily-limited' : 'pending'),
      proofOfLife: status?.service_truth?.proof_of_life ?? summary?.proof_of_life ?? 'pending',
      syncStatus: status?.service_truth?.sync_status ?? (status?.upstream?.reachable ? 'ready' : 'waiting'),
      liveFlow: status?.service_truth?.live_flow ?? (status?.upstream?.reachable ? 'Bridge → Sovereign upstream → Sync → Ready' : status?.ocean_core?.reachable ? 'Bridge → Ocean visible → Sovereign upstream pending' : 'Bridge → Runtime live → Sovereign upstream pending'),
      networkHealth: status?.service_truth?.hardware_network_health ?? summary?.network_health ?? 'unknown',
      clusterMode: summary?.cluster_mode ?? meshStatus?.mesh?.mode ?? (status?.upstream?.configured ? 'bridge-visible' : 'awaiting-upstream'),
      registeredNodes: summary?.registered_nodes ?? (bridgeLive ? 1 : 0),
      onlineNodes: summary?.online_nodes ?? 0,
      staleNodes: summary?.stale_nodes ?? 0,
      totalPulses: summary?.total_pulses ?? 0,
      coordinatorNodeId: summary?.coordinator_node_id ?? meshStatus?.mesh?.coordinator_node_id ?? (bridgeLive ? 'bridge-visible' : 'pending'),
    };
  }, [health?.status, meshStatus, status]);

  const bridgeReachable = useMemo(() => {
    const healthState = (health?.status ?? '').toLowerCase();
    return ['ok', 'healthy', 'live'].includes(healthState)
      || status?.availability === 'connected'
      || status?.availability === 'limited'
      || kloudRuntime.proofOfLife === 'active'
      || kloudRuntime.onlineNodes > 0;
  }, [health?.status, kloudRuntime.onlineNodes, kloudRuntime.proofOfLife, status?.availability]);

  const visibleRegisteredNodes = Math.max(kloudRuntime.registeredNodes, kloudRuntime.onlineNodes, bridgeReachable ? 1 : 0);

  const bridgePeerCount = useMemo(() => {
    const rawCount = status?.summary?.peer_count ?? status?.service_truth?.peer_count ?? 0;
    return typeof rawCount === 'number' && Number.isFinite(rawCount) ? rawCount : 0;
  }, [status]);

  const meshModeLabel = useMemo(() => {
    if (status?.upstream?.reachable && bridgePeerCount > 1) return 'distributed visibility';
    if (bridgeReachable && status?.upstream?.configured && !status?.upstream?.reachable) {
      return visibleRegisteredNodes > 1 ? 'partial mesh visibility' : 'bridge-visible slice';
    }
    if (!bridgeReachable && status?.upstream?.configured) return 'upstream pending';
    return kloudRuntime.clusterMode;
  }, [bridgePeerCount, bridgeReachable, kloudRuntime.clusterMode, status, visibleRegisteredNodes]);

  const meshCountLabel = useMemo(() => {
    if (bridgeReachable && status?.upstream?.configured && !status?.upstream?.reachable) {
      return `${kloudRuntime.onlineNodes}/${visibleRegisteredNodes} bridge-visible node${visibleRegisteredNodes === 1 ? '' : 's'} online`;
    }
    return `${kloudRuntime.onlineNodes}/${visibleRegisteredNodes} nodes online`;
  }, [bridgeReachable, kloudRuntime.onlineNodes, status, visibleRegisteredNodes]);

  const meshVisibilityNote = useMemo(() => {
    if (status?.upstream?.reachable && bridgePeerCount > 0) {
      return `${bridgePeerCount} upstream peer node${bridgePeerCount === 1 ? '' : 's'} are visible through the live bridge.`;
    }
    if (bridgeReachable && status?.upstream?.configured) {
      return 'Only the bridge-visible slice is counted here until upstream synchronization responds with the wider Kloud fabric.';
    }
    if (bridgeReachable) {
      return 'This panel is currently showing the bridge-visible slice only.';
    }
    return 'Mesh-wide visibility will appear once the upstream link is enabled.';
  }, [bridgePeerCount, bridgeReachable, status]);

  const upstreamLabel = useMemo(() => {
    if (status?.upstream?.reachable) return 'Connected and monitored';
    if (bridgeReachable && status?.upstream?.configured) return 'Bridge live • sovereign upstream pending';
    if (bridgeReachable) return 'Bridge live';
    return 'Activation pending';
  }, [bridgeReachable, status]);

  const oceanLabel = useMemo(() => {
    if (status?.ocean_core?.reachable) return 'linked';
    if (status?.ocean_core?.configured) return 'waiting';
    return 'not configured';
  }, [status]);

  const liveNote = useMemo(() => {
    if (status?.upstream?.reachable) return 'Real bridge connectivity and synchronization are active.';
    if (status?.ocean_core?.reachable && bridgeReachable && status?.upstream?.configured) {
      return 'Ocean is linked through the bridge, while the sovereign upstream mesh is still waiting to respond.';
    }
    if (bridgeReachable && status?.upstream?.configured) return 'The bridge is live and collecting proof-of-life, while wider upstream mesh visibility is still waiting to respond.';
    if (bridgeReachable) return 'The protected bridge view is live and reachable for users.';
    return 'Live service activation is pending until the upstream connection is enabled.';
  }, [bridgeReachable, status]);

  const practicalState = useMemo(() => {
    if (status?.upstream?.reachable) {
      return 'The bridge is reachable, and verified synchronization checks can run normally.';
    }
    if (bridgeReachable && status?.upstream?.configured) {
      return 'The bridge itself is live; upstream synchronization is still waiting, so this page is showing the bridge-visible slice instead of the full external fabric.';
    }
    if (bridgeReachable) {
      return 'The bridge runtime is reachable and protected, with live proof-of-life already visible.';
    }
    return 'The bridge is installed and protected, but it is still waiting for upstream activation.';
  }, [bridgeReachable, status]);

  const currentActions = useMemo(() => {
    if (status?.upstream?.reachable) {
      return [
        'Refresh live status at any time',
        'Check synchronization readiness now',
        `Confirm Kloud mesh visibility (${kloudRuntime.onlineNodes}/${kloudRuntime.registeredNodes} nodes online)`,
      ];
    }
    if (bridgeReachable && status?.upstream?.configured) {
      return [
        'Refresh status after the upstream link recovers',
        'Keep using the live bridge view for proof-of-life and mesh visibility',
        `Track bridge-visible readiness (${kloudRuntime.onlineNodes}/${visibleRegisteredNodes} nodes visible)`,
      ];
    }
    if (bridgeReachable) {
      return [
        'Refresh live status at any time',
        'Use this page to confirm bridge uptime and pulse activity',
        'Wait for upstream activation when the external runtime is ready',
      ];
    }
    return [
      'Wait for upstream activation to be enabled',
      'Refresh this page to re-check readiness',
      'Use the module as a clean live visibility panel until launch',
    ];
  }, [bridgeReachable, kloudRuntime.onlineNodes, kloudRuntime.registeredNodes, status]);

  const flowLabel = useMemo(() => {
    if (status?.service_truth?.live_flow && !bridgeReachable) return status.service_truth.live_flow;
    if (status?.upstream?.reachable) return 'Bridge → Sovereign upstream → Sync → Ready';
    if (status?.ocean_core?.reachable && bridgeReachable && status?.upstream?.configured) return 'Bridge → Ocean visible → Sovereign upstream pending';
    if (bridgeReachable && status?.upstream?.configured) return 'Bridge → Runtime live → Sovereign upstream pending';
    if (bridgeReachable) return 'Bridge → Runtime live → Monitoring';
    return 'Bridge → Sovereign upstream (pending) → Sync → Ready';
  }, [bridgeReachable, status]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        <header className="rounded-3xl border border-cyan-500/30 bg-gradient-to-r from-slate-900 via-cyan-950/40 to-violet-950/40 p-6 shadow-2xl shadow-cyan-500/10">
          <div className="flex flex-wrap items-center gap-3 text-cyan-300">
            <Shield className="h-6 w-6" />
            <span className="text-sm font-semibold uppercase tracking-[0.2em]">Kloud Bridge</span>
            <span className="rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-xs">Real user services</span>
            <span className="rounded-full border border-violet-400/40 bg-violet-500/10 px-3 py-1 text-xs">Live connectivity</span>
            <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs">User-friendly view</span>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
            <div>
              <h1 className="text-3xl font-bold md:text-4xl">A cleaner live service view for real users</h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-300 md:text-base">
                This module shows the real operating state of the <strong>Kloud Bridge</strong> with useful service information,
                live connectivity feedback, and synchronization readiness — without turning the page into a static debug panel.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Current posture</p>
              <p className="mt-2 text-lg font-semibold text-cyan-200">{upstreamLabel}</p>
              <p className="mt-2 text-sm text-slate-300">{practicalState}</p>
              <p className="mt-2 text-xs text-slate-400">Verified live service feedback for real users — without noisy infrastructure details.</p>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <article className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
            <div className="flex items-center gap-2 text-emerald-300">
              <Activity className="h-4 w-4" />
              <h2 className="text-sm font-semibold">Service health</h2>
            </div>
            <div className="mt-3 space-y-1 text-sm text-slate-100">
              <p>Status: <span className="font-semibold">{health?.status ?? 'unknown'}</span></p>
              <p>Service: {health?.service ?? '—'}</p>
              <p>Uptime: {formatUptime(health?.uptime_seconds)}</p>
            </div>
          </article>

          <article className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-5">
            <div className="flex items-center gap-2 text-cyan-300">
              <Lock className="h-4 w-4" />
              <h2 className="text-sm font-semibold">Security</h2>
            </div>
            <div className="mt-3 space-y-1 text-sm text-slate-100">
              <p>Access model: <span className="font-semibold">controlled bridge</span></p>
              <p>Exposure: minimal</p>
              <p>Data view: user-safe</p>
            </div>
          </article>

          <article className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-5">
            <div className="flex items-center gap-2 text-violet-300">
              <Network className="h-4 w-4" />
              <h2 className="text-sm font-semibold">Connectivity</h2>
            </div>
            <div className="mt-3 space-y-1 text-sm text-slate-100">
              <p>State: <span className="font-semibold">{upstreamLabel}</span></p>
              <p>Bridge reachable: {bridgeReachable ? 'yes' : 'no'}</p>
              <p>Sovereign upstream: {status?.upstream?.reachable ? 'ready' : status?.upstream?.configured ? 'waiting' : 'not configured'}</p>
              <p>Ocean companion: {oceanLabel}</p>
              <p>Sync status: {syncResult?.status ?? kloudRuntime.syncStatus}</p>
            </div>
          </article>

          <article className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
            <div className="flex items-center gap-2 text-amber-300">
              <Workflow className="h-4 w-4" />
              <h2 className="text-sm font-semibold">Kloud runtime</h2>
            </div>
            <div className="mt-3 space-y-1 text-sm text-slate-100">
              <p>State: <span className="font-semibold">{kloudRuntime.state}</span></p>
              <p>Mesh: {meshModeLabel}</p>
              <p>Proof of life: {kloudRuntime.proofOfLife}</p>
            </div>
          </article>
        </section>

        <section className="rounded-3xl border border-cyan-500/20 bg-slate-900/80 p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Kloud live runtime</h2>
              <p className="mt-2 text-sm text-slate-400">
                Kloud is surfaced here as a real runtime layer with mesh visibility, proof-of-life, and synchronization readiness.
              </p>
            </div>
            <div className="text-right text-xs text-slate-400">
              <p>{meshCountLabel}</p>
              <p>{kloudRuntime.totalPulses} pulse frames recorded</p>
              <p className="max-w-xs text-slate-500">{meshVisibilityNote}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Kloud state</p>
              <p className="mt-2 text-2xl font-bold text-white">{kloudRuntime.state}</p>
              <p className="mt-1 text-xs text-cyan-100/80">{kloudRuntime.liveFlow}</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">Mesh nodes</p>
              <p className="mt-2 text-2xl font-bold text-white">{kloudRuntime.onlineNodes}/{visibleRegisteredNodes}</p>
              <p className="mt-1 text-xs text-emerald-100/80">{status?.upstream?.reachable ? 'online / registered' : 'bridge-visible / registered'}</p>
            </div>
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-amber-200">Coordinator</p>
              <p className="mt-2 text-base font-bold text-white">{kloudRuntime.coordinatorNodeId}</p>
              <p className="mt-1 text-xs text-amber-100/80">network {kloudRuntime.networkHealth}</p>
            </div>
            <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-violet-200">Pulse + sync</p>
              <p className="mt-2 text-2xl font-bold text-white">{kloudRuntime.totalPulses}</p>
              <p className="mt-1 text-xs text-violet-100/80">proof {kloudRuntime.proofOfLife} • {kloudRuntime.syncStatus}</p>
            </div>
          </div>
        </section>

        {fleetSummary && (
          <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Platform behind the bridge</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Kloud is not shown here as a raw debug wall — it now surfaces the wider Clisonix service fabric and the bridge-adjacent layers users actually care about.
                </p>
              </div>
              <div className="text-right text-xs text-slate-400">
                <p>{fleetSummary.totalServices} services discovered</p>
                <p>{fleetSummary.runningContainers}/{fleetSummary.totalContainers} live containers</p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Service fleet</p>
                <p className="mt-2 text-3xl font-bold text-white">{fleetSummary.totalServices}</p>
                <p className="mt-1 text-xs text-cyan-100/80">Clisonix + Kloud discovery surface</p>
              </div>
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">Running now</p>
                <p className="mt-2 text-3xl font-bold text-white">{fleetSummary.runningContainers}</p>
                <p className="mt-1 text-xs text-emerald-100/80">Verified active containers</p>
              </div>
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-amber-200">Kloud nodes</p>
                <p className="mt-2 text-3xl font-bold text-white">{fleetSummary.kloudNodes}</p>
                <p className="mt-1 text-xs text-amber-100/80">Mesh visibility through the bridge</p>
              </div>
              <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-violet-200">Capabilities</p>
                <p className="mt-2 text-3xl font-bold text-white">{fleetSummary.capabilityCount}</p>
                <p className="mt-1 text-xs text-violet-100/80">Across {fleetSummary.categoryCount} categories</p>
              </div>
            </div>

            {fleetServices.length > 0 && (
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {fleetServices.map((service) => (
                  <div key={service.id || service.name} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-lg">{getServiceGlyph(service)}</span>
                      <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{service.stack || 'clisonix'}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-white">{service.name || service.id}</p>
                    <p className="mt-1 text-xs capitalize text-slate-400">{service.category || 'service'} • {service.source || 'catalog'}</p>
                    {service.capabilities && service.capabilities.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {service.capabilities.slice(0, 2).map((capability) => (
                          <span key={`${service.id || service.name}-${capability}`} className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-300">
                            {capability}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
            <div className="flex items-center gap-2 text-cyan-300">
              <Workflow className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Real service actions</h2>
            </div>
            <p className="mt-2 text-sm text-slate-400">
              Check live service status and synchronization readiness in a simpler, more human-friendly way.
            </p>

            <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                <div>
                  <p className="font-semibold">Live note</p>
                  <p className="mt-1 text-amber-50/90">{liveNote}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Live flow</p>
              <p className="mt-2 text-sm font-semibold text-slate-100">{flowLabel}</p>
              <p className="mt-2 text-sm text-slate-300">Bridge status is shown as a simple operational path: bridge visibility, sovereign upstream reachability, Ocean linkage, sync readiness, then ready state.</p>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">What users can do now</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-200">
                {currentActions.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={loadStatus}
                disabled={isRefreshing}
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing…' : 'Refresh live status'}
              </button>

              <button
                onClick={syncFabric}
                disabled={isSyncing}
                className="inline-flex items-center gap-2 rounded-xl border border-violet-400/40 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 disabled:opacity-50"
              >
                <Database className="h-4 w-4" />
                {isSyncing ? 'Syncing…' : 'Check synchronization'}
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                <p className="font-semibold">Limited live response</p>
                <p className="mt-1">The page is still showing the safest verified service state for users.</p>
                <p className="mt-2 text-red-100/90">Internal diagnostics stay in the protected operator view while this page remains clean and user-safe.</p>
              </div>
            )}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Users get</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-200">
                  <li>• live service visibility</li>
                  <li>• connection readiness</li>
                  <li>• real sync confirmation</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Protected by design</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-200">
                  <li>• no fake values</li>
                  <li>• no raw infrastructure noise</li>
                  <li>• only useful service signals</li>
                </ul>
              </div>
            </div>
          </article>

          <article className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">User service summary</h2>
              <Link href="/developers" className="inline-flex items-center gap-1 text-sm text-cyan-300 hover:text-cyan-200">
                Developer docs <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-5 space-y-4 text-sm text-slate-300">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <div className="flex items-center gap-2 text-slate-100">
                  <Sparkles className="h-4 w-4 text-cyan-300" />
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Service state</p>
                </div>
                <p className="mt-2 text-base font-semibold text-slate-100">{health?.status ?? 'unknown'}</p>
                <p className="mt-2">The page stays focused on real service health and verified availability.</p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Connectivity</p>
                <p className="mt-2 text-base font-semibold text-slate-100">{upstreamLabel}</p>
                <p className="mt-2">Sovereign upstream: {status?.upstream?.reachable ? 'ready' : status?.upstream?.configured ? 'waiting' : 'not configured'} • Ocean: {oceanLabel}.</p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Synchronization</p>
                <p className="mt-2 text-base font-semibold text-slate-100">{syncResult?.status ?? kloudRuntime.syncStatus ?? 'Not synchronized yet'}</p>
                <p className="mt-2">Live responses confirm readiness and continuity using verified service data only.</p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Kloud mesh</p>
                <p className="mt-2 text-base font-semibold text-slate-100">{meshModeLabel}</p>
                <p className="mt-2">{meshVisibilityNote} Coordinator {kloudRuntime.coordinatorNodeId}; {kloudRuntime.onlineNodes} online, {kloudRuntime.staleNodes} stale.</p>
              </div>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
