#!/usr/bin/env python3
"""
Clisonix Developer Portal
------------------------
Dashboard for API key management, usage tracking, and billing
Runs on port 8005
"""

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

import httpx
from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("DevPortal")

PORT = int(os.getenv("DEV_PORTAL_PORT", "8005"))
MARKETPLACE_URL = os.getenv("MARKETPLACE_URL", "http://localhost:8004")
ANALYTICS_URL = os.getenv("ANALYTICS_URL", "http://localhost:8006")

# ═══════════════════════════════════════════════════════════════════════════════
# APP SETUP
# ═══════════════════════════════════════════════════════════════════════════════

app = FastAPI(
    title="Clisonix Developer Portal",
    description="Manage API keys, usage, and billing",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ═══════════════════════════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class APIKeyResponse(BaseModel):
    """API Key info"""
    key_id: str
    prefix: str
    name: str
    plan: str
    created_at: str
    last_used: Optional[str] = None
    expires_at: Optional[str] = None
    is_active: bool

class UsageStats(BaseModel):
    """Usage statistics"""
    requests_today: int
    requests_limit: int
    requests_remaining: int
    reset_time: str
    requests_this_month: int
    top_endpoints: Dict[str, int]

class BillingInfo(BaseModel):
    """Billing information"""
    user_id: str
    plan: str
    price_eur: float
    next_billing_date: str
    status: str
    auto_renew: bool

# ═══════════════════════════════════════════════════════════════════════════════
# DEPENDENCIES
# ═══════════════════════════════════════════════════════════════════════════════

async def get_user_token(authorization: str = Header(None)) -> str:
    """Get user token from header"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")
    return authorization.replace("Bearer ", "")

# ═══════════════════════════════════════════════════════════════════════════════
# HEALTH CHECK
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/health")
async def health():
    """Health check"""
    return {
        "status": "healthy",
        "service": "developer-portal",
        "port": PORT,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

# ═══════════════════════════════════════════════════════════════════════════════
# DASHBOARD ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/", response_class=HTMLResponse)
async def dashboard_html():
    """Developer portal dashboard UI"""
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Clisonix Developer Portal</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f7fa; }
            .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
            header { background: linear-gradient(135deg, #0d2f6b, #0f6ab4); color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px; }
            header h1 { font-size: 28px; margin-bottom: 8px; }
            header p { opacity: 0.9; }
            
            .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
            .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
            .card h3 { font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
            .card .value { font-size: 24px; font-weight: bold; color: #0d2f6b; }
            .card .unit { font-size: 12px; color: #999; margin-left: 5px; }
            
            .section { background: white; padding: 25px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
            .section h2 { font-size: 18px; margin-bottom: 20px; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px; }
            
            table { width: 100%; border-collapse: collapse; }
            table th { text-align: left; padding: 12px; font-weight: 600; border-bottom: 2px solid #f0f0f0; color: #666; font-size: 12px; }
            table td { padding: 12px; border-bottom: 1px solid #f0f0f0; }
            table tr:hover { background: #f9f9f9; }
            
            .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
            .badge.active { background: #d4edda; color: #155724; }
            .badge.expired { background: #f8d7da; color: #721c24; }
            .badge.free { background: #e2e3e5; color: #383d41; }
            .badge.pro { background: #cfe2ff; color: #084298; }
            .badge.enterprise { background: #d1ecf1; color: #0c5460; }
            
            button { background: #0d2f6b; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600; }
            button:hover { background: #0a1f4a; }
            button.secondary { background: #6c757d; }
            button.secondary:hover { background: #5a6268; }
            
            .notice { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 4px; margin-bottom: 20px; }
            .notice p { margin: 0; color: #856404; font-size: 14px; }
            
            footer { text-align: center; padding: 20px; color: #999; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <header>
                <h1>🔑 Developer Portal</h1>
                <p>Manage your API keys, monitor usage, and view billing</p>
            </header>
            
            <div class="grid">
                <div class="card">
                    <h3>API Plan</h3>
                    <div class="value">-</div>
                </div>
                <div class="card">
                    <h3>Requests Today</h3>
                    <div class="value">-<span class="unit">/limit</span></div>
                </div>
                <div class="card">
                    <h3>Requests This Month</h3>
                    <div class="value">-</div>
                </div>
                <div class="card">
                    <h3>Next Billing</h3>
                    <div class="value">-</div>
                </div>
            </div>
            
            <div class="notice">
                <p>💡 Store API keys securely. Never share them in public repos or client-side code.</p>
            </div>
            
            <div class="section">
                <h2>API Keys</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Plan</th>
                            <th>Created</th>
                            <th>Last Used</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody id="keys-table">
                        <tr><td colspan="6" style="text-align: center; color: #999;">Loading...</td></tr>
                    </tbody>
                </table>
            </div>
            
            <div class="section">
                <h2>Pricing Plans</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Plan</th>
                            <th>Price</th>
                            <th>Requests/Day</th>
                            <th>Features</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><span class="badge free">Free</span></td>
                            <td>€0</td>
                            <td>1,000</td>
                            <td>Basic API access, Community support</td>
                            <td><button class="secondary">Current</button></td>
                        </tr>
                        <tr>
                            <td><span class="badge pro">Pro</span></td>
                            <td>€29/mo</td>
                            <td>10,000</td>
                            <td>Full API access, Priority support, Webhooks</td>
                            <td><button>Upgrade</button></td>
                        </tr>
                        <tr>
                            <td><span class="badge enterprise">Enterprise</span></td>
                            <td>Custom</td>
                            <td>50,000+</td>
                            <td>Unlimited, Dedicated support, SLA</td>
                            <td><button>Contact Sales</button></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <footer>
                <p>Clisonix Developer Portal © 2026. All rights reserved.</p>
            </footer>
        </div>
        
        <script>
            // Placeholder - would load real data from /api/keys
            console.log('Developer Portal loaded');
        </script>
    </body>
    </html>
    """

# ═══════════════════════════════════════════════════════════════════════════════
# API ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/v1/keys")
async def list_api_keys(user_token: str = Depends(get_user_token)) -> Dict:
    """List user's API keys"""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{MARKETPLACE_URL}/api/v1/keys",
                headers={"Authorization": f"Bearer {user_token}"}
            )
            if resp.status_code == 200:
                return resp.json()
            else:
                raise HTTPException(status_code=resp.status_code, detail="Failed to fetch keys")
    except Exception as e:
        logger.error(f"Error fetching keys: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/keys/generate")
async def generate_key(
    name: str,
    plan: str = "free",
    user_token: str = Depends(get_user_token)
) -> Dict:
    """Generate new API key"""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{MARKETPLACE_URL}/api/v1/keys/generate",
                json={"name": name, "plan": plan},
                headers={"Authorization": f"Bearer {user_token}"}
            )
            if resp.status_code == 200:
                return resp.json()
            else:
                raise HTTPException(status_code=resp.status_code, detail="Failed to generate key")
    except Exception as e:
        logger.error(f"Error generating key: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/usage")
async def get_usage_stats(user_token: str = Depends(get_user_token)) -> UsageStats:
    """Get usage statistics"""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{ANALYTICS_URL}/api/v1/usage",
                headers={"Authorization": f"Bearer {user_token}"}
            )
            if resp.status_code == 200:
                data = resp.json()
                return UsageStats(
                    requests_today=data.get("requests_today", 0),
                    requests_limit=data.get("requests_limit", 1000),
                    requests_remaining=data.get("requests_remaining", 1000),
                    reset_time=(datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
                    requests_this_month=data.get("requests_this_month", 0),
                    top_endpoints=data.get("top_endpoints", {})
                )
            else:
                # Return defaults
                return UsageStats(
                    requests_today=0,
                    requests_limit=1000,
                    requests_remaining=1000,
                    reset_time=(datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
                    requests_this_month=0,
                    top_endpoints={}
                )
    except Exception as e:
        logger.error(f"Error fetching usage: {e}")
        return UsageStats(
            requests_today=0,
            requests_limit=1000,
            requests_remaining=1000,
            reset_time=(datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
            requests_this_month=0,
            top_endpoints={}
        )

@app.get("/api/v1/billing")
async def get_billing_info(user_token: str = Depends(get_user_token)) -> BillingInfo:
    """Get billing information"""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{MARKETPLACE_URL}/api/v1/billing",
                headers={"Authorization": f"Bearer {user_token}"}
            )
            if resp.status_code == 200:
                data = resp.json()
                return BillingInfo(
                    user_id=data.get("user_id"),
                    plan=data.get("plan", "free"),
                    price_eur=data.get("price_eur", 0),
                    next_billing_date=data.get("next_billing_date", "2026-04-12"),
                    status=data.get("status", "active"),
                    auto_renew=data.get("auto_renew", True)
                )
            else:
                return BillingInfo(
                    user_id="unknown",
                    plan="free",
                    price_eur=0,
                    next_billing_date="2026-04-12",
                    status="active",
                    auto_renew=True
                )
    except Exception as e:
        logger.error(f"Error fetching billing: {e}")
        return BillingInfo(
            user_id="unknown",
            plan="free",
            price_eur=0,
            next_billing_date="2026-04-12",
            status="active",
            auto_renew=True
        )

@app.post("/api/v1/keys/{key_id}/revoke")
async def revoke_key(key_id: str, user_token: str = Depends(get_user_token)) -> Dict:
    """Revoke an API key"""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{MARKETPLACE_URL}/api/v1/keys/{key_id}/revoke",
                headers={"Authorization": f"Bearer {user_token}"}
            )
            if resp.status_code == 200:
                return {"status": "revoked", "key_id": key_id}
            else:
                raise HTTPException(status_code=resp.status_code, detail="Failed to revoke key")
    except Exception as e:
        logger.error(f"Error revoking key: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ═══════════════════════════════════════════════════════════════════════════════
# SERVER STARTUP
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    logger.info(f"🚀 Developer Portal starting on port {PORT}")
    uvicorn.run(app, host="0.0.0.0", port=PORT)
