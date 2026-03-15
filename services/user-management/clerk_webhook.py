"""
CLERK WEBHOOK HANDLER - Sinkronizimi i përdoruesve nga Clerk
=============================================================

Ky modul merr webhook events nga Clerk dhe sinkronizon përdoruesit
me UserRegistry lokale.

Events që trajtohen:
- user.created: Krijon user në backend
- user.updated: Përditëson profilin
- user.deleted: Fshin/deaktivizon userin

Author: Ledjan Ahmati (CEO, ABA GmbH)
"""

import hashlib
import hmac
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel
from user_core import (
    SubscriptionPlan,
    UserRegistry,
    get_user_registry,
)

logger = logging.getLogger("clerk_webhook")

# Clerk webhook secret (from environment)

CLERK_WEBHOOK_SECRET = os.getenv("CLERK_WEBHOOK_SECRET", "")

router = APIRouter(prefix="/webhooks/clerk", tags=["Clerk Webhooks"])


# ═══════════════════════════════════════════════════════════════════════════════
# PYDANTIC MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class ClerkUserData(BaseModel):
    """Të dhënat e userit nga Clerk"""
    id: str
    email_addresses: list = []
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    image_url: Optional[str] = None
    created_at: Optional[int] = None
    updated_at: Optional[int] = None
    public_metadata: Dict[str, Any] = {}
    private_metadata: Dict[str, Any] = {}


class ClerkWebhookEvent(BaseModel):
    """Eventi i webhook nga Clerk"""
    type: str
    data: Dict[str, Any]


# ═══════════════════════════════════════════════════════════════════════════════
# SIGNATURE VERIFICATION
# ═══════════════════════════════════════════════════════════════════════════════

def verify_clerk_signature(payload: bytes, signature: str, secret: str) -> bool:
    """
    Verifikon që webhook vjen vërtet nga Clerk.
    
    Clerk përdor SVIX për webhooks - formati i signature:
    v1,<signature>
    """
    if not secret:
        logger.warning("⚠️ CLERK_WEBHOOK_SECRET not configured - skipping verification")
        return True  # In development, allow without verification
    
    try:
        # Clerk/SVIX format: "v1,<signature>"
        parts = signature.split(",")
        if len(parts) < 2:
            return False
        
        expected_sig = parts[1]
        
        # HMAC-SHA256
        computed = hmac.new(
            secret.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(computed, expected_sig)
    except Exception as e:
        logger.error(f"Signature verification error: {e}")
        return False


# ═══════════════════════════════════════════════════════════════════════════════
# WEBHOOK HANDLERS
# ═══════════════════════════════════════════════════════════════════════════════

def handle_user_created(data: Dict[str, Any], registry: UserRegistry) -> Dict[str, Any]:
    """
    Trajto user.created event.
    Krijon user të ri në backend kur dikush regjistrohet në Clerk.
    """
    clerk_id = data.get("id", "")
    emails = data.get("email_addresses", [])
    primary_email = emails[0]["email_address"] if emails else f"{clerk_id}@clerk.user"
    
    username = data.get("username") or clerk_id[:12]
    first_name = data.get("first_name", "")
    last_name = data.get("last_name", "")
    
    # Check if user already exists
    existing = registry.get_user_by_email(primary_email)
    if existing:
        logger.info(f"User {primary_email} already exists, updating clerk_id")
        # Update existing user with clerk_id
        registry.update_user_metadata(existing["user_id"], {"clerk_id": clerk_id})
        return {"action": "updated", "user_id": existing["user_id"]}
    
    # Register new user
    result = registry.register_user(
        email=primary_email,
        username=username,
        password=f"clerk_{clerk_id}",  # Password not used with Clerk
        first_name=first_name,
        last_name=last_name,
        plan=SubscriptionPlan.FREE
    )
    
    if result["success"]:
        user_id = result["user_id"]
        
        # Update with Clerk metadata
        registry.update_user_metadata(user_id, {
            "clerk_id": clerk_id,
            "auth_provider": "clerk",
            "avatar_url": data.get("image_url", "")
        })
        
        # Activate immediately (Clerk handles email verification)
        registry.activate_user(user_id)
        
        logger.info(f"✅ Created user from Clerk: {primary_email} (ID: {user_id})")
        return {"action": "created", "user_id": user_id}
    else:
        logger.error(f"❌ Failed to create user: {result.get('error')}")
        return {"action": "error", "error": result.get("error")}


def handle_user_updated(data: Dict[str, Any], registry: UserRegistry) -> Dict[str, Any]:
    """
    Trajto user.updated event.
    Përditëson profilin kur useri ndryshon diçka në Clerk.
    """
    clerk_id = data.get("id", "")
    
    # Find user by clerk_id
    user = registry.find_by_clerk_id(clerk_id)
    if not user:
        # User doesn't exist, create them
        return handle_user_created(data, registry)
    
    user_id = user["user_id"]
    
    # Update profile fields
    updates = {}
    if data.get("first_name"):
        updates["first_name"] = data["first_name"]
    if data.get("last_name"):
        updates["last_name"] = data["last_name"]
    if data.get("username"):
        updates["username"] = data["username"]
    if data.get("image_url"):
        updates["avatar_url"] = data["image_url"]
    
    if updates:
        registry.update_profile(user_id, **updates)
        logger.info(f"✅ Updated user from Clerk: {user_id}")
    
    return {"action": "updated", "user_id": user_id}


def handle_user_deleted(data: Dict[str, Any], registry: UserRegistry) -> Dict[str, Any]:
    """
    Trajto user.deleted event.
    Deaktivon userin kur fshihet nga Clerk.
    """
    clerk_id = data.get("id", "")
    
    user = registry.find_by_clerk_id(clerk_id)
    if not user:
        return {"action": "not_found"}
    
    user_id = user["user_id"]
    registry.delete_user(user_id)
    
    logger.info(f"✅ Deleted user from Clerk: {user_id}")
    return {"action": "deleted", "user_id": user_id}


# ═══════════════════════════════════════════════════════════════════════════════
# API ENDPOINT
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("")
async def clerk_webhook(
    request: Request,
    svix_id: Optional[str] = Header(None, alias="svix-id"),
    svix_timestamp: Optional[str] = Header(None, alias="svix-timestamp"),
    svix_signature: Optional[str] = Header(None, alias="svix-signature"),
):
    """
    📥 Clerk Webhook Endpoint
    
    Merr events nga Clerk kur:
    - User regjistrohet (user.created)
    - User përditëson profilin (user.updated)
    - User fshihet (user.deleted)
    
    Kjo mundëson sinkronizim të plotë mes Clerk dhe backend.
    """
    # Get raw body for signature verification
    body = await request.body()
    
    # Verify signature
    if svix_signature and CLERK_WEBHOOK_SECRET:
        if not verify_clerk_signature(body, svix_signature, CLERK_WEBHOOK_SECRET):
            logger.warning("❌ Invalid webhook signature")
            raise HTTPException(status_code=401, detail="Invalid signature")
    
    # Parse event
    try:
        event_data = json.loads(body)
        event_type = event_data.get("type", "")
        data = event_data.get("data", {})
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    
    logger.info(f"📥 Clerk webhook: {event_type}")
    
    # Get registry
    registry = get_user_registry()
    
    # Handle event
    result = {"event": event_type, "processed": False}
    
    if event_type == "user.created":
        result = handle_user_created(data, registry)
        result["processed"] = True
        
    elif event_type == "user.updated":
        result = handle_user_updated(data, registry)
        result["processed"] = True
        
    elif event_type == "user.deleted":
        result = handle_user_deleted(data, registry)
        result["processed"] = True
        
    elif event_type == "session.created":
        # User logged in - can track for analytics
        logger.info(f"📊 Session created for user: {data.get('user_id')}")
        result["processed"] = True
        
    else:
        logger.info(f"ℹ️ Unhandled event type: {event_type}")
    
    return {
        "success": True,
        "event": event_type,
        **result
    }


@router.get("/health")
async def webhook_health():
    """Health check for webhook endpoint"""
    return {
        "status": "healthy",
        "webhook_secret_configured": bool(CLERK_WEBHOOK_SECRET),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
