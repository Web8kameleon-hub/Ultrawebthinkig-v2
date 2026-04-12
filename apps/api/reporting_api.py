"""
ULTRA REPORTING API ENDPOINTS
Automat raportet: Excel + PowerPoint + Dashboards në kërkesë
"""

import json
import logging
import os
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib import error as urllib_error
from urllib import request as urllib_request

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Request
from fastapi.responses import JSONResponse, PlainTextResponse, Response
from pydantic import BaseModel

try:
    import cbor2  # type: ignore
except ImportError:  # pragma: no cover - runtime safety
    cbor2 = None  # type: ignore[assignment]

try:
    import msgpack  # type: ignore
except ImportError:  # pragma: no cover - runtime safety
    msgpack = None  # type: ignore[assignment]

# Add current directory to Python path
sys.path.insert(0, os.path.dirname(__file__))

# Import the ultra reporting module
# Import error tracker
from error_tracker import error_tracker
from ultra_reporting import (
    MetricsSnapshot,
    UltraExcelExporter,
    UltraPowerPointGenerator,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/reporting", tags=["reporting"])

# Ensure reports directory exists
REPORTS_DIR = Path("./reports")
REPORTS_DIR.mkdir(exist_ok=True)


def _display_metric(value: Any, suffix: str = "") -> str:
    if value is None or value == "":
        return "Unavailable"
    if isinstance(value, float):
        return f"{round(value, 2)}{suffix}"
    return f"{value}{suffix}"


class ExportRequest(BaseModel):
    """Request body për Excel/PowerPoint export"""
    title: str = "Clisonix Cloud Metrics Report"
    format: str = "xlsx"  # xlsx, pptx, both
    include_sla: bool = True
    include_alerts: bool = True
    date_range_hours: int = 24


class ReportMetadata(BaseModel):
    """Metadata për raportin e gjeneruar"""
    id: str
    title: str
    format: str
    generated_at: str
    file_path: str
    size_bytes: int


class DashboardMetrics(BaseModel):
    """Unified dashboard metrics"""
    api_uptime_percent: Optional[float] = None
    api_requests_per_second: Optional[int] = None
    api_requests_24h: Optional[int] = None
    api_errors_24h: Optional[int] = None
    api_error_rate_percent: Optional[float] = None
    avg_response_time_ms: Optional[float] = None
    api_latency_p95_ms: Optional[float] = None
    api_latency_p99_ms: Optional[float] = None
    ai_agent_calls_24h: Optional[int] = None
    ai_agent_success_rate: Optional[float] = None
    documents_generated_24h: Optional[int] = None
    cache_hit_rate_percent: Optional[float] = None
    cache_status: Optional[str] = None
    cache_memory_used_mb: Optional[float] = None
    db_status: Optional[str] = None
    db_connections: Optional[int] = None
    db_query_avg_ms: Optional[float] = None
    system_cpu_percent: Optional[float] = None
    system_memory_percent: Optional[float] = None
    system_disk_percent: Optional[float] = None
    system_uptime_seconds: Optional[float] = None
    running_containers: Optional[int] = None
    total_containers: Optional[int] = None
    active_alerts: List[Dict[str, Any]]
    sla_status: str
    data_sources: Dict[str, Any] = {}


def _normalize_base_url(value: Optional[str]) -> Optional[str]:
    return value.rstrip("/") if value else None


MAIN_API_CANDIDATES = [
    candidate
    for candidate in dict.fromkeys(
        filter(
            None,
            [
                _normalize_base_url(os.getenv("API_INTERNAL_URL")),
                _normalize_base_url(os.getenv("MAIN_API_URL")),
                "http://clisonix-api:8000",
                "http://127.0.0.1:8000",
                "http://localhost:8000",
            ],
        )
    )
]


def _fetch_json_from_candidates(path: str, timeout_seconds: float = 5.0) -> Tuple[Optional[Dict[str, Any]], Optional[str], Optional[str]]:
    last_error: Optional[str] = None

    for base_url in MAIN_API_CANDIDATES:
        target = f"{base_url}{path}"
        try:
            with urllib_request.urlopen(target, timeout=timeout_seconds) as response:
                payload = json.loads(response.read().decode("utf-8"))
                if isinstance(payload, dict):
                    return payload, target, None
                last_error = f"{target} returned non-object payload"
        except (urllib_error.URLError, urllib_error.HTTPError, TimeoutError, json.JSONDecodeError) as exc:
            last_error = f"{target}: {exc}"

    return None, None, last_error


def _parse_memory_to_mb(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return round(float(value) / (1024 * 1024), 2)
    if not isinstance(value, str):
        return None

    raw = value.strip().lower()
    multiplier = 1.0
    if raw.endswith("gb"):
        multiplier = 1024.0
        raw = raw[:-2]
    elif raw.endswith("mb"):
        raw = raw[:-2]
    elif raw.endswith("kb"):
        multiplier = 1 / 1024.0
        raw = raw[:-2]
    elif raw.endswith("b"):
        multiplier = 1 / (1024.0 * 1024.0)
        raw = raw[:-1]

    try:
        return round(float(raw.strip()) * multiplier, 2)
    except ValueError:
        return None


def _inspect_docker_containers() -> Dict[str, Any]:
    try:
        result = subprocess.run(
            ["docker", "ps", "-a", "--format", "{{.Names}}|{{.State}}|{{.Status}}|{{.Ports}}"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
    except FileNotFoundError:
        return {
            "containers": [],
            "total": 0,
            "running": 0,
            "error": "Docker CLI unavailable",
        }
    except subprocess.TimeoutExpired:
        return {
            "containers": [],
            "total": 0,
            "running": 0,
            "error": "Docker inspection timed out",
        }

    if result.returncode != 0:
        return {
            "containers": [],
            "total": 0,
            "running": 0,
            "error": result.stderr.strip() or "Docker inspection failed",
        }

    containers: List[Dict[str, Any]] = []
    for line in result.stdout.splitlines():
        if not line.strip():
            continue
        name, state, status, ports = (line.split("|", 3) + [""] * 4)[:4]
        containers.append(
            {
                "name": name,
                "state": state,
                "status": status,
                "ports": ports,
                "healthy": "healthy" in status.lower() if status else None,
            }
        )

    running = sum(1 for container in containers if str(container.get("state", "")).lower() == "running")
    return {
        "containers": containers,
        "total": len(containers),
        "running": running,
        "error": None,
    }


def _reports_generated_last_24h() -> int:
    cutoff = datetime.now() - timedelta(hours=24)
    return sum(
        1
        for file_path in REPORTS_DIR.glob("*")
        if file_path.is_file() and datetime.fromtimestamp(file_path.stat().st_mtime) >= cutoff
    )


def _errors_last_24h() -> int:
    cutoff = datetime.now() - timedelta(hours=24)
    total = 0
    for error in error_tracker.errors:
        try:
            if datetime.fromisoformat(error.timestamp) >= cutoff:
                total += 1
        except ValueError:
            continue
    return total


async def _build_live_dashboard_metrics() -> Dict[str, Any]:
    health_payload, health_source, health_error = _fetch_json_from_candidates("/health")
    docker_state = _inspect_docker_containers()

    system = (health_payload or {}).get("system") or {}
    redis = (health_payload or {}).get("redis") or {}
    database = (health_payload or {}).get("database") or {}
    errors_24h = _errors_last_24h()
    documents_24h = _reports_generated_last_24h()

    alerts: List[Dict[str, Any]] = []
    if health_error:
        alerts.append(
            {
                "severity": "WARNING",
                "name": "MainApiUnavailable",
                "message": health_error,
                "fired_at": datetime.now().isoformat(),
            }
        )
    if redis.get("status") and redis.get("status") != "connected":
        alerts.append(
            {
                "severity": "WARNING",
                "name": "RedisStatus",
                "message": f"Redis status: {redis.get('status')}",
                "fired_at": datetime.now().isoformat(),
            }
        )
    if database.get("status") and database.get("status") != "healthy":
        alerts.append(
            {
                "severity": "WARNING",
                "name": "DatabaseStatus",
                "message": f"Database status: {database.get('status')}",
                "fired_at": datetime.now().isoformat(),
            }
        )
    if docker_state.get("error"):
        alerts.append(
            {
                "severity": "WARNING",
                "name": "DockerInspection",
                "message": str(docker_state["error"]),
                "fired_at": datetime.now().isoformat(),
            }
        )
    if errors_24h:
        alerts.append(
            {
                "severity": "WARNING",
                "name": "ErrorsLast24Hours",
                "message": f"{errors_24h} errors recorded in the last 24 hours",
                "fired_at": datetime.now().isoformat(),
                "value": errors_24h,
            }
        )

    metrics = DashboardMetrics(
        api_uptime_percent=None,
        api_requests_per_second=None,
        api_requests_24h=None,
        api_errors_24h=errors_24h,
        api_error_rate_percent=None,
        avg_response_time_ms=None,
        api_latency_p95_ms=None,
        api_latency_p99_ms=None,
        ai_agent_calls_24h=None,
        ai_agent_success_rate=None,
        documents_generated_24h=documents_24h,
        cache_hit_rate_percent=None,
        cache_status=redis.get("status"),
        cache_memory_used_mb=_parse_memory_to_mb(redis.get("used_memory")),
        db_status=database.get("status"),
        db_connections=redis.get("connected_clients"),
        db_query_avg_ms=database.get("response_time_ms"),
        system_cpu_percent=system.get("cpu_percent"),
        system_memory_percent=system.get("memory_percent"),
        system_disk_percent=system.get("disk_percent"),
        system_uptime_seconds=system.get("uptime_seconds"),
        running_containers=docker_state.get("running"),
        total_containers=docker_state.get("total"),
        active_alerts=alerts,
        sla_status="LIVE" if not alerts else "DEGRADED",
        data_sources={
            "main_api_health": health_source,
            "docker": "docker ps -a",
            "reports_directory": str(REPORTS_DIR.resolve()),
        },
    )
    return metrics.model_dump() if hasattr(metrics, "model_dump") else metrics.dict()


LIGHTWEIGHT_MIME_MAP = {
    "cbor": "application/cbor",
    "msgpack": "application/msgpack",
    "compact": "text/plain",
    "lora": "text/plain",
}


def _pick_format(request: Request) -> str:
    format_param = (request.query_params.get("format") or "").strip().lower()
    if format_param in {"json", "cbor", "msgpack", "mpack", "mpk", "compact", "lora", "minimal"}:
        return format_param

    accept = (request.headers.get("accept") or "").lower()
    if "application/cbor" in accept:
        return "cbor"
    if "application/msgpack" in accept or "application/x-msgpack" in accept:
        return "msgpack"
    if "text/plain" in accept and "json" not in accept:
        return "compact"
    return "json"


def _format_numeric(value: Any) -> Any:
    if isinstance(value, float):
        return round(value, 3)
    return value


def _as_compact(payload: Dict[str, Any], mode: str) -> str:
    if "api_uptime_percent" not in payload:
        # Generic fallback for broader payloads (e.g., history, stats)
        flat: Dict[str, Any] = {}
        for key, value in payload.items():
            if isinstance(value, (int, float, str)):
                flat[key] = _format_numeric(value)
        if mode in {"lora", "minimal"}:
            if flat:
                return "|".join(f"{key}={value}" for key, value in flat.items())
            return json.dumps(payload, separators=(",", ":"))
        if flat:
            return json.dumps(flat, separators=(",", ":"))
        return json.dumps(payload, separators=(",", ":"))

    essentials = {
        "upt": _format_numeric(payload.get("api_uptime_percent")),
        "reqps": _format_numeric(payload.get("api_requests_per_second")),
        "err": _format_numeric(payload.get("api_error_rate_percent")),
        "lat95": _format_numeric(payload.get("api_latency_p95_ms")),
        "lat99": _format_numeric(payload.get("api_latency_p99_ms")),
        "ai": _format_numeric(payload.get("ai_agent_calls_24h")),
        "ai_ok": _format_numeric(payload.get("ai_agent_success_rate")),
        "doc24": _format_numeric(payload.get("documents_generated_24h")),
        "cache": _format_numeric(payload.get("cache_hit_rate_percent")),
        "cpu": _format_numeric(payload.get("system_cpu_percent")),
        "mem": _format_numeric(payload.get("system_memory_percent")),
        "disk": _format_numeric(payload.get("system_disk_percent")),
        "alerts": len(payload.get("active_alerts", [])),
        "sla": payload.get("sla_status"),
    }

    if mode in {"lora", "minimal"}:
        return "|".join(f"{key}={value}" for key, value in essentials.items() if value is not None)

    return json.dumps({k: v for k, v in essentials.items() if v is not None}, separators=(",", ":"))


def _serialize_payload(request: Request, payload: Dict[str, Any]) -> Response:
    fmt = _pick_format(request)

    if fmt == "json" or fmt == "":
        return JSONResponse(payload)

    if fmt == "cbor":
        if cbor2 is None:
            raise HTTPException(status_code=406, detail="CBOR format unavailable - install cbor2")
        return Response(content=cbor2.dumps(payload), media_type=LIGHTWEIGHT_MIME_MAP["cbor"])

    if fmt in {"msgpack", "mpack", "mpk"}:
        if msgpack is None:
            raise HTTPException(status_code=406, detail="MessagePack format unavailable - install msgpack")
        return Response(content=msgpack.packb(payload, use_bin_type=True), media_type=LIGHTWEIGHT_MIME_MAP["msgpack"])

    if fmt in {"compact", "lora", "minimal"}:
        text_payload = _as_compact(payload, fmt)
        return PlainTextResponse(text_payload, media_type=LIGHTWEIGHT_MIME_MAP.get(fmt, "text/plain"))

    # Fallback to JSON for any unknown request
    return JSONResponse(payload)


@router.get("/export-excel")
async def export_excel(background_tasks: BackgroundTasks) -> Response:
    """
    Eksporto metriken në Excel me grafike, pivot tabela, dhe SLA tracking
    Kthen file-in direkt për download
    """
    try:
        # Generate Excel file
        excel_exporter = UltraExcelExporter("Clisonix Cloud Metrics Report")

        snapshots = _get_mock_metrics(hours=24)
        if not snapshots:
            raise HTTPException(status_code=503, detail="Historical metrics source is not configured")
        excel_exporter.add_metrics(snapshots)

        # Save file
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"metrics_report_{timestamp}.xlsx"
        filepath = REPORTS_DIR / filename

        excel_exporter.save(str(filepath))

        # Read file and return as download
        with open(filepath, 'rb') as f:
            content = f.read()

        return Response(
            content=content,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except Exception as e:
        error_id = error_tracker.track_error(e, function_name="export_excel")
        logger.error(f"{error_id} | Excel export failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Failed to generate Excel report",
                "error_id": error_id,
                "message": str(e)
            }
        )


@router.get("/export-pptx")
async def export_powerpoint(background_tasks: BackgroundTasks) -> Response:
    """
    Eksporto metriken në PowerPoint presentation
    Kthen file-in direkt për download
    """
    try:
        # Generate PowerPoint
        ppt_gen = UltraPowerPointGenerator("Clisonix Cloud Metrics Report")

        # Add slides
        ppt_gen.add_title_slide("Enterprise Metrics & SLA Tracking Report")

        live_metrics = await _build_live_dashboard_metrics()
        metrics = {
            "api_uptime": _display_metric(live_metrics.get("api_uptime_percent"), "%"),
            "avg_latency": _display_metric(live_metrics.get("avg_response_time_ms"), "ms"),
            "error_rate": _display_metric(live_metrics.get("api_error_rate_percent"), "%"),
            "docs_per_day": _display_metric(live_metrics.get("documents_generated_24h")),
        }
        ppt_gen.add_metrics_slide(metrics)
        ppt_gen.add_sla_slide()

        alerts = live_metrics.get("active_alerts", [])
        ppt_gen.add_alerts_slide(alerts)

        # Save file
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"metrics_presentation_{timestamp}.pptx"
        filepath = REPORTS_DIR / filename

        ppt_gen.save(str(filepath))

        # Read file and return as download
        with open(filepath, 'rb') as f:
            content = f.read()

        return Response(
            content=content,
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except Exception as e:
        error_id = error_tracker.track_error(e, function_name="export_powerpoint")
        logger.error(f"{error_id} | PowerPoint export failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Failed to generate PowerPoint",
                "error_id": error_id,
                "message": str(e)
            }
        )


@router.post("/export-both")
async def export_both(request: ExportRequest) -> Dict[str, Any]:
    """Eksporto si Excel edhe PowerPoint në të njejtën kohë"""

    try:
        # Generate Excel
        excel_exporter = UltraExcelExporter(request.title)
        snapshots = _get_mock_metrics(hours=request.date_range_hours)
        if not snapshots:
            raise HTTPException(status_code=503, detail="Historical metrics source is not configured")
        excel_exporter.add_metrics(snapshots)

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        excel_filename = f"metrics_report_{timestamp}.xlsx"
        excel_filepath = REPORTS_DIR / excel_filename
        excel_exporter.save(str(excel_filepath))

        # Generate PowerPoint
        ppt_gen = UltraPowerPointGenerator(request.title)
        ppt_gen.add_title_slide("Enterprise Metrics & SLA Tracking")
        live_metrics = await _build_live_dashboard_metrics()
        ppt_gen.add_metrics_slide({
            "api_uptime": _display_metric(live_metrics.get("api_uptime_percent"), "%"),
            "avg_latency": _display_metric(live_metrics.get("avg_response_time_ms"), "ms"),
            "error_rate": _display_metric(live_metrics.get("api_error_rate_percent"), "%"),
            "docs_per_day": _display_metric(live_metrics.get("documents_generated_24h")),
        })

        if request.include_sla:
            ppt_gen.add_sla_slide()
        if request.include_alerts:
            ppt_gen.add_alerts_slide(live_metrics.get("active_alerts", []))

        ppt_filename = f"metrics_presentation_{timestamp}.pptx"
        ppt_filepath = REPORTS_DIR / ppt_filename
        ppt_gen.save(str(ppt_filepath))

        return {
            "success": True,
            "reports": {
                "excel": {
                    "filename": excel_filename,
                    "file_path": str(excel_filepath),
                    "download_url": f"/api/reporting/download/{excel_filename}",
                    "size_bytes": excel_filepath.stat().st_size
                },
                "powerpoint": {
                    "filename": ppt_filename,
                    "file_path": str(ppt_filepath),
                    "download_url": f"/api/reporting/download/{ppt_filename}",
                    "size_bytes": ppt_filepath.stat().st_size
                }
            },
            "generated_at": datetime.now().isoformat(),
            "message": "✓ Both Excel and PowerPoint reports generated successfully"
        }

    except Exception as e:
        error_id = error_tracker.track_error(e, function_name="export_both")
        logger.error(f"{error_id} | Export both failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Failed to generate reports",
                "error_id": error_id,
                "message": str(e)
            }
        )


@router.get("/dashboard")
async def get_unified_dashboard(request: Request) -> Response:
    """
    Unified dashboard combining Datadog + Grafana + Prometheus metrics

    Real implementation would:
    - Query VictoriaMetrics for latest metrics
    - Fetch from Prometheus for detailed data
    - Get alerts from AlertManager
    - Aggregate all sources into single response
    """

    try:
        payload = await _build_live_dashboard_metrics()
        return _serialize_payload(request, payload)

    except Exception as e:
        logger.error(f"Dashboard fetch failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics-history")
async def get_metrics_history(
    request: Request,
    hours: int = Query(24, ge=1, le=720),
    metric_type: str = Query("all", pattern="^(all|api|ai|infrastructure)$")
) -> Response:
    """
    Merr historiken e metrikave për periudhën e caktuar

    Metric types:
    - all: Të gjitha metriken
    - api: API request/error/latency metrics
    - ai: AI agent metrics
    - infrastructure: System/DB/cache metrics
    """

    try:
        snapshots = _get_mock_metrics(hours=hours)
        if not snapshots:
            raise HTTPException(status_code=503, detail="Historical metrics source is not configured")

        history = {
            "period_hours": hours,
            "data_points": len(snapshots),
            "metrics": {
                "api_requests": [s.api_requests_total for s in snapshots],
                "error_rate": [s.api_error_rate * 100 for s in snapshots],
                "latency_p95": [s.api_latency_p95 for s in snapshots],
                "latency_p99": [s.api_latency_p99 for s in snapshots],
                "ai_calls": [s.ai_agent_calls for s in snapshots],
                "documents_generated": [s.documents_generated for s in snapshots],
                "cache_hit_rate": [s.cache_hit_rate * 100 for s in snapshots],
                "cpu_percent": [s.system_cpu_percent for s in snapshots],
                "memory_percent": [s.system_memory_percent for s in snapshots],
            },
            "timestamps": [s.timestamp.isoformat() for s in snapshots],
            "generated_at": datetime.now().isoformat()
        }

        return _serialize_payload(request, history)

    except Exception as e:
        logger.error(f"Metrics history fetch failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/download/{filename}")
async def download_report(filename: str):
    """Shkarko raportin e gjeneruar"""

    from fastapi.responses import FileResponse

    try:
        filepath = REPORTS_DIR / filename

        if not filepath.exists():
            raise HTTPException(status_code=404, detail="Report not found")

        return FileResponse(
            path=filepath,
            media_type="application/octet-stream",
            filename=filename
        )

    except Exception as e:
        logger.error(f"Download failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list-reports")
async def list_reports() -> List[ReportMetadata]:
    """Listo të gjithë raportet e gjeneruar"""

    try:
        reports = []

        for filepath in REPORTS_DIR.glob("*"):
            if filepath.is_file():
                stat = filepath.stat()

                reports.append(ReportMetadata(
                    id=filepath.stem,
                    title=filepath.stem.replace("_", " "),
                    format=filepath.suffix.lower().lstrip("."),
                    generated_at=datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    file_path=str(filepath),
                    size_bytes=stat.st_size
                ))

        return sorted(reports, key=lambda r: r.generated_at, reverse=True)

    except Exception as e:
        logger.error(f"List reports failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/clear-reports")
async def clear_old_reports(days_old: int = Query(7, ge=1)) -> Dict[str, Any]:
    """Pastro raportet e vjetra më shumë se N ditë"""

    try:
        cutoff_time = datetime.now() - timedelta(days=days_old)
        deleted_count = 0
        total_freed = 0

        for filepath in REPORTS_DIR.glob("*"):
            if filepath.is_file():
                file_time = datetime.fromtimestamp(filepath.stat().st_mtime)
                if file_time < cutoff_time:
                    size = filepath.stat().st_size
                    filepath.unlink()
                    deleted_count += 1
                    total_freed += size

        return {
            "success": True,
            "deleted_files": deleted_count,
            "freed_bytes": total_freed,
            "freed_mb": round(total_freed / (1024 * 1024), 2),
            "message": f"✓ Deleted {deleted_count} reports older than {days_old} days"
        }

    except Exception as e:
        logger.error(f"Clear reports failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# HEALTH & STATUS ENDPOINTS - Required by Frontend Status Monitor
# ============================================================================

@router.get("/health")
async def reporting_health():
    """
    Health check for reporting module.
    Returns status of all reporting-related services.
    """
    try:
        # Check if reports directory exists and is writable
        reports_dir_ok = REPORTS_DIR.exists() and os.access(REPORTS_DIR, os.W_OK)

        return {
            "status": "healthy" if reports_dir_ok else "degraded",
            "service": "reporting",
            "timestamp": datetime.now().isoformat(),
            "checks": {
                "reports_directory": "ok" if reports_dir_ok else "error",
                "excel_export": "available",
                "pptx_export": "available",
                "dashboard": "available"
            },
            "version": "2.0.0",
            "uptime": "operational"
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "service": "reporting",
            "error": str(e)
        }


@router.get("/docker-containers")
async def get_docker_containers():
    """
    Returns Docker container status for reporting dashboard.
    Uses subprocess to get actual container status if available.
    """
    docker_state = _inspect_docker_containers()
    return {
        "success": docker_state.get("error") is None,
        "timestamp": datetime.now().isoformat(),
        "total": docker_state.get("total", 0),
        "running": docker_state.get("running", 0),
        "containers": docker_state.get("containers", []),
        **({"error": docker_state["error"]} if docker_state.get("error") else {}),
    }


@router.get("/export-excel")
async def export_excel_get():
    """
    GET endpoint for export-excel status check.
    The actual export uses POST with data payload.
    """
    return {
        "status": "available",
        "service": "excel-export",
        "method": "POST",
        "description": "Use POST method with report data to generate Excel file",
        "endpoint": "/api/reporting/export-excel",
        "supported_formats": ["xlsx", "xls"],
        "max_rows": 100000,
        "timestamp": datetime.now().isoformat()
    }


def _get_mock_metrics(hours: int = 24) -> List[MetricsSnapshot]:
    """Historical metrics are disabled until a real time-series source is wired in."""
    return []


# ========== ERROR TRACKING ENDPOINTS ==========

@router.get("/errors")
async def get_errors() -> Dict[str, Any]:
    """
    Merr listën e të gjithë erroreve me referenca unike (ERR-001, ERR-002, etj)
    Shfaq numrin e rreshtit, funksionin, kodin e gabimit dhe detajet
    """
    return {
        "errors": error_tracker.get_all_errors(),
        "summary": error_tracker.get_error_summary(),
    }


@router.get("/errors/summary")
async def get_error_summary() -> Dict[str, Any]:
    """Merr përmbledhjen e erroreve"""
    return error_tracker.get_error_summary()


@router.get("/errors/by-function/{function_name}")
async def get_errors_by_function(function_name: str) -> Dict[str, Any]:
    """Merr errore sipas emrit të funksionit"""
    errors = error_tracker.get_errors_by_function(function_name)
    return {
        "function": function_name,
        "error_count": len(errors),
        "errors": errors,
    }


@router.get("/errors/table")
async def get_errors_table() -> PlainTextResponse:
    """
    Shfaq errore si tabelë e formatuar për konsol/terminal
    Tabelë me ERR-001, ERR-002, etj me numrin e rreshtit, funksionin, tipin, dhe mesazhin
    """
    table = error_tracker.export_errors_as_table()
    return PlainTextResponse(table)


@router.delete("/errors/clear")
async def clear_errors() -> Dict[str, Any]:
    """Pastro të gjithë errore"""
    error_count = len(error_tracker.errors)
    error_tracker.clear_errors()
    return {
        "status": "success",
        "message": f"Cleared {error_count} errors",
        "cleared_count": error_count,
    }

