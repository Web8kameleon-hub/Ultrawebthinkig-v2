#!/usr/bin/env python3
"""
BALANCER NODES SERVICE (Port 3334)
Python-based node discovery and load distribution
Routes traffic to external Mesh nodes and offline nodes
"""

import json
import logging
import os
import socket
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import requests
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Initialize FastAPI
app = FastAPI(
    title="Balancer Nodes (Python)",
    description="Node discovery, load distribution, external mesh routing",
    version="1.0.0"
)

# Add CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Node registry
NODE_REGISTRY: Dict[str, Dict[str, Any]] = {}
EXTERNAL_NODES: Dict[str, Dict[str, Any]] = {}  # External Mesh nodes
OFFLINE_NODES: List[str] = []  # Offline node IDs
REQUEST_COUNT = 0
SERVICE_START = datetime.now(timezone.utc).isoformat()

# Mesh HQ configuration
MESH_HQ_URL = "http://localhost:7777"
PULSE_SERVICE_URL = os.getenv("BALANCER_PULSE_URL", "http://localhost:3336").rstrip("/")
KLOUD_STATUS_URL = os.getenv("KLOUD_STATUS_URL", "http://localhost:9090/status").strip()
LOGGER = logging.getLogger("balancer_nodes")


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _csv_env(name: str) -> List[str]:
    value = os.getenv(name, "")
    return [item.strip() for item in value.split(",") if item.strip()]


def _event_log(message: str) -> None:
    """Emit chatty node-event logs only when explicitly enabled."""
    if _env_bool("BALANCER_NODES_EVENT_LOG", False):
        LOGGER.info(message)


def _riscv_status() -> Dict[str, Any]:
    arch = os.getenv("RISCV_ARCH", "rv64")
    mode = os.getenv("RISCV_HARDWARE_MODE", "unknown")
    secure_elements = os.getenv("RISCV_SECURE_ELEMENTS", "unknown")
    vector_ext = _env_bool("RISCV_VECTOR_EXT_ENABLED", False)
    bitmanip_ext = _env_bool("RISCV_BITMANIP_EXT_ENABLED", False)

    checks = [
        mode not in {"", "unknown"},
        secure_elements not in {"", "unknown"},
        arch in {"rv32", "rv64", "rv64v", "rv64gc"},
        vector_ext,
    ]
    readiness_score = int((sum(1 for c in checks if c) / len(checks)) * 100)

    return {
        "target_arch": arch,
        "hardware_mode": mode,
        "secure_elements": secure_elements,
        "vector_extension": vector_ext,
        "bitmanip_extension": bitmanip_ext,
        "readiness_score": readiness_score,
    }


def _governance_labor_status() -> Dict[str, Any]:
    vision_models = _csv_env("LABOR_VISION_MODELS")
    nlp_models = _csv_env("LABOR_NLP_MODELS")
    audio_models = _csv_env("LABOR_AUDIO_MODELS")
    synthesis_models = _csv_env("LABOR_SYNTHESIS_MODELS")
    java_longo_enabled = _env_bool("JAVA_LONGO_ENABLED", False)
    java_longo_url = os.getenv("JAVA_LONGO_URL", "").strip()

    onnx_enabled = _env_bool("ONNX_RUNTIME_ENABLED", False)
    governance_quantum = _env_bool("GOVERNANCE_QUANTUM_ENABLED", False)
    governance_ddos = _env_bool("GOVERNANCE_DDOS_ENABLED", False)
    governance_mesh_hq = _env_bool("GOVERNANCE_MESH_HQ_ENABLED", True)

    return {
        "governance": {
            "quantum_enabled": governance_quantum,
            "ddos_enabled": governance_ddos,
            "mesh_hq_enabled": governance_mesh_hq,
            "onnx_runtime_enabled": onnx_enabled,
        },
        "labor": {
            "vision_models": vision_models,
            "nlp_models": nlp_models,
            "audio_models": audio_models,
            "synthesis_models": synthesis_models,
            "java_longo_enabled": java_longo_enabled,
            "java_longo_url": java_longo_url or None,
            "vision_ready": len(vision_models) > 0,
            "nlp_ready": len(nlp_models) > 0,
            "audio_ready": len(audio_models) > 0,
            "synthesis_ready": len(synthesis_models) > 0,
            "java_longo_ready": java_longo_enabled and bool(java_longo_url),
        },
    }


def _safe_get_json(url: str, timeout: float = 2.0) -> Optional[Any]:
    """Fetch JSON without raising; returns decoded JSON or None when unavailable."""
    try:
        response = requests.get(url, timeout=timeout)
        response.raise_for_status()
        return response.json()
    except Exception:
        return None


def _nodesms_vendor_count() -> int:
    """Count vendor nodes that advertise NodeSMS capability in metadata/capabilities/type."""
    count = 0
    for node in VENDOR_NODES.values():
        node_type = str(node.get("type", "")).lower()
        capabilities = node.get("capabilities")
        metadata = node.get("metadata")

        capability_text = json.dumps(capabilities).lower() if isinstance(capabilities, (dict, list, str)) else ""
        metadata_text = json.dumps(metadata).lower() if isinstance(metadata, (dict, list, str)) else ""

        if "nodesms" in node_type or "nodesms" in capability_text or "nodesms" in metadata_text:
            count += 1
    return count


@app.post("/api/nodes/register")
async def register_node(nodeId: str, type: Optional[str] = None, port: Optional[int] = None,
                       host: Optional[str] = None, metadata: Optional[Dict] = None):
    """Register a new node"""
    global REQUEST_COUNT
    REQUEST_COUNT += 1

    if not nodeId:
        raise HTTPException(status_code=400, detail="nodeId required")

    node_data = {
        "nodeId": nodeId,
        "type": type or "unknown",
        "port": port,
        "host": host or socket.gethostname(),
        "status": "active",
        "registeredAt": datetime.now(timezone.utc).isoformat(),
        "lastHeartbeat": datetime.now(timezone.utc).isoformat(),
        "metadata": metadata or {},
        "requestCount": 0,
        "loadFactor": 0.0
    }

    NODE_REGISTRY[nodeId] = node_data
    _event_log(f"[{datetime.now().isoformat()}] Node registered: {nodeId}")

    return {
        "success": True,
        "message": f"Node {nodeId} registered",
        "node": node_data
    }


@app.get("/api/nodes")
async def get_nodes():
    """Get all registered nodes"""
    global REQUEST_COUNT
    REQUEST_COUNT += 1

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "totalNodes": len(NODE_REGISTRY),
        "nodes": list(NODE_REGISTRY.values())
    }


@app.get("/api/nodes/{nodeId}")
async def get_node(nodeId: str):
    """Get specific node"""
    global REQUEST_COUNT
    REQUEST_COUNT += 1

    if nodeId not in NODE_REGISTRY:
        raise HTTPException(status_code=404, detail=f"Node {nodeId} not found")

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "node": NODE_REGISTRY[nodeId]
    }


@app.put("/api/nodes/{nodeId}/status")
async def update_node_status(nodeId: str, status: str = "active", load: Optional[float] = None):
    """Update node status and load"""
    global REQUEST_COUNT
    REQUEST_COUNT += 1

    if nodeId not in NODE_REGISTRY:
        raise HTTPException(status_code=404, detail=f"Node {nodeId} not found")

    node = NODE_REGISTRY[nodeId]
    node["status"] = status
    node["lastHeartbeat"] = datetime.now(timezone.utc).isoformat()
    node["requestCount"] += 1
    if load is not None:
        node["loadFactor"] = load

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "message": f"Node {nodeId} updated",
        "node": node
    }


@app.post("/api/nodes/heartbeat")
async def node_heartbeat(nodeId: str, stats: Optional[Dict] = None, load: Optional[Dict] = None):
    """Compatibility heartbeat endpoint used by vendor-node clients."""
    global REQUEST_COUNT
    REQUEST_COUNT += 1

    if not nodeId:
        raise HTTPException(status_code=400, detail="nodeId required")

    now_iso = datetime.now(timezone.utc).isoformat()

    if nodeId not in NODE_REGISTRY:
        NODE_REGISTRY[nodeId] = {
            "nodeId": nodeId,
            "type": "vendor",
            "port": None,
            "host": socket.gethostname(),
            "status": "active",
            "registeredAt": now_iso,
            "lastHeartbeat": now_iso,
            "metadata": {},
            "requestCount": 0,
            "loadFactor": 0.0,
        }

    node = NODE_REGISTRY[nodeId]
    node["status"] = "active"
    node["lastHeartbeat"] = now_iso
    node["requestCount"] = node.get("requestCount", 0) + 1

    if stats:
        node["stats"] = stats
    if load:
        node["load"] = load
        cpu_load = load.get("cpu")
        if isinstance(cpu_load, (int, float)):
            node["loadFactor"] = float(cpu_load)

    return {"success": True, "nodeId": nodeId, "timestamp": now_iso}


@app.get("/api/load-balance")
async def get_load_balance():
    """Get load balancing recommendations"""
    global REQUEST_COUNT
    REQUEST_COUNT += 1

    if not NODE_REGISTRY:
        return {"timestamp": datetime.now(timezone.utc).isoformat(), "recommendation": "No nodes available"}

    sorted_nodes = sorted(
        NODE_REGISTRY.values(),
        key=lambda x: x.get("loadFactor", 0)
    )

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "recommended_node": sorted_nodes[0] if sorted_nodes else None,
        "all_nodes_sorted": sorted_nodes
    }


@app.post("/api/external-nodes/register")
async def register_external_node(nodeId: str, meshUrl: str, region: Optional[str] = None,
                                capacity: Optional[int] = None, metadata: Optional[Dict] = None):
    """Register external Mesh node for load distribution"""
    global REQUEST_COUNT
    REQUEST_COUNT += 1

    if not nodeId or not meshUrl:
        raise HTTPException(status_code=400, detail="nodeId and meshUrl required")

    external_node = {
        "nodeId": nodeId,
        "meshUrl": meshUrl,
        "region": region or "unknown",
        "capacity": capacity or 100,
        "metadata": metadata or {},
        "registeredAt": datetime.now(timezone.utc).isoformat(),
        "lastHeartbeat": datetime.now(timezone.utc).isoformat(),
        "status": "active",
        "requestsRouted": 0
    }

    EXTERNAL_NODES[nodeId] = external_node
    _event_log(f"[{datetime.now().isoformat()}] External Mesh node registered: {nodeId} -> {meshUrl}")

    return {
        "success": True,
        "message": f"External node {nodeId} registered",
        "node": external_node
    }


@app.get("/api/external-nodes")
async def get_external_nodes():
    """Get all registered external Mesh nodes"""
    global REQUEST_COUNT
    REQUEST_COUNT += 1

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "totalExternalNodes": len(EXTERNAL_NODES),
        "externalNodes": list(EXTERNAL_NODES.values())
    }


@app.post("/api/route-to-external")
async def route_to_external(nodeId: str, request_data: Dict):
    """Route load to external Mesh node"""
    global REQUEST_COUNT
    REQUEST_COUNT += 1

    if nodeId not in EXTERNAL_NODES:
        raise HTTPException(status_code=404, detail=f"External node {nodeId} not found")

    external_node = EXTERNAL_NODES[nodeId]
    external_node["requestsRouted"] += 1

    try:
        response = requests.post(
            f"{external_node['meshUrl']}/process",
            json=request_data,
            timeout=10
        )
        return {
            "success": True,
            "routedTo": nodeId,
            "meshUrl": external_node['meshUrl'],
            "region": external_node['region'],
            "response": response.json() if response.ok else response.text
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "routedTo": nodeId
        }


@app.post("/api/offline-nodes/register")
async def register_offline_node(nodeId: str):
    """Register offline node for load distribution"""
    global REQUEST_COUNT
    REQUEST_COUNT += 1

    if nodeId not in OFFLINE_NODES:
        OFFLINE_NODES.append(nodeId)
        _event_log(f"[{datetime.now().isoformat()}] Offline node registered: {nodeId}")

    return {
        "success": True,
        "message": f"Offline node {nodeId} registered",
        "offlineNodes": OFFLINE_NODES
    }


@app.get("/api/offline-nodes")
async def get_offline_nodes():
    """Get all offline nodes available for load distribution"""
    global REQUEST_COUNT
    REQUEST_COUNT += 1

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "totalOfflineNodes": len(OFFLINE_NODES),
        "offlineNodes": OFFLINE_NODES
    }


@app.post("/api/route-to-offline")
async def route_to_offline(nodeId: str, request_data: Dict):
    """Queue work for offline node (stores for later processing)"""
    global REQUEST_COUNT
    REQUEST_COUNT += 1

    if nodeId not in OFFLINE_NODES:
        raise HTTPException(status_code=404, detail=f"Offline node {nodeId} not found")

    # Store for offline processing
    queue_key = f"offline_{nodeId}_{datetime.now().timestamp()}"

    return {
        "success": True,
        "message": f"Work queued for offline node {nodeId}",
        "queueKey": queue_key,
        "nodeId": nodeId,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.get("/api/mesh-status")
async def get_mesh_status():
    """Get overall Mesh and load distribution status"""
    global REQUEST_COUNT
    REQUEST_COUNT += 1

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "localNodes": len(NODE_REGISTRY),
        "externalMeshNodes": len(EXTERNAL_NODES),
        "offlineNodes": len(OFFLINE_NODES),
        "totalRequests": REQUEST_COUNT,
        "meshHQ": MESH_HQ_URL,
        "status": "operational"
    }


@app.get("/api/hierarchy/123")
async def get_hierarchy_123():
    """Operational 1-2-3 hierarchy snapshot: ingress -> pulse -> mesh federation."""
    global REQUEST_COUNT
    REQUEST_COUNT += 1

    now_iso = datetime.now(timezone.utc).isoformat()

    pulse_metrics = _safe_get_json(f"{PULSE_SERVICE_URL}/pulse/metrics")
    pulse_dead = _safe_get_json(f"{PULSE_SERVICE_URL}/pulse/dead-nodes")
    mesh_nodes = _safe_get_json(f"{MESH_HQ_URL}/mesh/nodes")
    kloud_status = _safe_get_json(KLOUD_STATUS_URL) if KLOUD_STATUS_URL else None
    riscv = _riscv_status()
    gov_labor = _governance_labor_status()

    local_active = sum(1 for n in NODE_REGISTRY.values() if n.get("status") == "active")
    vendor_active = sum(1 for n in VENDOR_NODES.values() if n.get("status") == "active")

    dead_count = int((pulse_metrics or {}).get("deadCount") or (pulse_dead or {}).get("deadNodeCount") or 0)
    alive_count = int((pulse_metrics or {}).get("aliveCount") or 0)
    mesh_node_count = len(mesh_nodes) if isinstance(mesh_nodes, list) else 0

    tide_value = None
    if isinstance(kloud_status, dict):
        tide_value = kloud_status.get("tide") or kloud_status.get("tide_level")

    # "batica/zbatica" maps to tide-aware fanout pressure from Kloud runtime.
    tide_mode = str(tide_value).lower() if tide_value is not None else "unknown"
    batica_zbatica = {
        "mode": tide_mode,
        "fanout_profile": (
            "high" if tide_mode == "high" else
            "normal" if tide_mode == "normal" else
            "low" if tide_mode == "low" else
            None
        )
    }

    return {
        "timestamp": now_iso,
        "model": "balancer-mesh-1-2-3",
        "nodes": {
            "node_1_ingress": {
                "purpose": "registration-discovery-ingress",
                "local_registered": len(NODE_REGISTRY),
                "local_active": local_active,
                "vendor_registered": len(VENDOR_NODES),
                "vendor_active": vendor_active,
                "nodesms_vendor_nodes": _nodesms_vendor_count()
            },
            "node_2_pulse": {
                "purpose": "heartbeat-liveness-arbitration",
                "alive": alive_count,
                "dead": dead_count,
                "pulse_source_available": pulse_metrics is not None or pulse_dead is not None
            },
            "node_3_mesh": {
                "purpose": "mesh-federation-routing",
                "external_mesh_nodes": len(EXTERNAL_NODES),
                "offline_nodes": len(OFFLINE_NODES),
                "mesh_hq_nodes": mesh_node_count,
                "mesh_hq_source_available": isinstance(mesh_nodes, list)
            }
        },
        "flow_control": {
            "batica_zbatica": batica_zbatica,
            "kloud_status_source_available": kloud_status is not None
        },
        "riscv": riscv,
        "governance_labor": gov_labor,
        "upstream": {
            "pulse_url": PULSE_SERVICE_URL,
            "mesh_hq_url": MESH_HQ_URL,
            "kloud_status_url": KLOUD_STATUS_URL or None
        }
    }


@app.get("/health")
async def health():
    """Health check"""
    global REQUEST_COUNT
    REQUEST_COUNT += 1

    return {
        "status": "healthy",
        "service": "balancer-nodes-3334",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime_since": SERVICE_START,
        "requests_served": REQUEST_COUNT,
        "activeNodes": len(NODE_REGISTRY),
        "externalNodes": len(EXTERNAL_NODES),
        "offlineNodes": len(OFFLINE_NODES)
    }


@app.get("/info")
async def info():
    """Service information"""
    global REQUEST_COUNT
    REQUEST_COUNT += 1

    return {
        "service": "Balancer Nodes (Python) - External Mesh Routing",
        "port": 3334,
        "type": "node-discovery-external",
        "version": "2.1.0",
        "started_at": SERVICE_START,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "endpoints": {
            "POST /api/nodes/register": "Register local node",
            "POST /api/nodes/heartbeat": "Update local node heartbeat",
            "GET /api/nodes": "List local nodes",
            "POST /api/external-nodes/register": "Register external Mesh node",
            "GET /api/external-nodes": "List external Mesh nodes",
            "POST /api/route-to-external": "Route load to external Mesh node",
            "POST /api/offline-nodes/register": "Register offline node",
            "GET /api/offline-nodes": "List offline nodes",
            "POST /api/route-to-offline": "Queue work for offline node",
            "POST /api/vendor-nodes/register": "Register user vendor node (edge)",
            "GET /api/vendor-nodes": "List vendor nodes",
            "POST /api/vendor-nodes/heartbeat": "Vendor node heartbeat",
            "POST /api/vendor-nodes/complete": "Report task completion",
            "GET /api/hierarchy/123": "1-2-3 balancer-mesh hierarchy snapshot",
            "GET /api/mesh-status": "Get Mesh & load status",
            "GET /health": "Health check",
            "GET /info": "Service info"
        }
    }

# ============== VENDOR NODES (Edge Computing) ==============
VENDOR_NODES: Dict[str, Dict[str, Any]] = {}

@app.post("/api/vendor-nodes/register")
async def register_vendor_node(nodeId: str, type: str = "vendor",
                               capabilities: Optional[Dict] = None,
                               metadata: Optional[Dict] = None):
    """Register a user's device as vendor node for edge computing"""
    global REQUEST_COUNT
    REQUEST_COUNT += 1

    if not nodeId:
        raise HTTPException(status_code=400, detail="nodeId required")

    vendor_data = {
        "nodeId": nodeId,
        "type": type,
        "capabilities": capabilities or {},
        "metadata": metadata or {},
        "status": "active",
        "registeredAt": datetime.now(timezone.utc).isoformat(),
        "lastHeartbeat": datetime.now(timezone.utc).isoformat(),
        "tasksCompleted": 0,
        "loadFactor": 0.0
    }

    VENDOR_NODES[nodeId] = vendor_data
    _event_log(f"[{datetime.now().isoformat()}] Vendor node registered: {nodeId}")

    return {
        "success": True,
        "message": f"Vendor node {nodeId} registered for edge computing",
        "node": vendor_data
    }

@app.get("/api/vendor-nodes")
async def get_vendor_nodes():
    """Get all registered vendor nodes"""
    global REQUEST_COUNT
    REQUEST_COUNT += 1

    active_nodes = [n for n in VENDOR_NODES.values() if n["status"] == "active"]

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "totalVendorNodes": len(VENDOR_NODES),
        "activeVendorNodes": len(active_nodes),
        "vendorNodes": list(VENDOR_NODES.values())
    }

@app.post("/api/vendor-nodes/heartbeat")
async def vendor_heartbeat(nodeId: str, stats: Optional[Dict] = None, load: Optional[Dict] = None):
    """Update vendor node heartbeat"""
    global REQUEST_COUNT
    REQUEST_COUNT += 1

    if nodeId not in VENDOR_NODES:
        raise HTTPException(status_code=404, detail=f"Vendor node {nodeId} not found")

    VENDOR_NODES[nodeId]["lastHeartbeat"] = datetime.now(timezone.utc).isoformat()
    VENDOR_NODES[nodeId]["status"] = "active"
    if stats:
        VENDOR_NODES[nodeId]["stats"] = stats
    if load:
        VENDOR_NODES[nodeId]["loadFactor"] = load.get("cpu", 0)

    return {"success": True, "nodeId": nodeId}

@app.post("/api/vendor-nodes/complete")
async def vendor_complete(nodeId: str, taskId: str, result: Optional[Dict] = None):
    """Report task completion from vendor node"""
    global REQUEST_COUNT
    REQUEST_COUNT += 1

    if nodeId in VENDOR_NODES:
        VENDOR_NODES[nodeId]["tasksCompleted"] = VENDOR_NODES[nodeId].get("tasksCompleted", 0) + 1

    _event_log(f"[{datetime.now().isoformat()}] Vendor {nodeId} completed task {taskId}")

    return {"success": True, "nodeId": nodeId, "taskId": taskId}

@app.get("/api/vendor-nodes/best")
async def get_best_vendor_node():
    """Get the best available vendor node for task distribution"""
    global REQUEST_COUNT
    REQUEST_COUNT += 1

    # Find active nodes with lowest load
    active_nodes = [n for n in VENDOR_NODES.values() if n["status"] == "active"]

    if not active_nodes:
        return {"available": False, "message": "No vendor nodes available"}

    # Sort by load factor (lowest first)
    best = sorted(active_nodes, key=lambda x: x.get("loadFactor", 1.0))[0]

    return {
        "available": True,
        "node": best
    }


if __name__ == "__main__":
    port = int(os.getenv("BALANCER_NODES_PORT", "3334"))
    host = os.getenv("BALANCER_NODES_HOST", "0.0.0.0")
    log_level = os.getenv("BALANCER_NODES_LOG_LEVEL", "warning").strip().lower() or "warning"
    access_log = _env_bool("BALANCER_NODES_ACCESS_LOG", False)

    print(f"\n{'='*60}")
    print("  BALANCER NODES SERVICE (Python)")
    print(f"  Listening on {host}:{port}")
    print("  Node discovery & load distribution")
    print("  + Vendor Nodes (Edge Computing)")
    print(f"{'='*60}\n")

    uvicorn.run(app, host=host, port=port, log_level=log_level, access_log=access_log)
