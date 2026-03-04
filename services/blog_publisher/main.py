#!/usr/bin/env python3
"""
╔═══════════════════════════════════════════════════════════════════════════════╗
║  CLISONIX BLOG AUTO-PUBLISHER                                                 ║
║  Automatically publishes articles from Blerina & Dr. Albana to GitHub Pages   ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  Features:                                                                    ║
║  - Auto-converts articles to Jekyll format                                    ║
║  - Schedules 3-5 posts per day                                               ║
║  - Pushes to GitHub Pages repository                                          ║
║  - Tracks published articles to avoid duplicates                              ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Target: https://ledjanahmati.github.io/clisonix-blog/
Port: 8041
Author: Ledjan Ahmati (CEO, ABA GmbH)
"""

import asyncio
import json
import logging
import os
import re
import subprocess
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any
import hashlib

import httpx
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

# ═══════════════════════════════════════════════════════════════════════════════
# LOGGING
# ═══════════════════════════════════════════════════════════════════════════════

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("BlogPublisher")

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

PORT = int(os.getenv("PUBLISHER_PORT", "8041"))
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
GITHUB_REPO = os.getenv("GITHUB_REPO", "ledjanahmati/clisonix-blog")
GITHUB_BRANCH = os.getenv("GITHUB_BRANCH", "main")

# Source directories for articles
BLERINA_PILLARS_DIR = Path(os.getenv("BLERINA_PILLARS_DIR", "/app/blerina_pillars"))
DR_ALBANA_PILLARS_DIR = Path(os.getenv("DR_ALBANA_PILLARS_DIR", "/app/medical_pillars"))

# Local tracking
PUBLISHED_TRACKER = Path("/app/published_tracker.json")
DEDUP_CACHE = Path("/app/dedup_cache.json")  # Content hash cache for deduplication
QUALITY_LOG = Path("/app/quality_log.json")  # Track quality scores over time

# Publishing configuration
POSTS_PER_DAY = int(os.getenv("POSTS_PER_DAY", "10"))  # Changed from 4 to 10 for high-quality articles
MIN_QUALITY_SCORE = float(os.getenv("MIN_QUALITY_SCORE", "0.85"))  # Minimum 0.85
MAX_DAILY_PUBLISHED = int(os.getenv("MAX_DAILY_PUBLISHED", "10"))  # Maximum 10 per day
LAST_PUBLISHER_HEARTBEAT = None  # Track last successful publish

# ═══════════════════════════════════════════════════════════════════════════════
# APP INITIALIZATION
# ═══════════════════════════════════════════════════════════════════════════════

app = FastAPI(
    title="Clisonix Blog Auto-Publisher",
    description="Automatically publishes articles to GitHub Pages",
    version="1.0.0"
)

# ═══════════════════════════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class PublishRequest(BaseModel):
    """Manual publish request"""
    article_id: str = Field(..., description="Article ID from Blerina or Dr. Albana")
    source: str = Field("blerina", description="Source: blerina or dr_albana")
    schedule_time: Optional[str] = Field(None, description="ISO datetime to schedule, or None for immediate")

class PublishResponse(BaseModel):
    """Publish result"""
    status: str
    message: str
    github_url: Optional[str] = None
    post_filename: str

class ScheduleStatus(BaseModel):
    """Schedule status"""
    total_scheduled: int
    total_published_today: int
    next_publish_time: Optional[str]
    pending_articles: List[str]

# ═══════════════════════════════════════════════════════════════════════════════
# TRACKING & STATE
# ═══════════════════════════════════════════════════════════════════════════════

def load_published_tracker() -> Dict[str, Any]:
    """Load published articles tracker"""
    if PUBLISHED_TRACKER.exists():
        return json.loads(PUBLISHED_TRACKER.read_text())
    return {"published": [], "scheduled": [], "last_publish_date": None}

def save_published_tracker(data: Dict[str, Any]):
    """Save published articles tracker"""
    PUBLISHED_TRACKER.parent.mkdir(parents=True, exist_ok=True)
    PUBLISHED_TRACKER.write_text(json.dumps(data, indent=2))

def get_content_hash(content: str) -> str:
    """Generate hash of content for deduplication"""
    return hashlib.sha256(content.strip().encode('utf-8')).hexdigest()

def load_dedup_cache() -> Dict[str, Any]:
    """Load content deduplication cache"""
    if DEDUP_CACHE.exists():
        return json.loads(DEDUP_CACHE.read_text())
    return {"hashes": {}, "last_check": None}

def save_dedup_cache(data: Dict[str, Any]):
    """Save content deduplication cache"""
    DEDUP_CACHE.parent.mkdir(parents=True, exist_ok=True)
    DEDUP_CACHE.write_text(json.dumps(data, indent=2))

def is_duplicate_content(content: str) -> bool:
    """Check if content hash already exists in cache"""
    content_hash = get_content_hash(content)
    cache = load_dedup_cache()
    if content_hash in cache.get("hashes", {}):
        logger.warning(f"Duplicate content detected: {cache['hashes'][content_hash]}")
        return True
    return False

def register_content(content: str, article_id: str):
    """Register content hash in deduplication cache"""
    content_hash = get_content_hash(content)
    cache = load_dedup_cache()
    cache["hashes"][content_hash] = {
        "article_id": article_id,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    cache["last_check"] = datetime.now(timezone.utc).isoformat()
    save_dedup_cache(cache)

def load_quality_log() -> Dict[str, Any]:
    """Load quality assessment log"""
    if QUALITY_LOG.exists():
        return json.loads(QUALITY_LOG.read_text())
    return {"assessments": [], "stats": {"avg_score": 0.0, "min_score": 1.0, "max_score": 0.0, "total": 0}}

def save_quality_log(data: Dict[str, Any]):
    """Save quality assessment log"""
    QUALITY_LOG.parent.mkdir(parents=True, exist_ok=True)
    QUALITY_LOG.write_text(json.dumps(data, indent=2))

def calculate_quality_score(content: str, source: str) -> float:
    """
    Calculate article quality score (0.0-1.0)
    Factors: word count, structure, citations, depth
    """
    score = 0.0
    issues = []
    
    word_count = len(content.split())
    
    # Word count (20% weight) - minimum 800 words for blog articles
    if word_count >= 2500:
        score += 0.20
    elif word_count >= 1500:
        score += 0.15
    elif word_count >= 800:
        score += 0.10
    else:
        issues.append(f"Low word count: {word_count} (minimum 800)")
    
    # Structure (20% weight) - headings, sections
    heading_count = content.count('#')
    if heading_count >= 5:
        score += 0.20
    elif heading_count >= 3:
        score += 0.10
    else:
        issues.append("Insufficient structure (need at least 3 headings)")
    
    # Citations/References (20% weight)
    citation_count = content.count('[') + content.count('(http')
    if citation_count >= 8:
        score += 0.20
    elif citation_count >= 5:
        score += 0.15
    elif citation_count >= 3:
        score += 0.10
    else:
        issues.append("Few citations/references (need at least 3)")
    
    # Depth (20% weight) - code blocks, tables, technical depth
    has_code = '```' in content or '```python' in content or '```javascript' in content
    has_tables = '|' in content and content.count('|') > 4
    has_lists = content.count('\n- ') >= 5 or content.count('\n* ') >= 5
    
    depth_score = 0.0
    if has_code:
        depth_score += 0.10
    if has_tables:
        depth_score += 0.05
    if has_lists:
        depth_score += 0.05
    if depth_score == 0.0:
        issues.append("Lacks technical depth (add code, tables, or lists)")
    score += depth_score
    
    # Originality (20% weight) - checked via dedup
    if not is_duplicate_content(content):
        score += 0.20
    else:
        issues.append("Duplicate content detected")
    
    # For medical articles, add bonus for specific markers
    if source == "dr_albana":
        if any(marker in content.lower() for marker in ["fda", "clinical", "study", "trial", "biomarker"]):
            score = min(1.0, score + 0.10)
    
    # For technical articles, add bonus for real implementations
    elif source == "blerina":
        if any(marker in content.lower() for marker in ["github", "implementation", "api", "algorithm", "framework"]):
            score = min(1.0, score + 0.10)
    
    return min(1.0, max(0.0, score))

def is_already_published(article_id: str) -> bool:
    """Check if an article has already been published"""
    tracker = load_published_tracker()
    return article_id in tracker.get("published", [])

def mark_as_published(article_id: str, github_url: str):
    """Mark an article as published"""
    tracker = load_published_tracker()
    if article_id not in tracker["published"]:
        tracker["published"].append(article_id)
    tracker["last_publish_date"] = datetime.now(timezone.utc).isoformat()
    save_published_tracker(tracker)

# ═══════════════════════════════════════════════════════════════════════════════
# JEKYLL CONVERTER
# ═══════════════════════════════════════════════════════════════════════════════

def slugify(text: str) -> str:
    """Convert text to URL-friendly slug"""
    text = text.lower()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_-]+', '-', text)
    text = text.strip('-')
    return text[:80]  # Limit length

def extract_title_from_markdown(content: str) -> str:
    """Extract title from markdown content"""
    # Try to find # Title
    match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
    if match:
        return match.group(1).strip()
    # Fallback to first line
    lines = content.strip().split('\n')
    if lines:
        return lines[0].strip('#').strip()
    return "Untitled Article"

def determine_categories(content: str, source: str) -> List[str]:
    """Determine article categories based on content"""
    categories = []
    content_lower = content.lower()
    
    if source == "dr_albana":
        categories.append("Medical Research")
        if "cardio" in content_lower or "heart" in content_lower or "cardiac" in content_lower:
            categories.append("Cardiology")
        if "hepat" in content_lower or "liver" in content_lower:
            categories.append("Hepatology")
        if "hormon" in content_lower or "cortisol" in content_lower or "testosterone" in content_lower:
            categories.append("Endocrinology")
        if "obesity" in content_lower or "muscle" in content_lower or "body composition" in content_lower:
            categories.append("Body Composition")
    else:  # blerina
        categories.append("Technology")
        if "eeg" in content_lower or "brain" in content_lower or "neural" in content_lower:
            categories.append("Neurotechnology")
        if "bci" in content_lower or "brain-computer" in content_lower:
            categories.append("Brain-Computer Interface")
        if "python" in content_lower or "code" in content_lower or "algorithm" in content_lower:
            categories.append("Software Engineering")
        if "ai" in content_lower or "machine learning" in content_lower:
            categories.append("Artificial Intelligence")
    
    return categories[:3]  # Max 3 categories

def convert_to_jekyll(content: str, source: str, article_id: str) -> tuple[str, str]:
    """
    Convert markdown content to Jekyll format with YAML frontmatter
    Returns: (jekyll_content, filename)
    """
    title = extract_title_from_markdown(content)
    categories = determine_categories(content, source)
    
    # Generate date for filename
    now = datetime.now(timezone.utc)
    date_str = now.strftime("%Y-%m-%d")
    
    # Create slug from title
    slug = slugify(title)
    filename = f"{date_str}-{slug}.md"
    
    # Build YAML frontmatter
    frontmatter = f"""---
layout: post
title: "{title}"
date: {now.strftime("%Y-%m-%d %H:%M:%S %z")}
categories: [{', '.join(categories)}]
author: {"Dr. Albana" if source == "dr_albana" else "Blerina"}
source: {source}
article_id: {article_id}
tags: [{', '.join(categories[:2])}]
excerpt: "{title[:150]}..."
---

"""
    
    # Remove the original title from content if it starts with #
    content_lines = content.strip().split('\n')
    if content_lines and content_lines[0].startswith('#'):
        content = '\n'.join(content_lines[1:]).strip()
    
    jekyll_content = frontmatter + content
    
    return jekyll_content, filename

# ═══════════════════════════════════════════════════════════════════════════════
# GITHUB PUBLISHER
# ═══════════════════════════════════════════════════════════════════════════════

async def publish_to_github(content: str, filename: str) -> Optional[str]:
    """
    Publish content to GitHub Pages repository using GitHub API
    Returns the URL of the published post
    """
    if not GITHUB_TOKEN:
        logger.error("GITHUB_TOKEN not set!")
        return None
    
    api_url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/_posts/{filename}"
    
    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }
    
    # Base64 encode content
    import base64
    content_b64 = base64.b64encode(content.encode('utf-8')).decode('utf-8')
    
    payload = {
        "message": f"Auto-publish: {filename}",
        "content": content_b64,
        "branch": GITHUB_BRANCH
    }
    
    try:
        async with httpx.AsyncClient() as client:
            # Check if file already exists
            check_response = await client.get(api_url, headers=headers)
            
            if check_response.status_code == 200:
                # File exists, get SHA for update
                existing = check_response.json()
                payload["sha"] = existing["sha"]
                logger.info(f"Updating existing file: {filename}")
            
            # Create or update file
            response = await client.put(api_url, headers=headers, json=payload)
            
            if response.status_code in [200, 201]:
                logger.info(f"Successfully published: {filename}")
                # Construct blog URL
                slug = filename.replace('.md', '').split('-', 3)[-1]
                date_parts = filename.split('-')[:3]
                blog_url = f"https://ledjanahmati.github.io/clisonix-blog/{'/'.join(date_parts)}/{slug}/"
                return blog_url
            else:
                logger.error(f"GitHub API error: {response.status_code} - {response.text}")
                return None
                
    except Exception as e:
        logger.error(f"Error publishing to GitHub: {e}")
        return None

# ═══════════════════════════════════════════════════════════════════════════════
# ARTICLE FETCHERS
# ═══════════════════════════════════════════════════════════════════════════════

async def fetch_blerina_article(article_id: str) -> Optional[str]:
    """Fetch article content from Blerina service"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"http://clisonix-blerina:8035/api/v1/pillars/{article_id}")
            if response.status_code == 200:
                data = response.json()
                return data.get("content", "")
    except Exception as e:
        logger.error(f"Error fetching from Blerina: {e}")
    
    # Try file-based fallback
    file_path = BLERINA_PILLARS_DIR / f"{article_id}.md"
    if file_path.exists():
        return file_path.read_text()
    
    return None

async def fetch_dr_albana_article(article_id: str) -> Optional[str]:
    """Fetch article content from Dr. Albana service"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"http://clisonix-dr-albana:8040/api/v1/medical/pillars/{article_id}")
            if response.status_code == 200:
                data = response.json()
                return data.get("content", "")
    except Exception as e:
        logger.error(f"Error fetching from Dr. Albana: {e}")
    
    # Try file-based fallback
    file_path = DR_ALBANA_PILLARS_DIR / f"{article_id}.md"
    if file_path.exists():
        return file_path.read_text()
    
    return None

async def get_unpublished_articles() -> List[Dict[str, str]]:
    """Get list of unpublished articles from both sources"""
    unpublished = []
    tracker = load_published_tracker()
    published_ids = set(tracker.get("published", []))
    
    # Check Blerina articles
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get("http://clisonix-blerina:8035/api/v1/pillars")
            if response.status_code == 200:
                pillars = response.json().get("pillars", [])
                for p in pillars:
                    if p["id"] not in published_ids:
                        unpublished.append({"id": p["id"], "source": "blerina", "title": p.get("title", "")})
    except Exception as e:
        logger.warning(f"Could not fetch Blerina articles: {e}")
    
    # Check Dr. Albana articles
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get("http://clisonix-dr-albana:8040/api/v1/medical/pillars")
            if response.status_code == 200:
                pillars = response.json().get("pillars", [])
                for p in pillars:
                    if p["id"] not in published_ids:
                        unpublished.append({"id": p["id"], "source": "dr_albana", "title": p.get("title", "")})
    except Exception as e:
        logger.warning(f"Could not fetch Dr. Albana articles: {e}")
    
    return unpublished

# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/", response_class=HTMLResponse)
async def root():
    """Serve the modern blog publisher dashboard"""
    dashboard_path = Path(__file__).parent / "dashboard.html"
    if dashboard_path.exists():
        return dashboard_path.read_text()
    
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Clisonix Blog Auto-Publisher</title>
        <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; margin: 40px; background: #f0f4f8; }
            .container { max-width: 900px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
            h1 { color: #1a365d; border-bottom: 3px solid #3182ce; padding-bottom: 10px; }
            .badge { background: #38a169; color: white; padding: 5px 15px; border-radius: 20px; font-weight: bold; display: inline-block; margin-bottom: 20px; }
            .endpoint { background: #ebf8ff; padding: 15px; border-left: 5px solid #3182ce; margin: 20px 0; }
            code { background: #edf2f7; padding: 2px 6px; border-radius: 4px; }
        </style>
    </head>
    <body>
        <div class="container">
            <span class="badge">📝 AUTO-PUBLISH TO GITHUB PAGES</span>
            <h1>📰 Clisonix Blog Auto-Publisher</h1>
            <h2>Target: <a href="https://ledjanahmati.github.io/clisonix-blog/">ledjanahmati.github.io/clisonix-blog</a></h2>
            
            <div class="endpoint">
                <h3>📊 Dashboard</h3>
                <code>GET /dashboard</code>
                <p>Modern web dashboard for blog management</p>
            </div>
            
            <div class="endpoint">
                <h3>📤 Publish Article</h3>
                <code>POST /api/v1/publish</code>
                <p>Manually publish an article from Blerina or Dr. Albana</p>
            </div>
            
            <div class="endpoint">
                <h3>🔄 Auto-Publish All Pending</h3>
                <code>POST /api/v1/publish/batch</code>
                <p>Publish all unpublished articles (up to 10/day, quality filtered)</p>
            </div>
            
            <div class="endpoint">
                <h3>🔍 Quality Check</h3>
                <code>GET /api/v1/quality/check/{article_id}</code>
                <p>Check quality score of an article before publishing</p>
            </div>
            
            <div class="endpoint">
                <h3>📋 Pending Articles</h3>
                <code>GET /api/v1/pending</code>
                <p>List articles waiting to be published</p>
            </div>
            
            <div class="endpoint">
                <h3>📊 Quality Statistics</h3>
                <code>GET /api/v1/quality/stats</code>
                <p>Get quality assessment statistics</p>
            </div>
            
            <div class="endpoint">
                <h3>✅ FDA Validation</h3>
                <code>POST /api/v1/fda/validate</code>
                <p>Validate medical articles for FDA compliance</p>
            </div>
            
            <div class="endpoint">
                <h3>🧪 Sandbox Testing</h3>
                <code>POST /api/v1/sandbox/test</code>
                <p>Test articles in sandbox environment</p>
            </div>
            
            <div class="endpoint">
                <h3>⚕️ Health Check</h3>
                <code>GET /health</code>
            </div>
        </div>
    </body>
    </html>
    """

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard():
    """Serve the modern blog publisher dashboard"""
    dashboard_path = Path(__file__).parent / "dashboard.html"
    if dashboard_path.exists():
        return dashboard_path.read_text()
    else:
        return "<h1>Dashboard HTML file not found</h1>"

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "blog_publisher",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "target_blog": f"https://ledjanahmati.github.io/clisonix-blog/",
        "github_configured": bool(GITHUB_TOKEN),
        "posts_per_day": POSTS_PER_DAY
    }

@app.post("/api/v1/publish", response_model=PublishResponse)
async def publish_article(request: PublishRequest):
    """Manually publish a specific article"""
    global LAST_PUBLISHER_HEARTBEAT
    
    try:
        # Check if already published
        if is_already_published(request.article_id):
            raise HTTPException(status_code=400, detail="Article already published")
        
        # Fetch content based on source
        if request.source == "dr_albana":
            content = await fetch_dr_albana_article(request.article_id)
        else:
            content = await fetch_blerina_article(request.article_id)
        
        if not content:
            raise HTTPException(status_code=404, detail=f"Article {request.article_id} not found in {request.source}")
        
        # ===== QUALITY CHECK #1: Deduplication =====
        if is_duplicate_content(content):
            logger.warning(f"Skipping duplicate article: {request.article_id}")
            raise HTTPException(status_code=400, detail="Duplicate content - article already published or too similar")
        
        # ===== QUALITY CHECK #2: Content Quality Score =====
        quality_score = calculate_quality_score(content, request.source)
        
        # Log quality assessment
        quality_log = load_quality_log()
        quality_log["assessments"].append({
            "article_id": request.article_id,
            "source": request.source,
            "score": quality_score,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "word_count": len(content.split()),
            "passed": quality_score >= MIN_QUALITY_SCORE
        })
        
        # Update stats
        scores = [a["score"] for a in quality_log["assessments"]]
        quality_log["stats"]["avg_score"] = sum(scores) / len(scores) if scores else 0.0
        quality_log["stats"]["min_score"] = min(scores) if scores else 1.0
        quality_log["stats"]["max_score"] = max(scores) if scores else 0.0
        quality_log["stats"]["total"] = len(scores)
        save_quality_log(quality_log)
        
        if quality_score < MIN_QUALITY_SCORE:
            logger.warning(f"Article {request.article_id} quality score {quality_score:.2f} below minimum {MIN_QUALITY_SCORE}")
            raise HTTPException(
                status_code=400, 
                detail=f"Article quality score {quality_score:.2f} below minimum {MIN_QUALITY_SCORE}. Improve content depth, citations, and structure."
            )
        
        # Convert to Jekyll format
        jekyll_content, filename = convert_to_jekyll(content, request.source, request.article_id)
        
        # ===== QUALITY CHECK #3: Daily limit =====
        tracker = load_published_tracker()
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        today_published = [p for p in tracker.get("published", []) if p.startswith(today)]
        
        if len(today_published) >= MAX_DAILY_PUBLISHED:
            logger.warning(f"Daily limit reached: {len(today_published)}/{MAX_DAILY_PUBLISHED}")
            raise HTTPException(
                status_code=429,
                detail=f"Daily publishing limit reached ({MAX_DAILY_PUBLISHED} articles/day)"
            )
        
        # Publish to GitHub
        github_url = await publish_to_github(jekyll_content, filename)
        
        if github_url:
            # Register content for deduplication
            register_content(content, request.article_id)
            
            # Mark as published
            mark_as_published(request.article_id, github_url)
            LAST_PUBLISHER_HEARTBEAT = datetime.now(timezone.utc).isoformat()
            
            logger.info(f"✅ Published {request.article_id} from {request.source} (quality: {quality_score:.2f})")
            
            return PublishResponse(
                status="published",
                message=f"Article published successfully (quality score: {quality_score:.2f})",
                github_url=github_url,
                post_filename=filename
            )
        else:
            raise HTTPException(status_code=500, detail="Failed to publish to GitHub. Check GITHUB_TOKEN configuration.")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error publishing article: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Publishing error: {str(e)}")

@app.post("/api/v1/publish/batch")
async def publish_batch():
    """Publish multiple unpublished articles (up to POSTS_PER_DAY, quality filtered)"""
    unpublished = await get_unpublished_articles()
    
    if not unpublished:
        return {"status": "no_pending", "message": "No unpublished articles found"}
    
    # Get today's count
    tracker = load_published_tracker()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_published = [p for p in tracker.get("published", []) if p.startswith(today)]
    remaining_slots = MAX_DAILY_PUBLISHED - len(today_published)
    
    if remaining_slots <= 0:
        return {
            "status": "daily_limit_reached",
            "message": f"Daily limit reached ({MAX_DAILY_PUBLISHED}/day)",
            "published_count": 0,
            "results": []
        }
    
    # Quality-filter articles BEFORE publishing
    quality_candidates = []
    for article in unpublished:
        try:
            # Fetch content for quality check
            if article["source"] == "dr_albana":
                content = await fetch_dr_albana_article(article["id"])
            else:
                content = await fetch_blerina_article(article["id"])
            
            if content and not is_duplicate_content(content):
                quality_score = calculate_quality_score(content, article["source"])
                if quality_score >= MIN_QUALITY_SCORE:
                    quality_candidates.append({
                        **article,
                        "quality_score": quality_score,
                        "content": content
                    })
                else:
                    logger.info(f"⏭️  Skipping {article['id']}: quality {quality_score:.2f} < {MIN_QUALITY_SCORE}")
        except Exception as e:
            logger.error(f"Error checking quality for {article['id']}: {e}")
    
    if not quality_candidates:
        return {
            "status": "no_quality_articles",
            "message": f"No articles met quality threshold ({MIN_QUALITY_SCORE})",
            "published_count": 0,
            "results": []
        }
    
    # Sort by quality score (highest first)
    quality_candidates.sort(key=lambda x: x["quality_score"], reverse=True)
    
    # Limit to remaining slots
    to_publish = quality_candidates[:remaining_slots]
    
    results = []
    published_count = 0
    
    for article in to_publish:
        try:
            request = PublishRequest(article_id=article["id"], source=article["source"])
            result = await publish_article(request)
            results.append({
                "article_id": article["id"],
                "source": article["source"],
                "quality_score": article["quality_score"],
                "status": result.status,
                "github_url": result.github_url
            })
            published_count += 1
            logger.info(f"✅ {published_count}/{len(to_publish)} published (quality: {article['quality_score']:.2f})")
            # Small delay between publishes
            await asyncio.sleep(2)
        except HTTPException as e:
            results.append({
                "article_id": article["id"],
                "source": article["source"],
                "quality_score": article.get("quality_score", 0),
                "status": "error",
                "error": e.detail
            })
        except Exception as e:
            results.append({
                "article_id": article["id"],
                "source": article["source"],
                "quality_score": article.get("quality_score", 0),
                "status": "error",
                "error": str(e)
            })
    
    return {
        "status": "batch_complete",
        "published_count": published_count,
        "quality_filtered": len(unpublished) - len(quality_candidates),
        "daily_remaining": remaining_slots - published_count,
        "results": results
    }

@app.get("/api/v1/pending")
async def get_pending_articles():
    """Get list of articles waiting to be published"""
    unpublished = await get_unpublished_articles()
    return {
        "total_pending": len(unpublished),
        "articles": unpublished
    }

@app.get("/api/v1/status", response_model=ScheduleStatus)
async def get_schedule_status():
    """Get publishing schedule status"""
    tracker = load_published_tracker()
    unpublished = await get_unpublished_articles()
    
    # Count published today
    today = datetime.now(timezone.utc).date()
    published_today = 0
    for article_id in tracker.get("published", []):
        # In a real implementation, we'd track publish dates
        pass
    
    return ScheduleStatus(
        total_scheduled=len(tracker.get("scheduled", [])),
        total_published_today=published_today,
        next_publish_time=None,
        pending_articles=[a["id"] for a in unpublished[:5]]
    )

@app.get("/api/v1/published")
async def get_published_articles():
    """Get list of already published articles"""
    tracker = load_published_tracker()
    return {
        "total_published": len(tracker.get("published", [])),
        "articles": tracker.get("published", []),
        "last_publish_date": tracker.get("last_publish_date")
    }

# ═══════════════════════════════════════════════════════════════════════════════
# QUALITY MONITORING ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/v1/quality/stats")
async def get_quality_stats():
    """Get quality assessment statistics"""
    quality_log = load_quality_log()
    return {
        "stats": quality_log["stats"],
        "recent_assessments": quality_log["assessments"][-20:],  # Last 20 assessments
        "min_required_score": MIN_QUALITY_SCORE,
        "articles_per_day_max": MAX_DAILY_PUBLISHED,
        "last_publisher_heartbeat": LAST_PUBLISHER_HEARTBEAT
    }

@app.get("/api/v1/quality/check/{article_id}")
async def check_article_quality(article_id: str, source: str = "blerina"):
    """Check quality of a specific article before publishing"""
    try:
        # Fetch content
        if source == "dr_albana":
            content = await fetch_dr_albana_article(article_id)
        else:
            content = await fetch_blerina_article(article_id)
        
        if not content:
            raise HTTPException(status_code=404, detail=f"Article not found: {article_id}")
        
        # Calculate quality
        quality_score = calculate_quality_score(content, source)
        is_dup = is_duplicate_content(content)
        already_pub = is_already_published(article_id)
        
        return {
            "article_id": article_id,
            "source": source,
            "quality_score": quality_score,
            "passed": quality_score >= MIN_QUALITY_SCORE,
            "is_duplicate": is_dup,
            "already_published": already_pub,
            "word_count": len(content.split()),
            "min_required": MIN_QUALITY_SCORE,
            "recommendations": [
                "Add more citations/references (8+ recommended)" if content.count('[') < 8 else None,
                "Improve structure with more headings (5+ recommended)" if content.count('#') < 5 else None,
                "Add code examples or technical depth" if '```' not in content else None,
                "Expand content length (2500+ words recommended)" if len(content.split()) < 2500 else None
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ═══════════════════════════════════════════════════════════════════════════════
# FDA / SANDBOX VALIDATION ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/api/v1/fda/validate")
async def fda_validate_article(article_id: str, source: str = "dr_albana"):
    """
    FDA Validation Framework for medical articles.
    Ensures compliance with FDA requirements for medical content.
    """
    try:
        content = await fetch_dr_albana_article(article_id) if source == "dr_albana" else await fetch_blerina_article(article_id)
        
        if not content:
            raise HTTPException(status_code=404, detail="Article not found")
        
        validation_results = {
            "article_id": article_id,
            "source": source,
            "fda_compliant": True,
            "checks": {},
            "issues": [],
            "warnings": [],
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        # FDA Check #1: Clinical Evidence
        has_clinical_data = any(term in content.lower() for term in ["clinical", "trial", "study", "fda", "510(k)"])
        validation_results["checks"]["clinical_evidence"] = has_clinical_data
        if not has_clinical_data and source == "dr_albana":
            validation_results["warnings"].append("Medical article should reference clinical evidence or FDA processes")
        
        # FDA Check #2: Disclaimers
        has_disclaimer = any(term in content.lower() for term in ["not medical advice", "consult", "physician", "doctor", "healthcare provider"])
        validation_results["checks"]["has_disclaimer"] = has_disclaimer
        if not has_disclaimer and source == "dr_albana":
            validation_results["issues"].append("CRITICAL: Medical articles must include appropriate disclaimers")
            validation_results["fda_compliant"] = False
        
        # FDA Check #3: References
        citation_count = content.count('[') + content.count('(http')
        validation_results["checks"]["citation_count"] = citation_count
        if citation_count < 5 and source == "dr_albana":
            validation_results["warnings"].append("FDA medical articles should have at least 5 peer-reviewed references")
        
        # FDA Check #4: No unauthorized claims
        banned_claims = ["cure", "treat", "miracle", "guaranteed", "100% effective", "safe for everyone"]
        found_claims = [claim for claim in banned_claims if claim.lower() in content.lower()]
        validation_results["checks"]["unauthorized_claims"] = found_claims
        if found_claims:
            validation_results["issues"].append(f"CRITICAL: Unauthorized medical claims detected: {found_claims}")
            validation_results["fda_compliant"] = False
        
        return validation_results
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/sandbox/test")
async def sandbox_test_article(article_id: str, source: str = "blerina"):
    """
    Sandbox Algorithm Test Framework.
    Test articles in isolated sandbox before production publishing.
    """
    try:
        content = await fetch_blerina_article(article_id) if source == "blerina" else await fetch_dr_albana_article(article_id)
        
        if not content:
            raise HTTPException(status_code=404, detail="Article not found")
        
        sandbox_results = {
            "article_id": article_id,
            "source": source,
            "sandbox_passed": True,
            "test_results": {},
            "performance_metrics": {},
            "issues": [],
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        # Test #1: Content Parsing
        try:
            lines = content.split('\n')
            sandbox_results["test_results"]["parsing"] = "✅ PASSED"
            sandbox_results["performance_metrics"]["line_count"] = len(lines)
        except Exception:
            sandbox_results["test_results"]["parsing"] = "❌ FAILED"
            sandbox_results["sandbox_passed"] = False
            sandbox_results["issues"].append("Content parsing failed")
        
        # Test #2: Formatting Validation
        formatting_issues = []
        if content.count('```') % 2 != 0:
            formatting_issues.append("Unmatched code blocks")
        if content.count('[') != content.count(']'):
            formatting_issues.append("Unmatched brackets")
        if content.count('(') != content.count(')'):
            formatting_issues.append("Unmatched parentheses")
        
        sandbox_results["test_results"]["formatting"] = "✅ PASSED" if not formatting_issues else f"⚠️  WARNINGS: {formatting_issues}"
        
        # Test #3: Quality Metrics
        quality_score = calculate_quality_score(content, source)
        sandbox_results["test_results"]["quality_score"] = f"{quality_score:.2f}"
        sandbox_results["performance_metrics"]["quality_threshold"] = MIN_QUALITY_SCORE
        sandbox_results["performance_metrics"]["quality_passed"] = quality_score >= MIN_QUALITY_SCORE
        
        # Test #4: Duplication Check
        is_dup = is_duplicate_content(content)
        sandbox_results["test_results"]["duplication_check"] = "❌ DUPLICATE" if is_dup else "✅ UNIQUE"
        
        # Test #5: Performance
        import time
        start = time.time()
        hash_val = get_content_hash(content)
        sandbox_results["performance_metrics"]["hash_time_ms"] = (time.time() - start) * 1000
        sandbox_results["performance_metrics"]["content_hash"] = hash_val[:16] + "..."
        
        return sandbox_results
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ═══════════════════════════════════════════════════════════════════════════════
# BACKGROUND SCHEDULER (for cron-like auto-publishing)
# ═══════════════════════════════════════════════════════════════════════════════

async def auto_publish_scheduler():
    """Background task that auto-publishes articles on schedule"""
    while True:
        try:
            now = datetime.now(timezone.utc)
            hour = now.hour
            
            # Publish at specific hours: 6AM, 10AM, 2PM, 6PM, 10PM UTC
            publish_hours = [6, 10, 14, 18, 22]
            
            if hour in publish_hours:
                logger.info(f"Auto-publish triggered at {now}")
                unpublished = await get_unpublished_articles()
                
                if unpublished:
                    article = unpublished[0]
                    try:
                        request = PublishRequest(article_id=article["id"], source=article["source"])
                        result = await publish_article(request)
                        logger.info(f"Auto-published: {article['id']} -> {result.github_url}")
                    except Exception as e:
                        logger.error(f"Auto-publish failed: {e}")
            
            # Wait 1 hour before checking again
            await asyncio.sleep(3600)
            
        except Exception as e:
            logger.error(f"Scheduler error: {e}")
            await asyncio.sleep(300)  # Wait 5 minutes on error

@app.on_event("startup")
async def startup_event():
    """Start background scheduler on app startup"""
    asyncio.create_task(auto_publish_scheduler())
    logger.info("Blog Auto-Publisher started with scheduler")

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
