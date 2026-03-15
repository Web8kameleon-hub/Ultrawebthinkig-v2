"""
HYBRID BIOMETRIC API BACKEND
Menaxhimi i të dhënave nga telefon + aparate klinike
"""

from fastapi import FastAPI, HTTPException, Depends, WebSocket, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import json
import asyncio
import logging
from enum import Enum

app = FastAPI(title="Hybrid Biometric API", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger = logging.getLogger(__name__)

# ============================================================================
# MODELS - TELEFON
# ============================================================================

class AccelerometerData(BaseModel):
    x: float
    y: float
    z: float
    timestamp: int


class GyroscopeData(BaseModel):
    x: float
    y: float
    z: float
    timestamp: int


class HeartRateData(BaseModel):
    bpm: float
    confidence: float
    timestamp: int


class TemperatureData(BaseModel):
    celsius: float
    timestamp: int


class ProximityData(BaseModel):
    distance: float
    timestamp: int


class PhoneSensorReading(BaseModel):
    accelerometer: Optional[AccelerometerData] = None
    gyroscope: Optional[GyroscopeData] = None
    heart_rate: Optional[HeartRateData] = None
    temperature: Optional[TemperatureData] = None
    proximity: Optional[ProximityData] = None
    session_id: str
    user_id: str


# ============================================================================
# MODELS - KLINIKA
# ============================================================================

class DeviceType(str, Enum):
    EEG = "EEG"
    ECG = "ECG"
    SPO2 = "SpO2"
    BLOOD_PRESSURE = "BloodPressure"
    TEMPERATURE_PROBE = "TemperatureProbe"
    SPIROMETER = "Spirometer"
    OTHER = "Other"


class ClinicalDeviceReading(BaseModel):
    device_type: DeviceType
    device_id: str
    device_name: str
    clinic_id: str
    value: float | List[float]
    unit: str
    quality: int  # 0-100
    timestamp: int
    metadata: Optional[Dict[str, Any]] = None


class ClinicalDeviceRegistration(BaseModel):
    device_type: DeviceType
    device_id: str
    device_name: str
    clinic_id: str
    api_key: str
    supported_channels: int = 1
    sample_rate: int = 256  # Hz


# ============================================================================
# MODELS - SESSION & INTEGRATION
# ============================================================================

class DataSource(str, Enum):
    PHONE = "phone"
    CLINIC = "clinic"
    HYBRID = "hybrid"


class SyncStatus(str, Enum):
    LOCAL = "local"
    SYNCING = "syncing"
    SYNCED = "synced"


class HybridBiometricSession(BaseModel):
    session_id: str
    user_id: str
    clinic_id: Optional[str] = None
    start_time: int
    end_time: Optional[int] = None
    data_source: DataSource
    sync_status: SyncStatus
    storage_location: str  # "phone", "cloud", "clinic-server"
    phone_readings_count: int = 0
    clinical_readings_count: int = 0


class ClinicIntegrationConfig(BaseModel):
    clinic_id: str
    clinic_name: str
    api_endpoint: str
    api_key: str
    supported_devices: List[DeviceType]
    ws_url: Optional[str] = None
    sync_interval: int = 5000  # ms


# ============================================================================
# STORAGE (in-memory për demo, pastaj DB)
# ============================================================================

sessions_db: Dict[str, HybridBiometricSession] = {}
phone_readings_db: Dict[str, List[PhoneSensorReading]] = {}
clinical_readings_db: Dict[str, List[ClinicalDeviceReading]] = {}
clinic_configs_db: Dict[str, ClinicIntegrationConfig] = {}
registered_devices_db: Dict[str, ClinicalDeviceRegistration] = {}

# Active WebSocket connections për real-time streaming
active_ws_connections: Dict[str, List[WebSocket]] = {}

# ============================================================================
# PHONE SENSOR ENDPOINTS
# ============================================================================

@app.post("/api/phone/sensor-reading")
async def submit_phone_sensor(reading: PhoneSensorReading):
    """
    Marrë lexim nga sensori i telefonit
    """
    session_id = reading.session_id
    user_id = reading.user_id

    # Create session if not exists
    if session_id not in sessions_db:
        sessions_db[session_id] = HybridBiometricSession(
            session_id=session_id,
            user_id=user_id,
            start_time=int(datetime.now().timestamp() * 1000),
            data_source=DataSource.PHONE,
            sync_status=SyncStatus.LOCAL,
            storage_location="phone",
        )

    # Store reading
    if session_id not in phone_readings_db:
        phone_readings_db[session_id] = []

    phone_readings_db[session_id].append(reading)
    sessions_db[session_id].phone_readings_count += 1

    logger.info(f"📱 Phone sensor reading: {user_id} - Session: {session_id}")

    return {"status": "received", "session_id": session_id, "reading_count": len(phone_readings_db[session_id])}


@app.get("/api/phone/session/{session_id}")
async def get_phone_session(session_id: str):
    """
    Get phone sensor data për një sesion
    """
    if session_id not in sessions_db:
        raise HTTPException(status_code=404, detail="Session not found")

    readings = phone_readings_db.get(session_id, [])
    return {
        "session": sessions_db[session_id],
        "readings": readings,
        "count": len(readings),
    }


@app.get("/api/phone/active-sessions")
async def get_active_phone_sessions(user_id: str):
    """
    Get të gjitha sesionet aktive për një përdorues
    """
    user_sessions = [
        s for s in sessions_db.values()
        if s.user_id == user_id and s.end_time is None
    ]
    return {"sessions": user_sessions}


# ============================================================================
# CLINICAL DEVICE ENDPOINTS
# ============================================================================

@app.post("/api/clinic/device/register")
async def register_clinic_device(device: ClinicalDeviceRegistration):
    """
    Regjistro një aparat klinike
    """
    clinic_id = device.clinic_id
    device_id = device.device_id

    # Validate API key (simplified)
    if not device.api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")

    registered_devices_db[device_id] = device

    logger.info(f"🏥 Registered clinic device: {device_id} ({device.device_type}) @ {clinic_id}")

    return {
        "status": "registered",
        "device_id": device_id,
        "message": f"Device {device.device_name} registered successfully",
    }


@app.post("/api/clinic/device/{device_id}/reading")
async def submit_clinical_reading(device_id: str, reading: ClinicalDeviceReading):
    """
    Marrë lexim nga aparat klinike
    """
    if device_id not in registered_devices_db:
        raise HTTPException(status_code=404, detail="Device not registered")

    # Store reading
    if device_id not in clinical_readings_db:
        clinical_readings_db[device_id] = []

    clinical_readings_db[device_id].append(reading)

    # Broadcast to active WebSocket connections
    session_key = f"clinic_{reading.clinic_id}"
    if session_key in active_ws_connections:
        message = json.dumps({
            "type": "clinical_reading",
            "device_id": device_id,
            "device_type": reading.device_type,
            "value": reading.value,
            "unit": reading.unit,
            "quality": reading.quality,
            "timestamp": reading.timestamp,
        })
        for connection in active_ws_connections[session_key]:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Failed to send WS message: {e}")

    logger.info(f"🏥 Clinical reading: {reading.device_type} from {device_id}")

    return {
        "status": "received",
        "device_id": device_id,
        "reading_count": len(clinical_readings_db[device_id]),
    }


@app.get("/api/clinic/device/{device_id}/latest")
async def get_latest_clinical_reading(device_id: str):
    """
    Get leximin më të fundit nga një aparat
    """
    if device_id not in clinical_readings_db or not clinical_readings_db[device_id]:
        return {"status": "no_data"}

    latest = clinical_readings_db[device_id][-1]
    return latest


@app.get("/api/clinic/readings/{clinic_id}")
async def get_clinic_readings(clinic_id: str, device_type: Optional[DeviceType] = None):
    """
    Get të gjitha leximet e fundit për një klinikë
    """
    readings = []
    for device_id, device_readings in clinical_readings_db.items():
        if device_id in registered_devices_db:
            reg_device = registered_devices_db[device_id]
            if reg_device.clinic_id == clinic_id:
                if device_type is None or reg_device.device_type == device_type:
                    if device_readings:
                        readings.append(device_readings[-1])

    return {"clinic_id": clinic_id, "readings": readings, "count": len(readings)}


# ============================================================================
# HYBRID SESSION ENDPOINTS
# ============================================================================

@app.post("/api/session/start-hybrid")
async def start_hybrid_session(
    user_id: str,
    clinic_id: Optional[str] = None,
    data_source: DataSource = DataSource.HYBRID,
):
    """
    Fillo një sesion hibrid (telefon + klinikë)
    """
    session_id = f"session_{user_id}_{int(datetime.now().timestamp() * 1000)}"

    session = HybridBiometricSession(
        session_id=session_id,
        user_id=user_id,
        clinic_id=clinic_id,
        start_time=int(datetime.now().timestamp() * 1000),
        data_source=data_source,
        sync_status=SyncStatus.LOCAL,
        storage_location="phone",
    )

    sessions_db[session_id] = session
    phone_readings_db[session_id] = []

    logger.info(f"🔗 Started hybrid session: {session_id} for {user_id}")

    return {"session": session, "status": "started"}


@app.post("/api/session/{session_id}/stop")
async def stop_hybrid_session(session_id: str):
    """
    Mbyll një sesion
    """
    if session_id not in sessions_db:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions_db[session_id]
    session.end_time = int(datetime.now().timestamp() * 1000)
    session.sync_status = SyncStatus.SYNCED

    phone_count = len(phone_readings_db.get(session_id, []))
    clinical_count = session.clinical_readings_count

    logger.info(f"🔗 Stopped session: {session_id} - Phone: {phone_count}, Clinical: {clinical_count}")

    return {
        "session": session,
        "phone_readings": phone_count,
        "clinical_readings": clinical_count,
    }


@app.get("/api/session/{session_id}")
async def get_hybrid_session(session_id: str):
    """
    Get detajet e një sesioni hibrid
    """
    if session_id not in sessions_db:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions_db[session_id]
    phone_readings = phone_readings_db.get(session_id, [])

    return {
        "session": session,
        "phone_readings": phone_readings,
        "phone_count": len(phone_readings),
        "clinical_count": session.clinical_readings_count,
    }


@app.get("/api/user/{user_id}/sessions")
async def get_user_sessions(user_id: str):
    """
    Get të gjitha sesionet për një përdorues
    """
    user_sessions = [s for s in sessions_db.values() if s.user_id == user_id]
    return {"user_id": user_id, "sessions": user_sessions, "count": len(user_sessions)}


# ============================================================================
# CLINIC INTEGRATION ENDPOINTS
# ============================================================================

@app.post("/api/clinic/register")
async def register_clinic(config: ClinicIntegrationConfig):
    """
    Regjistro një klinikë
    """
    clinic_id = config.clinic_id
    clinic_configs_db[clinic_id] = config

    logger.info(f"🏥 Registered clinic: {config.clinic_name}")

    return {
        "status": "registered",
        "clinic_id": clinic_id,
        "clinic_name": config.clinic_name,
    }


@app.get("/api/clinic/{clinic_id}/config")
async def get_clinic_config(clinic_id: str):
    """
    Get konfigurimin e një klinike
    """
    if clinic_id not in clinic_configs_db:
        raise HTTPException(status_code=404, detail="Clinic not found")

    return clinic_configs_db[clinic_id]


@app.get("/api/clinic/{clinic_id}/devices")
async def get_clinic_devices(clinic_id: str):
    """
    Get të gjitha aparatet e një klinike
    """
    devices = [
        d for d in registered_devices_db.values()
        if d.clinic_id == clinic_id
    ]
    return {"clinic_id": clinic_id, "devices": devices, "count": len(devices)}


# ============================================================================
# WEBSOCKET - REAL-TIME STREAMING
# ============================================================================

@app.websocket("/ws/clinic/{clinic_id}/stream")
async def websocket_clinic_stream(websocket: WebSocket, clinic_id: str):
    """
    Real-time WebSocket stream për leximet klinike
    """
    await websocket.accept()
    session_key = f"clinic_{clinic_id}"

    if session_key not in active_ws_connections:
        active_ws_connections[session_key] = []

    active_ws_connections[session_key].append(websocket)

    logger.info(f"📡 WebSocket connected for clinic: {clinic_id}")

    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        active_ws_connections[session_key].remove(websocket)
        if not active_ws_connections[session_key]:
            del active_ws_connections[session_key]


# ============================================================================
# ANALYTICS ENDPOINTS
# ============================================================================

@app.get("/api/analytics/session/{session_id}")
async def get_session_analytics(session_id: str):
    """
    Analiza të dhënash për një sesion
    """
    if session_id not in sessions_db:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions_db[session_id]
    phone_readings = phone_readings_db.get(session_id, [])

    # Calculate stats
    if phone_readings:
        bpms = [r.heart_rate.bpm for r in phone_readings if r.heart_rate]
        temps = [r.temperature.celsius for r in phone_readings if r.temperature]

        heart_rate_avg = sum(bpms) / len(bpms) if bpms else 0
        temp_avg = sum(temps) / len(temps) if temps else 0

        return {
            "session_id": session_id,
            "duration_ms": (session.end_time or datetime.now().timestamp() * 1000) - session.start_time,
            "heart_rate": {
                "avg": heart_rate_avg,
                "min": min(bpms) if bpms else 0,
                "max": max(bpms) if bpms else 0,
            },
            "temperature": {
                "avg": temp_avg,
                "min": min(temps) if temps else 0,
                "max": max(temps) if temps else 0,
            },
            "readings_count": len(phone_readings),
        }

    return {"error": "No phone readings"}


@app.get("/api/clinic/{clinic_id}/analytics")
async def get_clinic_analytics(clinic_id: str):
    """
    Analiza për një klinikë
    """
    clinic_devices = [
        d for d in registered_devices_db.values()
        if d.clinic_id == clinic_id
    ]

    device_stats = []
    for device in clinic_devices:
        readings = clinical_readings_db.get(device.device_id, [])
        if readings:
            values = [r.value for r in readings if isinstance(r.value, (int, float))]
            device_stats.append({
                "device_id": device.device_id,
                "device_name": device.device_name,
                "device_type": device.device_type,
                "latest_reading": readings[-1],
                "avg_value": sum(values) / len(values) if values else 0,
                "readings_count": len(readings),
            })

    return {
        "clinic_id": clinic_id,
        "devices_count": len(clinic_devices),
        "device_stats": device_stats,
    }


# ============================================================================
# HEALTH CHECK
# ============================================================================

@app.get("/health")
async def health_check():
    """
    Health check endpoint
    """
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "sessions": len(sessions_db),
        "registered_devices": len(registered_devices_db),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001)
