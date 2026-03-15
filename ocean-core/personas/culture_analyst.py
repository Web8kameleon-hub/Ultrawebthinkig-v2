from typing import Dict, Any


class CultureAnalyst:
    name = "Culture Analyst"
    domain = "culture"

    def answer(self, q: str, ext: Dict[str, Any]) -> str:
        wiki = ext.get("wikipedia", "")
        
        return (
            f"🎭 {self.name}\n"
            f"Pyetja: {q}\n"
            f"- Wikipedia: {wiki}\n"
            f"- Fokus: kulturë, traditë, art, simbiolikë shoqërore.\n"
        )
