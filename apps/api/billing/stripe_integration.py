import os
from typing import Optional

import stripe
from fastapi import HTTPException

STRIPE_API_KEY = os.getenv("STRIPE_API_KEY", "sk_test_...")
stripe.api_key = STRIPE_API_KEY

# Example: create a customer

def create_customer(email: str, name: Optional[str] = None):
    try:
        if name is not None:
            customer = stripe.Customer.create(email=email, name=name)
        else:
            customer = stripe.Customer.create(email=email)
        return customer
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Example: create a subscription

def create_subscription(customer_id: str, price_id: str):
    try:
        subscription = stripe.Subscription.create(
            customer=customer_id,
            items=[{"price": price_id}],
            payment_behavior="default_incomplete",
            expand=["latest_invoice.payment_intent"]
        )
        return subscription
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Example: retrieve usage

def get_customer_usage(customer_id: str):
    # This is a placeholder. Usage tracking should be linked with usage_tracker.py
    return {"customer_id": customer_id, "usage": "See usage_tracker.py"}


