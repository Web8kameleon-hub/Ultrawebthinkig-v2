from typing import Dict, Any, List


class AGIAnalyst:
    name = "AGI Systems Analyst"
    domain = "agi_systems"

    def answer(self, q: str, internal: Dict[str, Any]) -> str:
        agents = internal.get("agents", [])
        agents_str = ", ".join(agents) if agents else "none"
        
        return (
            f"🧠 {self.name}\n"
            f"Pyetja: {q}\n"
            f"- Agjentë aktivë: {agents_str}\n"
            f"- Fokus: sisteme kognitive, inteligjencë e përgjithshme, autonomi.\n"
        )
