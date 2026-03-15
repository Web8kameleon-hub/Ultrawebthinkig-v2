"""
OCEAN USER CONTEXT - Lidh Ocean me përdoruesin
==============================================

Ky modul merr profilin e userit dhe e shton në kontekstin e Ocean.
Kështu Ocean di me kë po flet.

Author: Ledjan Ahmati (CEO, ABA GmbH)
"""

import logging
import os
from dataclasses import dataclass
from typing import Optional

import httpx

logger = logging.getLogger("ocean_user_context")

# User Management service URL
USER_SERVICE_URL = os.getenv("USER_SERVICE_URL", "http://localhost:8070")


@dataclass
class UserContext:
    """Konteksti i userit për Ocean"""
    user_id: str
    email: str
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    display_name: Optional[str] = None
    language: str = "en"
    plan: str = "free"
    role: str = "user"
    clerk_id: Optional[str] = None
    
    @property
    def greeting_name(self) -> str:
        """Emri për përshëndetje"""
        if self.first_name:
            return self.first_name
        if self.display_name:
            return self.display_name
        if self.username:
            return self.username
        return "përdorues"
    
    @property
    def is_admin(self) -> bool:
        return self.role in ["admin", "superadmin"]
    
    @property
    def is_premium(self) -> bool:
        return self.plan in ["pro", "professional", "enterprise"]
    
    def to_prompt_context(self) -> str:
        """Gjenero kontekst për system prompt"""
        parts = []
        
        # Greeting
        parts.append(f"Po flet me: {self.greeting_name}")
        
        # Plan info
        plan_names = {
            "free": "Free (falas)",
            "starter": "Starter",
            "standard": "Standard",
            "pro": "Pro",
            "professional": "Professional",
            "enterprise": "Enterprise"
        }
        parts.append(f"Plani: {plan_names.get(self.plan, self.plan)}")
        
        # Language preference
        lang_names = {
            "sq": "Shqip",
            "en": "English",
            "de": "Deutsch",
            "it": "Italiano"
        }
        parts.append(f"Gjuha e preferuar: {lang_names.get(self.language, self.language)}")
        
        # Admin badge
        if self.is_admin:
            parts.append("🛡️ Admin access")
        
        return "\n".join(parts)


async def get_user_from_clerk_id(clerk_id: str) -> Optional[UserContext]:
    """Merr userin nga Clerk ID"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{USER_SERVICE_URL}/api/users/by-clerk/{clerk_id}"
            )
            if response.status_code == 200:
                data = response.json()
                return UserContext(
                    user_id=data.get("user_id", ""),
                    email=data.get("email", ""),
                    username=data.get("username"),
                    first_name=data.get("first_name"),
                    last_name=data.get("last_name"),
                    display_name=data.get("display_name"),
                    language=data.get("language", "en"),
                    plan=data.get("plan", "free"),
                    role=data.get("role", "user"),
                    clerk_id=clerk_id
                )
    except Exception as e:
        logger.warning(f"Could not fetch user from Clerk ID: {e}")
    return None


async def get_user_from_api_key(api_key: str) -> Optional[UserContext]:
    """Merr userin nga API key"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{USER_SERVICE_URL}/api/users/me/info",
                headers={"X-API-Key": api_key}
            )
            if response.status_code == 200:
                data = response.json()
                return UserContext(
                    user_id=data.get("user_id", ""),
                    email=data.get("email", ""),
                    username=data.get("username"),
                    first_name=data.get("first_name"),
                    last_name=data.get("last_name"),
                    display_name=data.get("display_name"),
                    language=data.get("language", "en"),
                    plan=data.get("plan", "free"),
                    role=data.get("role", "user")
                )
    except Exception as e:
        logger.warning(f"Could not fetch user from API key: {e}")
    return None


def create_anonymous_context(ip_address: str = "anonymous") -> UserContext:
    """Krijo kontekst anonim për userit pa login"""
    return UserContext(
        user_id=f"anon_{ip_address}",
        email="",
        username=None,
        first_name=None,
        language="sq",  # Default shqip
        plan="free",
        role="guest"
    )


def build_personalized_prompt(base_prompt: str, user: UserContext) -> str:
    """Shto kontekstin e userit në prompt"""
    user_section = f"""
═══════════════════════════════════════════════════════════════════════════════
 KONTEKSTI I PËRDORUESIT AKTUAL
═══════════════════════════════════════════════════════════════════════════════

{user.to_prompt_context()}

UDHËZIME TË VEÇANTA:
• Përshëndete me emër kur është e përshtatshme
• Përdor gjuhën e preferuar të userit
• Nëse është FREE user, mund të sugjerosh upgrade kur ka sens
• Nëse është Admin, jep akses të plotë të informacionit

═══════════════════════════════════════════════════════════════════════════════
"""
    return base_prompt + user_section
