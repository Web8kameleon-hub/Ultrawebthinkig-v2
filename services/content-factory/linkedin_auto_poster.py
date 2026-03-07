#!/usr/bin/env python3
"""
LinkedIn Auto Poster - Automated content publishing system
Posts blog articles to LinkedIn on a schedule

Features:
- Daily cron job posting
- Tracks posted articles to avoid duplicates
- Generates engaging post text from article content
- Supports manual posting via API
"""

import asyncio
import hashlib
import json
import logging
import os
import re
from datetime import datetime
from pathlib import Path

import requests

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('linkedin_auto_poster')

# Configuration
LINKEDIN_ACCESS_TOKEN = os.getenv('LINKEDIN_ACCESS_TOKEN')
LINKEDIN_PERSON_URN = os.getenv('LINKEDIN_PERSON_URN', 'urn:li:person:5KOBp94BOT')
POSTED_ARTICLES_FILE = Path('/app/data/posted_articles.json')
BLOG_URL = os.getenv('BLOG_URL', 'https://web8kameleon-hub.github.io/clisonix-blog/')
SITE_URL = os.getenv('SITE_URL', 'https://clisonix.com')
LINKEDIN_POLL_SECONDS = int(os.getenv('LINKEDIN_POLL_SECONDS', '60'))
LINKEDIN_POST_ALL_PENDING = os.getenv('LINKEDIN_POST_ALL_PENDING', 'true').lower() in ('1', 'true', 'yes', 'on')
DOCUMENT_SCAN_ENABLED = os.getenv('LINKEDIN_SCAN_DOCUMENTS', 'true').lower() in ('1', 'true', 'yes', 'on')
DOCUMENT_SCAN_GLOB = os.getenv('LINKEDIN_DOCUMENT_GLOB', '*.md')
DOCUMENT_SCAN_DIRS = [
    Path(p.strip())
    for p in os.getenv('LINKEDIN_DOCUMENT_DIRS', '/app/blerina_pillars,/app/medical_pillars,/app/lagter_pillars').split(',')
    if p.strip()
]
DOCUMENT_SNAPSHOT_FILE = Path('/app/data/document_snapshot.json')
LAGTER_TRIGGER_ENABLED = os.getenv('LINKEDIN_TRIGGER_LAGTER', 'true').lower() in ('1', 'true', 'yes', 'on')
LAGTER_TRIGGER_URL = os.getenv('LAGTER_TRIGGER_URL', 'http://clisonix-lagter:9500/api/v1/publish/batch').strip()

# Ensure data directory exists
POSTED_ARTICLES_FILE.parent.mkdir(parents=True, exist_ok=True)


def load_document_snapshot() -> dict:
    if DOCUMENT_SNAPSHOT_FILE.exists():
        try:
            with open(DOCUMENT_SNAPSHOT_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading document snapshot: {e}")
    return {"seen": {}, "last_updated": None}


def save_document_snapshot(data: dict) -> None:
    with open(DOCUMENT_SNAPSHOT_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)


def build_initial_document_snapshot() -> None:
    if not DOCUMENT_SCAN_ENABLED:
        return
    snapshot = load_document_snapshot()
    if snapshot.get('seen'):
        return
    seen: dict[str, str] = {}
    for directory in DOCUMENT_SCAN_DIRS:
        if not directory.exists():
            continue
        for file_path in directory.rglob(DOCUMENT_SCAN_GLOB):
            if file_path.is_file():
                seen[str(file_path)] = str(file_path.stat().st_mtime)
    save_document_snapshot({
        "seen": seen,
        "last_updated": datetime.now().isoformat()
    })
    logger.info(f"Initialized document snapshot with {len(seen)} files")


def _extract_title_from_document(file_path: Path, content: str) -> str:
    lines = [line.strip() for line in content.splitlines() if line.strip()]
    for line in lines[:25]:
        if line.startswith('#'):
            return re.sub(r'^#+\s*', '', line).strip()[:120]
    return file_path.stem.replace('-', ' ').replace('_', ' ').title()[:120]


def fetch_new_document_articles() -> list:
    if not DOCUMENT_SCAN_ENABLED:
        return []

    snapshot = load_document_snapshot()
    seen = snapshot.get('seen', {})
    updated_seen = dict(seen)
    new_articles: list[dict] = []

    for directory in DOCUMENT_SCAN_DIRS:
        if not directory.exists():
            continue
        for file_path in directory.rglob(DOCUMENT_SCAN_GLOB):
            if not file_path.is_file():
                continue

            path_key = str(file_path)
            mtime = str(file_path.stat().st_mtime)
            if path_key in seen:
                updated_seen[path_key] = mtime
                continue

            try:
                content = file_path.read_text(encoding='utf-8', errors='ignore')
            except Exception as e:
                logger.error(f"Error reading new document {file_path}: {e}")
                continue

            title = _extract_title_from_document(file_path, content)
            article_id = f"doc-{hashlib.md5(path_key.encode()).hexdigest()[:16]}"
            description = f"New document generated: {file_path.name}"
            tags = extract_tags_from_title(f"{title} {file_path.parent.name}")

            new_articles.append({
                'id': article_id,
                'title': title,
                'description': description,
                'slug': file_path.stem,
                'url': f"{SITE_URL.rstrip('/')}/blog",
                'date': datetime.now().strftime('%Y-%m-%d'),
                'category': 'Documents',
                'tags': tags,
                'source_file': path_key,
            })

            updated_seen[path_key] = mtime

    if updated_seen != seen:
        save_document_snapshot({
            "seen": updated_seen,
            "last_updated": datetime.now().isoformat()
        })

    if new_articles:
        logger.info(f"Detected {len(new_articles)} newly created document(s)")
    return new_articles


def trigger_lagter_publish() -> dict:
    if not LAGTER_TRIGGER_ENABLED or not LAGTER_TRIGGER_URL:
        return {'ok': False, 'reason': 'disabled'}
    try:
        response = requests.post(LAGTER_TRIGGER_URL, timeout=20)
        if 200 <= response.status_code < 300:
            logger.info(f"Lagter trigger succeeded: {response.status_code}")
            return {'ok': True, 'status_code': response.status_code}
        logger.warning(f"Lagter trigger non-success status: {response.status_code}")
        return {'ok': False, 'status_code': response.status_code, 'error': response.text[:300]}
    except Exception as e:
        logger.warning(f"Lagter trigger failed: {e}")
        return {'ok': False, 'error': str(e)}


def load_posted_articles() -> set:
    """Load the set of already posted article IDs."""
    if POSTED_ARTICLES_FILE.exists():
        try:
            with open(POSTED_ARTICLES_FILE, 'r') as f:
                data = json.load(f)
                return set(data.get('posted', []))
        except Exception as e:
            logger.error(f"Error loading posted articles: {e}")
    return set()


def save_posted_article(article_id: str) -> None:
    """Save an article ID to the posted list."""
    posted = load_posted_articles()
    posted.add(article_id)
    
    with open(POSTED_ARTICLES_FILE, 'w') as f:
        json.dump({
            'posted': list(posted),
            'last_updated': datetime.now().isoformat()
        }, f, indent=2)


def generate_post_text(article: dict) -> str:
    """Generate engaging LinkedIn post text from article data."""
    title = article.get('title', 'New Article')
    description = article.get('description', article.get('excerpt', ''))
    # Use direct blog URL if available, otherwise construct from slug
    article_url = article.get('url', f"{BLOG_URL}static/{article.get('slug', '')}.html")
    tags = article.get('tags', [])
    
    # Build hashtags from tags
    hashtags = ' '.join([f'#{tag.replace(" ", "")}' for tag in tags[:5]])
    if not hashtags:
        hashtags = '#AI #CloudComputing #EEG #IndustrialAI #Clisonix'
    
    # Generate post text
    post_text = f"""🚀 New Article: {title}

{description[:200]}{'...' if len(description) > 200 else ''}

📖 Read more: {article_url}

{hashtags}

#Clisonix #TechInnovation"""
    
    return post_text


def post_to_linkedin(text: str) -> dict:
    """Post content to LinkedIn."""
    if not LINKEDIN_ACCESS_TOKEN:
        logger.error("LINKEDIN_ACCESS_TOKEN not configured")
        return {'success': False, 'error': 'Token not configured'}
    
    headers = {
        'Authorization': f'Bearer {LINKEDIN_ACCESS_TOKEN}',
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
    }
    
    post_data = {
        'author': LINKEDIN_PERSON_URN,
        'lifecycleState': 'PUBLISHED',
        'specificContent': {
            'com.linkedin.ugc.ShareContent': {
                'shareCommentary': {
                    'text': text
                },
                'shareMediaCategory': 'NONE'
            }
        },
        'visibility': {
            'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
        }
    }
    
    try:
        response = requests.post(
            'https://api.linkedin.com/v2/ugcPosts',
            headers=headers,
            json=post_data,
            timeout=30
        )
        
        if response.status_code == 201:
            result = response.json()
            logger.info(f"Successfully posted to LinkedIn: {result.get('id')}")
            return {'success': True, 'post_id': result.get('id')}
        else:
            logger.error(f"LinkedIn API error: {response.status_code} - {response.text}")
            return {'success': False, 'error': response.text}
            
    except Exception as e:
        logger.error(f"Error posting to LinkedIn: {e}")
        return {'success': False, 'error': str(e)}


def fetch_blog_articles() -> list:
    """Fetch articles from GitHub Pages blog by parsing HTML."""
    import re
    try:
        response = requests.get(BLOG_URL, timeout=15)
        if response.status_code == 200:
            html = response.text
            # Parse article links from HTML
            # Format: <a href="static/2026-02-07-slug.html">Title</a>
            pattern = r'href="(static/(\d{4}-\d{2}-\d{2})-([^"]+)\.html)">([^<]+)</a>'
            matches = re.findall(pattern, html)
            
            articles = []
            for url_path, date, slug, title in matches:
                # Clean up title
                title = title.strip()
                if not title or title == 'Clisonix Blog':
                    continue
                
                full_url = f"{BLOG_URL.rstrip('/')}/{url_path}"
                    
                articles.append({
                    'id': f"{date}-{slug}",
                    'title': title,
                    'description': f'Read our latest article: {title}',
                    'slug': slug,
                    'url': full_url,
                    'date': date,
                    'category': 'Blog',
                    'tags': extract_tags_from_title(title)
                })
            
            logger.info(f"Fetched {len(articles)} articles from blog")
            return articles
    except Exception as e:
        logger.error(f"Error fetching articles from blog: {e}")
    
    # Fallback: return sample articles if blog not available
    return get_sample_articles()


def extract_tags_from_title(title: str) -> list:
    """Extract relevant hashtags from article title."""
    keywords = {
        'EEG': 'EEG', 'Brain': 'BrainTech', 'Neural': 'NeuralNetworks',
        'AI': 'AI', 'Healthcare': 'Healthcare', 'FDA': 'FDA',
        'Edge': 'EdgeComputing', 'Cloud': 'CloudComputing',
        'Medical': 'MedicalDevices', 'Compliance': 'Compliance',
        'Data': 'DataScience', 'Audio': 'AudioAnalysis',
        'Signal': 'SignalProcessing', 'Privacy': 'DataPrivacy',
        'Industrial': 'IndustrialAI', 'Sustainable': 'Sustainability'
    }
    
    tags = ['Clisonix']
    for keyword, tag in keywords.items():
        if keyword.lower() in title.lower():
            tags.append(tag)
    
    return tags[:5]  # Limit to 5 tags


def get_sample_articles() -> list:
    """Return sample articles for testing."""
    return [
        {
            'id': 'eeg-analysis-intro',
            'title': 'Introduction to EEG Analysis with AI',
            'description': 'Learn how artificial intelligence is revolutionizing EEG signal processing and brain-computer interfaces.',
            'slug': 'eeg-analysis-intro',
            'category': 'EEG Analytics',
            'tags': ['EEG', 'AI', 'BrainTech', 'NeuralNetworks']
        },
        {
            'id': 'industrial-ai-2026',
            'title': 'Industrial AI Trends for 2026',
            'description': 'Discover the latest trends in industrial artificial intelligence and how they are transforming manufacturing.',
            'slug': 'industrial-ai-trends-2026',
            'category': 'Industrial AI',
            'tags': ['IndustrialAI', 'Manufacturing', 'Industry40', 'Automation']
        },
        {
            'id': 'fda-compliance-ai',
            'title': 'FDA Compliance in AI Medical Devices',
            'description': 'A comprehensive guide to navigating FDA regulations for AI-powered medical devices and software.',
            'slug': 'fda-compliance-ai-medical',
            'category': 'Compliance',
            'tags': ['FDA', 'MedicalDevices', 'Compliance', 'Healthcare']
        },
        {
            'id': 'ocean-ai-launch',
            'title': 'Introducing Curiosity Ocean: Your AI Research Assistant',
            'description': 'Meet Curiosity Ocean, our advanced AI assistant for research, document analysis, and intelligent Q&A.',
            'slug': 'curiosity-ocean-launch',
            'category': 'Product',
            'tags': ['AI', 'ChatBot', 'Research', 'Productivity']
        },
        {
            'id': 'neural-biofeedback',
            'title': 'Real-time Neural Biofeedback Systems',
            'description': 'How real-time biofeedback is enabling new therapeutic approaches for stress, focus, and mental wellness.',
            'slug': 'neural-biofeedback-systems',
            'category': 'EEG Analytics',
            'tags': ['Biofeedback', 'Neuroscience', 'Wellness', 'MentalHealth']
        }
    ]


def run_post_cycle(post_all: bool = True) -> dict:
    """Run one posting cycle. If post_all=True, posts all pending articles."""
    logger.info("Starting LinkedIn post cycle...")

    trigger_lagter_publish()
    
    posted = load_posted_articles()
    new_document_articles = fetch_new_document_articles()
    blog_articles = fetch_blog_articles()
    articles = new_document_articles + blog_articles
    
    posted_results: list[dict] = []

    # Find articles that haven't been posted yet
    for article in articles:
        article_id = article.get('id') or hashlib.md5(article.get('title', '').encode()).hexdigest()
        
        if article_id not in posted:
            logger.info(f"Found unposted article: {article.get('title')}")
            
            # Generate and post
            post_text = generate_post_text(article)
            result = post_to_linkedin(post_text)
            
            if result.get('success'):
                save_posted_article(article_id)
                posted_results.append({
                    'article': article.get('title'),
                    'article_id': article_id,
                    'post_id': result.get('post_id')
                })

                if not post_all:
                    return {
                        'success': True,
                        'posted_count': 1,
                        'posted': posted_results
                    }
            else:
                return {
                    'success': False,
                    'article': article.get('title'),
                    'error': result.get('error')
                }
    
    if posted_results:
        logger.info(f"Posted {len(posted_results)} new LinkedIn articles")
        return {
            'success': True,
            'posted_count': len(posted_results),
            'posted': posted_results
        }

    logger.info("No new articles to post")
    return {'success': True, 'posted_count': 0, 'message': 'No new articles to post'}


def run_daily_post() -> dict:
    """Backward-compatible daily job - posts one unposted article."""
    logger.info("Starting daily LinkedIn post job...")
    return run_post_cycle(post_all=False)


async def continuous_auto_post_loop() -> None:
    """Continuously poll for new articles and post automatically."""
    logger.info(
        f"Starting continuous LinkedIn auto-post loop: interval={LINKEDIN_POLL_SECONDS}s, "
        f"post_all_pending={LINKEDIN_POST_ALL_PENDING}"
    )
    while True:
        try:
            run_post_cycle(post_all=LINKEDIN_POST_ALL_PENDING)
        except Exception as e:
            logger.error(f"Continuous auto-post loop error: {e}")
        await asyncio.sleep(max(10, LINKEDIN_POLL_SECONDS))


def post_specific_article(article_id: str) -> dict:
    """Post a specific article by ID (manual trigger)."""
    articles = fetch_blog_articles()
    
    for article in articles:
        if article.get('id') == article_id or article.get('slug') == article_id:
            post_text = generate_post_text(article)
            result = post_to_linkedin(post_text)
            
            if result.get('success'):
                save_posted_article(article_id)
            
            return result
    
    return {'success': False, 'error': 'Article not found'}


def post_custom_content(text: str) -> dict:
    """Post custom content to LinkedIn (manual)."""
    return post_to_linkedin(text)


# FastAPI endpoints for the automation service
def create_app():
    """Create FastAPI app for the LinkedIn automation service."""
    from fastapi import BackgroundTasks, FastAPI, HTTPException
    from pydantic import BaseModel
    
    app = FastAPI(
        title="LinkedIn Auto Poster",
        description="Automated LinkedIn posting service for Clisonix blog articles",
        version="1.0.0"
    )
    
    class CustomPostRequest(BaseModel):
        text: str
    
    class ArticlePostRequest(BaseModel):
        article_id: str
    
    @app.get("/health")
    async def health() -> dict[str, str]:
        return {
            "status": "healthy",
            "service": "linkedin-auto-poster",
            "timestamp": datetime.now().isoformat(),
            "poll_seconds": str(LINKEDIN_POLL_SECONDS),
            "post_all_pending": str(LINKEDIN_POST_ALL_PENDING),
            "scan_documents": str(DOCUMENT_SCAN_ENABLED),
            "scan_document_dirs": ','.join([str(d) for d in DOCUMENT_SCAN_DIRS]),
            "trigger_lagter": str(LAGTER_TRIGGER_ENABLED),
            "lagter_trigger_url": LAGTER_TRIGGER_URL
        }
    
    @app.post("/api/linkedin/post-daily")
    async def trigger_daily_post(background_tasks: BackgroundTasks) -> dict[str, object]:
        """Trigger the daily posting job."""
        result = run_daily_post()
        return result

    @app.post("/api/linkedin/post-now-all")
    async def trigger_post_all_now() -> dict[str, object]:
        """Immediately post all pending articles."""
        result = run_post_cycle(post_all=True)
        return result
    
    @app.post("/api/linkedin/post-article")
    async def post_article(request: ArticlePostRequest):
        """Post a specific article to LinkedIn."""
        result = post_specific_article(request.article_id)
        if not result.get('success'):
            raise HTTPException(status_code=400, detail=result.get('error'))
        return result
    
    @app.post("/api/linkedin/post-custom")
    async def post_custom(request: CustomPostRequest):
        """Post custom content to LinkedIn."""
        result = post_custom_content(request.text)
        if not result.get('success'):
            raise HTTPException(status_code=400, detail=result.get('error'))
        return result
    
    @app.get("/api/linkedin/posted-articles")
    async def get_posted_articles():
        """Get list of already posted articles."""
        posted = load_posted_articles()
        return {"posted": list(posted), "count": len(posted)}
    
    @app.get("/api/linkedin/pending-articles")
    async def get_pending_articles():
        """Get list of articles not yet posted."""
        posted = load_posted_articles()
        articles = fetch_blog_articles()
        
        pending = []
        for article in articles:
            article_id = article.get('id') or hashlib.md5(article.get('title', '').encode()).hexdigest()
            if article_id not in posted:
                pending.append(article)
        
        return {"pending": pending, "count": len(pending)}

    @app.on_event("startup")
    async def start_continuous_loop() -> None:
        build_initial_document_snapshot()
        asyncio.create_task(continuous_auto_post_loop())
        logger.info("Continuous LinkedIn auto-post loop started")
    
    return app


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "daily":
            # Run daily job
            result = run_daily_post()
            print(json.dumps(result, indent=2))
        elif sys.argv[1] == "test":
            # Test posting
            result = post_custom_content("🧪 Test post from Clisonix LinkedIn Auto Poster!")
            print(json.dumps(result, indent=2))
        elif sys.argv[1] == "serve":
            # Run as API server
            import uvicorn
            app = create_app()
            uvicorn.run(app, host="0.0.0.0", port=8007)
    else:
        print("Usage: python linkedin_auto_poster.py [daily|test|serve]")
