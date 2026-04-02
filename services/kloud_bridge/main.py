from __future__ import annotations

import base64
import json
import os
import time
import uuid
from typing import Any, Dict, List, Optional

import httpx
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

SERVICE_NAME = "kloud-bridge"
SERVICE_VERSION = "0.2.0"
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
LIVE_ONLY_MODE = True
INSTANCE_ID = os.getenv("INSTANCE_ID", str(uuid.uuid4())[:8])
START_TIME = time.time()
_LAST_LIVE_UPSTREAM_URL = ""

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


@app.get("/")
def root() -> Dict[str, Any]:
    return {
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
        "instance": INSTANCE_ID,
        "isolated": KLOUD_ISOLATED_MODE,
        "live_only": LIVE_ONLY_MODE,
        "purpose": "Bridge Clisonix services to the external sovereign Kloud runtime.",
        "policy": "No simulated data or local-accept fallbacks are returned in production live-only mode.",
        "endpoints": {
            "GET /health": "Liveness and configuration probe",
            "GET /status": "Bridge + upstream + Ocean Core visibility",
            "GET /ocean/status": "Fetch live Ocean Core status through the bridge",
            "GET /admin/diagnostics": "Protected operator diagnostics with candidate upstream visibility",
            "POST /signals/publish": "Forward a real Clisonix signal into Kloud /submit",
            "POST /fabric/sync": "Fetch live remote Kloud state, peers, and status",
            "POST /ocean/signals/publish": "Forward a Kloud-origin signal into Ocean Core routing",
        },
    }


@app.get("/health")
def health() -> Dict[str, Any]:
    upstream_target = _current_upstream_target()
    upstream_configured = bool(upstream_target)
    return {
        "status": "ok" if upstream_configured else "degraded",
        "service": SERVICE_NAME,
        "port": PORT,
        "isolated": KLOUD_ISOLATED_MODE,
        "live_only": LIVE_ONLY_MODE,
        "upstream_configured": upstream_configured,
        "upstream_target": upstream_target,
        "ocean_configured": bool(OCEAN_CORE_URL),
        "admin_diagnostics": bool(KLOUD_BRIDGE_ADMIN_TOKEN),
        "uptime_seconds": round(time.time() - START_TIME, 2),
    }


@app.get("/status")
async def status() -> Dict[str, Any]:
    upstream = await _probe_upstream()
    ocean = await _probe_ocean()
    availability = "connected" if upstream.get("reachable") else ("limited" if upstream.get("configured") else "setup-required")
    return {
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
        "instance": INSTANCE_ID,
        "isolated": KLOUD_ISOLATED_MODE,
        "live_only": LIVE_ONLY_MODE,
        "port": PORT,
        "availability": availability,
        "upstream": upstream,
        "ocean_core": ocean,
    }


@app.get("/ocean/status")
async def ocean_status() -> Dict[str, Any]:
    return await _probe_ocean()


@app.get("/admin/diagnostics")
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
        "upstream": upstream,
        "ocean_core": ocean,
    }


@app.post("/ocean/signals/publish")
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
    }
    route = request.route or KLOUD_SIGNAL_PATH
    url = f"{upstream_url}{route}"

    try:
        async with httpx.AsyncClient(timeout=KLOUD_TIMEOUT_SECONDS) as client:
            response = await client.post(url, json=submit_payload)
            response.raise_for_status()
            body = _safe_json(response)
        return {
            "status": "forwarded",
            "forwarded": True,
            "isolated": KLOUD_ISOLATED_MODE,
            "live_only": LIVE_ONLY_MODE,
            "route": route,
            "upstream_url": url,
            "source": request.source,
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
async def fabric_sync(request: FabricSyncRequest) -> Dict[str, Any]:
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

    response: Dict[str, Any] = {
        "status": "synchronized" if not errors else "partial",
        "isolated": KLOUD_ISOLATED_MODE,
        "live_only": LIVE_ONLY_MODE,
        "upstream_url": upstream_url,
        "snapshot": collected,
    }
    if errors:
        response["errors"] = errors
    return response


async def _probe_upstream() -> Dict[str, Any]:
    global _LAST_LIVE_UPSTREAM_URL

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
            return {
                "configured": True,
                "reachable": True,
                "url": candidate,
                "auto_discovered": candidate != KLOUD_UPSTREAM_URL,
                "candidates_checked": checked,
                "status": data,
            }
        except Exception as exc:
            last_error = str(exc)

    return {
        "configured": True,
        "reachable": False,
        "url": KLOUD_UPSTREAM_URL or candidates[0],
        "candidates_checked": checked,
        "error": last_error,
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
