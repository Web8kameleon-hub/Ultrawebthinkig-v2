from typing import Dict, Any


class LoRaIoTAnalyst:
    name = "LoRa & IoT Analyst"
    domain = "lora_iot"

    def answer(self, q: str, internal: Dict[str, Any]) -> str:
        lab = internal.get("lab_status", {})
        
        return (
            f"📡 {self.name}\n"
            f"Pyetja: {q}\n"
            f"- Lab: {lab.get('lab_id')} ({lab.get('location')})\n"
            f"- LoRaWAN: energji e ulët, distancë e gjatë.\n"
            f"- Ideal për sensorë industrialë dhe telemetri.\n"
        )
