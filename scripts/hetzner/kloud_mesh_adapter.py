#!/usr/bin/env python3
"""Dynamic mesh adapter for Kloud Bridge.

Scalable behavior:
- Discovers all registered mesh nodes from real mesh status endpoint
- Uses coordinator as source and relays signals to every peer node
- Refreshes liveness with pulse + bi-directional ping + bi-directional dispatch
- Applies per-run peer limits to keep runtime bounded as cluster grows
"""

from __future__ import annotations

import json
import os
import random
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

BASE_URL = os.getenv("KLOUD_BASE_URL", "http://127.0.0.1:8889").rstrip("/")
API_PREFIX = os.getenv("KLOUD_API_PREFIX", "/api/v1/hardware")
REQUEST_TIMEOUT_SEC = float(os.getenv("KLOUD_ADAPTER_TIMEOUT_SEC", "5"))
ALERT_THRESHOLD = int(os.getenv("KLOUD_ADAPTER_ALERT_THRESHOLD", "3"))
MAX_PEERS_PER_RUN = int(os.getenv("KLOUD_ADAPTER_MAX_PEERS_PER_RUN", "16"))
MIN_COOLDOWN_SEC = int(os.getenv("KLOUD_ADAPTER_MIN_COOLDOWN_SEC", "60"))
MAX_COOLDOWN_SEC = int(os.getenv("KLOUD_ADAPTER_MAX_COOLDOWN_SEC", "900"))
STATE_FILE = Path(os.getenv("KLOUD_ADAPTER_STATE_FILE", "/var/lib/kloud-mesh-adapter/state.json"))
LOG_FILE = Path(os.getenv("KLOUD_ADAPTER_LOG_FILE", "/var/log/kloud-mesh-adapter.log"))
LOCK_FILE = Path(os.getenv("KLOUD_ADAPTER_LOCK_FILE", "/var/run/kloud-mesh-adapter.lock"))
NODE_TOKEN = os.getenv("KLOUD_NODE_TOKEN", "").strip()

MESH_STATUS_URL = f"{BASE_URL}{API_PREFIX}/mesh/status"
PULSE_URL = f"{BASE_URL}{API_PREFIX}/nodes/pulse"
PING_URL = f"{BASE_URL}{API_PREFIX}/mesh/ping"
DISPATCH_URL = f"{BASE_URL}{API_PREFIX}/hierarchy/dispatch"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_parent_dirs() -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    LOCK_FILE.parent.mkdir(parents=True, exist_ok=True)


def headers() -> dict[str, str]:
    out = {"Content-Type": "application/json"}
    if NODE_TOKEN:
        out["x-node-token"] = NODE_TOKEN
    return out


def write_log(record: dict[str, Any]) -> None:
    with LOG_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=True) + "\n")


def load_state() -> dict[str, Any]:
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {
            "consecutive_failures": 0,
            "last_error": None,
            "last_success_at": None,
            "next_allowed_at": None,
        }


def save_state(state: dict[str, Any]) -> None:
    STATE_FILE.write_text(json.dumps(state, ensure_ascii=True), encoding="utf-8")


def calculate_backoff_sec(consecutive_failures: int) -> int:
    exp = max(0, min(consecutive_failures, 10))
    raw = MIN_COOLDOWN_SEC * (2**exp)
    capped = min(MAX_COOLDOWN_SEC, raw)
    jitter = random.uniform(0.8, 1.2)
    return max(MIN_COOLDOWN_SEC, int(capped * jitter))


def parse_iso_utc(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        text = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(text)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except Exception:
        return None


def request_json(method: str, url: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    data = None
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=True).encode("utf-8")
    req = urllib.request.Request(url=url, method=method, data=data, headers=headers())
    with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SEC) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw) if raw else {}


def discover_topology(mesh: dict[str, Any]) -> tuple[str, list[str]]:
    nodes = mesh.get("nodes") or []
    node_ids = [str(n.get("node_id") or "").strip() for n in nodes]
    node_ids = [n for n in node_ids if n]
    if len(node_ids) < 2:
        raise RuntimeError("Need at least 2 registered nodes for mesh relay")

    summary = mesh.get("summary") or {}
    coordinator = str(summary.get("coordinator_node_id") or "").strip()
    if not coordinator:
        coordinator = node_ids[0]

    peers = [n for n in node_ids if n != coordinator]

    # Prioritize stale/offline first, then healthy peers.
    stale_or_offline = []
    healthy = []
    state_by_id = {str(n.get("node_id")): str(n.get("runtime_state") or "") for n in nodes}
    for peer in peers:
        if state_by_id.get(peer) in {"stale", "offline", "registered"}:
            stale_or_offline.append(peer)
        else:
            healthy.append(peer)

    ordered_peers = stale_or_offline + healthy
    if MAX_PEERS_PER_RUN > 0:
        ordered_peers = ordered_peers[:MAX_PEERS_PER_RUN]

    if not ordered_peers:
        raise RuntimeError("No peer nodes available for relay")

    return coordinator, ordered_peers


def relay_for_peer(source: str, target: str) -> None:
    request_json("POST", PULSE_URL, {"node_id": target})

    request_json(
        "POST",
        PING_URL,
        {
            "source_node_id": source,
            "target_node_id": target,
            "signal": "nanogrid-bridge",
            "ttl_ms": 900,
            "payload": {"bridge": "adapter", "direction": "source_to_target"},
        },
    )
    request_json(
        "POST",
        PING_URL,
        {
            "source_node_id": target,
            "target_node_id": source,
            "signal": "nanogrid-bridge",
            "ttl_ms": 900,
            "payload": {"bridge": "adapter", "direction": "target_to_source"},
        },
    )

    request_json(
        "POST",
        DISPATCH_URL,
        {
            "source_node_id": source,
            "target_node_id": target,
            "message": "task:nanogrid-sync-pipe",
            "direction": "targeted",
            "hop": 1,
            "pause_ms": 0,
            "payload": {"sync": "signal-transfer", "adapter": "mesh", "mode": "realtime"},
        },
    )
    request_json(
        "POST",
        DISPATCH_URL,
        {
            "source_node_id": target,
            "target_node_id": source,
            "message": "task:nanogrid-sync-pipe",
            "direction": "targeted",
            "hop": 1,
            "pause_ms": 0,
            "payload": {"sync": "signal-transfer", "adapter": "mesh", "mode": "realtime"},
        },
    )


def run_once() -> dict[str, Any]:
    mesh = request_json("GET", MESH_STATUS_URL)
    source, peers = discover_topology(mesh)

    errors: list[dict[str, str]] = []
    relayed = 0
    for target in peers:
        try:
            relay_for_peer(source, target)
            relayed += 1
        except urllib.error.HTTPError as ex:
            errors.append({"peer": target, "error": f"http:{ex.code}"})
        except Exception as ex:  # noqa: BLE001 - explicit per-peer isolation
            errors.append({"peer": target, "error": str(ex)})

    summary = (request_json("GET", MESH_STATUS_URL).get("summary") or {})
    return {
        "source_node_id": source,
        "peer_count_total": len(peers),
        "peer_count_relayed": relayed,
        "peer_errors": errors,
        "network_health": summary.get("network_health"),
        "online_nodes": summary.get("online_nodes"),
        "offline_nodes": summary.get("offline_nodes"),
        "stale_nodes": summary.get("stale_nodes"),
    }


def main() -> int:
    ensure_parent_dirs()
    state = load_state()

    next_allowed = parse_iso_utc(state.get("next_allowed_at"))
    now = datetime.now(timezone.utc)
    if next_allowed and now < next_allowed:
        wait_seconds = int((next_allowed - now).total_seconds())
        write_log(
            {
                "ts": now_iso(),
                "level": "warning",
                "event": "adapter.cooldown",
                "wait_seconds": wait_seconds,
                "consecutive_failures": int(state.get("consecutive_failures", 0)),
            }
        )
        return 0

    try:
        result = run_once()

        if int(result.get("peer_count_relayed", 0)) <= 0:
            raise RuntimeError("No peer relay succeeded")

        state["consecutive_failures"] = 0
        state["last_error"] = None
        state["last_success_at"] = now_iso()
        state["next_allowed_at"] = None
        save_state(state)
        write_log({"ts": now_iso(), "level": "info", "event": "adapter.success", **result})
        return 0
    except Exception as ex:  # noqa: BLE001 - service must never crash silently
        state["consecutive_failures"] = int(state.get("consecutive_failures", 0)) + 1
        state["last_error"] = str(ex)
        wait_sec = calculate_backoff_sec(int(state["consecutive_failures"]))
        state["next_allowed_at"] = (datetime.now(timezone.utc) + timedelta(seconds=wait_sec)).isoformat()
        save_state(state)

        write_log(
            {
                "ts": now_iso(),
                "level": "error",
                "event": "adapter.failure",
                "consecutive_failures": state["consecutive_failures"],
                "error": str(ex),
                "cooldown_seconds": wait_sec,
            }
        )

        if int(state["consecutive_failures"]) >= ALERT_THRESHOLD:
            safe_error = str(ex).replace("'", "")
            subprocess.run(
                [
                    "logger",
                    "-p",
                    "daemon.err",
                    (
                        "kloud-mesh-adapter alert: "
                        f"{state['consecutive_failures']} consecutive failures; error={safe_error}"
                    ),
                ],
                check=False,
            )
        return 1


if __name__ == "__main__":
    sys.exit(main())
