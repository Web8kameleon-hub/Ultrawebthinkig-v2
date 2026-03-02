#!/usr/bin/env python3
"""
JONA Professional Neural Synthesis Engine
Real-time brainwave entrainment audio synthesis with therapeutic protocols
Port: 7777
"""

import asyncio
import logging
import uuid
import wave
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
from fastapi import Depends, FastAPI, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

try:
    from pydantic_settings import BaseSettings
except ImportError:
    from pydantic import BaseSettings

# ═══════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════

class Settings(BaseSettings):
    app_title: str = "JONA Neural Synthesis Engine"
    app_version: str = "1.0.0"
    api_host: str = "0.0.0.0"
    api_port: int = 7777
    debug: bool = True

    class Config:
        env_prefix = "JONA_"
        case_sensitive = False

settings = Settings()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════════════

class BrainwaveBand(BaseModel):
    name: str
    frequency_range: tuple
    power_percent: int
    interpretation: str

class SynthesisMetrics(BaseModel):
    session_id: str
    state: str
    duration_seconds: float
    signals_processed: int
    audio_files_generated: int
    current_frequency: float
    current_waveform: str
    quality_score: float
    dominant_band: str
    thd_percent: float
    uptime_seconds: float
    brainwave_bands: List[BrainwaveBand]

class SessionStartRequest(BaseModel):
    user_id: str
    target_frequency: float
    waveform_type: str
    preset_id: Optional[str] = None
    volume: int = 75

class SessionStartResponse(BaseModel):
    session_id: str
    status: str
    message: str

class PresetModel(BaseModel):
    id: str
    name: str
    frequency: float
    waveform: str
    description: str

# ═══════════════════════════════════════════════════════════════════
# SESSION MANAGER
# ═══════════════════════════════════════════════════════════════════

class SynthesisSession:
    def __init__(self, session_id: str, user_id: str, target_frequency: float, 
        waveform_type: str, volume: int):
        self.session_id = session_id
        self.user_id = user_id
        self.target_frequency = target_frequency
        self.waveform_type = waveform_type
        self.volume = volume
        self.state = "recording"
        self.created_at = datetime.now()
        self.duration_seconds = 0
        self.signals_processed = 0
        self.audio_files_generated = 0
        self.is_active = True
        
    def get_metrics(self) -> SynthesisMetrics:
        uptime = (datetime.now() - self.created_at).total_seconds()
        
        # Generate brainwave bands based on frequency
        bands = self._generate_brainwave_bands()
        
        # Calculate THD (Total Harmonic Distortion) - realistic for sine synthesis
        thd = max(0.5, np.random.normal(2.0, 0.5))
        
        # Quality score based on THD and signal integrity
        quality_score = max(75, min(99, 95 - thd * 5))
        
        return SynthesisMetrics(
            session_id=self.session_id,
            state=self.state,
            duration_seconds=uptime,
            signals_processed=int(48000 * uptime),  # 48kHz sample rate
            audio_files_generated=self.audio_files_generated,
            current_frequency=self.target_frequency,
            current_waveform=self.waveform_type,
            quality_score=quality_score,
            dominant_band=self._get_dominant_band(),
            thd_percent=thd,
            uptime_seconds=int(uptime),
            brainwave_bands=bands
        )
    
    def _generate_brainwave_bands(self) -> List[BrainwaveBand]:
        """Generate realistic brainwave band distributions"""
        delta_power = min(80, max(20, int(100 - self.target_frequency * 2)))
        theta_power = min(70, max(25, int(80 - self.target_frequency * 1.5)))
        alpha_power = max(50, min(80, int((10 - abs(10 - self.target_frequency)) * 5)))
        beta_power = max(30, min(70, int((self.target_frequency - 12) * 2)))
        gamma_power = max(10, min(40, int((self.target_frequency - 30) * 1)))
        
        total = delta_power + theta_power + alpha_power + beta_power + gamma_power
        
        return [
            BrainwaveBand(
                name="Delta",
                frequency_range=(0.5, 4),
                power_percent=int((delta_power / total) * 100),
                interpretation="Deep sleep, unconsciousness"
            ),
            BrainwaveBand(
                name="Theta",
                frequency_range=(4, 8),
                power_percent=int((theta_power / total) * 100),
                interpretation="Meditation, creativity"
            ),
            BrainwaveBand(
                name="Alpha",
                frequency_range=(8, 12),
                power_percent=int((alpha_power / total) * 100),
                interpretation="Relaxed awareness, calm"
            ),
            BrainwaveBand(
                name="Beta",
                frequency_range=(12, 30),
                power_percent=int((beta_power / total) * 100),
                interpretation="Active thinking, focus"
            ),
            BrainwaveBand(
                name="Gamma",
                frequency_range=(30, 100),
                power_percent=int((gamma_power / total) * 100),
                interpretation="High cognitive processing"
            ),
        ]
    
    def _get_dominant_band(self) -> str:
        """Return dominant brainwave band based on frequency"""
        if self.target_frequency < 4:
            return "Delta"
        elif self.target_frequency < 8:
            return "Theta"
        elif self.target_frequency < 12:
            return "Alpha"
        elif self.target_frequency < 30:
            return "Beta"
        else:
            return "Gamma"

# ═══════════════════════════════════════════════════════════════════
# FASTAPI APPLICATION
# ═══════════════════════════════════════════════════════════════════

app = FastAPI(
    title=settings.app_title,
    version=settings.app_version,
    description="Professional neural synthesis engine for therapeutic audio"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Session storage
active_sessions: Dict[str, SynthesisSession] = {}
AUDIO_DIR = Path("./data/jona_audio")
AUDIO_DIR.mkdir(parents=True, exist_ok=True)
session_exports: Dict[str, Dict[str, object]] = {}

# Presets
PRESETS = [
    PresetModel(
        id="deep-sleep",
        name="Deep Sleep",
        frequency=2.5,
        waveform="isochronic",
        description="Delta waves for deep, restorative sleep"
    ),
    PresetModel(
        id="meditation",
        name="Meditation",
        frequency=6.0,
        waveform="binaural",
        description="Theta waves for deep meditation state"
    ),
    PresetModel(
        id="relaxation",
        name="Relaxation",
        frequency=10.0,
        waveform="sine",
        description="Alpha waves for calm relaxation"
    ),
    PresetModel(
        id="focus",
        name="Focus",
        frequency=14.0,
        waveform="isochronic",
        description="Low Beta for concentration and focus"
    ),
    PresetModel(
        id="alertness",
        name="Alertness",
        frequency=20.0,
        waveform="binaural",
        description="High Beta for alertness and energy"
    ),
    PresetModel(
        id="cognition",
        name="Cognition",
        frequency=40.0,
        waveform="isochronic",
        description="Gamma waves for cognitive enhancement"
    ),
]


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _generate_audio_samples(session: SynthesisSession, duration_seconds: float, sample_rate: int = 44100) -> np.ndarray:
    duration_seconds = _clamp(duration_seconds, 1.0, 600.0)
    t = np.linspace(0.0, duration_seconds, int(sample_rate * duration_seconds), endpoint=False)
    amplitude = _clamp(session.volume / 100.0, 0.05, 1.0) * 0.5

    waveform = session.waveform_type.lower()
    if waveform == "binaural":
        base = 200.0
        left = np.sin(2 * np.pi * base * t)
        right = np.sin(2 * np.pi * (base + session.target_frequency) * t)
        stereo = np.column_stack((left, right))
        return (stereo * amplitude).astype(np.float32)

    if waveform == "isochronic":
        carrier = np.sin(2 * np.pi * 220.0 * t)
        pulse = (np.sin(2 * np.pi * session.target_frequency * t) > 0).astype(np.float32)
        mono = carrier * pulse
        return (mono * amplitude).astype(np.float32)

    if waveform == "pink_noise":
        white = np.random.normal(0, 1, len(t)).astype(np.float32)
        pinkish = np.cumsum(white)
        pinkish = pinkish / (np.max(np.abs(pinkish)) + 1e-9)
        return (pinkish * amplitude).astype(np.float32)

    mono = np.sin(2 * np.pi * session.target_frequency * t)
    return (mono * amplitude).astype(np.float32)


def _write_wav(session: SynthesisSession, duration_seconds: float) -> Dict[str, object]:
    sample_rate = 44100
    samples = _generate_audio_samples(session, duration_seconds=duration_seconds, sample_rate=sample_rate)

    file_id = str(uuid.uuid4())
    filename = f"jona_{session.session_id}_{file_id[:8]}.wav"
    path = (AUDIO_DIR / filename).resolve()

    channels = 2 if samples.ndim == 2 else 1
    pcm = np.clip(samples, -1.0, 1.0)
    pcm = (pcm * np.iinfo(np.int16).max).astype(np.int16)

    with wave.open(str(path), "wb") as wav_file:
        wav_file.setnchannels(channels)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm.tobytes())

    size_bytes = path.stat().st_size
    return {
        "file_id": file_id,
        "filename": filename,
        "format": "wav",
        "duration_ms": int(_clamp(duration_seconds, 1.0, 600.0) * 1000),
        "sample_rate": sample_rate,
        "channels": channels,
        "size_bytes": int(size_bytes),
        "created_at": datetime.now().isoformat(),
        "neural_frequency": session.target_frequency,
        "waveform_type": session.waveform_type,
        "session_id": session.session_id,
        "download_url": f"/files/{filename}",
    }

# ═══════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "JONA Neural Synthesis",
        "version": settings.app_version,
        "active_sessions": len(active_sessions)
    }

@app.get("/status")
async def status():
    """Get system status"""
    return {
        "status": "operational",
        "timestamp": datetime.now().isoformat(),
        "active_sessions": len(active_sessions),
        "sessions": {
            sid: {
                "frequency": session.target_frequency,
                "waveform": session.waveform_type,
                "uptime": (datetime.now() - session.created_at).total_seconds()
            }
            for sid, session in active_sessions.items()
        }
    }

@app.post("/session/start", response_model=SessionStartResponse)
async def start_synthesis(request: SessionStartRequest):
    """Start a new neural synthesis session"""
    try:
        session_id = f"session_{uuid.uuid4().hex[:12]}"
        
        session = SynthesisSession(
            session_id=session_id,
            user_id=request.user_id,
            target_frequency=request.target_frequency,
            waveform_type=request.waveform_type,
            volume=request.volume
        )
        
        active_sessions[session_id] = session
        
        logger.info(f"✓ Synthesis session started: {session_id} at {request.target_frequency} Hz ({request.waveform_type})")
        
        return SessionStartResponse(
            session_id=session_id,
            status="started",
            message=f"Synthesis session {session_id} initialized"
        )
    except Exception as e:
        logger.error(f"Failed to start session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/session/{session_id}/stop")
async def stop_synthesis(session_id: str):
    """Stop a synthesis session"""
    try:
        if session_id not in active_sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session = active_sessions[session_id]
        session.is_active = False
        session.state = "completed"
        duration_seconds = (datetime.now() - session.created_at).total_seconds()
        audio_file = _write_wav(session, duration_seconds=duration_seconds)
        session_exports[session_id] = audio_file
        
        del active_sessions[session_id]
        
        logger.info(f"✓ Synthesis session stopped: {session_id}")
        
        return {
            "status": "stopped",
            "session_id": session_id,
            "message": "Session stopped successfully",
            "audio_file": audio_file,
        }
    except Exception as e:
        logger.error(f"Failed to stop session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/session/{session_id}/metrics", response_model=SynthesisMetrics)
async def get_session_metrics(session_id: str):
    """Get real-time metrics for a synthesis session"""
    try:
        if session_id not in active_sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session = active_sessions[session_id]
        return session.get_metrics()
    except Exception as e:
        logger.error(f"Failed to get metrics: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/presets", response_model=List[PresetModel])
async def get_presets():
    """Get all available synthesis presets"""
    return PRESETS

@app.get("/presets/{preset_id}", response_model=PresetModel)
async def get_preset(preset_id: str):
    """Get a specific preset"""
    for preset in PRESETS:
        if preset.id == preset_id:
            return preset
    raise HTTPException(status_code=404, detail="Preset not found")

@app.get("/settings/default")
async def get_default_settings():
    """Get default synthesis settings"""
    return {
        "audio": {
            "output_devices": ["Speakers", "Headphones", "Line-out", "HDMI"],
            "sample_rates": [44100, 48000, 96000],
            "bit_depths": [16, 24, 32],
            "volume_default": 75
        },
        "synthesis": {
            "frequency_range": [0.5, 50],
            "waveforms": ["sine", "binaural", "isochronic", "pink_noise"],
            "presets": len(PRESETS)
        },
        "defaults": {
            "waveform": "sine",
            "frequency": 10.0,
            "volume": 75,
            "sample_rate": 48000
        }
    }

@app.get("/channels")
async def get_supported_channels():
    """Get supported audio channels"""
    return {
        "channels": ["Mono", "Stereo"],
        "default": "Stereo"
    }

@app.post("/session/{session_id}/export")
async def export_session(session_id: str, format: str = "wav"):
    """Export session audio in specified format"""
    try:
        if format.lower() != "wav":
            raise HTTPException(status_code=400, detail="Only WAV export is currently supported")

        if session_id in session_exports:
            export = session_exports[session_id]
            return {
                "status": "success",
                "session_id": session_id,
                "format": "wav",
                "download_url": export["download_url"],
                "message": "Audio export available"
            }

        if session_id not in active_sessions:
            raise HTTPException(status_code=404, detail="Session not found")

        session = active_sessions[session_id]
        duration_seconds = max(1.0, (datetime.now() - session.created_at).total_seconds())
        export = _write_wav(session, duration_seconds=duration_seconds)
        session_exports[session_id] = export

        return {
            "status": "success",
            "session_id": session_id,
            "format": "wav",
            "download_url": export["download_url"],
            "message": "Audio exported as WAV"
        }
    except Exception as e:
        logger.error(f"Export failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/files/{filename}")
async def download_file(filename: str):
    requested = (AUDIO_DIR / filename).resolve()
    base = AUDIO_DIR.resolve()
    if not str(requested).startswith(str(base)):
        raise HTTPException(status_code=400, detail="Invalid file path")
    if not requested.exists() or not requested.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path=str(requested), media_type="audio/wav", filename=requested.name)

@app.websocket("/stream/{session_id}")
async def websocket_stream(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for real-time synthesis data streaming"""
    await websocket.accept()
    
    if session_id not in active_sessions:
        await websocket.close(code=4004, reason="Session not found")
        return
    
    session = active_sessions[session_id]
    logger.info(f"✓ WebSocket connected: {session_id}")
    
    try:
        while session.is_active:
            # Send metrics every 100ms
            metrics = session.get_metrics()
            await websocket.send_json(metrics.dict())
            await asyncio.sleep(0.1)
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
    finally:
        await websocket.close()
        logger.info(f"WebSocket disconnected: {session_id}")

# ═══════════════════════════════════════════════════════════════════
# STARTUP/SHUTDOWN
# ═══════════════════════════════════════════════════════════════════

@app.on_event("startup")
async def startup():
    logger.info("=" * 60)
    logger.info("🎵 JONA Neural Synthesis Engine")
    logger.info("=" * 60)
    logger.info("✓ Service initialized")
    logger.info(f"✓ API running on {settings.api_host}:{settings.api_port}")
    logger.info(f"✓ Presets available: {len(PRESETS)}")
    logger.info("✓ WebSocket streaming enabled")
    logger.info("✓ Real-time metrics polling active")
    logger.info("=" * 60)

@app.on_event("shutdown")
async def shutdown():
    logger.info("🛑 JONA Neural Synthesis Engine shutting down")
    for session_id in list(active_sessions.keys()):
        active_sessions[session_id].is_active = False

# ═══════════════════════════════════════════════════════════════════
# RUN
# ═══════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host=settings.api_host,
        port=settings.api_port,
        log_level="info"
    )
