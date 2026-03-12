"""
Clisonix API Monetization Manager
Handles API key generation, rate limiting, billing integration
"""

import hashlib
import json
import os
from datetime import datetime, timedelta
from typing import Dict, Optional

import stripe

# Initialize Stripe
stripe.api_key = os.getenv('STRIPE_SECRET_KEY')

class APIKeyManager:
    """Manages API keys and billing for monetized endpoints"""
    
    def __init__(self):
        self.plans = {
            'free': {
                'name': 'Free',
                'price': 0,
                'requests_per_day': 1000,
                'features': ['eeg-analysis', 'health-check']
            },
            'pro': {
                'name': 'Pro',
                'price': 2900,  # $29.00 in cents
                'requests_per_day': 10000,
                'features': ['eeg-analysis', 'audio-analytics', 'health-check', 'priority-support']
            },
            'enterprise': {
                'name': 'Enterprise',
                'price': None,  # Custom pricing
                'requests_per_day': 50000,
                'features': ['eeg-analysis', 'audio-analytics', 'ml-models', 'custom-sla', 'priority-support']
            }
        }
    
    def generate_api_key(self, user_id: str, plan: str) -> str:
        """Generate a new API key for a user"""
        key_material = f"{user_id}:{datetime.utcnow().isoformat()}:{os.urandom(16).hex()}"
        api_key = hashlib.sha256(key_material.encode()).hexdigest()
        return f"csx_{api_key[:32]}"
    
    def create_subscription(self, user_id: str, email: str, plan: str) -> Optional[str]:
        """Create a Stripe subscription for a user"""
        if plan not in self.plans or self.plans[plan]['price'] is None:
            return None
        
        # Create Stripe customer
        customer = stripe.Customer.create(
            email=email,
            metadata={'user_id': user_id, 'plan': plan}
        )
        
        # Get or create Stripe product
        product = self._get_or_create_product(plan)
        
        # Create subscription
        subscription = stripe.Subscription.create(
            customer=customer.id,
            items=[{'price': product['price_id']}],
            payment_behavior='default_incomplete',
            expand=['latest_invoice.payment_intent']
        )
        
        return subscription.id
    
    def _get_or_create_product(self, plan: str) -> Dict:
        """Get or create Stripe product for a plan"""
        plan_data = self.plans[plan]
        
        product = stripe.Product.create(
            name=f"Clisonix {plan_data['name']} Plan",
            description=f"{plan_data['requests_per_day']:,} requests/day + {', '.join(plan_data['features'])}",
            metadata={'plan': plan}
        )
        
        price = stripe.Price.create(
            product=product.id,
            unit_amount=plan_data['price'],
            currency='usd',
            recurring={'interval': 'month'},
            billing_scheme='per_unit'
        )
        
        return {
            'product_id': product.id,
            'price_id': price.id
        }
    
    def check_rate_limit(self, api_key: str) -> Dict:
        """Check if API key has requests remaining today"""
        # In production, store this in Redis for fast lookups
        # For now, we'll use a placeholder implementation
        
        plan = self._get_plan_for_key(api_key)
        if not plan:
            return {'allowed': False, 'reason': 'Invalid API key'}
        
        limit = self.plans[plan]['requests_per_day']
        used = self._get_requests_today(api_key)
        remaining = max(0, limit - used)
        
        return {
            'allowed': remaining > 0,
            'limit': limit,
            'used': used,
            'remaining': remaining,
            'resets_at': (datetime.utcnow() + timedelta(days=1)).isoformat()
        }
    
    def _get_plan_for_key(self, api_key: str) -> Optional[str]:
        """Get plan for an API key"""
        # In production, query database
        return 'free'  # placeholder
    
    def _get_requests_today(self, api_key: str) -> int:
        """Get request count for today"""
        # In production, query Redis or analytics database
        return 0  # placeholder


# FastAPI Integration Example
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/v1", tags=["monetization"])
key_manager = APIKeyManager()

async def verify_api_key(request: Request) -> str:
    """Dependency to verify API key and check rate limits"""
    api_key = request.headers.get('X-API-Key')
    
    if not api_key:
        raise HTTPException(status_code=401, detail="Missing API key")
    
    rate_limit = key_manager.check_rate_limit(api_key)
    if not rate_limit['allowed']:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    
    return api_key

@router.post("/subscribe")
async def create_subscription(user_id: str, email: str, plan: str):
    """Create a subscription for a user"""
    if plan not in key_manager.plans:
        raise HTTPException(status_code=400, detail="Invalid plan")
    
    subscription_id = key_manager.create_subscription(user_id, email, plan)
    
    if not subscription_id:
        raise HTTPException(status_code=400, detail="Cannot create subscription for this plan")
    
    api_key = key_manager.generate_api_key(user_id, plan)
    
    return {
        'subscription_id': subscription_id,
        'api_key': api_key,
        'plan': plan,
        'requests_per_day': key_manager.plans[plan]['requests_per_day']
    }

@router.get("/usage")
async def get_usage(api_key: str = Depends(verify_api_key)):
    """Get current API usage"""
    rate_limit = key_manager.check_rate_limit(api_key)
    return rate_limit
