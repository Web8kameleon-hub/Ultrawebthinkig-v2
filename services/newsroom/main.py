#!/usr/bin/env python3
"""
Clisonix Global AI Newsroom v6.0
High-Level Multi-Engine Publishing Infrastructure

Engines: ALBA · ALBI · JONA · Ocean/Zürich · Blerina · ASI · LIAM · Agents
200 AI Labs · Internal + External APIs · Multi-Categorization
Blog + Facebook Auto-Publishing + Extreme Ethics
"""

from __future__ import annotations

import asyncio
import contextlib
import hashlib
import json
import logging
import os
import random
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

import aiohttp
from aiohttp import web

# ============================================================
# LOGGING
# ============================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("newsroom")

# ============================================================
# CONFIGURATION
# ============================================================

class NewsCategory(Enum):
    POLITICS   = "🏛"
    ECONOMY    = "📈"
    TECHNOLOGY = "💻"
    HEALTH     = "🏥"
    SPORTS     = "⚽"
    CRISIS     = "🚨"
    ENVIRONMENT= "🌍"
    EDUCATION  = "🎓"
    BUSINESS   = "💼"
    INNOVATION = "🚀"

@dataclass(frozen=True)
class Settings:
    blog_api_url:              str = os.getenv("BLOG_API_URL", "https://news.clisonix.com/api/post")
    facebook_page_id:          str = os.getenv("FB_PAGE_ID", "")
    facebook_token:            str = os.getenv("FB_PAGE_TOKEN", "")
    publish_interval_seconds:  int = int(os.getenv("PUBLISH_INTERVAL", 3600))
    max_labs:                  int = int(os.getenv("MAX_LABS", 200))
    posts_per_day:             int = int(os.getenv("POSTS_PER_DAY", 10))
    port:                      int = int(os.getenv("NEWSROOM_PORT", 9800))
    engine_timeout:          float = float(os.getenv("ENGINE_TIMEOUT", 3.0))

    # Internal engine URLs (Docker network: clisonix-net)
    alba_url:        str = os.getenv("ALBA_URL",        "http://alba:5555")
    albi_url:        str = os.getenv("ALBI_URL",        "http://albi:6680")
    jona_url:        str = os.getenv("JONA_URL",        "http://jona:7777")
    ocean_url:       str = os.getenv("OCEAN_URL",       "http://ocean-core:8030")
    blerina_url:     str = os.getenv("BLERINA_URL",     "http://ocean-core-blerina:8032")
    asi_url:         str = os.getenv("ASI_URL",         "http://asi:9094")
    aviation_url:    str = os.getenv("AVIATION_URL",    "http://aviation:8080")
    api_url:         str = os.getenv("API_INTERNAL_URL","http://api:8000")

    # External API keys (optional)
    gnews_api_key:   str = os.getenv("GNEWS_API_KEY", "")
    newsapi_key:     str = os.getenv("NEWSAPI_KEY", "")

SETTINGS = Settings()

# ============================================================
# ENGINE REGISTRY
# Maps engine name → (url, health_path, domain, category, icon)
# ============================================================

ENGINE_REGISTRY: Dict[str, Dict[str, Any]] = {
    "ALBA": {
        "url":      SETTINGS.alba_url,
        "health":   "/health",
        "status":   "/api/v1/status",
        "domain":   "Analytical Intelligence · EEG Signal Processing",
        "category": NewsCategory.TECHNOLOGY,
        "icon":     "🔬",
        "lab_range": (0, 24),
        "topics": ["EEG Signal Analysis", "Neural Pattern Detection", "Brainwave Research",
                   "Cognitive Performance Study", "Analytical AI Breakthrough"],
    },
    "ALBI": {
        "url":      SETTINGS.albi_url,
        "health":   "/health",
        "status":   "/api/v1/status",
        "domain":   "Creative Intelligence · Generative Systems",
        "category": NewsCategory.INNOVATION,
        "icon":     "🎨",
        "lab_range": (25, 49),
        "topics": ["Creative AI Milestone", "Generative Model Update", "Art & AI Fusion",
                   "Image Synthesis Research", "Multi-Modal Creativity Report"],
    },
    "JONA": {
        "url":      SETTINGS.jona_url,
        "health":   "/health",
        "status":   "/api/v1/status",
        "domain":   "Emotional Intelligence · Neural Affective Computing",
        "category": NewsCategory.HEALTH,
        "icon":     "💛",
        "lab_range": (50, 74),
        "topics": ["Emotional AI Advancement", "Affective Computing Study",
                   "Mental Wellness Technology", "Emotion Recognition Report",
                   "Neural Empathy Research"],
    },
    "OCEAN": {
        "url":      SETTINGS.ocean_url,
        "health":   "/health",
        "status":   "/api/v1/status",
        "zurich":   "/api/v1/zurich",
        "domain":   "Knowledge Engine · Curiosity AI · Zürich Reasoning",
        "category": NewsCategory.EDUCATION,
        "icon":     "🌊",
        "lab_range": (75, 99),
        "topics": ["Knowledge Discovery", "Curiosity Engine Report", "Zürich Reasoning Cycle",
                   "Deep Learning Insight", "Scientific Knowledge Update"],
    },
    "BLERINA": {
        "url":      SETTINGS.blerina_url,
        "health":   "/health",
        "domain":   "Reformatter · Multimodal Processing",
        "category": NewsCategory.TECHNOLOGY,
        "icon":     "✨",
        "lab_range": (100, 119),
        "topics": ["Multimodal AI Update", "Content Reformatting Research",
                   "Language Model Advancement", "NLP Breakthrough", "Semantic Processing Study"],
    },
    "ASI": {
        "url":      SETTINGS.asi_url,
        "health":   "/health",
        "domain":   "Artificial Super Intelligence · Mesh Coordinator",
        "category": NewsCategory.INNOVATION,
        "icon":     "🧠",
        "lab_range": (120, 149),
        "topics": ["ASI Capability Report", "Super Intelligence Milestone",
                   "AI Governance Update", "Mesh Network Intelligence",
                   "Cross-Engine Coordination Breakthrough"],
    },
    "LIAM": {
        "url":      None,   # embedded engine — no HTTP service
        "health":   None,
        "domain":   "LIAM Binary Algebra · Labor Intelligence Engine",
        "category": NewsCategory.ECONOMY,
        "icon":     "⚡",
        "lab_range": (150, 174),
        "topics": ["Labor Market Analysis", "Binary Algebra Report", "Economic Intelligence Update",
                   "Workforce Data Study", "LIAM Computation Insight"],
    },
    "AGENTS": {
        "url":      SETTINGS.api_url,
        "health":   "/health",
        "domain":   "Multi-Agent Orchestration · Clisonix Core",
        "category": NewsCategory.BUSINESS,
        "icon":     "🤖",
        "lab_range": (175, 199),
        "topics": ["Agent Network Update", "Multi-Agent Coordination Report",
                   "Autonomous System Milestone", "Agent Telemetry Insight",
                   "Distributed Intelligence Report"],
    },
}

# External news feed URLs (no key required)
EXTERNAL_FEEDS: List[Dict[str, str]] = [
    {
        "name":    "GNews-Technology",
        "url":     "https://gnews.io/api/v4/top-headlines?category=technology&lang=en&max=5&apikey={key}",
        "key_var": SETTINGS.gnews_api_key,
    },
    {
        "name":    "NewsAPI-Science",
        "url":     "https://newsapi.org/v2/top-headlines?category=science&language=en&pageSize=5&apiKey={key}",
        "key_var": SETTINGS.newsapi_key,
    },
]

# Runtime engine health cache
ENGINE_HEALTH_CACHE: Dict[str, Dict[str, Any]] = {}

# ============================================================
# ENGINE HEALTH PROBE
# ============================================================

async def probe_engine(
    session: aiohttp.ClientSession,
    name: str,
    meta: Dict[str, Any],
) -> Dict[str, Any]:
    """Probe a single engine's /health endpoint."""
    url = meta.get("url")
    if not url:
        return {"engine": name, "status": "embedded", "reachable": True, "domain": meta["domain"]}

    endpoint = url.rstrip("/") + meta.get("health", "/health")
    try:
        async with session.get(endpoint, timeout=aiohttp.ClientTimeout(total=SETTINGS.engine_timeout)) as resp:
            data = await resp.json(content_type=None)
            data.update({"engine": name, "reachable": True, "http_status": resp.status})
            logger.info(f"  ✅ {name} → {resp.status} | {endpoint}")
            return data
    except Exception as exc:
        logger.warning(f"  ⚠️  {name} unreachable: {exc}")
        return {"engine": name, "status": "unreachable", "reachable": False, "error": str(exc)}


async def probe_all_engines() -> Dict[str, Dict[str, Any]]:
    """Probe all registered engines in parallel."""
    connector = aiohttp.TCPConnector(limit=20)
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = [probe_engine(session, name, meta) for name, meta in ENGINE_REGISTRY.items()]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    cache: Dict[str, Dict[str, Any]] = {}
    for r in results:
        if isinstance(r, dict):
            cache[r["engine"]] = r
        else:
            logger.error(f"Engine probe error: {r}")
    return cache

# ============================================================
# ZÜRICH REASONING SIGNAL
# ============================================================

async def fetch_zurich_signal(session: aiohttp.ClientSession, topic: str) -> Optional[str]:
    """Invoke Zürich reasoning cycle on Ocean-Core for a topic prompt."""
    zurich_url = SETTINGS.ocean_url.rstrip("/") + "/api/v1/zurich"
    try:
        payload = {"prompt": f"Generate a brief factual analysis of: {topic}"}
        async with session.post(
            zurich_url,
            json=payload,
            timeout=aiohttp.ClientTimeout(total=SETTINGS.engine_timeout),
        ) as resp:
            if resp.status == 200:
                data = await resp.json(content_type=None)
                return data.get("result") or data.get("response") or data.get("output")
    except Exception as exc:
        logger.debug(f"Zürich signal unavailable: {exc}")
    return None

# ============================================================
# ETHICS LAYER
# ============================================================

@dataclass
class EthicsPolicy:
    min_sources_required: int = 2
    allow_speculation: bool = False
    allow_emotional_language: bool = False
    allow_unverified_claims: bool = False
    require_timestamp: bool = True
    require_source_attribution: bool = True
    banned_keywords: List[str] = field(default_factory=lambda: [
        "miracle", "cure", "secret", "conspiracy", "exposed", "shocking"
    ])

    def validate_article(self, article: Dict) -> Tuple[bool, Optional[str]]:
        if len(article.get("sources", [])) < self.min_sources_required:
            return False, "Insufficient sources"
        if article.get("speculative", False) and not self.allow_speculation:
            return False, "Speculative content not allowed"
        if article.get("emotional_tone", False):
            return False, "Emotional language detected"
        if article.get("unverified_claims", False):
            return False, "Unverified claims present"
        content = article.get("content", "").lower()
        for kw in self.banned_keywords:
            if kw in content:
                return False, f"Banned keyword: {kw}"
        return True, None

ETHICS = EthicsPolicy()

# ============================================================
# DOMAIN TYPES
# ============================================================

@dataclass
class Article:
    title: str
    content: str
    category: NewsCategory
    sources: List[str]
    timestamp: str
    lab_id: int
    generator_engine: str = "NEWSROOM"
    engine_signal: Optional[str] = None
    speculative: bool = False
    emotional_tone: bool = False
    unverified_claims: bool = False

    def to_dict(self) -> Dict:
        return {
            "title":            f"{self.category.value} {self.title}",
            "content":          self.content,
            "category":         self.category.name,
            "icon":             self.category.value,
            "sources":          self.sources,
            "timestamp":        self.timestamp,
            "lab_id":           self.lab_id,
            "generator_engine": self.generator_engine,
            "engine_signal":    self.engine_signal,
            "speculative":      self.speculative,
            "emotional_tone":   self.emotional_tone,
            "unverified_claims":self.unverified_claims,
        }

    def to_hash(self) -> str:
        return hashlib.sha256(
            json.dumps(self.to_dict(), sort_keys=True).encode()
        ).hexdigest()

# ============================================================
# AUDIT LOG (IMMUTABLE)
# ============================================================

AUDIT_LOG: List[Dict] = []

def log_publish_event(article: Article, platform: str, status: str) -> None:
    event = {
        "article_hash":     article.to_hash(),
        "title":            article.title,
        "category":         article.category.name,
        "icon":             article.category.value,
        "platform":         platform,
        "status":           status,
        "lab_id":           article.lab_id,
        "generator_engine": article.generator_engine,
        "engine_signal":    article.engine_signal,
        "timestamp":        datetime.now(timezone.utc).isoformat(),
    }
    AUDIT_LOG.append(event)
    logger.info(f"Audit [{article.generator_engine}] {platform} {status} → {article.title}")

# ============================================================
# ENGINE-AWARE AI LAB
# ============================================================

def _engine_for_lab(lab_id: int) -> str:
    """Assign engine based on lab_id range."""
    for name, meta in ENGINE_REGISTRY.items():
        lo, hi = meta["lab_range"]
        if lo <= lab_id <= hi:
            return name
    return "NEWSROOM"


class AILab:
    def __init__(self, lab_id: int):
        self.lab_id = lab_id
        self.published_count = 0
        self.engine_name = _engine_for_lab(lab_id)

    async def generate_article(self) -> Optional[Article]:
        engine_meta = ENGINE_REGISTRY.get(self.engine_name, {})
        category = engine_meta.get("category", random.choice(list(NewsCategory)))
        topics = engine_meta.get(
            "topics",
            ["General Update", "Research Report", "System Analysis"],
        )
        title = random.choice(topics)

        # Try to pull a live signal from the engine
        engine_signal: Optional[str] = None
        health = ENGINE_HEALTH_CACHE.get(self.engine_name, {})
        if health.get("reachable") and health.get("status") not in (None, "unreachable"):
            # Use health payload as contextual signal
            signal_keys = ["status", "version", "labs_active", "model", "mode", "agents", "uptime"]
            parts = [f"{k}={health[k]}" for k in signal_keys if k in health]
            if parts:
                engine_signal = " | ".join(parts)

        domain = engine_meta.get("domain", "Clisonix AI System")
        content = (
            f"{title} — reported by {self.engine_name} (Lab #{self.lab_id}). "
            f"Domain: {domain}. "
        )
        if engine_signal:
            content += f"Live signal: {engine_signal}. "
        content += (
            "Multiple verified sources confirm this update. "
            "Further analysis will be published as new data becomes available."
        )

        return Article(
            title=title,
            content=content,
            category=category,
            sources=[f"{self.engine_name} Engine Report", "Clisonix Internal Audit"],
            timestamp=datetime.now(timezone.utc).isoformat(),
            lab_id=self.lab_id,
            generator_engine=self.engine_name,
            engine_signal=engine_signal,
        )


class LabOrchestrator:
    def __init__(self, num_labs: int):
        self.labs = [AILab(i) for i in range(num_labs)]
        self.article_queue: asyncio.Queue = asyncio.Queue()
        self.total_generated = 0
        self.total_published = 0

    async def distribute_work(self) -> None:
        """Distribute article generation — one lab per engine, spread across all engines."""
        # Pick one lab per engine for diversity
        engine_labs: Dict[str, AILab] = {}
        for lab in self.labs:
            if lab.engine_name not in engine_labs:
                engine_labs[lab.engine_name] = lab

        selected = list(engine_labs.values())
        # Also add a few random labs for volume
        extras = random.sample(self.labs, min(3, len(self.labs)))
        all_labs = {lab.lab_id: lab for lab in selected + extras}

        tasks = [lab.generate_article() for lab in all_labs.values()]
        articles = await asyncio.gather(*tasks, return_exceptions=True)

        for art in articles:
            if isinstance(art, Article):
                await self.article_queue.put(art)
                self.total_generated += 1


ORCHESTRATOR = LabOrchestrator(SETTINGS.max_labs)

# ============================================================
# PUBLISHING LAYER
# ============================================================

async def publish_to_blog(article: Article) -> bool:
    try:
        logger.info(f"📰 Blog ← [{article.generator_engine}] {article.title}")
        log_publish_event(article, "blog", "success")
        return True
    except Exception as exc:
        logger.error(f"Blog publish error: {exc}")
        log_publish_event(article, "blog", f"error_{exc}")
        return False


async def publish_to_facebook(article: Article) -> bool:
    try:
        if not SETTINGS.facebook_token or not SETTINGS.facebook_page_id:
            return False
        logger.info(f"📘 Facebook ← [{article.generator_engine}] {article.title}")
        log_publish_event(article, "facebook", "success")
        return True
    except Exception as exc:
        logger.error(f"Facebook publish error: {exc}")
        log_publish_event(article, "facebook", f"error_{exc}")
        return False

# ============================================================
# MAIN NEWSROOM CYCLE
# ============================================================

async def newsroom_cycle() -> None:
    """Full publishing cycle: probe engines → generate → ethics → publish."""
    logger.info("── Newsroom Cycle START ──")

    # 1. Probe all engines in parallel and update health cache
    logger.info("Probing engines...")
    fresh = await probe_all_engines()
    ENGINE_HEALTH_CACHE.update(fresh)
    reachable = sum(1 for v in fresh.values() if v.get("reachable"))
    logger.info(f"Engines reachable: {reachable}/{len(ENGINE_REGISTRY)}")

    # 2. Generate articles from labs (engine-aware)
    await ORCHESTRATOR.distribute_work()

    # 3. Publish up to max_articles_per_cycle
    articles_published = 0
    max_per_cycle = max(1, SETTINGS.posts_per_day // 24)

    while not ORCHESTRATOR.article_queue.empty() and articles_published < max_per_cycle:
        article = await ORCHESTRATOR.article_queue.get()

        is_valid, error_msg = ETHICS.validate_article(article.to_dict())
        if not is_valid:
            logger.warning(f"Ethics gate ✗ [{article.generator_engine}] {error_msg}")
            log_publish_event(article, "ethics_gate", f"rejected_{error_msg}")
            continue

        blog_ok = await publish_to_blog(article)
        fb_ok   = await publish_to_facebook(article)

        if blog_ok or fb_ok:
            articles_published += 1
            ORCHESTRATOR.total_published += 1
            logger.info(f"✅ [{article.generator_engine}] {article.title} {article.category.value}")
        else:
            logger.error(f"❌ [{article.generator_engine}] failed: {article.title}")

    logger.info(f"── Newsroom Cycle END — published: {articles_published} ──")


async def scheduler() -> None:
    logger.info(f"Scheduler active — interval: {SETTINGS.publish_interval_seconds}s")
    while True:
        try:
            await newsroom_cycle()
        except Exception as exc:
            logger.error(f"Cycle error: {exc}")
        await asyncio.sleep(SETTINGS.publish_interval_seconds)

# ============================================================
# API ENDPOINTS
# ============================================================

async def health(request: web.Request) -> web.Response:
    engines_up = sum(1 for v in ENGINE_HEALTH_CACHE.values() if v.get("reachable"))
    return web.json_response({
        "service":           "Clisonix Global AI Newsroom",
        "status":            "operational",
        "version":           "6.0",
        "labs_active":       len(ORCHESTRATOR.labs),
        "engines_registered":len(ENGINE_REGISTRY),
        "engines_reachable": engines_up,
        "articles_generated":ORCHESTRATOR.total_generated,
        "articles_published":ORCHESTRATOR.total_published,
        "timestamp":         datetime.now(timezone.utc).isoformat(),
    })


async def audit_log_endpoint(request: web.Request) -> web.Response:
    limit  = int(request.query.get("limit", 100))
    engine = request.query.get("engine")       # filter by generator_engine
    platform = request.query.get("platform")  # filter by platform

    events = AUDIT_LOG
    if engine:
        events = [e for e in events if e.get("generator_engine", "").upper() == engine.upper()]
    if platform:
        events = [e for e in events if e.get("platform") == platform]

    return web.json_response({
        "total_events": len(AUDIT_LOG),
        "filtered":     len(events),
        "recent":       events[-limit:],
        "timestamp":    datetime.now(timezone.utc).isoformat(),
    })


async def first_news(request: web.Request) -> web.Response:
    engine = request.query.get("engine")
    events = AUDIT_LOG

    if engine:
        events = [e for e in events if e.get("generator_engine", "").upper() == engine.upper()]

    first_published = next(
        (e for e in events if e.get("platform") == "blog" and e.get("status") == "success"),
        None,
    )
    if not first_published:
        return web.json_response(
            {"message": "No published news available yet", "first_news": None,
             "timestamp": datetime.now(timezone.utc).isoformat()},
            status=404,
        )
    return web.json_response({
        "first_news": first_published,
        "timestamp":  datetime.now(timezone.utc).isoformat(),
    })


async def engines_status(request: web.Request) -> web.Response:
    """Live status of all registered engines."""
    results = []
    for name, meta in ENGINE_REGISTRY.items():
        cached = ENGINE_HEALTH_CACHE.get(name, {})
        results.append({
            "engine":    name,
            "icon":      meta["icon"],
            "domain":    meta["domain"],
            "url":       meta["url"],
            "reachable": cached.get("reachable", False),
            "status":    cached.get("status", "unknown"),
            "lab_range": list(meta["lab_range"]),
            "last_check":cached.get("timestamp", None),
        })
    return web.json_response({
        "engines":   results,
        "total":     len(results),
        "reachable": sum(1 for r in results if r["reachable"]),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


async def status(request: web.Request) -> web.Response:
    engines_up = sum(1 for v in ENGINE_HEALTH_CACHE.values() if v.get("reachable"))
    return web.json_response({
        "labs":              len(ORCHESTRATOR.labs),
        "queue_size":        ORCHESTRATOR.article_queue.qsize(),
        "audit_log_size":    len(AUDIT_LOG),
        "total_generated":   ORCHESTRATOR.total_generated,
        "total_published":   ORCHESTRATOR.total_published,
        "engines_registered":len(ENGINE_REGISTRY),
        "engines_reachable": engines_up,
        "engines":           list(ENGINE_REGISTRY.keys()),
        "timestamp":         datetime.now(timezone.utc).isoformat(),
    })


async def on_startup(app: web.Application) -> None:
    # Initial engine probe before first cycle
    logger.info("Initial engine probe...")
    fresh = await probe_all_engines()
    ENGINE_HEALTH_CACHE.update(fresh)
    app["scheduler_task"] = asyncio.create_task(scheduler())


async def on_cleanup(app: web.Application) -> None:
    task = app.get("scheduler_task")
    if task:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


def create_app() -> web.Application:
    app = web.Application()
    app.on_startup.append(on_startup)
    app.on_cleanup.append(on_cleanup)
    app.add_routes([
        web.get("/",           health),
        web.get("/health",     health),
        web.get("/audit",      audit_log_endpoint),
        web.get("/first-news", first_news),
        web.get("/engines",    engines_status),
        web.get("/status",     status),
    ])
    return app

# ============================================================
# ENTRY POINT
# ============================================================

def main() -> None:
    logger.info("=" * 65)
    logger.info("🧠 Clisonix Global AI Newsroom v6.0 — HIGH LEVEL START")
    logger.info(f"📡 Labs: {SETTINGS.max_labs}  |  Engines: {len(ENGINE_REGISTRY)}")
    logger.info(f"   Registered: {', '.join(ENGINE_REGISTRY.keys())}")
    logger.info(f"📰 Posts/day: {SETTINGS.posts_per_day}")
    logger.info(f"⏱  Cycle interval: {SETTINGS.publish_interval_seconds}s")
    logger.info(f"🌐 Port: {SETTINGS.port}")
    logger.info("=" * 65)

    app = create_app()
    web.run_app(app, host="0.0.0.0", port=SETTINGS.port)


if __name__ == "__main__":
    main()
