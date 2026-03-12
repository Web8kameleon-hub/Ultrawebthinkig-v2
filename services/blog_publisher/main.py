#!/usr/bin/env python3
"""
╔═══════════════════════════════════════════════════════════════════════════════╗
║  CLISONIX BLOG AUTO-PUBLISHER                                                 ║
║  Automatically publishes articles from Blerina & Dr. Albana to GitHub Pages   ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  Features:                                                                    ║
║  - Auto-converts articles to Jekyll format                                    ║
║  - Publishes new articles immediately (continuous auto-publish)              ║
║  - Pushes to GitHub Pages repository                                          ║
║  - Tracks published articles to avoid duplicates                              ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Target: https://ledjanahmati.github.io/clisonix-blog/
Port: 8041
Author: Ledjan Ahmati (CEO, ABA GmbH)
"""

import asyncio
import hashlib
import json
import logging
import os
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
from fastapi import BackgroundTasks, FastAPI, HTTPException
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
GITHUB_REPO = os.getenv("GITHUB_REPO", "LedjanAhmati/clisonix-blog")
GITHUB_BRANCH = os.getenv("GITHUB_BRANCH", "main")

# Source directories for articles
BLERINA_PILLARS_DIR = Path(os.getenv("BLERINA_PILLARS_DIR", "/app/blerina_pillars"))
DR_ALBANA_PILLARS_DIR = Path(os.getenv("DR_ALBANA_PILLARS_DIR", "/app/medical_pillars"))

# LinkedIn publishing configuration
LINKEDIN_ACCESS_TOKEN = os.getenv("LINKEDIN_ACCESS_TOKEN", "")
LINKEDIN_PERSON_URN = os.getenv("LINKEDIN_PERSON_URN", "")
LINKEDIN_ORGANIZATION_URN = os.getenv("LINKEDIN_ORGANIZATION_URN", "")
LINKEDIN_ENABLED = bool(LINKEDIN_ACCESS_TOKEN)

# Local tracking
PUBLISHED_TRACKER = Path("/app/published_tracker.json")
AUTO_PUBLISH_INTERVAL_SECONDS = int(os.getenv("AUTO_PUBLISH_INTERVAL_SECONDS", "30"))

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
# LINKEDIN PUBLISHER - DYNAMIC REAL-TIME POSTING
# ═══════════════════════════════════════════════════════════════════════════════

class LinkedInPublisher:
    """Publish to LinkedIn - Dynamic Real-Time Posting on Article Generation"""
    
    def __init__(self, access_token: Optional[str], person_urn: Optional[str] = None, org_urn: Optional[str] = None):
        self.access_token = access_token
        self.person_urn = person_urn or ""
        self.org_urn = org_urn or ""
        self.api_url = "https://api.linkedin.com/v2"
    
    def _build_hashtags(self, content_type: str = "tech", article_title: str = "") -> str:
        """Build rich hashtags based on content type"""
        base_tags = {
            "tech": "#AI #MachineLearning #EdgeComputing #RealtimeProcessing #TechInnovation #CloudArchitecture",
            "medical": "#MedTech #Healthcare #ClinicalAI #EEG #BrainComputerInterface #WellnessAI #HealthTech",
            "audio": "#AudioProcessing #SignalProcessing #SpeechRecognition #DSP #AI #Innovation",
            "eeg": "#EEG #Neuroscience #BCI #BrainHealth #ClinicalMonitoring #NeuroTech #AI",
            "industrial": "#IndustrialAI #Industry40 #Automation #RealTimeData #IoT #SmartManufacturing"
        }
        
        # Auto-detect from title
        if "medical" in article_title.lower() or "clinical" in article_title.lower() or "health" in article_title.lower():
            content_type = "medical"
        elif "eeg" in article_title.lower() or "brain" in article_title.lower():
            content_type = "eeg"
        elif "audio" in article_title.lower() or "speech" in article_title.lower():
            content_type = "audio"
        
        base = base_tags.get(content_type, base_tags["tech"])
        # Add Clisonix brand tags
        return f"{base} #Clisonix #Web8 #EthicalTech #ClisonixCloud"
    
    async def publish(self, excerpt: str, article_title: str, article_url: str = "", is_medical: bool = False) -> Dict[str, Any]:
        """Publish post to LinkedIn - DYNAMIC REAL-TIME"""
        
        if not self.access_token:
            logger.warning("LinkedIn publishing skipped: No access token configured")
            return {"success": False, "error": "No LinkedIn token configured", "platform": "linkedin"}
        
        try:
            if not httpx:
                return {"success": False, "error": "httpx not available", "platform": "linkedin"}
            
            # Build rich post with hashtags
            hashtags = self._build_hashtags("medical" if is_medical else "tech", article_title)
            excerpt_clean = excerpt[:280] if len(excerpt) > 280 else excerpt
            
            # Format: Emoji + Title + Excerpt + Article Link + Rich Hashtags
            emoji = "🏥" if is_medical else "🚀"
            
            if article_url:
                post_text = f"{emoji} {article_title}\n\n{excerpt_clean}\n\n📖 Read: {article_url}\n\n{hashtags}"
            else:
                post_text = f"{emoji} {article_title}\n\n{excerpt_clean}\n\n{hashtags}"
            
            # Ensure we respect LinkedIn's 3000 char limit
            post_text = post_text[:2950]
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Use provided URN directly
                author_urn = self.person_urn if self.person_urn else "urn:li:person:unknown"
                
                # Create post payload
                post_data = {
                    "author": author_urn,
                    "lifecycleState": "PUBLISHED",
                    "specificContent": {
                        "com.linkedin.ugc.ShareContent": {
                            "shareCommentary": {"text": post_text},
                            "shareMediaCategory": "NONE"
                        }
                    },
                    "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"}
                }
                
                response = await client.post(
                    f"{self.api_url}/ugcPosts",
                    headers={
                        "Authorization": f"Bearer {self.access_token}",
                        "Content-Type": "application/json",
                        "X-Restli-Protocol-Version": "2.0.0"
                    },
                    json=post_data,
                    timeout=30.0
                )
                
                if response.status_code in [200, 201]:
                    post_id = response.headers.get("x-restli-id", "unknown")
                    logger.info(f"✅ LinkedIn post published: {article_title[:50]}... (ID: {post_id})")
                    return {
                        "success": True,
                        "platform": "linkedin",
                        "post_id": post_id,
                        "url": f"https://www.linkedin.com/feed/update/{post_id}",
                        "published_at": datetime.now(timezone.utc).isoformat(),
                        "dynamic": True,
                        "is_medical": is_medical
                    }
                else:
                    logger.error(f"❌ LinkedIn post failed: {response.status_code} - {response.text[:200]}")
                    return {"success": False, "error": response.text[:200], "platform": "linkedin", "dynamic": True}
        
        except Exception as e:
            logger.error(f"LinkedIn publishing exception: {str(e)}")
            return {"success": False, "error": str(e), "platform": "linkedin", "dynamic": True}

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
                <h3>📤 Publish Article</h3>
                <code>POST /api/v1/publish</code>
                <p>Manually publish an article from Blerina or Dr. Albana</p>
            </div>
            
            <div class="endpoint">
                <h3>🔄 Auto-Publish All Pending</h3>
                <code>POST /api/v1/publish/batch</code>
                <p>Publish all unpublished articles immediately</p>
            </div>
            
            <div class="endpoint">
                <h3>📋 Get Unpublished</h3>
                <code>GET /api/v1/pending</code>
                <p>List articles waiting to be published</p>
            </div>
            
            <div class="endpoint">
                <h3>📊 Schedule Status</h3>
                <code>GET /api/v1/status</code>
                <p>Check publishing schedule and stats</p>
            </div>
            
            <div class="endpoint">
                <h3>⚕️ Health Check</h3>
                <code>GET /health</code>
            </div>
        </div>
    </body>
    </html>
    """

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "blog_publisher",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "target_blog": f"https://ledjanahmati.github.io/clisonix-blog/",
        "github_configured": bool(GITHUB_TOKEN),
        "auto_publish_interval_seconds": AUTO_PUBLISH_INTERVAL_SECONDS
    }

@app.post("/api/v1/publish", response_model=PublishResponse)
async def publish_article(request: PublishRequest):
    """Manually publish a specific article"""
    
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
    
    # Convert to Jekyll format
    jekyll_content, filename = convert_to_jekyll(content, request.source, request.article_id)
    
    # Extract title for LinkedIn
    title = extract_title_from_markdown(content)
    excerpt = content[:500] if len(content) > 500 else content
    
    # Publish to GitHub FIRST (local storage always works)
    github_url = await publish_to_github(jekyll_content, filename)
    
    if github_url:
        mark_as_published(request.article_id, github_url)
        
        # 🚀 PUBLISH TO LINKEDIN IMMEDIATELY (Dynamic Real-Time Posting)
        linkedin_result = None
        if LINKEDIN_ENABLED:
            is_medical = request.source == "dr_albana"
            linkedin_publisher = LinkedInPublisher(
                LINKEDIN_ACCESS_TOKEN,
                person_urn=LINKEDIN_PERSON_URN,
                org_urn=LINKEDIN_ORGANIZATION_URN
            )
            linkedin_result = await linkedin_publisher.publish(
                excerpt=excerpt,
                article_title=title,
                article_url=github_url,
                is_medical=is_medical
            )
            
            if linkedin_result.get("success"):
                logger.info(f"🚀 SUCCESS: Published to both GitHub & LinkedIn: {title}")
            else:
                logger.warning(f"⚠️  GitHub OK but LinkedIn failed: {linkedin_result.get('error')}")
        
        return PublishResponse(
            status="published",
            message=f"Article published successfully to GitHub Pages{' & LinkedIn' if LINKEDIN_ENABLED else ''}",
            github_url=github_url,
            post_filename=filename
        )
    else:
        return PublishResponse(
            status="error",
            message="Failed to publish to GitHub. Check GITHUB_TOKEN configuration.",
            post_filename=filename
        )

@app.post("/api/v1/publish/batch")
async def publish_batch():
    """Publish all unpublished articles immediately"""
    unpublished = await get_unpublished_articles()
    
    if not unpublished:
        return {"status": "no_pending", "message": "No unpublished articles found"}
    
    results = []
    
    for article in unpublished:
        try:
            request = PublishRequest(article_id=article["id"], source=article["source"], schedule_time=None)
            result = await publish_article(request)
            results.append({
                "article_id": article["id"],
                "source": article["source"],
                "status": result.status,
                "github_url": result.github_url
            })
            # Small delay between publishes
            await asyncio.sleep(2)
        except Exception as e:
            results.append({
                "article_id": article["id"],
                "source": article["source"],
                "status": "error",
                "error": str(e)
            })
    
    return {
        "status": "batch_complete",
        "published_count": len([r for r in results if r["status"] == "published"]),
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
# BACKGROUND SCHEDULER (for cron-like auto-publishing)
# ═══════════════════════════════════════════════════════════════════════════════

async def auto_publish_scheduler():
    """Background task that continuously auto-publishes newly generated articles"""
    while True:
        try:
            unpublished = await get_unpublished_articles()
            if unpublished:
                logger.info(f"Auto-publish detected {len(unpublished)} pending article(s)")

            for article in unpublished:
                try:
                    request = PublishRequest(article_id=article["id"], source=article["source"], schedule_time=None)
                    result = await publish_article(request)
                    logger.info(f"Auto-published: {article['id']} -> {result.github_url}")
                    await asyncio.sleep(1)
                except Exception as e:
                    logger.error(f"Auto-publish failed for {article['id']}: {e}")

            await asyncio.sleep(AUTO_PUBLISH_INTERVAL_SECONDS)
            
        except Exception as e:
            logger.error(f"Scheduler error: {e}")
            await asyncio.sleep(300)  # Wait 5 minutes on error

@app.on_event("startup")
async def startup_event():
    """Start background scheduler on app startup"""
    asyncio.create_task(auto_publish_scheduler())
    logger.info(
        f"Blog Auto-Publisher started with continuous mode (interval={AUTO_PUBLISH_INTERVAL_SECONDS}s)"
    )

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
