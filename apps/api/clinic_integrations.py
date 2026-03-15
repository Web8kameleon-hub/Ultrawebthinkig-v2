"""
CLINIC INTEGRATION EXAMPLES
Shembuj real të integrimit me klinike të ndryshme
"""

from typing import List, Dict, Any
import asyncio
import time
from datetime import datetime

# ============================================================================
# EMOTIV EPOC+ EEG INTEGRATION
# ============================================================================

class EmotivEPOCIntegration:
    """
    Integrimi me headset-in EEG Emotiv EPOC+
    14 channels, 256 Hz sampling rate
    """

    def __init__(self, clinic_id: str):
        self.clinic_id = clinic_id
        self.device_id = "emotiv_epoc_001"
        self.channels = 14
        self.sample_rate = 256
        self.channel_names = [
            "AF3", "F7", "F3", "FC5", "T7",
            "P7", "O1", "O2", "P8", "T8",
            "FC6", "F4", "F8", "AF4"
        ]

    async def stream_eeg_data(self):
        """
        Stream EEG data në real-time
        """
        reading_count = 0

        while True:
            # Simulim të dhënash EEG (në praktikë, këto do të vinin nga headset-i)
            eeg_values = [
                50.5 + i * 0.5 + (hash(str(time.time() + i)) % 100) / 100
                for i in range(self.channels)
            ]

            reading = {
                "device_type": "EEG",
                "device_id": self.device_id,
                "device_name": "Emotiv EPOC+ EEG Headset",
                "clinic_id": self.clinic_id,
                "value": eeg_values,
                "unit": "μV",
                "quality": 90 + (hash(str(time.time())) % 10),
                "timestamp": int(time.time() * 1000),
                "metadata": {
                    "channels": self.channels,
                    "sample_rate": self.sample_rate,
                    "channel_names": self.channel_names,
                    "markers": self._detect_markers(eeg_values),
                },
            }

            reading_count += 1
            yield reading

            # 256 Hz = 3.9ms per sample
            await asyncio.sleep(0.004)

    def _detect_markers(self, eeg_values: List[float]) -> Dict[str, str]:
        """
        Detektim i shënimit të aktivitetit neural
        """
        avg = sum(eeg_values) / len(eeg_values)

        if avg > 55:
            return {"state": "alert", "band": "beta"}
        elif avg > 45:
            return {"state": "relaxed", "band": "alpha"}
        else:
            return {"state": "drowsy", "band": "theta"}


# ============================================================================
# POLAR H10 ECG INTEGRATION
# ============================================================================

class PolarH10Integration:
    """
    Integrimi me Polar H10 Heart Rate Monitor
    Single channel ECG, 130 Hz sampling rate
    """

    def __init__(self, clinic_id: str):
        self.clinic_id = clinic_id
        self.device_id = "polar_h10_001"
        self.sample_rate = 130
        self.base_hr = 70

    async def stream_ecg_data(self):
        """
        Stream ECG data në real-time
        """
        phase = 0

        while True:
            # Simulim ECG waveform (PQRST)
            ecg_value = self._generate_ecg_waveform(phase)

            reading = {
                "device_type": "ECG",
                "device_id": self.device_id,
                "device_name": "Polar H10 Heart Rate Monitor",
                "clinic_id": self.clinic_id,
                "value": ecg_value,
                "unit": "mV",
                "quality": 95 + (hash(str(time.time())) % 5),
                "timestamp": int(time.time() * 1000),
                "metadata": {
                    "sample_rate": self.sample_rate,
                    "heart_rate": self.base_hr + (hash(str(time.time())) % 10),
                    "rr_interval": 60000 // (self.base_hr + 5),
                },
            }

            yield reading
            phase += 1
            await asyncio.sleep(1 / self.sample_rate)

    def _generate_ecg_waveform(self, phase: int) -> float:
        """
        Generate synthetic ECG waveform
        """
        import math

        # PQRST cycle
        cycle_phase = (phase % 130) / 130 * (2 * math.pi)

        # P wave
        p_wave = 0.2 * math.sin(cycle_phase * 5) if 0 < cycle_phase < math.pi / 5 else 0

        # QRS complex
        qrs = (
            1.5 * math.sin(cycle_phase) if math.pi / 3 < cycle_phase < 2 * math.pi / 3
            else 0
        )

        # T wave
        t_wave = (
            0.3 * math.sin(cycle_phase - math.pi) 
            if 4 * math.pi / 5 < cycle_phase < 6 * math.pi / 5 else 0
        )

        return p_wave + qrs + t_wave


# ============================================================================
# PULSE OXIMETER INTEGRATION (SpO2)
# ============================================================================

class PulseOximeterIntegration:
    """
    Integrimi me Pulse Oximeter
    SpO2 (Oxygen Saturation) + Heart Rate
    """

    def __init__(self, clinic_id: str):
        self.clinic_id = clinic_id
        self.device_id = "pulse_ox_001"
        self.base_spo2 = 98

    async def stream_spo2_data(self):
        """
        Stream SpO2 data
        """
        while True:
            # Normal SpO2: 95-100%
            spo2_value = self.base_spo2 - (hash(str(time.time())) % 3)

            reading = {
                "device_type": "SpO2",
                "device_id": self.device_id,
                "device_name": "Pulse Oximeter",
                "clinic_id": self.clinic_id,
                "value": spo2_value,
                "unit": "%",
                "quality": 90 + (hash(str(time.time())) % 10),
                "timestamp": int(time.time() * 1000),
                "metadata": {
                    "measurement_site": "finger",
                    "perfusion_index": 4.5 + (hash(str(time.time())) % 10) / 10,
                },
            }

            yield reading
            await asyncio.sleep(1)  # Update every 1 second


# ============================================================================
# BLOOD PRESSURE MONITOR INTEGRATION
# ============================================================================

class BloodPressureIntegration:
    """
    Integrimi me Blood Pressure Monitor
    Systolic/Diastolic
    """

    def __init__(self, clinic_id: str):
        self.clinic_id = clinic_id
        self.device_id = "bp_monitor_001"
        self.base_systolic = 120
        self.base_diastolic = 80

    async def stream_bp_data(self):
        """
        Stream blood pressure data
        """
        while True:
            # Normal BP: 120/80 mmHg
            systolic = self.base_systolic + (hash(str(time.time())) % 10) - 5
            diastolic = self.base_diastolic + (hash(str(time.time())) % 8) - 4

            reading = {
                "device_type": "BloodPressure",
                "device_id": self.device_id,
                "device_name": "Omron BP Monitor",
                "clinic_id": self.clinic_id,
                "value": [systolic, diastolic],  # [systolic, diastolic]
                "unit": "mmHg",
                "quality": 92 + (hash(str(time.time())) % 8),
                "timestamp": int(time.time() * 1000),
                "metadata": {
                    "pulse": 70 + (hash(str(time.time())) % 10),
                    "measurement_site": "left_arm",
                },
            }

            yield reading
            await asyncio.sleep(5)  # Update every 5 seconds


# ============================================================================
# TEMPERATURE PROBE INTEGRATION
# ============================================================================

class TemperatureProbeIntegration:
    """
    Integrimi me temperatura probe
    Passive ose digital probe
    """

    def __init__(self, clinic_id: str, measurement_site: str = "oral"):
        self.clinic_id = clinic_id
        self.device_id = "temp_probe_001"
        self.measurement_site = measurement_site
        self.base_temperature = 36.8

    async def stream_temperature_data(self):
        """
        Stream temperature data
        """
        while True:
            # Body temperature: 36.5-37.5°C
            temperature = self.base_temperature + (hash(str(time.time())) % 5) / 10 - 0.25

            reading = {
                "device_type": "TemperatureProbe",
                "device_id": self.device_id,
                "device_name": "Digital Temperature Probe",
                "clinic_id": self.clinic_id,
                "value": round(temperature, 1),
                "unit": "°C",
                "quality": 98,
                "timestamp": int(time.time() * 1000),
                "metadata": {
                    "measurement_site": self.measurement_site,
                    "probe_type": "digital_infrared",
                },
            }

            yield reading
            await asyncio.sleep(2)  # Update every 2 seconds


# ============================================================================
# SPIROMETER INTEGRATION (Lung Function)
# ============================================================================

class SpirometerIntegration:
    """
    Integrimi me Spirometer
    Lung function testing
    """

    def __init__(self, clinic_id: str):
        self.clinic_id = clinic_id
        self.device_id = "spirometer_001"
        self.base_fev1 = 3.5  # Liters

    async def stream_spirometer_data(self):
        """
        Stream spirometer data
        """
        measurement_count = 0

        while True:
            # FEV1: Forced Expiratory Volume in 1 second
            fev1 = self.base_fev1 - (hash(str(time.time() + measurement_count)) % 5) / 10

            reading = {
                "device_type": "Spirometer",
                "device_id": self.device_id,
                "device_name": "MGC Ultima Spirometer",
                "clinic_id": self.clinic_id,
                "value": [
                    fev1,  # FEV1
                    4.2,   # FVC (Forced Vital Capacity)
                    fev1 / 4.2,  # FEV1/FVC ratio
                ],
                "unit": "L",
                "quality": 93 + (hash(str(time.time())) % 7),
                "timestamp": int(time.time() * 1000),
                "metadata": {
                    "parameters": ["FEV1", "FVC", "FEV1_FVC_Ratio"],
                    "measurement_number": measurement_count,
                },
            }

            measurement_count += 1
            yield reading
            await asyncio.sleep(3)


# ============================================================================
# MULTI-DEVICE CLINIC SETUP
# ============================================================================

class UniversityClinincMultiDeviceSetup:
    """
    Setup komplet për një klinikë universitare
    Me shumë aparate duke punuar në të njëjtën kohë
    """

    def __init__(self, clinic_id: str = "uniClinic_001"):
        self.clinic_id = clinic_id
        self.devices = {
            "eeg": EmotivEPOCIntegration(clinic_id),
            "ecg": PolarH10Integration(clinic_id),
            "spo2": PulseOximeterIntegration(clinic_id),
            "bp": BloodPressureIntegration(clinic_id),
            "temperature": TemperatureProbeIntegration(clinic_id),
            "spirometer": SpirometerIntegration(clinic_id),
        }

    async def stream_all_devices(self):
        """
        Stream data nga të gjithë aparatet në të njëjtën kohë
        """
        # Create async generators for each device
        eeg_gen = self.devices["eeg"].stream_eeg_data()
        ecg_gen = self.devices["ecg"].stream_ecg_data()
        spo2_gen = self.devices["spo2"].stream_spo2_data()
        bp_gen = self.devices["bp"].stream_bp_data()
        temp_gen = self.devices["temperature"].stream_temperature_data()
        spiro_gen = self.devices["spirometer"].stream_spirometer_data()

        # Run all in parallel and yield readings
        async def gen_wrapper(gen, device_type):
            async for reading in gen:
                yield reading

        while True:
            try:
                # Get readings from all devices
                eeg_reading = await gen_wrapper(eeg_gen, "eeg").__anext__()
                ecg_reading = await gen_wrapper(ecg_gen, "ecg").__anext__()
                spo2_reading = await gen_wrapper(spo2_gen, "spo2").__anext__()

                yield eeg_reading
                yield ecg_reading
                yield spo2_reading

                # Less frequent readings
                if int(time.time()) % 5 == 0:
                    bp_reading = await gen_wrapper(bp_gen, "bp").__anext__()
                    temp_reading = await gen_wrapper(temp_gen, "temp").__anext__()
                    yield bp_reading
                    yield temp_reading

            except Exception as e:
                print(f"Error streaming: {e}")
                await asyncio.sleep(1)

    def get_device_status(self) -> Dict[str, str]:
        """
        Get status i të gjithë aparateve
        """
        return {
            "eeg": "connected",
            "ecg": "connected",
            "spo2": "connected",
            "bp": "ready",
            "temperature": "ready",
            "spirometer": "ready",
        }

    def get_device_specs(self) -> Dict[str, Dict[str, Any]]:
        """
        Get specifications të të gjithë aparateve
        """
        return {
            "eeg": {
                "name": "Emotiv EPOC+",
                "channels": 14,
                "sample_rate": 256,
                "bandwidth": "0.5-100 Hz",
            },
            "ecg": {
                "name": "Polar H10",
                "channels": 1,
                "sample_rate": 130,
                "bandwidth": "0.5-200 Hz",
            },
            "spo2": {
                "name": "Pulse Oximeter",
                "measurement": "SpO2 + HR",
                "accuracy": "±2%",
            },
            "bp": {
                "name": "Omron BP Monitor",
                "measurement": "Systolic/Diastolic",
                "accuracy": "±3 mmHg",
            },
            "temperature": {
                "name": "Digital Probe",
                "measurement": "Body Temperature",
                "range": "32-42°C",
            },
            "spirometer": {
                "name": "MGC Ultima",
                "measurements": "FEV1, FVC",
                "accuracy": "±3%",
            },
        }


# ============================================================================
# EXAMPLE USAGE
# ============================================================================

async def main():
    """
    Example: Run a complete clinic setup
    """
    clinic = UniversityClinincMultiDeviceSetup("uniClinic_001")

    print("🏥 University Clinic Multi-Device Setup")
    print("=" * 50)
    print(f"Status: {clinic.get_device_status()}")
    print("\nDevice Specifications:")
    for device, specs in clinic.get_device_specs().items():
        print(f"  • {device.upper()}: {specs}")

    print("\nStarting data collection...")
    print("-" * 50)

    # Stream data from one device as example
    eeg = clinic.devices["eeg"]
    async for reading in eeg.stream_eeg_data():
        print(f"📊 EEG Reading: {reading['metadata']['markers']['state']}")
        print(f"   Quality: {reading['quality']}%")
        print(f"   Timestamp: {datetime.fromtimestamp(reading['timestamp']/1000)}")

        # Just show a few readings for demo
        if int(time.time()) % 10 == 0:
            break


if __name__ == "__main__":
    asyncio.run(main())
