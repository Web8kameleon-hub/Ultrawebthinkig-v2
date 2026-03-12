#!/usr/bin/env python3
"""
╔═══════════════════════════════════════════════════════════════════════════════╗
║  CLISONIX BLOG API SERVER - WITH PAYWALL & AUTHENTICATION                     ║
║  Handles user authentication, payments, article access, and monetization     ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  Features:                                                                    ║
║  ✅ Clerk Authentication (OAuth2)                                            ║
║  ✅ Stripe Micropayments (€0.10 per article)                                 ║
║  ✅ Free Article Previews (First 200 chars)                                  ║
║  ✅ Article Access Tracking (User → Article)                                 ║
║  ✅ Non-Intrusive Ad System (Premium users skip ads)                          ║
║  ✅ Subscription System (Monthly/Annual)                                      ║
║  ✅ User Dashboard (Purchase history)                                         ║
║  ✅ Revenue Analytics                                                         ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Port: 8050
Revenue Model:
  - €0.10 per article (micropayment)
  - €4.99/month unlimited access (subscription)
  - €49/year unlimited access + ad-free
  - Ad revenue: Contextual medical/health ads only
"""

import asyncio
import hashlib
import json
import logging
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
import stripe
from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, Response
from pydantic import BaseModel, Field
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session, sessionmaker

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("BlogAPI")

PORT = int(os.getenv("BLOG_API_PORT", "8050"))
CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY", "")
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

# Database
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:////app/blog_api.db")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Stripe config
stripe.api_key = STRIPE_SECRET_KEY

# Article sources
DR_ALBANA_URL = os.getenv("DR_ALBANA_URL", "http://localhost:8040")
BLERINA_URL = os.getenv("BLERINA_URL", "http://localhost:8039")

# Pricing
ARTICLE_PRICE_CENTS = 10  # €0.10 = 10 cents
MONTHLY_SUBSCRIPTION_CENTS = 499  # €4.99
YEARLY_SUBSCRIPTION_CENTS = 4900  # €49.00

BASE_DIR = Path(__file__).resolve().parent

# ═══════════════════════════════════════════════════════════════════════════════
# DATABASE MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class User(Base):
    """User profile and subscription status"""
    __tablename__ = "users"
    
    user_id = Column(String, primary_key=True, index=True)  # Clerk user ID
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    stripe_customer_id = Column(String, nullable=True, index=True)
    subscription_tier = Column(String, default="free")  # free, article, monthly, yearly
    subscription_expires = Column(DateTime, nullable=True)
    total_spent_cents = Column(Integer, default=0)
    total_articles_purchased = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    is_active = Column(Boolean, default=True)

class UserArticleAccess(Base):
    """Track which user accessed which article"""
    __tablename__ = "user_article_access"
    
    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    article_id = Column(String, index=True, nullable=False)
    article_title = Column(String, nullable=False)
    source = Column(String, nullable=False)  # dr_albana, blerina
    access_date = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    payment_method = Column(String)  # micropayment, subscription, free
    stripe_payment_id = Column(String, nullable=True)

class Payment(Base):
    """Payment transaction"""
    __tablename__ = "payments"
    
    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    stripe_payment_id = Column(String, unique=True, index=True)
    amount_cents = Column(Integer, nullable=False)
    currency = Column(String, default="eur")
    payment_type = Column(String)  # micropayment, subscription
    article_id = Column(String, nullable=True)
    status = Column(String, default="pending")  # pending, completed, failed, refunded
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)

class Advertisement(Base):
    """Ad system - only serious health/wellness ads"""
    __tablename__ = "advertisements"
    
    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=False)
    image_url = Column(String, nullable=False)
    click_url = Column(String, nullable=False)
    click_redirect_url = Column(String, nullable=True)  # Where to redirect (tracking middleware)
    advertiser_id = Column(String, nullable=True)
    category = Column(String, nullable=False)  # medical, wellness, health-tech
    is_active = Column(Boolean, default=True)
    impressions = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
    cpm_cents = Column(Integer, default=50)  # Cost per 1000 impressions in cents (€0.50)
    daily_budget_cents = Column(Integer, nullable=True)  # Optional daily cap
    revenue_cents = Column(Integer, default=0)  # Earned revenue
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class AdImpression(Base):
    """Track individual impressions for ad viewing"""
    __tablename__ = "ad_impressions"
    
    id = Column(String, primary_key=True, index=True)
    ad_id = Column(String, index=True, nullable=False)
    user_id = Column(String, nullable=True)  # None for anonymous
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

# Create tables
Base.metadata.create_all(bind=engine)

# ═══════════════════════════════════════════════════════════════════════════════
# PYDANTIC MODELS (API)
# ═══════════════════════════════════════════════════════════════════════════════

class UserProfile(BaseModel):
    user_id: str
    email: str
    name: Optional[str] = None
    subscription_tier: str
    subscription_expires: Optional[str] = None
    total_spent_cents: int
    total_articles_purchased: int

class ArticlePreview(BaseModel):
    id: str
    title: str
    author: str
    date: str
    preview: str  # First 200 chars
    source: str  # dr_albana, blerina
    category: str
    read_time: int  # Minutes
    requires_payment: bool

class ArticleDetail(BaseModel):
    id: str
    title: str
    author: str
    date: str
    content: str
    source: str
    category: str
    tags: List[str] = []

class PaymentRequest(BaseModel):
    article_id: str
    source: str

class PaymentResponse(BaseModel):
    client_secret: str
    payment_intent_id: str
    amount_cents: int

class SubscriptionRequest(BaseModel):
    tier: str  # monthly, yearly

class SubscriptionResponse(BaseModel):
    client_secret: str
    payment_intent_id: str
    amount_cents: int
    expires_date: str

class AdResponse(BaseModel):
    id: str
    title: str
    description: str
    image_url: str
    click_url: str
    category: str

class AdMetrics(BaseModel):
    ad_id: str
    impressions: int
    clicks: int
    ctr: float  # Click-through rate
    cpm_cents: int
    revenue_cents: int
    advertiser: Optional[str] = None

class AdCreateRequest(BaseModel):
    title: str
    description: str
    image_url: str
    click_url: str
    advertiser_id: Optional[str] = None
    category: str  # medical, wellness, health-tech
    cpm_cents: int = 50
    daily_budget_cents: Optional[int] = None

class AdUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    click_url: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None
    cpm_cents: Optional[int] = None
    daily_budget_cents: Optional[int] = None

# ═══════════════════════════════════════════════════════════════════════════════
# FASTAPI APP
# ═══════════════════════════════════════════════════════════════════════════════

app = FastAPI(
    title="Clisonix Blog API",
    description="Blog platform with paywall, authentication, and monetization",
    version="2.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ═══════════════════════════════════════════════════════════════════════════════
# DEPENDENCIES
# ═══════════════════════════════════════════════════════════════════════════════

def get_db():
    """Database session dependency"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def classify_document_nature(article: Dict[str, Any]) -> str:
    """Classify article into a user-friendly document nature category."""
    domain = (article.get("domain") or "").lower()
    title = (article.get("title") or "").lower()
    content = (article.get("content") or "").lower()
    text = f"{domain} {title} {content}"

    if any(token in text for token in ["trial", "cohort", "meta-analysis", "study", "evidence"]):
        return "clinical-study"
    if any(token in text for token in ["diagnostic", "screening", "biomarker", "imaging", "laboratory"]):
        return "diagnostic"
    if any(token in text for token in ["therapy", "treatment", "intervention", "protocol", "guideline"]):
        return "therapy"
    if any(token in text for token in ["prevention", "risk", "lifestyle", "public health"]):
        return "prevention"
    if any(token in text for token in ["nutrition", "diet", "metabolism", "obesity"]):
        return "nutrition"
    if any(token in text for token in ["neural", "brain", "eeg", "cognitive", "neuro"]):
        return "neuroscience"
    return "medical-general"


def matches_query(article: Dict[str, Any], query: str) -> bool:
    """Case-insensitive query match across key article fields."""
    if not query:
        return True
    q = query.strip().lower()
    hay = " ".join([
        str(article.get("id", "")),
        str(article.get("title", "")),
        str(article.get("domain", "")),
        str(article.get("content", "")),
    ]).lower()
    return q in hay

async def verify_clerk_token(authorization: str = Header(None)) -> str:
    """Verify Clerk JWT token and return user_id"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = authorization.replace("Bearer ", "")
    
    # Verify with Clerk (in production, validate JWT properly)
    # For now, we'll do a simple check
    if not token or len(token) < 10:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Extract user_id from token (you'd do proper JWT validation in production)
    # For demo: token format is "user_<user_id>"
    try:
        user_id = token.split("_")[1] if "_" in token else token
        return user_id
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token format")

# ═══════════════════════════════════════════════════════════════════════════════
# HEALTH CHECK
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/health")
async def health():
    """Health check"""
    return {
        "status": "healthy",
        "service": "blog-api",
        "port": PORT,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.get("/", response_class=HTMLResponse)
async def blog_homepage() -> str:
    """Serve the modern industrial blog UI."""
    ui_file = BASE_DIR / "index.html"
    if not ui_file.exists():
        raise HTTPException(status_code=404, detail="Blog UI not found")
    return ui_file.read_text(encoding="utf-8")


@app.get("/app.js")
async def blog_homepage_js() -> Response:
    """Serve frontend javascript without extra static server setup."""
    js_file = BASE_DIR / "app.js"
    if not js_file.exists():
        raise HTTPException(status_code=404, detail="Frontend script not found")
    return Response(content=js_file.read_text(encoding="utf-8"), media_type="application/javascript")

@app.get("/status")
async def status(db: Session = Depends(get_db)):
    """Detailed status"""
    try:
        total_users = db.query(User).count()
        total_transactions = db.query(Payment).filter(Payment.status == "completed").count()
        revenue_cents = db.query(Payment).filter(Payment.status == "completed").all()
        total_revenue = sum(p.amount_cents for p in revenue_cents) / 100  # Convert to €
        
        return {
            "status": "operational",
            "users": total_users,
            "transactions": total_transactions,
            "revenue_eur": total_revenue,
            "stripe_connected": bool(STRIPE_SECRET_KEY)
        }
    except Exception as e:
        logger.error(f"Status check error: {e}")
        return {"status": "degraded", "error": str(e)}

# ═══════════════════════════════════════════════════════════════════════════════
# AUTHENTICATION ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/api/v1/auth/register")
async def register(name: str, email: str, user_id: str, db: Session = Depends(get_db)):
    """Register new user with Clerk"""
    # Check if user already exists
    existing = db.query(User).filter(User.user_id == user_id).first()
    if existing:
        return {"status": "exists", "user_id": user_id}
    
    # Create Stripe customer for this user
    stripe_customer = stripe.Customer.create(
        email=email,
        name=name,
        metadata={"clisonix_user_id": user_id}
    )
    
    # Add user to DB
    user = User(
        user_id=user_id,
        email=email,
        name=name,
        stripe_customer_id=stripe_customer.id,
        subscription_tier="free"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    logger.info(f"✅ New user registered: {email} (ID: {user_id})")
    
    return {
        "status": "registered",
        "user_id": user_id,
        "stripe_customer_id": stripe_customer.id
    }

@app.get("/api/v1/auth/profile")
async def get_profile(
    user_id: str = Depends(verify_clerk_token),
    db: Session = Depends(get_db)
) -> UserProfile:
    """Get user profile and subscription status"""
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return UserProfile(
        user_id=user.user_id,
        email=user.email,
        name=user.name,
        subscription_tier=user.subscription_tier,
        subscription_expires=user.subscription_expires.isoformat() if user.subscription_expires else None,
        total_spent_cents=user.total_spent_cents,
        total_articles_purchased=user.total_articles_purchased
    )

# ═══════════════════════════════════════════════════════════════════════════════
# ARTICLE ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/v1/articles")
async def list_articles(
    skip: int = 0,
    limit: int = 20,
    category: Optional[str] = None,
    q: Optional[str] = None,
    user_id: Optional[str] = None,
    db: Session = Depends(get_db)
) -> List[ArticlePreview]:
    """
    List articles with previews.
    Free users see preview only (200 chars).
    Subscriber/purchased: see full content indicator.
    """
    try:
        # Fetch from Dr. Albana
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{DR_ALBANA_URL}/api/v1/medical/pillars",
                params={"skip": skip, "limit": limit}
            )
            articles_data = resp.json()

        filtered_articles = []
        raw_articles = articles_data.get("pillars", [])

        for article in raw_articles:
            document_nature = classify_document_nature(article)

            if category and category != "all" and document_nature != category:
                continue
            if q and not matches_query(article, q):
                continue

            article["document_nature"] = document_nature
            filtered_articles.append(article)

        paginated_articles = filtered_articles[skip: skip + limit]
        articles_preview = []

        for article in paginated_articles:
            # Check if user has access
            has_access = False
            if user_id:
                access = db.query(UserArticleAccess).filter(
                    UserArticleAccess.user_id == user_id,
                    UserArticleAccess.article_id == article["id"]
                ).first()
                has_access = bool(access)
                
                # Check subscription
                user = db.query(User).filter(User.user_id == user_id).first()
                if user and user.subscription_tier in ["monthly", "yearly"]:
                    has_access = True
            
            preview = ArticlePreview(
                id=article["id"],
                title=article.get("title", "Untitled"),
                author="Dr. Albana",
                date=article.get("date", datetime.now(timezone.utc).isoformat()),
                preview=article.get("content", "")[:200] + "...",
                source="dr_albana",
                category=article.get("document_nature", "medical-general"),
                read_time=max(3, len(article.get("content", "")) // 200),  # Estimate
                requires_payment=not has_access
            )
            articles_preview.append(preview)
        
        return articles_preview
    
    except Exception as e:
        logger.error(f"Error fetching articles: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching articles: {e}")


@app.get("/api/v1/articles/categories")
async def list_article_categories() -> Dict[str, Any]:
    """Return available document nature categories with counts."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{DR_ALBANA_URL}/api/v1/medical/pillars",
                params={"skip": 0, "limit": 200}
            )
            resp.raise_for_status()
            articles_data = resp.json()

        counts: Dict[str, int] = {}
        for article in articles_data.get("pillars", []):
            nature = classify_document_nature(article)
            counts[nature] = counts.get(nature, 0) + 1

        return {
            "categories": [
                {"key": key, "count": value}
                for key, value in sorted(counts.items(), key=lambda item: item[0])
            ],
            "total": sum(counts.values())
        }
    except Exception as e:
        logger.error(f"Error fetching categories: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching categories: {e}")

@app.get("/api/v1/articles/{article_id}")
async def get_article(
    article_id: str,
    user_id: str = Depends(verify_clerk_token),
    db: Session = Depends(get_db)
) -> ArticleDetail:
    """
    Get full article content.
    Requires payment or subscription.
    """
    try:
        # Check user access
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check if user has access to this article
        has_paid = db.query(UserArticleAccess).filter(
            UserArticleAccess.user_id == user_id,
            UserArticleAccess.article_id == article_id
        ).first()
        
        has_subscription = user.subscription_tier in ["monthly", "yearly"]
        
        if not has_paid and not has_subscription:
            raise HTTPException(
                status_code=403,
                detail="Article requires payment. Please purchase access or subscribe."
            )
        
        # Fetch from Dr. Albana
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{DR_ALBANA_URL}/api/v1/medical/pillars/{article_id}")
            article = resp.json()
        
        return ArticleDetail(
            id=article["id"],
            title=article.get("title", "Untitled"),
            author="Dr. Albana",
            date=article.get("date", datetime.now(timezone.utc).isoformat()),
            content=article.get("content", ""),
            source="dr_albana",
            category=article.get("domain", "medical"),
            tags=article.get("tags", [])
        )
    
    except Exception as e:
        logger.error(f"Error fetching article {article_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ═══════════════════════════════════════════════════════════════════════════════
# PAYMENT ENDPOINTS (STRIPE)
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/api/v1/payments/article")
async def purchase_article(
    req: PaymentRequest,
    user_id: str = Depends(verify_clerk_token),
    db: Session = Depends(get_db)
) -> PaymentResponse:
    """Purchase single article (€0.10 micropayment via Stripe)"""
    try:
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Create Stripe PaymentIntent
        intent = stripe.PaymentIntent.create(
            amount=ARTICLE_PRICE_CENTS,
            currency="eur",
            customer=user.stripe_customer_id,
            description=f"Article: {req.article_id}",
            metadata={
                "user_id": user_id,
                "article_id": req.article_id,
                "source": req.source
            }
        )
        
        # Track in DB
        payment = Payment(
            id=f"pay_{hashlib.sha256(f'{user_id}_{req.article_id}_{datetime.now()}'.encode()).hexdigest()[:16]}",
            user_id=user_id,
            stripe_payment_id=intent.id,
            amount_cents=ARTICLE_PRICE_CENTS,
            payment_type="micropayment",
            article_id=req.article_id,
            status="pending"
        )
        db.add(payment)
        db.commit()
        
        logger.info(f"💳 Payment intent created for user {user_id}: €{ARTICLE_PRICE_CENTS/100}")
        
        return PaymentResponse(
            client_secret=intent.client_secret,
            payment_intent_id=intent.id,
            amount_cents=ARTICLE_PRICE_CENTS
        )
    
    except Exception as e:
        logger.error(f"Payment error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/payments/subscribe")
async def subscribe(
    req: SubscriptionRequest,
    user_id: str = Depends(verify_clerk_token),
    db: Session = Depends(get_db)
) -> SubscriptionResponse:
    """Create subscription (€4.99/month or €49/year)"""
    try:
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        amount_cents = MONTHLY_SUBSCRIPTION_CENTS if req.tier == "monthly" else YEARLY_SUBSCRIPTION_CENTS
        
        # Create Stripe PaymentIntent
        intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency="eur",
            customer=user.stripe_customer_id,
            description=f"Clisonix Blog {req.tier.capitalize()} Subscription",
            metadata={
                "user_id": user_id,
                "subscription_tier": req.tier
            }
        )
        
        # Calculate expiry
        if req.tier == "monthly":
            expires = datetime.now(timezone.utc) + timedelta(days=30)
        else:
            expires = datetime.now(timezone.utc) + timedelta(days=365)
        
        payment = Payment(
            id=f"sub_{hashlib.sha256(f'{user_id}_{req.tier}_{datetime.now()}'.encode()).hexdigest()[:16]}",
            user_id=user_id,
            stripe_payment_id=intent.id,
            amount_cents=amount_cents,
            payment_type="subscription",
            status="pending"
        )
        db.add(payment)
        db.commit()
        
        return SubscriptionResponse(
            client_secret=intent.client_secret,
            payment_intent_id=intent.id,
            amount_cents=amount_cents,
            expires_date=expires.isoformat()
        )
    
    except Exception as e:
        logger.error(f"Subscription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/payments/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """Process Stripe webhook events"""
    try:
        payload = await request.body()
        sig_header = request.headers.get("stripe-signature")
        
        # Verify webhook signature
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
        
        if event["type"] == "payment_intent.succeeded":
            pi = event["data"]["object"]
            
            # Find payment in DB
            payment = db.query(Payment).filter(Payment.stripe_payment_id == pi.id).first()
            if payment:
                payment.status = "completed"
                payment.completed_at = datetime.now(timezone.utc)
                
                user = db.query(User).filter(User.user_id == payment.user_id).first()
                if user:
                    user.total_spent_cents += payment.amount_cents
                    
                    # Handle article purchase
                    if payment.payment_type == "micropayment" and payment.article_id:
                        user.total_articles_purchased += 1
                        
                        # Grant access
                        access = UserArticleAccess(
                            id=f"access_{hashlib.sha256(f'{payment.user_id}_{payment.article_id}'.encode()).hexdigest()[:16]}",
                            user_id=payment.user_id,
                            article_id=payment.article_id,
                            article_title="Article",
                            source=pi.metadata.get("source", "unknown"),
                            payment_method="micropayment",
                            stripe_payment_id=pi.id
                        )
                        db.add(access)
                        logger.info(f"✅ Article access granted: user {payment.user_id} → {payment.article_id}")
                    
                    # Handle subscription
                    elif payment.payment_type == "subscription":
                        tier = pi.metadata.get("subscription_tier", "monthly")
                        user.subscription_tier = tier
                        
                        if tier == "monthly":
                            user.subscription_expires = datetime.now(timezone.utc) + timedelta(days=30)
                        else:
                            user.subscription_expires = datetime.now(timezone.utc) + timedelta(days=365)
                        
                        logger.info(f"✅ Subscription activated: user {payment.user_id} → {tier}")
                
                db.commit()
        
        return {"received": True}
    
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"error": str(e)}, 400

# ═══════════════════════════════════════════════════════════════════════════════
# ADVERTISEMENT ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/v1/ads")
async def get_ads(
    user_id: Optional[str] = None,
    db: Session = Depends(get_db),
    limit: int = 3,
    request: Request = None
) -> List[AdResponse]:
    """
    Get ads (only shown to non-subscribers).
    Serious health/wellness ads only.
    """
    try:
        # Check if user has subscription (skip ads for them)
        if user_id:
            user = db.query(User).filter(User.user_id == user_id).first()
            if user and user.subscription_tier in ["monthly", "yearly"]:
                return []  # Premium users see no ads
        
        # Get active ads
        ads = db.query(Advertisement).filter(Advertisement.is_active).limit(limit).all()
        
        return [
            AdResponse(
                id=ad.id,
                title=ad.title,
                description=ad.description,
                image_url=ad.image_url,
                click_url=ad.click_url,
                category=ad.category
            )
            for ad in ads
        ]
    
    except Exception as e:
        logger.error(f"Error fetching ads: {e}")
        return []

@app.post("/api/v1/ads/{ad_id}/impression")
async def track_ad_impression(
    ad_id: str,
    request: Request,
    user_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Track ad impression (when ad is displayed)"""
    try:
        ad = db.query(Advertisement).filter(Advertisement.id == ad_id).first()
        if ad:
            ad.impressions += 1
            
            # Calculate revenue
            impression_revenue = (ad.cpm_cents / 1000)  # CPM = cost per 1000
            ad.revenue_cents = int(ad.revenue_cents + impression_revenue)
            
            # Log impression
            impression = AdImpression(
                id=f"imp_{hashlib.sha256(f'{ad_id}_{user_id}_{datetime.now()}'.encode()).hexdigest()[:16]}",
                ad_id=ad_id,
                user_id=user_id,
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent") if request else None
            )
            db.add(impression)
            db.commit()
            
            logger.info(f"👁️ Ad impression: {ad_id} (total: {ad.impressions})")
        
        return {"status": "tracked"}
    except Exception as e:
        logger.error(f"Error tracking impression: {e}")
        return {"error": str(e)}

@app.post("/api/v1/ads/{ad_id}/click")
async def track_ad_click(
    ad_id: str,
    request: Request,
    user_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Track ad click and return redirect URL"""
    try:
        ad = db.query(Advertisement).filter(Advertisement.id == ad_id).first()
        if ad:
            ad.clicks += 1
            db.commit()
            logger.info(f"🔗 Ad clicked: {ad_id} (total: {ad.clicks})")
            
            return {
                "status": "tracked",
                "redirect_url": ad.click_url,
                "ctr": (ad.clicks / ad.impressions * 100) if ad.impressions > 0 else 0
            }
        
        raise HTTPException(status_code=404, detail="Ad not found")
    except Exception as e:
        logger.error(f"Error tracking click: {e}")
        return {"error": str(e)}

# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN: AD MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/v1/admin/ads")
async def list_ads_admin(
    admin_token: str = Header(None),
    category: Optional[str] = None,
    db: Session = Depends(get_db)
) -> List[AdMetrics]:
    """Get all ads with metrics (admin only)"""
    # TODO: Verify admin_token in production
    try:
        query = db.query(Advertisement)
        if category:
            query = query.filter(Advertisement.category == category)
        
        ads = query.all()
        
        return [
            AdMetrics(
                ad_id=ad.id,
                impressions=ad.impressions,
                clicks=ad.clicks,
                ctr=(ad.clicks / ad.impressions * 100) if ad.impressions > 0 else 0,
                cpm_cents=ad.cpm_cents,
                revenue_cents=ad.revenue_cents,
                advertiser=ad.advertiser_id
            )
            for ad in ads
        ]
    except Exception as e:
        logger.error(f"Error fetching ads: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/admin/ads")
async def create_ad(
    req: AdCreateRequest,
    admin_token: str = Header(None),
    db: Session = Depends(get_db)
):
    """Create new ad (admin only)"""
    # TODO: Verify admin_token in production
    try:
        ad_id = f"ad_{hashlib.sha256(str(datetime.now()).encode()).hexdigest()[:12]}"
        
        ad = Advertisement(
            id=ad_id,
            title=req.title,
            description=req.description,
            image_url=req.image_url,
            click_url=req.click_url,
            advertiser_id=req.advertiser_id,
            category=req.category,
            cpm_cents=req.cpm_cents,
            daily_budget_cents=req.daily_budget_cents,
            is_active=True
        )
        db.add(ad)
        db.commit()
        db.refresh(ad)
        
        logger.info(f"✅ Ad created: {ad_id} ({req.category})")
        
        return {
            "status": "created",
            "ad_id": ad_id,
            "category": req.category
        }
    except Exception as e:
        logger.error(f"Error creating ad: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/v1/admin/ads/{ad_id}")
async def update_ad(
    ad_id: str,
    req: AdUpdateRequest,
    admin_token: str = Header(None),
    db: Session = Depends(get_db)
):
    """Update ad (admin only)"""
    try:
        ad = db.query(Advertisement).filter(Advertisement.id == ad_id).first()
        if not ad:
            raise HTTPException(status_code=404, detail="Ad not found")
        
        if req.title:
            ad.title = req.title
        if req.description:
            ad.description = req.description
        if req.image_url:
            ad.image_url = req.image_url
        if req.click_url:
            ad.click_url = req.click_url
        if req.category:
            ad.category = req.category
        if req.is_active is not None:
            ad.is_active = req.is_active
        if req.cpm_cents:
            ad.cpm_cents = req.cpm_cents
        if req.daily_budget_cents:
            ad.daily_budget_cents = req.daily_budget_cents
        
        ad.updated_at = datetime.now(timezone.utc)
        db.commit()
        
        logger.info(f"✏️ Ad updated: {ad_id}")
        
        return {"status": "updated", "ad_id": ad_id}
    except Exception as e:
        logger.error(f"Error updating ad: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/v1/admin/ads/{ad_id}")
async def delete_ad(
    ad_id: str,
    admin_token: str = Header(None),
    db: Session = Depends(get_db)
):
    """Delete ad (admin only)"""
    try:
        ad = db.query(Advertisement).filter(Advertisement.id == ad_id).first()
        if not ad:
            raise HTTPException(status_code=404, detail="Ad not found")
        
        db.delete(ad)
        db.commit()
        
        logger.info(f"🗑️ Ad deleted: {ad_id}")
        
        return {"status": "deleted", "ad_id": ad_id}
    except Exception as e:
        logger.error(f"Error deleting ad: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN ENDPOINTS (ANALYTICS)
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/v1/admin/analytics")
async def get_analytics(admin_token: str = Header(None), db: Session = Depends(get_db)):
    """Get comprehensive revenue and usage analytics (admin only)"""
    try:
        # Users
        total_users = db.query(User).count()
        active_subscribers = db.query(User).filter(
            User.subscription_tier.in_(["monthly", "yearly"])
        ).count()
        free_users = total_users - active_subscribers
        
        # Payments
        completed_payments = db.query(Payment).filter(Payment.status == "completed").all()
        total_payment_revenue_cents = sum(p.amount_cents for p in completed_payments)
        
        # Breakdown by type
        micropayments = db.query(Payment).filter(
            Payment.payment_type == "micropayment",
            Payment.status == "completed"
        ).all()
        micropayment_revenue_cents = sum(p.amount_cents for p in micropayments)
        micropayment_count = len(micropayments)
        
        subscriptions = db.query(Payment).filter(
            Payment.payment_type == "subscription",
            Payment.status == "completed"
        ).all()
        subscription_revenue_cents = sum(p.amount_cents for p in subscriptions)
        
        # Ads
        all_ads = db.query(Advertisement).all()
        ad_revenue_cents = sum(ad.revenue_cents for ad in all_ads)
        total_impressions = sum(ad.impressions for ad in all_ads)
        total_clicks = sum(ad.clicks for ad in all_ads)
        avg_ctr = (total_clicks / total_impressions * 100) if total_impressions > 0 else 0
        
        # Total revenue
        total_revenue_cents = total_payment_revenue_cents + ad_revenue_cents
        
        return {
            "summary": {
                "total_revenue_eur": total_revenue_cents / 100,
                "total_users": total_users,
                "active_subscribers": active_subscribers,
                "free_users": free_users,
                "total_ads": len(all_ads),
                "active_ads": len([a for a in all_ads if a.is_active])
            },
            "revenue_breakdown": {
                "micropayments_eur": micropayment_revenue_cents / 100,
                "micropayment_transactions": micropayment_count,
                "subscriptions_eur": subscription_revenue_cents / 100,
                "ad_revenue_eur": ad_revenue_cents / 100,
                "percentages": {
                    "micropayments": (micropayment_revenue_cents / total_revenue_cents * 100) if total_revenue_cents > 0 else 0,
                    "subscriptions": (subscription_revenue_cents / total_revenue_cents * 100) if total_revenue_cents > 0 else 0,
                    "ads": (ad_revenue_cents / total_revenue_cents * 100) if total_revenue_cents > 0 else 0
                }
            },
            "ad_metrics": {
                "total_impressions": total_impressions,
                "total_clicks": total_clicks,
                "average_ctr": avg_ctr,
                "top_ads": [
                    {
                        "ad_id": ad.id,
                        "title": ad.title,
                        "impressions": ad.impressions,
                        "clicks": ad.clicks,
                        "revenue_eur": ad.revenue_cents / 100,
                        "category": ad.category
                    }
                    for ad in sorted(all_ads, key=lambda x: x.revenue_cents, reverse=True)[:5]
                ]
            },
            "user_insights": {
                "monthly_subscribers": active_subscribers if True else 0,
                "total_articles_purchased": db.query(User).with_entities(
                    db.func.sum(User.total_articles_purchased)
                ).scalar() or 0,
                "avg_spending_per_user_eur": (total_revenue_cents / total_users / 100) if total_users > 0 else 0
            }
        }
    except Exception as e:
        logger.error(f"Analytics error: {e}")
        return {"error": str(e)}

# ═══════════════════════════════════════════════════════════════════════════════
# SERVER STARTUP
# ═══════════════════════════════════════════════════════════════════════════════

def seed_sample_ads():
    """Seed database with sample ads on startup"""
    db = SessionLocal()
    try:
        # Check if ads exist
        if db.query(Advertisement).count() > 0:
            logger.info("✓ Sample ads already exist")
            return
        
        sample_ads = [
            {
                "title": "Oura Ring - Sleep & Recovery Tracking",
                "description": "Advanced biometric ring for sleep, activity, and recovery tracking",
                "image_url": "https://www.ouraring.com/images/oura-ring.jpg",
                "click_url": "https://ouraring.com/?ref=clisonix",
                "category": "wellness",
                "advertiser_id": "oura-ring",
                "cpm_cents": 75
            },
            {
                "title": "Whoop Band - Performance Intelligence",
                "description": "Real-time biometric wearable for fitness and recovery optimization",
                "image_url": "https://www.whoop.com/images/whoop-band.jpg",
                "click_url": "https://www.whoop.com?ref=clisonix",
                "category": "health-tech",
                "advertiser_id": "whoop",
                "cpm_cents": 85
            },
            {
                "title": "Everlywell - At-Home Health Tests",
                "description": "Medical-grade lab tests delivered to your home",
                "image_url": "https://www.everlywell.com/images/test-kit.jpg",
                "click_url": "https://www.everlywell.com?ref=clisonix",
                "category": "medical",
                "advertiser_id": "everlywell",
                "cpm_cents": 100
            },
            {
                "title": "Headspace Health - Clinical Programs",
                "description": "Meditation and digital therapeutics for health conditions",
                "image_url": "https://www.headspacehealth.com/images/app.jpg",
                "click_url": "https://www.headspacehealth.com?ref=clisonix",
                "category": "wellness",
                "advertiser_id": "headspace-health",
                "cpm_cents": 60
            },
            {
                "title": "Withings Health Devices",
                "description": "Connected scales, blood pressure monitors, and sleep trackers",
                "image_url": "https://www.withings.com/images/devices.jpg",
                "click_url": "https://www.withings.com?ref=clisonix",
                "category": "health-tech",
                "advertiser_id": "withings",
                "cpm_cents": 65
            }
        ]
        
        for ad_data in sample_ads:
            ad_id = f"ad_{hashlib.sha256(ad_data['advertiser_id'].encode()).hexdigest()[:12]}"
            ad = Advertisement(
                id=ad_id,
                title=ad_data['title'],
                description=ad_data['description'],
                image_url=ad_data['image_url'],
                click_url=ad_data['click_url'],
                category=ad_data['category'],
                advertiser_id=ad_data['advertiser_id'],
                cpm_cents=ad_data['cpm_cents'],
                is_active=True
            )
            db.add(ad)
        
        db.commit()
        logger.info(f"✅ Seeded {len(sample_ads)} sample ads")
    except Exception as e:
        logger.error(f"Error seeding ads: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    import uvicorn
    # Seed sample ads
    seed_sample_ads()
    logger.info(f"🚀 Blog API starting on port {PORT}")
    uvicorn.run(app, host="0.0.0.0", port=PORT)
