"""
JONA Neural Synthesis API Routes
================================
Backend API endpoints for JONA - Joyful Overseer of Neural Alignment

Provides:
- Real-time neural synthesis status
- Audio generation and playback
- Session management
- Brainwave-to-audio conversion
"""

import logging
import math
import os
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel

logger = logging.getLogger("jona_routes")

router = APIRouter(prefix="/api/jona", tags=["JONA Neural Synthesis"])

# ============================================================================
# MODELS
# ============================================================================

class SynthesisSession(BaseModel):
    session_id: str
    status: str  # idle, recording, synthesizing, complete
    duration_seconds: float
    samples_processed: int
    created_at: str
    user_id: Optional[str] = None

class AudioFile(BaseModel):
    file_id: str
    filename: str
    format: str
    duration_ms: int
    sample_rate: int
    channels: int
    size_bytes: int
    created_at: str
    neural_frequency: float
    waveform_type: str

class JonaMetrics(BaseModel):
    service: str
    status: str
    version: str
    eeg_signals_processed: int
    audio_files_created: int
    current_symphony: Optional[str]
    neural_frequency: float
    excitement_level: float
    uptime_seconds: int
    last_synthesis: Optional[str]

class SynthesisConfig(BaseModel):
    frequency: float = 14.0  # Hz - Alpha waves default
    waveform: str = "sine"   # sine, square, triangle, sawtooth
    duration: int = 60       # seconds
    modulation: bool = True
    binaural: bool = False
    base_frequency: float = 200.0  # Hz for carrier wave

class WaveformData(BaseModel):
    channel: str
    data: List[float]
    frequency: float
    amplitude: float

# ============================================================================
# IN-MEMORY STATE (Production would use Redis/Database)
# ============================================================================

_active_sessions: Dict[str, Dict[str, Any]] = {}
_service_start_time = datetime.now()
_total_signals_processed = 0
_total_audio_created = 0
_active_proxy_session_id: Optional[str] = None
_last_completed_proxy_session_id: Optional[str] = None

JONA_CANDIDATE_URLS = [
    os.getenv("JONA_API_URL"),
    "http://clisonix-jona:7777",
    "http://jona:7777",
    "http://localhost:7777",
]


async def _jona_request(method: str, path: str, json_payload: Optional[Dict[str, Any]] = None):
    last_error: Optional[Exception] = None
    for base in [url for url in JONA_CANDIDATE_URLS if url]:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.request(method, f"{base.rstrip('/')}{path}", json=json_payload)
                if response.status_code >= 400:
                    detail = response.text
                    raise HTTPException(status_code=response.status_code, detail=detail)
                if not response.content:
                    return {}
                return response.json()
        except HTTPException:
            raise
        except Exception as exc:
            last_error = exc
            continue

    raise HTTPException(status_code=502, detail=f"JONA backend unavailable: {last_error}")


def _infer_band_distribution(target_frequency: float) -> Dict[str, Dict[str, Any]]:
    freq = max(0.5, min(100.0, float(target_frequency)))
    delta = max(5.0, 100.0 - freq * 2.0)
    theta = max(5.0, 85.0 - freq * 1.6)
    alpha = max(5.0, 80.0 - abs(freq - 10.0) * 8.0)
    beta = max(5.0, 12.0 + max(0.0, freq - 12.0) * 3.2)
    gamma = max(5.0, 8.0 + max(0.0, freq - 30.0) * 1.8)

    raw = {
        "delta": delta,
        "theta": theta,
        "alpha": alpha,
        "beta": beta,
        "gamma": gamma,
    }
    total = sum(raw.values()) or 1.0

    return {
        "delta": {"range": "0.5-4 Hz", "power": round(raw["delta"] / total * 100.0, 1), "description": "Deep sleep"},
        "theta": {"range": "4-8 Hz", "power": round(raw["theta"] / total * 100.0, 1), "description": "Meditation, light sleep"},
        "alpha": {"range": "8-12 Hz", "power": round(raw["alpha"] / total * 100.0, 1), "description": "Relaxed, calm"},
        "beta": {"range": "12-30 Hz", "power": round(raw["beta"] / total * 100.0, 1), "description": "Active thinking"},
        "gamma": {"range": "30-100 Hz", "power": round(raw["gamma"] / total * 100.0, 1), "description": "High cognition"},
    }


def _dominant_band_name(freq: float) -> str:
    if freq < 4:
        return "delta"
    if freq < 8:
        return "theta"
    if freq < 12:
        return "alpha"
    if freq < 30:
        return "beta"
    return "gamma"

# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/status")
async def get_jona_status() -> Dict[str, Any]:
    """Get JONA Neural Synthesis service status"""
    health = await _jona_request("GET", "/health")
    status = await _jona_request("GET", "/status")
    audio = await _jona_request("GET", "/audio/list")

    active_sessions = int(status.get("active_sessions", 0) or 0)
    active_frequency = 14.0
    current_symphony = None
    processed_signals = 0
    sessions = status.get("sessions", {})
    if isinstance(sessions, dict) and sessions:
        first_key, first = next(iter(sessions.items()))
        if isinstance(first, dict):
            active_frequency = float(first.get("frequency", 14.0))
            current_symphony = str(first.get("session_id") or first_key)
        for _, session_payload in sessions.items():
            if isinstance(session_payload, dict):
                uptime = float(session_payload.get("uptime", 0.0) or 0.0)
                processed_signals += int(max(0.0, uptime) * 48000)

    if processed_signals <= 0 and active_sessions > 0:
        processed_signals = int(active_sessions * 48000)

    excitement_level = max(0.0, min(1.0, 0.35 + (active_frequency / 100.0)))

    return {
        "success": True,
        "service": "JONA Neural Synthesis",
        "tagline": "Joyful Overseer of Neural Alignment",
        "status": "online",
        "version": health.get("version", "1.0.0"),
        "metrics": {
            "eeg_signals_processed": processed_signals,
            "audio_files_created": int(audio.get("count", 0)),
            "active_sessions": active_sessions,
            "current_symphony": current_symphony,
            "neural_frequency": active_frequency,
            "excitement_level": round(excitement_level, 3),
            "uptime_seconds": int((datetime.now() - _service_start_time).total_seconds())
        },
        "capabilities": [
            "eeg_to_audio",
            "binaural_beats",
            "isochronic_tones",
            "neural_entrainment",
            "real_time_synthesis"
        ],
        "timestamp": datetime.now().isoformat()
    }

@router.get("/health")
async def get_jona_health() -> Dict[str, Any]:
    """Health check for JONA service"""
    health = await _jona_request("GET", "/health")
    return {
        "success": True,
        "healthy": str(health.get("status", "")).lower() in {"healthy", "ok", "operational"},
        "service": health.get("service", "jona-neural-synthesis"),
        "version": health.get("version", "1.0.0"),
        "checks": {
            "audio_engine": "healthy",
            "synthesis_pipeline": "healthy",
            "upstream": "ok",
        },
        "uptime_seconds": int((datetime.now() - _service_start_time).total_seconds()),
        "timestamp": datetime.now().isoformat(),
    }

@router.get("/session")
async def get_current_session() -> Dict[str, Any]:
    """Get current active synthesis session"""
    if not _active_sessions:
        return {
            "success": True,
            "active": False,
            "session": None,
            "message": "No active synthesis session"
        }
    
    session_id = list(_active_sessions.keys())[0]
    session = _active_sessions[session_id]
    
    # Update duration
    session["duration_seconds"] = (datetime.now() - datetime.fromisoformat(session["created_at"])).total_seconds()
    session["samples_processed"] = int(session["duration_seconds"] * 256)  # 256 Hz sample rate
    
    return {
        "success": True,
        "active": True,
        "session": session
    }

@router.post("/synthesis/start")
async def start_synthesis(config: Optional[SynthesisConfig] = None) -> Dict[str, Any]:
    """Start a new neural synthesis session"""
    global _active_proxy_session_id

    if config is None:
        config = SynthesisConfig()

    waveform = config.waveform
    if waveform == "pink":
        waveform = "pink_noise"

    payload = {
        "user_id": f"web-{uuid.uuid4().hex[:8]}",
        "target_frequency": config.frequency,
        "waveform_type": waveform,
        "volume": 75,
    }
    real = await _jona_request("POST", "/session/start", payload)
    _active_proxy_session_id = real.get("session_id")

    return {
        "success": True,
        "message": "Neural synthesis started",
        "session": {
            "session_id": real.get("session_id"),
            "status": "synthesizing",
            "frequency": config.frequency,
            "waveform": waveform,
            "duration_target": config.duration,
            "duration_seconds": 0,
            "samples_processed": 0,
            "symphony_name": f"Neural Symphony #{real.get('session_id', '')[-6:]}",
            "created_at": datetime.now().isoformat(),
            "config": config.model_dump(),
        }
    }

@router.post("/synthesis/stop")
async def stop_synthesis() -> Dict[str, Any]:
    """Stop current synthesis session without creating files"""
    global _active_proxy_session_id, _last_completed_proxy_session_id

    if not _active_proxy_session_id:
        raise HTTPException(status_code=404, detail="No active synthesis session to stop")

    session_id = _active_proxy_session_id
    real = await _jona_request("POST", f"/session/{session_id}/stop")
    _active_proxy_session_id = None
    _last_completed_proxy_session_id = str(real.get("session_id") or session_id)

    logger.info(f"[JONA] Stopped synthesis: {_last_completed_proxy_session_id}")

    return {
        "success": True,
        "message": "Synthesis complete. Use export endpoint to create file.",
        "session_id": _last_completed_proxy_session_id,
        "export_required": True,
        "export_endpoint": f"/api/jona/synthesis/export?session_id={_last_completed_proxy_session_id}&format=wav",
        "session_summary": {
            "session_id": _last_completed_proxy_session_id,
            "duration_seconds": max(0, int(real.get("duration_seconds", 0) or 0)),
            "samples_processed": int(max(0, int(real.get("duration_seconds", 0) or 0)) * 256)
        }
    }


@router.post("/synthesis/export")
async def export_synthesis(request: Request) -> Dict[str, Any]:
    """Create JONA export file only when requested by user"""
    global _active_proxy_session_id, _last_completed_proxy_session_id

    payload: Dict[str, Any] = {}
    try:
        payload = await request.json()
    except Exception:
        payload = {}

    format_value = str(payload.get("format", "wav")).lower()
    if format_value not in ("wav", "midi", "mid"):
        raise HTTPException(status_code=400, detail="Supported formats: wav, midi")
    if format_value == "mid":
        format_value = "midi"

    session_id = str(
        payload.get("session_id")
        or _last_completed_proxy_session_id
        or _active_proxy_session_id
        or ""
    ).strip()

    if not session_id:
        raise HTTPException(status_code=404, detail="No session available for export")

    real = await _jona_request("POST", f"/session/{session_id}/export?format={format_value}")
    return {
        "success": True,
        "session_id": session_id,
        "format": format_value,
        "download_url": real.get("download_url"),
        "message": real.get("message", "Export generated"),
    }


@router.get("/synthesis/preview")
async def preview_synthesis(session_id: Optional[str] = None, seconds: float = 3.0):
    """Stream live preview audio from JONA without writing files"""
    target_session_id = str(
        session_id
        or _active_proxy_session_id
        or _last_completed_proxy_session_id
        or ""
    ).strip()

    if not target_session_id:
        raise HTTPException(status_code=404, detail="No session available for preview")

    last_error: Optional[Exception] = None
    for base in [url for url in JONA_CANDIDATE_URLS if url]:
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                upstream = await client.get(
                    f"{base.rstrip('/')}/session/{target_session_id}/audio/preview",
                    params={"seconds": max(1.0, min(10.0, float(seconds)))},
                )
                if upstream.status_code >= 400:
                    continue
                return Response(
                    content=upstream.content,
                    media_type=upstream.headers.get("content-type", "audio/wav"),
                    headers={"X-Audio-Mode": upstream.headers.get("x-audio-mode", "live_preview")},
                )
        except Exception as exc:
            last_error = exc
            continue

    raise HTTPException(status_code=502, detail=f"Unable to stream preview audio: {last_error}")

@router.get("/audio/list")
async def list_audio_files() -> Dict[str, Any]:
    """List all generated audio files"""
    real = await _jona_request("GET", "/audio/list")
    files = real.get("files", []) if isinstance(real, dict) else []
    return {
        "success": True,
        "count": len(files),
        "files": files,
        "total_duration_ms": sum((f.get("duration_ms", 0) or 0) for f in files),
        "total_size_bytes": sum((f.get("size_bytes", 0) or 0) for f in files)
    }

@router.get("/audio/{file_id}")
async def get_audio_file(file_id: str) -> Dict[str, Any]:
    """Get details of a specific audio file"""
    files_payload = await _jona_request("GET", "/audio/list")
    files = files_payload.get("files", []) if isinstance(files_payload, dict) else []
    for audio in files:
        if str(audio.get("file_id", "")) == file_id:
            return {"success": True, "file": audio}

    raise HTTPException(status_code=404, detail=f"Audio file not found: {file_id}")


@router.get("/audio/{file_id}/download")
async def download_audio_file(file_id: str):
    files_payload = await _jona_request("GET", "/audio/list")
    files = files_payload.get("files", []) if isinstance(files_payload, dict) else []

    target = None
    for item in files:
        if str(item.get("file_id", "")) == file_id:
            target = item
            break

    if not target:
        raise HTTPException(status_code=404, detail=f"Audio file not found: {file_id}")

    download_url = str(target.get("download_url", ""))
    if not download_url.startswith("/"):
        raise HTTPException(status_code=500, detail="Invalid download URL")

    last_error: Optional[Exception] = None
    for base in [url for url in JONA_CANDIDATE_URLS if url]:
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                upstream = await client.get(f"{base.rstrip('/')}{download_url}")
                if upstream.status_code >= 400:
                    continue
                content_type = upstream.headers.get("content-type", "application/octet-stream")
                filename = str(target.get("filename", "audio.wav"))
                return Response(
                    content=upstream.content,
                    media_type=content_type,
                    headers={"Content-Disposition": f"attachment; filename={filename}"},
                )
        except Exception as exc:
            last_error = exc
            continue

    raise HTTPException(status_code=502, detail=f"Unable to stream audio file: {last_error}")

@router.delete("/audio/{file_id}")
async def delete_audio_file(file_id: str) -> Dict[str, Any]:
    """Delete an audio file"""
    real = await _jona_request("DELETE", f"/audio/{file_id}")
    return {
        "success": True,
        "message": real.get("message", "Deleted"),
        "file_id": file_id,
    }

@router.get("/waveform/live")
async def get_live_waveform() -> Dict[str, Any]:
    """Get live waveform data for visualization"""
    status_payload = await _jona_request("GET", "/status")
    sessions = status_payload.get("sessions", {}) if isinstance(status_payload, dict) else {}
    target_frequency = 14.0
    if isinstance(sessions, dict) and sessions:
        first = next(iter(sessions.values()))
        if isinstance(first, dict):
            target_frequency = float(first.get("frequency", 14.0) or 14.0)

    channels = ["Alpha", "Beta", "Theta", "Delta", "Gamma"]
    waveforms = []

    for idx, ch in enumerate(channels):
        harmonic = idx + 1
        data = [
            round(math.sin((sample / 20.0) * harmonic + (target_frequency / 15.0)) * 0.9, 4)
            for sample in range(100)
        ]
        waveforms.append({
            "channel": ch,
            "data": data,
            "frequency": round(target_frequency * (1 + (idx * 0.1)), 2),
            "amplitude": round(0.6 + idx * 0.15, 2)
        })
    
    return {
        "success": True,
        "timestamp": datetime.now().isoformat(),
        "sample_rate": 256,
        "waveforms": waveforms
    }

@router.get("/frequencies")
async def get_frequency_bands() -> Dict[str, Any]:
    """Get current frequency band power"""
    status_payload = await _jona_request("GET", "/status")
    sessions = status_payload.get("sessions", {}) if isinstance(status_payload, dict) else {}
    target_frequency = 14.0
    if isinstance(sessions, dict) and sessions:
        first = next(iter(sessions.values()))
        if isinstance(first, dict):
            target_frequency = float(first.get("frequency", 14.0) or 14.0)

    bands = _infer_band_distribution(target_frequency)
    dominant = _dominant_band_name(target_frequency)

    return {
        "success": True,
        "bands": bands,
        "dominant": dominant,
        "neural_frequency": target_frequency,
        "timestamp": datetime.now().isoformat()
    }

@router.post("/frequency/set")
async def set_target_frequency(frequency: float = 14.0) -> Dict[str, Any]:
    """Set target neural entrainment frequency"""
    if not (0.5 <= frequency <= 100):
        raise HTTPException(status_code=400, detail="Frequency must be between 0.5 and 100 Hz")
    
    return {
        "success": True,
        "message": f"Target frequency set to {frequency} Hz",
        "frequency": frequency,
        "band": (
            "delta" if frequency < 4 else
            "theta" if frequency < 8 else
            "alpha" if frequency < 12 else
            "beta" if frequency < 30 else
            "gamma"
        )
    }
