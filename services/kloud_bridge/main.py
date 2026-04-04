from __future__ import annotations

import base64
import json
import os
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

SERVICE_NAME = "kloud-bridge"
SERVICE_VERSION = "0.4.0"
API_PREFIX = "/api/v1"
PORT = int(os.getenv("PORT", os.getenv("KLOUD_BRIDGE_PORT", "8889")))
KLOUD_UPSTREAM_URL = os.getenv("KLOUD_UPSTREAM_URL", "").strip().rstrip("/")
KLOUD_UPSTREAM_CANDIDATES_RAW = os.getenv("KLOUD_UPSTREAM_CANDIDATES", "")
KLOUD_SIGNAL_PATH = os.getenv("KLOUD_SIGNAL_PATH", "/submit")
KLOUD_STATUS_PATH = os.getenv("KLOUD_STATUS_PATH", "/status")
KLOUD_PEERS_PATH = os.getenv("KLOUD_PEERS_PATH", "/peers")
KLOUD_STATE_PATH = os.getenv("KLOUD_STATE_PATH", "/state")
KLOUD_ISOLATED_MODE = os.getenv("KLOUD_ISOLATED_MODE", "true").lower() == "true"
KLOUD_TIMEOUT_SECONDS = float(os.getenv("KLOUD_TIMEOUT_SECONDS", "8"))
OCEAN_CORE_URL = os.getenv("OCEAN_CORE_URL", "http://clisonix-ocean-core:8030").rstrip("/")
OCEAN_STATUS_PATH = os.getenv("OCEAN_STATUS_PATH", "/api/v1/status")
OCEAN_SIGNAL_PATH = os.getenv("OCEAN_SIGNAL_PATH", "/api/v1/signals/internal")
KLOUD_BRIDGE_ADMIN_TOKEN = (
    os.getenv("KLOUD_BRIDGE_ADMIN_TOKEN", "").strip()
    or os.getenv("OCEAN_ADMIN_API_TOKEN", "").strip()
)
KLOUD_NODE_API_TOKEN = os.getenv("KLOUD_NODE_API_TOKEN", "").strip()
LIVE_ONLY_MODE = True
BRIDGE_MODE = "production-live" if LIVE_ONLY_MODE else "integration-flex"
ENFORCEMENT_MODE = "hard" if LIVE_ONLY_MODE else "soft"
INSTANCE_ID = os.getenv("INSTANCE_ID", str(uuid.uuid4())[:8])
START_TIME = time.time()
_LAST_LIVE_UPSTREAM_URL = ""
_LAST_SUCCESSFUL_SYNC_AT: Optional[str] = None
_LAST_UPSTREAM_ERROR = ""
_LAST_SIGNAL_ACTIVITY: Dict[str, Any] = {}
KLOUD_NODE_REGISTRY_PATH = os.getenv(
    "KLOUD_NODE_REGISTRY_PATH",
    os.path.join(os.path.dirname(__file__), "data", "hardware_nodes.json"),
).strip()
_LAST_REGISTRY_SYNC_AT: Optional[str] = None
_LAST_REGISTRY_ERROR = ""
HARDWARE_NODES: Dict[str, Dict[str, Any]] = {}
HARDWARE_PROFILE: Dict[str, Any] = {
    "name": "OceanCore + KLOUd hardware path",
    "phase": "prototype-contract",
    "chip_ready": False,
    "target_architecture": "RISC-V",
    "runtime": "Rust + GNU-compatible toolchain",
    "role": "Physical edge execution layer for signal processing, telemetry, and distributed coordination.",
    "principles": [
        "Clisonix remains the product and intelligence layer.",
        "Kloud remains the sovereign runtime and trust fabric.",
        "Hardware stays behind the isolated bridge contract.",
        "Use real telemetry and heartbeat signals instead of demo state.",
        "Validate with prototypes before any ASIC claim.",
    ],
}
FIRMWARE_CONTRACT: Dict[str, Any] = {
    "version": "v0.1",
    "transport": "http-json",
    "register_endpoint": "/hardware/nodes/register",
    "heartbeat_endpoint": "/hardware/nodes/heartbeat",
    "node_detail_endpoint": "/hardware/nodes/{node_id}",
    "recommended_heartbeat_seconds": 15,
    "required_registration_fields": [
        "node_id",
        "node_class",
        "architecture",
        "runtime",
        "firmware_version",
    ],
    "required_heartbeat_fields": [
        "node_id",
        "status",
    ],
    "optional_metrics": [
        "uptime_seconds",
        "temperature_c",
        "power_watts",
        "latency_ms",
        "telemetry",
    ],
    "status_values": ["registered", "online", "degraded", "offline", "maintenance"],
    "notes": [
        "Register before sending heartbeats.",
        "Use live telemetry values rather than placeholders whenever available.",
        "Forward-to-Ocean is optional and reserved for routed internal signals.",
    ],
    "security": {
        "auth": "x-node-token or Bearer token when KLOUD_NODE_API_TOKEN is configured",
        "roles": ["node", "operator", "admin"],
    },
}

app = FastAPI(
    title="Clisonix Kloud Bridge",
    version=SERVICE_VERSION,
    description="Isolated bridge microservice that connects Clisonix to the sovereign Kloud fabric without merging codebases.",
)


class PublishRequest(BaseModel):
    ops: List[str] = Field(default_factory=lambda: ["S"])
    payload: Dict[str, Any] = Field(default_factory=dict)
    payload_b64: Optional[str] = None
    source: str = "clisonix"
    route: Optional[str] = None
    dry_run: bool = False


class FabricSyncRequest(BaseModel):
    include_state: bool = True
    include_peers: bool = True
    include_status: bool = True
    dry_run: bool = False
    metadata: Dict[str, Any] = Field(default_factory=dict)


class OceanSignalRequest(BaseModel):
    event_type: str = "kloud.bridge.signal"
    source: str = "kloud-bridge"
    payload: Dict[str, Any] = Field(default_factory=dict)
    priority: str = "normal"
    tags: List[str] = Field(default_factory=lambda: ["kloud", "bridge", "ocean"])
    correlation_id: Optional[str] = None
    dry_run: bool = False


class HardwareNodeRegistration(BaseModel):
    node_id: str = Field(..., min_length=2, max_length=80)
    node_class: str = "oceancore-edge"
    architecture: str = "riscv"
    runtime: str = "rust"
    transport: str = "http"
    firmware_version: str = "0.1.0"
    capabilities: List[str] = Field(default_factory=lambda: ["heartbeat", "telemetry"])
    metadata: Dict[str, Any] = Field(default_factory=dict)


class HardwareNodeHeartbeat(BaseModel):
    node_id: str = Field(..., min_length=2, max_length=80)
    status: str = "online"
    uptime_seconds: Optional[float] = None
    temperature_c: Optional[float] = None
    power_watts: Optional[float] = None
    latency_ms: Optional[float] = None
    telemetry: Dict[str, Any] = Field(default_factory=dict)
    forward_to_ocean: bool = False


def _normalize_candidate_urls() -> List[str]:
    raw_candidates: List[str] = [KLOUD_UPSTREAM_URL]
    if KLOUD_UPSTREAM_CANDIDATES_RAW:
        raw_candidates.extend(part.strip() for part in KLOUD_UPSTREAM_CANDIDATES_RAW.split(","))
    raw_candidates.extend(
        [
            "http://host.docker.internal:9080",
            "http://127.0.0.1:9080",
            "http://localhost:9080",
        ]
    )

    normalized: List[str] = []
    for item in raw_candidates:
        candidate = (item or "").strip().rstrip("/")
        if candidate and candidate not in normalized:
            normalized.append(candidate)
    return normalized


def _ordered_upstream_candidates() -> List[str]:
    ordered: List[str] = []
    if _LAST_LIVE_UPSTREAM_URL:
        ordered.append(_LAST_LIVE_UPSTREAM_URL)
    ordered.extend(_normalize_candidate_urls())
    return list(dict.fromkeys(ordered))


def _current_upstream_target() -> Optional[str]:
    candidates = _ordered_upstream_candidates()
    return candidates[0] if candidates else None


def _require_admin_access(x_admin_token: Optional[str] = None, authorization: Optional[str] = None) -> None:
    configured = (KLOUD_BRIDGE_ADMIN_TOKEN or "").strip()
    if not configured:
        raise HTTPException(status_code=503, detail="Admin diagnostics token is not configured")

    auth_header = (authorization or "").strip()
    bearer = auth_header[7:].strip() if auth_header.lower().startswith("bearer ") else ""
    candidate = (x_admin_token or "").strip() or bearer
    if candidate != configured:
        raise HTTPException(status_code=401, detail="Unauthorized")


def _require_node_access(x_node_token: Optional[str] = None, authorization: Optional[str] = None) -> None:
    configured = (KLOUD_NODE_API_TOKEN or "").strip()
    if not configured:
        return

    auth_header = (authorization or "").strip()
    bearer = auth_header[7:].strip() if auth_header.lower().startswith("bearer ") else ""
    candidate = (x_node_token or "").strip() or bearer
    admin_token = (KLOUD_BRIDGE_ADMIN_TOKEN or "").strip()
    if candidate not in {configured, admin_token}:
        raise HTTPException(status_code=401, detail="Unauthorized node token")


def _security_summary() -> Dict[str, Any]:
    return {
        "auth": {
            "admin": "x-admin-token or Bearer token",
            "node": "x-node-token or Bearer token" if KLOUD_NODE_API_TOKEN else "optional-until-configured",
        },
        "roles": ["operator", "node", "admin"],
        "admin_token_configured": bool(KLOUD_BRIDGE_ADMIN_TOKEN),
        "node_token_configured": bool(KLOUD_NODE_API_TOKEN),
        "mode": BRIDGE_MODE,
        "enforcement": ENFORCEMENT_MODE,
    }


def _registry_summary() -> Dict[str, Any]:
    return {
        "backend": "json-file",
        "path": KLOUD_NODE_REGISTRY_PATH,
        "persistent": True,
        "last_sync_at": _LAST_REGISTRY_SYNC_AT,
        "last_error": _LAST_REGISTRY_ERROR or None,
    }


def _persist_hardware_nodes() -> None:
    global _LAST_REGISTRY_SYNC_AT, _LAST_REGISTRY_ERROR

    try:
        directory = os.path.dirname(KLOUD_NODE_REGISTRY_PATH)
        if directory:
            os.makedirs(directory, exist_ok=True)
        with open(KLOUD_NODE_REGISTRY_PATH, "w", encoding="utf-8") as handle:
            json.dump(HARDWARE_NODES, handle, ensure_ascii=False, indent=2)
        _LAST_REGISTRY_SYNC_AT = datetime.now(timezone.utc).isoformat()
        _LAST_REGISTRY_ERROR = ""
    except Exception as exc:
        _LAST_REGISTRY_ERROR = str(exc)


def _load_hardware_nodes() -> None:
    global _LAST_REGISTRY_SYNC_AT, _LAST_REGISTRY_ERROR

    try:
        if not os.path.exists(KLOUD_NODE_REGISTRY_PATH):
            return
        with open(KLOUD_NODE_REGISTRY_PATH, "r", encoding="utf-8") as handle:
            data = json.load(handle)
        if isinstance(data, dict):
            HARDWARE_NODES.clear()
            HARDWARE_NODES.update(data)
            _LAST_REGISTRY_SYNC_AT = datetime.now(timezone.utc).isoformat()
            _LAST_REGISTRY_ERROR = ""
    except Exception as exc:
        _LAST_REGISTRY_ERROR = str(exc)


@app.on_event("startup")
async def load_hardware_registry() -> None:
    _load_hardware_nodes()


_load_hardware_nodes()


@app.get("/")
def root() -> Dict[str, Any]:
    return {
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
        "instance": INSTANCE_ID,
        "isolated": KLOUD_ISOLATED_MODE,
        "live_only": LIVE_ONLY_MODE,
        "mode": BRIDGE_MODE,
        "enforcement": ENFORCEMENT_MODE,
        "purpose": "Bridge Clisonix services to the external sovereign Kloud runtime.",
        "policy": "No simulated data or local-accept fallbacks are returned in production live-only mode.",
        "api": {
            "default_version": "v1",
            "primary_prefix": API_PREFIX,
            "legacy_unversioned_paths_supported": True,
        },
        "security": _security_summary(),
        "registry": _registry_summary(),
        "endpoints": {
            "GET /health": "Liveness and configuration probe",
            "GET /status": "Bridge + upstream + Ocean Core visibility",
            "GET /fabric/summary": "Compact NanoGrid/Kloud health summary for dashboards",
            "GET /ocean/status": "Fetch live Ocean Core status through the bridge",
            "GET /hardware/profile": "Professional hardware profile for the OceanCore + KLOUd edge path",
            "GET /hardware/contracts/firmware-v0.1": "Canonical firmware/edge contract for node registration and heartbeat behavior",
            "GET /hardware/nodes": "List registered hardware prototype nodes and their live state",
            "GET /hardware/nodes/{node_id}": "Inspect one hardware prototype node in detail",
            "GET /hardware/registry": "Inspect registry backend and persistence state for bound nodes",
            "GET /admin/diagnostics": "Protected operator diagnostics with candidate upstream visibility",
            "POST /signals/publish": "Forward a real Clisonix signal into Kloud /submit",
            "POST /fabric/sync": "Fetch live remote Kloud state, peers, and status",
            "POST /ocean/signals/publish": "Forward a Kloud-origin signal into Ocean Core routing",
            "POST /hardware/nodes/register": "Register a real OceanCore/KLOUd edge node",
            "POST /hardware/nodes/heartbeat": "Update live heartbeat and optional telemetry for a registered hardware node",
        },
        "hardware": _hardware_summary(),
    }


@app.get("/health")
@app.get(f"{API_PREFIX}/health")
def health() -> Dict[str, Any]:
    upstream_target = _current_upstream_target()
    upstream_configured = bool(upstream_target)
    hardware = _hardware_summary()
    return {
        "status": "ok" if upstream_configured else "degraded",
        "service": SERVICE_NAME,
        "port": PORT,
        "isolated": KLOUD_ISOLATED_MODE,
        "live_only": LIVE_ONLY_MODE,
        "mode": BRIDGE_MODE,
        "enforcement": ENFORCEMENT_MODE,
        "upstream_configured": upstream_configured,
        "upstream_target": upstream_target,
        "ocean_configured": bool(OCEAN_CORE_URL),
        "admin_diagnostics": bool(KLOUD_BRIDGE_ADMIN_TOKEN),
        "uptime_seconds": round(time.time() - START_TIME, 2),
        "hardware_nodes_registered": hardware["registered_nodes"],
        "hardware_nodes_online": hardware["online_nodes"],
        "hardware_nodes_offline": hardware["offline_nodes"],
        "security": _security_summary(),
    }


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _hardware_summary() -> Dict[str, Any]:
    nodes = list(HARDWARE_NODES.values())
    online = sum(1 for node in nodes if str(node.get("status", "")).lower() == "online")
    seen_values = [str(node["last_seen_at"]) for node in nodes if node.get("last_seen_at")]
    last_seen = max(seen_values) if seen_values else None
    offline = max(len(nodes) - online, 0)
    latency_values = [float(node["latency_ms"]) for node in nodes if node.get("latency_ms") is not None]
    last_latency = latency_values[-1] if latency_values else None

    if not nodes:
        network_health = "no-nodes"
    elif online == len(nodes) and (last_latency is None or last_latency <= 25):
        network_health = "healthy"
    elif online > 0:
        network_health = "degraded"
    else:
        network_health = "offline"

    return {
        "phase": HARDWARE_PROFILE["phase"],
        "chip_ready": HARDWARE_PROFILE["chip_ready"],
        "registered_nodes": len(nodes),
        "online_nodes": online,
        "offline_nodes": offline,
        "last_seen_at": last_seen,
        "last_heartbeat_latency_ms": last_latency,
        "network_health": network_health,
        "registry_backend": "json-file",
        "registry_persistent": True,
        "target_architecture": HARDWARE_PROFILE["target_architecture"],
        "runtime": HARDWARE_PROFILE["runtime"],
    }


def _record_signal_activity(source: str, route: str, payload: Dict[str, Any], upstream_url: str) -> None:
    global _LAST_SIGNAL_ACTIVITY
    _LAST_SIGNAL_ACTIVITY = {
        "timestamp": _now_iso(),
        "source": source,
        "route": route,
        "upstream_url": upstream_url,
        "payload_keys": sorted(list(payload.keys()))[:10],
    }


def _build_truth_contract(upstream: Dict[str, Any], ocean: Dict[str, Any], peer_count: int) -> Dict[str, Any]:
    hardware = _hardware_summary()
    upstream_reachable = bool(upstream.get("reachable"))
    ocean_reachable = bool(ocean.get("reachable"))

    if upstream_reachable and ocean_reachable:
        state = "ready"
        connectivity = "connected"
        sync_status = "synchronized"
        confidence = "verified"
        estimated_recovery = None
    elif upstream_reachable:
        state = "partial-sync"
        connectivity = "connected"
        sync_status = "partial"
        confidence = "partial"
        estimated_recovery = "Ocean visibility is still limited; bridge sync is already active."
    elif upstream.get("configured") and _LAST_SUCCESSFUL_SYNC_AT:
        state = "recovering"
        connectivity = "limited"
        sync_status = "waiting"
        confidence = "partial"
        estimated_recovery = "Retry synchronization when the upstream responds again."
    elif upstream.get("configured"):
        state = "degraded"
        connectivity = "limited"
        sync_status = "waiting"
        confidence = "verified"
        estimated_recovery = "Upstream must respond before synchronization can complete."
    else:
        state = "setup-required"
        connectivity = "not-configured"
        sync_status = "not-configured"
        confidence = "unknown"
        estimated_recovery = "Set KLOUD_UPSTREAM_URL or KLOUD_UPSTREAM_CANDIDATES."

    live_flow = {
        "synchronized": "Bridge → Upstream → Ready",
        "partial": "Bridge → Upstream → Partial sync",
        "waiting": "Bridge → Upstream → Sync waiting",
        "not-configured": "Bridge → Upstream → Setup required",
    }.get(sync_status, "Bridge → Upstream → Review")

    return {
        "state": state,
        "connectivity": connectivity,
        "sync_status": sync_status,
        "confidence": confidence,
        "last_successful_sync": _LAST_SUCCESSFUL_SYNC_AT,
        "estimated_recovery": estimated_recovery,
        "peer_count": peer_count,
        "proof_of_life": "active" if hardware["online_nodes"] > 0 or _LAST_SIGNAL_ACTIVITY else "pending",
        "last_signal": _LAST_SIGNAL_ACTIVITY or None,
        "last_upstream_error": _LAST_UPSTREAM_ERROR or None,
        "live_flow": live_flow,
        "hardware_network_health": hardware["network_health"],
    }


def _build_bridge_summary(upstream: Dict[str, Any], ocean: Dict[str, Any]) -> Dict[str, Any]:
    """Create a concise, UI-friendly summary of live bridge health."""
    upstream_status = "live" if upstream.get("reachable") else ("configured" if upstream.get("configured") else "setup-required")
    ocean_status = "live" if ocean.get("reachable") else ("configured" if ocean.get("configured") else "setup-required")
    upstream_payload = upstream.get("status", {}) if isinstance(upstream.get("status"), dict) else {}

    peer_count = 0
    for candidate_key in ("peers", "nodes", "neighbors"):
        candidate_value = upstream_payload.get(candidate_key)
        if isinstance(candidate_value, list):
            peer_count = len(candidate_value)
            break

    truth = _build_truth_contract(upstream, ocean, peer_count)

    return {
        "bridge": "live" if upstream.get("reachable") or ocean.get("reachable") else "degraded",
        "upstream_status": upstream_status,
        "ocean_status": ocean_status,
        "peer_count": peer_count,
        "upstream_target": upstream.get("url"),
        "ocean_target": ocean.get("url"),
        "hardware_nodes": _hardware_summary(),
        "service_truth": truth,
        "state": truth["state"],
        "connectivity": truth["connectivity"],
        "sync_status": truth["sync_status"],
        "confidence": truth["confidence"],
        "last_successful_sync": truth["last_successful_sync"],
        "estimated_recovery": truth["estimated_recovery"],
    }


@app.get("/status")
@app.get(f"{API_PREFIX}/status")
async def status() -> Dict[str, Any]:
    upstream = await _probe_upstream()
    ocean = await _probe_ocean()
    availability = "connected" if upstream.get("reachable") else ("limited" if upstream.get("configured") else "setup-required")
    summary = _build_bridge_summary(upstream, ocean)
    return {
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
        "instance": INSTANCE_ID,
        "isolated": KLOUD_ISOLATED_MODE,
        "live_only": LIVE_ONLY_MODE,
        "mode": BRIDGE_MODE,
        "enforcement": ENFORCEMENT_MODE,
        "port": PORT,
        "availability": availability,
        "summary": summary,
        "service_truth": summary.get("service_truth", {}),
        "security": _security_summary(),
        "upstream": upstream,
        "ocean_core": ocean,
        "hardware": {
            "profile": HARDWARE_PROFILE,
            "summary": _hardware_summary(),
        },
    }


@app.get("/fabric/summary")
@app.get("/fabric/state")
@app.get(f"{API_PREFIX}/fabric/summary")
@app.get(f"{API_PREFIX}/fabric/state")
async def fabric_summary() -> Dict[str, Any]:
    upstream = await _probe_upstream()
    ocean = await _probe_ocean()
    return _build_bridge_summary(upstream, ocean)


@app.get("/ocean/status")
@app.get(f"{API_PREFIX}/ocean/status")
async def ocean_status() -> Dict[str, Any]:
    return await _probe_ocean()


@app.get("/hardware/profile")
@app.get(f"{API_PREFIX}/hardware/profile")
def hardware_profile() -> Dict[str, Any]:
    return {
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
        "profile": HARDWARE_PROFILE,
        "summary": _hardware_summary(),
        "firmware_contract": FIRMWARE_CONTRACT,
        "contracts": {
            "register": "POST /hardware/nodes/register",
            "heartbeat": "POST /hardware/nodes/heartbeat",
            "nodes": "GET /hardware/nodes",
            "node_detail": "GET /hardware/nodes/{node_id}",
        },
    }


@app.get("/hardware/contracts/firmware-v0.1")
@app.get(f"{API_PREFIX}/hardware/contracts/firmware-v0.1")
def hardware_firmware_contract() -> Dict[str, Any]:
    return {
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
        "hardware_profile": HARDWARE_PROFILE,
        "contract": FIRMWARE_CONTRACT,
    }


@app.get("/hardware/nodes")
@app.get(f"{API_PREFIX}/hardware/nodes")
def list_hardware_nodes() -> Dict[str, Any]:
    return {
        "service": SERVICE_NAME,
        "summary": _hardware_summary(),
        "registry": _registry_summary(),
        "nodes": list(HARDWARE_NODES.values()),
    }


@app.get("/hardware/registry")
@app.get(f"{API_PREFIX}/hardware/registry")
def hardware_registry() -> Dict[str, Any]:
    return {
        "service": SERVICE_NAME,
        "registry": _registry_summary(),
        "summary": _hardware_summary(),
        "node_ids": sorted(HARDWARE_NODES.keys()),
    }


@app.get("/hardware/nodes/{node_id}")
@app.get(f"{API_PREFIX}/hardware/nodes/{{node_id}}")
def get_hardware_node(node_id: str) -> Dict[str, Any]:
    node = HARDWARE_NODES.get(node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Hardware node was not found.")
    return {
        "service": SERVICE_NAME,
        "node": node,
        "contract_version": FIRMWARE_CONTRACT["version"],
    }


@app.post("/hardware/nodes/register")
@app.post(f"{API_PREFIX}/hardware/nodes/register")
def register_hardware_node(
    request: HardwareNodeRegistration,
    x_node_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    _require_node_access(x_node_token, authorization)
    now = _now_iso()
    existing = HARDWARE_NODES.get(request.node_id, {})
    created = not bool(existing)

    node = {
        **existing,
        "node_id": request.node_id,
        "node_class": request.node_class,
        "architecture": request.architecture,
        "runtime": request.runtime,
        "transport": request.transport,
        "firmware_version": request.firmware_version,
        "capabilities": request.capabilities,
        "metadata": request.metadata,
        "status": existing.get("status", "registered"),
        "binding_state": "bound",
        "entity_managed": True,
        "first_seen_at": existing.get("first_seen_at", now),
        "last_registration_at": now,
        "last_seen_at": now,
    }
    HARDWARE_NODES[request.node_id] = node
    _persist_hardware_nodes()

    return {
        "status": "registered" if created else "updated",
        "live_only": LIVE_ONLY_MODE,
        "contract_version": FIRMWARE_CONTRACT["version"],
        "binding_state": "bound",
        "node": node,
        "summary": _hardware_summary(),
        "registry": _registry_summary(),
    }


@app.post("/hardware/nodes/heartbeat")
@app.post(f"{API_PREFIX}/hardware/nodes/heartbeat")
async def hardware_node_heartbeat(
    request: HardwareNodeHeartbeat,
    x_node_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    _require_node_access(x_node_token, authorization)
    node = HARDWARE_NODES.get(request.node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Hardware node is not registered. Call /hardware/nodes/register first.")

    node.update(
        {
            "status": request.status,
            "binding_state": "bound",
            "entity_managed": True,
            "uptime_seconds": request.uptime_seconds,
            "temperature_c": request.temperature_c,
            "power_watts": request.power_watts,
            "latency_ms": request.latency_ms,
            "telemetry": request.telemetry,
            "last_seen_at": _now_iso(),
        }
    )
    _persist_hardware_nodes()

    forward_result = {"attempted": False, "forwarded": False}
    if request.forward_to_ocean:
        forward_result = await _forward_hardware_heartbeat_to_ocean(node)

    return {
        "status": "heartbeat-recorded",
        "binding_state": "bound",
        "node": node,
        "ocean_forward": forward_result,
        "summary": _hardware_summary(),
        "registry": _registry_summary(),
    }


@app.get("/admin/diagnostics")
@app.get(f"{API_PREFIX}/admin/diagnostics")
async def admin_diagnostics(
    x_admin_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    _require_admin_access(x_admin_token, authorization)
    upstream = await _probe_upstream()
    ocean = await _probe_ocean()
    return {
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
        "instance": INSTANCE_ID,
        "isolated": KLOUD_ISOLATED_MODE,
        "live_only": LIVE_ONLY_MODE,
        "uptime_seconds": round(time.time() - START_TIME, 2),
        "timeout_seconds": KLOUD_TIMEOUT_SECONDS,
        "candidates": _ordered_upstream_candidates(),
        "selected_upstream": upstream.get("url"),
        "paths": {
            "status": KLOUD_STATUS_PATH,
            "peers": KLOUD_PEERS_PATH,
            "state": KLOUD_STATE_PATH,
            "signal": KLOUD_SIGNAL_PATH,
            "ocean_status": OCEAN_STATUS_PATH,
            "ocean_signal": OCEAN_SIGNAL_PATH,
        },
        "hardware": {
            "profile": HARDWARE_PROFILE,
            "summary": _hardware_summary(),
            "nodes": list(HARDWARE_NODES.values()),
        },
        "upstream": upstream,
        "ocean_core": ocean,
    }


@app.post("/ocean/signals/publish")
@app.post(f"{API_PREFIX}/ocean/signals/publish")
async def publish_to_ocean(request: OceanSignalRequest) -> Dict[str, Any]:
    _reject_dry_run(request.dry_run, "ocean signal publishing")
    ocean_url = _require_ocean()
    url = f"{ocean_url}{OCEAN_SIGNAL_PATH}"
    outbound = {
        "event_type": request.event_type,
        "source": request.source,
        "payload": request.payload,
        "origin": "internal",
        "priority": request.priority,
        "tags": request.tags,
        "correlation_id": request.correlation_id,
    }

    try:
        async with httpx.AsyncClient(timeout=KLOUD_TIMEOUT_SECONDS) as client:
            response = await client.post(url, json=outbound)
            response.raise_for_status()
            body = _safe_json(response)
        return {
            "status": "forwarded",
            "forwarded": True,
            "target": "ocean-core",
            "ocean_url": url,
            "signal": body,
        }
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Ocean Core returned {exc.response.status_code} for {OCEAN_SIGNAL_PATH}: {exc.response.text[:300]}",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to forward live signal to Ocean Core: {exc}",
        ) from exc


@app.post("/signals/publish")
@app.post(f"{API_PREFIX}/signals/publish")
async def publish_signal(request: PublishRequest) -> Dict[str, Any]:
    _reject_dry_run(request.dry_run, "signal publishing")
    upstream_url = _require_upstream()

    if not request.payload_b64 and not request.payload:
        raise HTTPException(
            status_code=400,
            detail="A real signal payload is required; empty or demo payloads are not allowed.",
        )

    payload_b64 = request.payload_b64 or _encode_payload(request.payload)
    submit_payload = {
        "ops": request.ops,
        "payload": payload_b64,
        "source": request.source,
        "submitted_at": _now_iso(),
    }
    route = request.route or KLOUD_SIGNAL_PATH
    url = f"{upstream_url}{route}"

    try:
        async with httpx.AsyncClient(timeout=KLOUD_TIMEOUT_SECONDS) as client:
            response = await client.post(url, json=submit_payload)
            response.raise_for_status()
            body = _safe_json(response)
        _record_signal_activity(request.source, route, request.payload, url)
        return {
            "status": "forwarded",
            "forwarded": True,
            "isolated": KLOUD_ISOLATED_MODE,
            "live_only": LIVE_ONLY_MODE,
            "route": route,
            "upstream_url": url,
            "source": request.source,
            "last_signal": _LAST_SIGNAL_ACTIVITY,
            "kloud_response": body,
        }
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Kloud upstream returned {exc.response.status_code} for {route}: {exc.response.text[:300]}",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to forward live signal to Kloud: {exc}",
        ) from exc


@app.post("/fabric/sync")
@app.post(f"{API_PREFIX}/fabric/sync")
async def fabric_sync(request: FabricSyncRequest) -> Dict[str, Any]:
    global _LAST_SUCCESSFUL_SYNC_AT

    _reject_dry_run(request.dry_run, "fabric synchronization")
    upstream_url = _require_upstream()

    collected: Dict[str, Any] = {}
    errors: Dict[str, str] = {}

    async with httpx.AsyncClient(timeout=KLOUD_TIMEOUT_SECONDS) as client:
        for key, include, path in (
            ("status", request.include_status, KLOUD_STATUS_PATH),
            ("peers", request.include_peers, KLOUD_PEERS_PATH),
            ("state", request.include_state, KLOUD_STATE_PATH),
        ):
            if not include:
                continue
            try:
                collected[key] = await _fetch_json(client, upstream_url, path)
            except Exception as exc:
                errors[key] = str(exc)

    if errors and not collected:
        raise HTTPException(
            status_code=502,
            detail=f"Unable to fetch live Kloud snapshot: {errors}",
        )

    if collected:
        _LAST_SUCCESSFUL_SYNC_AT = _now_iso()

    response: Dict[str, Any] = {
        "status": "synchronized" if not errors else "partial",
        "isolated": KLOUD_ISOLATED_MODE,
        "live_only": LIVE_ONLY_MODE,
        "upstream_url": upstream_url,
        "last_successful_sync": _LAST_SUCCESSFUL_SYNC_AT,
        "snapshot": collected,
    }
    if errors:
        response["errors"] = errors
    return response


async def _probe_upstream() -> Dict[str, Any]:
    global _LAST_LIVE_UPSTREAM_URL, _LAST_SUCCESSFUL_SYNC_AT, _LAST_UPSTREAM_ERROR

    candidates = _ordered_upstream_candidates()
    if not candidates:
        return {
            "configured": False,
            "reachable": False,
            "message": "Kloud upstream is not configured. Set KLOUD_UPSTREAM_URL or KLOUD_UPSTREAM_CANDIDATES to enable live bridge data.",
        }

    last_error = ""
    checked: List[str] = []

    for candidate in candidates:
        checked.append(candidate)
        try:
            async with httpx.AsyncClient(timeout=min(KLOUD_TIMEOUT_SECONDS, 4)) as client:
                response = await client.get(f"{candidate}{KLOUD_STATUS_PATH}")
                response.raise_for_status()
                data = _safe_json(response)
            _LAST_LIVE_UPSTREAM_URL = candidate
            _LAST_SUCCESSFUL_SYNC_AT = _now_iso()
            _LAST_UPSTREAM_ERROR = ""
            return {
                "configured": True,
                "reachable": True,
                "url": candidate,
                "auto_discovered": candidate != KLOUD_UPSTREAM_URL,
                "candidates_checked": checked,
                "last_successful_sync": _LAST_SUCCESSFUL_SYNC_AT,
                "status": data,
            }
        except Exception as exc:
            last_error = str(exc)

    _LAST_UPSTREAM_ERROR = last_error
    return {
        "configured": True,
        "reachable": False,
        "url": KLOUD_UPSTREAM_URL or candidates[0],
        "candidates_checked": checked,
        "error": last_error,
        "last_successful_sync": _LAST_SUCCESSFUL_SYNC_AT,
        "message": "No live Kloud upstream responded. Start the sovereign fabric API or point KLOUD_UPSTREAM_URL to a reachable runtime.",
    }


async def _probe_ocean() -> Dict[str, Any]:
    if not OCEAN_CORE_URL:
        return {
            "configured": False,
            "reachable": False,
            "message": "Ocean Core URL is not configured. Set OCEAN_CORE_URL to enable bidirectional bridge visibility.",
        }

    try:
        async with httpx.AsyncClient(timeout=min(KLOUD_TIMEOUT_SECONDS, 4)) as client:
            response = await client.get(f"{OCEAN_CORE_URL}{OCEAN_STATUS_PATH}")
            response.raise_for_status()
            data = _safe_json(response)
        return {
            "configured": True,
            "reachable": True,
            "url": OCEAN_CORE_URL,
            "status": data,
        }
    except Exception as exc:
        return {
            "configured": True,
            "reachable": False,
            "url": OCEAN_CORE_URL,
            "error": str(exc),
        }


async def _forward_hardware_heartbeat_to_ocean(node: Dict[str, Any]) -> Dict[str, Any]:
    if not OCEAN_CORE_URL:
        return {
            "attempted": False,
            "forwarded": False,
            "message": "Ocean Core URL is not configured.",
        }

    outbound = {
        "event_type": "kloud.hardware.heartbeat",
        "source": "kloud-bridge",
        "payload": {
            "node_id": node.get("node_id"),
            "node_class": node.get("node_class"),
            "architecture": node.get("architecture"),
            "runtime": node.get("runtime"),
            "status": node.get("status"),
            "telemetry": node.get("telemetry", {}),
            "metrics": {
                "uptime_seconds": node.get("uptime_seconds"),
                "temperature_c": node.get("temperature_c"),
                "power_watts": node.get("power_watts"),
                "latency_ms": node.get("latency_ms"),
            },
        },
        "origin": "internal",
        "priority": "normal",
        "tags": ["kloud", "hardware", "edge", "heartbeat"],
        "correlation_id": f"hw-{node.get('node_id', 'unknown')}-{int(time.time())}",
    }

    try:
        async with httpx.AsyncClient(timeout=KLOUD_TIMEOUT_SECONDS) as client:
            response = await client.post(f"{OCEAN_CORE_URL}{OCEAN_SIGNAL_PATH}", json=outbound)
            response.raise_for_status()
            body = _safe_json(response)
        return {
            "attempted": True,
            "forwarded": True,
            "response": body,
        }
    except Exception as exc:
        return {
            "attempted": True,
            "forwarded": False,
            "error": str(exc),
        }


async def _fetch_json(client: httpx.AsyncClient, base_url: str, path: str) -> Dict[str, Any]:
    response = await client.get(f"{base_url}{path}")
    response.raise_for_status()
    return _safe_json(response)


def _require_upstream() -> str:
    upstream_url = _current_upstream_target()
    if not upstream_url:
        raise HTTPException(
            status_code=503,
            detail="Kloud upstream is not configured. Live-only mode does not allow fake or local fallback responses.",
        )
    return upstream_url


def _require_ocean() -> str:
    if not OCEAN_CORE_URL:
        raise HTTPException(
            status_code=503,
            detail="Ocean Core URL is not configured. Bidirectional bridge mode requires OCEAN_CORE_URL.",
        )
    return OCEAN_CORE_URL


def _reject_dry_run(enabled: bool, operation: str) -> None:
    if enabled:
        raise HTTPException(
            status_code=400,
            detail=f"{operation.capitalize()} dry_run mode is disabled in production live-only mode.",
        )


def _encode_payload(payload: Dict[str, Any]) -> str:
    raw = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return base64.b64encode(raw).decode("ascii")


def _safe_json(response: httpx.Response) -> Dict[str, Any]:
    try:
        data = response.json()
        if isinstance(data, dict):
            return data
        return {"data": data}
    except Exception:
        return {"text": response.text}
