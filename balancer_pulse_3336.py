#!/usr/bin/env python3
"""
BALANCER PULSE SERVICE (Port 3336)
Heartbeat and node liveness detection
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Initialize FastAPI
app = FastAPI(
    title="Balancer Pulse",
    description="Heartbeat monitoring and node liveness detection",
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

# Heartbeat registry
HEARTBEATS: Dict[str, Dict[str, Any]] = {}
DEAD_NODES: List[str] = []
PULSES_RECEIVED = 0
SERVICE_START = datetime.now(timezone.utc).isoformat()
HEARTBEAT_TIMEOUT = 30  # seconds


def sync_dead_nodes(now: Optional[datetime] = None) -> List[str]:
    """Keep DEAD_NODES aligned with current heartbeat state."""
    current_time = now or datetime.now(timezone.utc)
    stale_nodes: List[str] = []

    for node_id, node in HEARTBEATS.items():
        last_pulse = datetime.fromisoformat(node["lastPulse"])
        seconds_since = (current_time - last_pulse).total_seconds()
        is_alive = seconds_since < HEARTBEAT_TIMEOUT
        node["alive"] = is_alive

        if is_alive:
            node["downtime"] = 0
        else:
            node["downtime"] = round(seconds_since)
            stale_nodes.append(node_id)

    DEAD_NODES[:] = stale_nodes
    return stale_nodes


@app.post("/pulse/heartbeat")
async def receive_heartbeat(nodeId: str, status: Optional[str] = None, metrics: Optional[Dict] = None):
    """Receive heartbeat from node"""
    global PULSES_RECEIVED

    if not nodeId:
        raise HTTPException(status_code=400, detail="nodeId required")

    timestamp = datetime.now(timezone.utc)

    # Check if node was previously dead
    if nodeId in DEAD_NODES:
        DEAD_NODES.remove(nodeId)
        print(f"[{timestamp.isoformat()}] Node {nodeId} is ALIVE again")

    HEARTBEATS[nodeId] = {
        "nodeId": nodeId,
        "lastPulse": timestamp.isoformat(),
        "status": status or "active",
        "metrics": metrics or {},
        "pulseCount": (HEARTBEATS.get(nodeId, {}).get("pulseCount", 0) + 1),
        "alive": True,
        "downtime": 0
    }

    PULSES_RECEIVED += 1
    sync_dead_nodes(timestamp)

    return {
        "success": True,
        "message": f"Heartbeat received from {nodeId}",
        "timestamp": timestamp.isoformat(),
        "pulseCount": HEARTBEATS[nodeId]["pulseCount"]
    }


@app.get("/pulse/status/{nodeId}")
async def get_node_pulse_status(nodeId: str):
    """Get pulse status of a node"""
    if nodeId not in HEARTBEATS:
        return {
            "nodeId": nodeId,
            "status": "unknown",
            "alive": False,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    sync_dead_nodes()
    node = HEARTBEATS[nodeId]
    last_pulse = datetime.fromisoformat(node["lastPulse"])
    time_since_pulse = datetime.now(timezone.utc) - last_pulse

    is_alive = time_since_pulse.total_seconds() < HEARTBEAT_TIMEOUT
    node["alive"] = is_alive

    return {
        "nodeId": nodeId,
        "status": node["status"],
        "alive": is_alive,
        "lastPulse": node["lastPulse"],
        "timeSincePulse": round(time_since_pulse.total_seconds()),
        "pulseCount": node["pulseCount"],
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.get("/pulse/nodes")
async def get_all_pulse_status():
    """Get pulse status of all nodes"""
    now = datetime.now(timezone.utc)
    nodes = []

    stale_nodes = sync_dead_nodes(now)

    for nodeId, node in HEARTBEATS.items():
        last_pulse = datetime.fromisoformat(node["lastPulse"])
        time_since_pulse = now - last_pulse
        is_alive = time_since_pulse.total_seconds() < HEARTBEAT_TIMEOUT
        node["alive"] = is_alive

        nodes.append({
            "nodeId": nodeId,
            "status": node["status"],
            "alive": is_alive,
            "timeSincePulse": round(time_since_pulse.total_seconds()),
            "pulseCount": node["pulseCount"]
        })

    alive_count = sum(1 for n in nodes if n["alive"])

    return {
        "timestamp": now.isoformat(),
        "totalNodes": len(nodes),
        "aliveNodes": alive_count,
        "deadNodes": len(stale_nodes),
        "nodes": nodes
    }


@app.get("/pulse/dead-nodes")
async def get_dead_nodes():
    """Get list of dead/unresponsive nodes"""
    now = datetime.now(timezone.utc)
    dead = []

    stale_nodes = set(sync_dead_nodes(now))

    for nodeId, node in HEARTBEATS.items():
        last_pulse = datetime.fromisoformat(node["lastPulse"])
        time_since_pulse = now - last_pulse
        if nodeId in stale_nodes:
            dead.append({
                "nodeId": nodeId,
                "lastPulse": node["lastPulse"],
                "timeSincePulse": round(time_since_pulse.total_seconds()),
                "status": "dead"
            })

    return {
        "timestamp": now.isoformat(),
        "deadNodeCount": len(dead),
        "deadNodes": dead
    }


@app.post("/pulse/resuscitate/{nodeId}")
async def resuscitate_node(nodeId: str):
    """Manually resuscitate a dead node"""
    if nodeId not in HEARTBEATS:
        raise HTTPException(status_code=404, detail=f"Node {nodeId} not found")

    node = HEARTBEATS[nodeId]
    node["lastPulse"] = datetime.now(timezone.utc).isoformat()
    node["alive"] = True

    if nodeId in DEAD_NODES:
        DEAD_NODES.remove(nodeId)

    return {
        "success": True,
        "message": f"Node {nodeId} resuscitated",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.get("/pulse/config")
async def get_pulse_config():
    """Get pulse configuration"""
    return {
        "heartbeat_timeout_seconds": HEARTBEAT_TIMEOUT,
        "max_dead_nodes_tracked": 1000,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.post("/pulse/config")
async def update_pulse_config(timeout: Optional[int] = None):
    """Update pulse configuration"""
    global HEARTBEAT_TIMEOUT

    if timeout is not None:
        if timeout < 1:
            raise HTTPException(status_code=422, detail="timeout must be >= 1 second")
        HEARTBEAT_TIMEOUT = timeout

    sync_dead_nodes()

    return {
        "success": True,
        "message": "Configuration updated",
        "heartbeat_timeout_seconds": HEARTBEAT_TIMEOUT,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.get("/pulse/metrics")
async def get_pulse_metrics():
    """Get pulse metrics"""
    now = datetime.now(timezone.utc)
    sync_dead_nodes(now)
    alive = sum(1 for node in HEARTBEATS.values() if node.get("alive"))

    return {
        "timestamp": now.isoformat(),
        "totalPulsesReceived": PULSES_RECEIVED,
        "nodeCount": len(HEARTBEATS),
        "aliveCount": alive,
        "deadCount": len(DEAD_NODES),
        "avgHeartbeatRate": round(PULSES_RECEIVED / max(1, len(HEARTBEATS))) if HEARTBEATS else 0
    }


@app.post("/pulse/reset/{nodeId}")
async def reset_node_pulse(nodeId: str):
    """Reset pulse counter for node"""
    if nodeId not in HEARTBEATS:
        raise HTTPException(status_code=404, detail=f"Node {nodeId} not found")

    HEARTBEATS[nodeId]["pulseCount"] = 0
    sync_dead_nodes()

    return {
        "success": True,
        "message": f"Pulse counter reset for {nodeId}",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.get("/health")
async def health():
    """Health check"""
    now = datetime.now(timezone.utc)
    sync_dead_nodes(now)
    alive = sum(1 for node in HEARTBEATS.values() if node.get("alive"))

    return {
        "status": "healthy",
        "service": "balancer-pulse-3336",
        "timestamp": now.isoformat(),
        "monitoredNodes": len(HEARTBEATS),
        "aliveNodes": alive,
        "totalPulses": PULSES_RECEIVED
    }


@app.get("/info")
async def info():
    """Service information"""
    return {
        "service": "Balancer Pulse (Python)",
        "port": 3336,
        "type": "heartbeat-monitor",
        "version": "1.0.0",
        "started_at": SERVICE_START,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "endpoints": {
            "POST /pulse/heartbeat": "Receive heartbeat from node",
            "GET /pulse/status/:nodeId": "Get node pulse status",
            "GET /pulse/nodes": "Get all nodes pulse status",
            "GET /pulse/dead-nodes": "Get dead/unresponsive nodes",
            "POST /pulse/resuscitate/:nodeId": "Resuscitate dead node",
            "GET /pulse/config": "Get pulse configuration",
            "POST /pulse/config": "Update pulse configuration",
            "GET /pulse/metrics": "Get pulse metrics",
            "POST /pulse/reset/:nodeId": "Reset node pulse counter",
            "GET /health": "Health check",
            "GET /info": "Service info"
        }
    }


if __name__ == "__main__":
    port = int(os.getenv("BALANCER_PULSE_PORT", "3336"))
    host = os.getenv("BALANCER_PULSE_HOST", "0.0.0.0")

    print(f"\n{'='*60}")
    print(f"  BALANCER PULSE SERVICE (Python)")
    print(f"  Listening on {host}:{port}")
    print(f"  Heartbeat monitoring & node liveness detection")
    print(f"{'='*60}\n")

    uvicorn.run(app, host=host, port=port, log_level="info")
