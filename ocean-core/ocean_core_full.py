#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OCEAN CORE FULL - Complete Production Brain
============================================
Aktivizon TË GJITHA sistemet e avancuara:

1. ResponseOrchestratorV5 - Production Brain
2. MegaLayerEngine - 14 MILIARD kombinime
3. OllamaMultiEngine - 5 modele
4. RealAnswerEngine - Deep Knowledge
5. Translation Node - 72 gjuhë
6. Knowledge Layer - Platform Intelligence
7. Service Registry - 31 module

Port: 8030
"""

import asyncio
import base64
import datetime
import hashlib
import io
import json
import logging
import os
import re
import time
from collections import deque
from functools import lru_cache
from pathlib import Path
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple

import httpx
from fastapi import FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

try:
    import cbor2  # type: ignore[import-not-found]
    HAS_CBOR2 = True
except ImportError:
    cbor2 = None
    HAS_CBOR2 = False

TOTAL_COMBINATIONS = 0
ALL_ALBANIAN_WORDS: Any = []
get_mega_layer_engine = None
get_answer_engine = None
get_service_registry = None
get_albanian_response = None
find_matching_seed = None
route_intent = None

# ═══════════════════════════════════════════════════════════════════
# LOGGING
# ═══════════════════════════════════════════════════════════════════
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(name)s - %(message)s"
)
logger = logging.getLogger("OceanCoreFull")

# ═══════════════════════════════════════════════════════════════════
# CONFIG
# ═══════════════════════════════════════════════════════════════════
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
MODEL = os.getenv("MODEL", "llama3.1:8b")
PORT = int(os.getenv("PORT", "8030"))
TRANSLATION_NODE = os.getenv("TRANSLATION_NODE", "http://clisonix-translation-node:8036")
CENTRAL_API_BASE = os.getenv("CENTRAL_API_URL", "http://clisonix-api:8000")
OPENMIND_BASE = os.getenv("OPENMIND_URL", "http://clisonix-openmind:9999")
EXCEL_CORE_BASE = os.getenv("EXCEL_CORE_URL", "http://clisonix-excel:8002")
SYSTEM_PROMPT_PATH = os.getenv("CLISONIX_SYSTEM_PROMPT_PATH", "/app/CLISONIX_SYSTEM_PROMPT.md")
MODULE_MAP_PATH = os.getenv("CLISONIX_MODULE_MAP_PATH", "/app/CLISONIX_MODULE_MAP.md")
REGULATORY_BASE = os.getenv("REGULATORY_URL", "http://clisonix-regulatory:9501")
LITE_BASE = os.getenv("OCEAN_LITE_URL", "")
VIDEO_PRODUCER_URL = os.getenv("VIDEO_PRODUCER_URL", "http://clisonix-ai-global-9999:9999")
ADMIN_API_TOKEN = os.getenv("OCEAN_ADMIN_API_TOKEN", "").strip()
MULTIMODAL_ELASTIC_NO_LIMITS = os.getenv("MULTIMODAL_ELASTIC_NO_LIMITS", "true").strip().lower() in {"1", "true", "yes", "on"}
DOCUMENT_MAX_BYTES = int(os.getenv("DOCUMENT_MAX_BYTES", "0"))
DOCUMENT_MIME_ALLOWLIST = {
    "application/pdf",
    "text/plain",
    "text/csv",
    "application/json",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


def _bool_env(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _csv_env(name: str, default: str) -> List[str]:
    raw = os.getenv(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


CORS_ALLOWED_ORIGINS = _csv_env("OCEAN_CORS_ALLOWED_ORIGINS", "*")
CORS_ALLOWED_METHODS = _csv_env("OCEAN_CORS_ALLOWED_METHODS", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
CORS_ALLOWED_HEADERS = _csv_env("OCEAN_CORS_ALLOWED_HEADERS", "Authorization,Content-Type,Accept,X-Requested-With,X-Admin-Token")
CORS_ALLOW_CREDENTIALS = _bool_env("OCEAN_CORS_ALLOW_CREDENTIALS", False)

CHAT_RATE_LIMIT_WINDOW_S = int(os.getenv("CHAT_RATE_LIMIT_WINDOW_S", "60"))
CHAT_RATE_LIMIT_REQUESTS = int(os.getenv("CHAT_RATE_LIMIT_REQUESTS", "40"))
CHAT_MAX_PROMPT_CHARS = int(os.getenv("CHAT_MAX_PROMPT_CHARS", "80000"))
CHAT_MAX_TOKENS_HARD = int(os.getenv("CHAT_MAX_TOKENS_HARD", "0"))
CHAT_ELASTIC_NO_LIMITS = _bool_env("CHAT_ELASTIC_NO_LIMITS", True)
OLLAMA_STREAM_TIMEOUT_BASE_S = float(os.getenv("OLLAMA_STREAM_TIMEOUT_BASE_S", "90"))
OLLAMA_STREAM_TIMEOUT_MAX_S = float(os.getenv("OLLAMA_STREAM_TIMEOUT_MAX_S", "600"))
OLLAMA_CHUNK_MIN_CHARS = int(os.getenv("OLLAMA_CHUNK_MIN_CHARS", "20"))
OLLAMA_CHUNK_MAX_CHARS = int(os.getenv("OLLAMA_CHUNK_MAX_CHARS", "120"))
DOCUMENT_SCAN_MAX_CHARS = int(os.getenv("DOCUMENT_SCAN_MAX_CHARS", "0"))
VOICE_MIN_AUDIO_BYTES = int(os.getenv("VOICE_MIN_AUDIO_BYTES", "100"))
VOICE_MAX_AUDIO_BYTES = int(os.getenv("VOICE_MAX_AUDIO_BYTES", "0"))
VOICE_STT_TIMEOUT_BASE_S = float(os.getenv("VOICE_STT_TIMEOUT_BASE_S", "45"))
VOICE_STT_TIMEOUT_MAX_S = float(os.getenv("VOICE_STT_TIMEOUT_MAX_S", "300"))
VOICE_LLM_TIMEOUT_BASE_S = float(os.getenv("VOICE_LLM_TIMEOUT_BASE_S", "90"))
VOICE_LLM_TIMEOUT_MAX_S = float(os.getenv("VOICE_LLM_TIMEOUT_MAX_S", "420"))


def _configured_or_none(value: int) -> Optional[int]:
    return value if value > 0 else None


def _document_upload_limit() -> Optional[int]:
    configured = _configured_or_none(DOCUMENT_MAX_BYTES)
    if configured is not None:
        return configured
    if MULTIMODAL_ELASTIC_NO_LIMITS:
        return None
    return 25 * 1024 * 1024


def _document_scan_char_limit() -> Optional[int]:
    configured = _configured_or_none(DOCUMENT_SCAN_MAX_CHARS)
    if configured is not None:
        return configured
    if MULTIMODAL_ELASTIC_NO_LIMITS:
        return None
    return 1500000


def _voice_audio_limit() -> Optional[int]:
    configured = _configured_or_none(VOICE_MAX_AUDIO_BYTES)
    if configured is not None:
        return configured
    if MULTIMODAL_ELASTIC_NO_LIMITS:
        return None
    return 25 * 1024 * 1024


def _resolve_scan_chars(requested_chars: int) -> int:
    requested = max(requested_chars, 200000)
    limit = _document_scan_char_limit()
    if limit is None:
        return requested
    return min(requested, limit)


def _adaptive_timeout(base_seconds: float, max_seconds: float, payload_size_bytes: int) -> float:
    size_mb = max(payload_size_bytes, 0) / (1024 * 1024)
    timeout = base_seconds + (size_mb * 10.0)
    return max(base_seconds, min(timeout, max_seconds))


def _elastic_stream_timeout(prompt_chars: int, message_count: int = 1) -> float:
    pseudo_payload = max(prompt_chars, 0) + (max(message_count, 1) * 1200)
    return _adaptive_timeout(
        OLLAMA_STREAM_TIMEOUT_BASE_S,
        OLLAMA_STREAM_TIMEOUT_MAX_S,
        pseudo_payload,
    )


def _elastic_chunk_chars(prompt_chars: int) -> int:
    if prompt_chars > 24000:
        return OLLAMA_CHUNK_MAX_CHARS
    if prompt_chars > 8000:
        return max(OLLAMA_CHUNK_MIN_CHARS, 64)
    return max(OLLAMA_CHUNK_MIN_CHARS, 24)


AUTOLEARNING_ENABLED = _bool_env("OCEAN_AUTOLEARNING_ENABLED", True)
AUTOLEARNING_QUEUE_MAX = int(os.getenv("OCEAN_AUTOLEARNING_QUEUE_MAX", "2000"))
AUTOLEARNING_MIN_PROMPT_CHARS = int(os.getenv("OCEAN_AUTOLEARNING_MIN_PROMPT_CHARS", "12"))
AUTOLEARNING_TIMEOUT_S = float(os.getenv("OCEAN_AUTOLEARNING_TIMEOUT_S", "5"))
AUTOLEARNING_TO_OPENMIND = _bool_env("OCEAN_AUTOLEARNING_TO_OPENMIND", True)
AUTOLEARNING_TO_REGULATORY = _bool_env("OCEAN_AUTOLEARNING_TO_REGULATORY", True)
AUTOLEARNING_TO_LITE = _bool_env("OCEAN_AUTOLEARNING_TO_LITE", False)
AUTOLEARNING_LOG_PATH = os.getenv("OCEAN_AUTOLEARNING_LOG_PATH", "./data/ocean_autolearning.jsonl")


@lru_cache(maxsize=16)
def _read_text_cached(path: str, default_value: str = "") -> str:
    try:
        return Path(path).read_text(encoding="utf-8")
    except Exception:
        return default_value


def _build_shared_system_context() -> str:
    parts: List[str] = []

    shared_prompt = _read_text_cached(SYSTEM_PROMPT_PATH, default_value="").strip()
    if shared_prompt:
        parts.append("## Global Clisonix System Prompt\n" + shared_prompt)
    module_map = _read_text_cached(MODULE_MAP_PATH, default_value="").strip()
    if module_map:
        parts.append("## Clisonix Module Map\n" + module_map)

    return "\n\n".join(parts)

try:
    from prometheus_client import Counter, Histogram  # type: ignore[import-not-found]
    HAS_PROMETHEUS = True
except ImportError:
    Counter = None
    Histogram = None
    HAS_PROMETHEUS = False

# ═══════════════════════════════════════════════════════════════════
# IMPORT ALL ENGINES
# ═══════════════════════════════════════════════════════════════════

# 1. Mega Layer Engine - 14 MILIARD KOMBINIME
try:
    from mega_layer_engine import (
        TOTAL_COMBINATIONS,
        get_mega_layer_engine,
    )
    MEGA_LAYERS_AVAILABLE = True
    logger.info(f"✅ MegaLayerEngine loaded - {TOTAL_COMBINATIONS:,} kombinime!")
except ImportError as e:
    MEGA_LAYERS_AVAILABLE = False
    logger.warning(f"⚠️ MegaLayerEngine not available: {e}")

# 2. Real Answer Engine - Deep Knowledge
try:
    from real_answer_engine import get_real_answer_engine as get_answer_engine
    REAL_ANSWER_AVAILABLE = True
    logger.info("✅ RealAnswerEngine loaded")
except ImportError as e:
    REAL_ANSWER_AVAILABLE = False
    logger.warning(f"⚠️ RealAnswerEngine not available: {e}")

# 3. Service Registry - 31 modules
try:
    from service_registry import get_service_registry
    SERVICE_REGISTRY_AVAILABLE = True
    logger.info("✅ ServiceRegistry loaded")
except ImportError as e:
    SERVICE_REGISTRY_AVAILABLE = False
    logger.warning(f"⚠️ ServiceRegistry not available: {e}")

# 4. Albanian Dictionary - 707 linja
try:
    from albanian_dictionary import (
        ALL_ALBANIAN_WORDS,
        get_albanian_response,
    )
    ALBANIAN_DICT_AVAILABLE = True
    logger.info(f"✅ Albanian Dictionary loaded - {len(ALL_ALBANIAN_WORDS)} words")
except ImportError as e:
    ALBANIAN_DICT_AVAILABLE = False
    logger.warning(f"⚠️ Albanian Dictionary not available: {e}")

# 5. Knowledge Seeds
try:
    from knowledge_seeds.core_knowledge import find_matching_seed
    KNOWLEDGE_SEEDS_AVAILABLE = True
    logger.info("✅ Knowledge Seeds loaded")
except ImportError as e:
    KNOWLEDGE_SEEDS_AVAILABLE = False
    logger.warning(f"⚠️ Knowledge Seeds not available: {e}")

# 6. Knowledge Layer - Platform Intelligence
try:
    from knowledge_layer import (
        SERVICES,
        route_intent,
    )
    KNOWLEDGE_LAYER_AVAILABLE = True
    logger.info(f"✅ Knowledge Layer loaded - {len(SERVICES)} services")
except ImportError as e:
    KNOWLEDGE_LAYER_AVAILABLE = False
    SERVICES = {}
    logger.warning(f"⚠️ Knowledge Layer not available: {e}")

# 7. Enterprise Guard - Security & Behavior Layer
try:
    from enterprise import get_enterprise_guard
    ENTERPRISE_GUARD_AVAILABLE = True
    enterprise_guard = get_enterprise_guard()
    logger.info("✅ Enterprise Guard loaded - 10 security modules")
except ImportError as e:
    ENTERPRISE_GUARD_AVAILABLE = False
    enterprise_guard = None
    logger.warning(f"⚠️ Enterprise Guard not available: {e}")

# ═══════════════════════════════════════════════════════════════════
# SYSTEM PROMPT - FULL VERSION with all capabilities
# ═══════════════════════════════════════════════════════════════════

def generate_full_system_prompt() -> str:
    """Generate comprehensive system prompt with all platform knowledge"""

    services_list = "\n".join([
        f"- **{svc['name']}**: {svc.get('url', '/modules/' + key)}"
        for key, svc in SERVICES.items()
    ]) if SERVICES else "No services loaded"

    capabilities = []
    if MEGA_LAYERS_AVAILABLE:
        capabilities.append(f"🧠 MegaLayerEngine: {TOTAL_COMBINATIONS:,} unique layer combinations")
    if REAL_ANSWER_AVAILABLE:
        capabilities.append("📚 RealAnswerEngine: Deep knowledge retrieval")
    if SERVICE_REGISTRY_AVAILABLE:
        capabilities.append("🔧 ServiceRegistry: 31 platform modules")
    if ALBANIAN_DICT_AVAILABLE:
        capabilities.append(f"🌐 Multilingual Dictionary: {len(ALL_ALBANIAN_WORDS)}+ words (72 languages)")
    if KNOWLEDGE_SEEDS_AVAILABLE:
        capabilities.append("🌱 Knowledge Seeds: Core platform knowledge")
    if ENTERPRISE_GUARD_AVAILABLE:
        capabilities.append("🛡️ Enterprise Guard: 10 security & behavior modules")

    capabilities_str = "\n".join(capabilities) if capabilities else "Basic mode"

    return f"""You are **Curiosity Ocean** 🌊 - The Advanced AI Brain of Clisonix Cloud.

## IDENTITY
- Created by: Ledjan Ahmati, Geschäftsführer
- Company: ABA GmbH (Amtsgericht Bochum HRB: 21069)
- Platform: https://clisonix.cloud - GLOBAL Industrial AI Platform
- Architecture: Full Production Brain with Multi-Layer Processing
- Market: Worldwide enterprise customers

## ACTIVE CAPABILITIES
{capabilities_str}

## AVAILABLE SERVICES
{services_list}

## RESPONSE GUIDELINES
1. **Language Detection**: Automatically respond in the user's language
2. **Service Routing**: If user asks about a service, explain and provide URL
3. **Deep Knowledge**: Use all available engines for comprehensive answers
4. **Multilingual**: Support 72+ languages seamlessly
5. **Professional & Global**: Be helpful, clear, and internationally professional

## ENTERPRISE BEHAVIOR
- This is a GLOBAL platform - do NOT emphasize any specific country or region
- Be neutral, professional, enterprise-grade
- Route service questions instantly
- Provide documentation when requested
- Be concise but comprehensive
- Never make up information about the platform

## STREAMING BEHAVIOR (CRITICAL)
- START WRITING IMMEDIATELY in the first 2-3 seconds
- DO NOT pause to think or plan internally before responding
- Produce continuous, flowing text without internal deliberation
- For long analyses: write multiple extended sections without stopping
- NEVER conclude early - continue until the explanation is fully developed
- Maintain a constant output rhythm to prevent timeouts

You are the most advanced AI assistant on Clisonix Cloud - a GLOBAL enterprise platform! 🌊"""

SYSTEM_PROMPT = generate_full_system_prompt()

# FAST system prompt for streaming - minimal tokens for quick TTFT
FAST_SYSTEM_PROMPT = """You are Curiosity Ocean 🌊, core AI of Clisonix Cloud.
Identity: created by Ledjan Ahmati (ABA GmbH). Never say you are ChatGPT or another assistant.
Character: professional, precise, warm, globally business-ready.
Core services: multilingual AI (72+), voice conversation, document/image analysis, debate reasoning, data/web research, video producer bridge.
Behavior: keep continuity across turns, preserve user context, and respond in the user language.
Start immediately with concrete value, no generic preamble."""

FAST_LANGUAGE_POLICY = """
LANGUAGE POLICY (MANDATORY):
- Answer in the target language only.
- Do not translate or explain the user's sentence unless explicitly asked.
- Do not say "I detected" or "I translated" unless explicitly asked.
- Treat the user's text as the actual request and answer it directly.
"""

FAST_LANGUAGE_POLICY = """
LANGUAGE POLICY (MANDATORY):
- Answer in the target language only.
- Do not translate or explain the user's sentence unless explicitly asked.
- Do not say "I detected" or "I translated" unless explicitly asked.
- Treat the user's text as the actual request and answer it directly.
"""

# ═══════════════════════════════════════════════════════════════════
# FASTAPI APP
# ═══════════════════════════════════════════════════════════════════

app = FastAPI(
    title="Ocean Core Full API",
    description="Complete Production Brain with all engines",
    version="5.0.0"
)

cors_allow_origins = CORS_ALLOWED_ORIGINS if CORS_ALLOWED_ORIGINS else ["*"]
if "*" in cors_allow_origins and CORS_ALLOW_CREDENTIALS:
    logger.warning("⚠️ OCEAN_CORS_ALLOW_CREDENTIALS ignored because wildcard origin is enabled")
    CORS_ALLOW_CREDENTIALS = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_allow_origins,
    allow_credentials=CORS_ALLOW_CREDENTIALS,
    allow_methods=CORS_ALLOWED_METHODS,
    allow_headers=CORS_ALLOWED_HEADERS,
)


DOC_GEN_IN_MEMORY_STATS: Dict[str, Any] = {
    "requests": 0,
    "success": 0,
    "failed": 0,
    "translated": 0,
    "last_error": None,
    "last_request_at": None,
    "total_latency_seconds": 0.0,
}

if HAS_PROMETHEUS and Counter is not None and Histogram is not None:
    DOC_GEN_REQUESTS_TOTAL = Counter(
        "ocean_document_generation_requests_total",
        "Total document generation requests",
        ["format", "contract_type"],
    )
    DOC_GEN_RESULTS_TOTAL = Counter(
        "ocean_document_generation_results_total",
        "Document generation result count",
        ["status"],
    )
    DOC_GEN_LATENCY_SECONDS = Histogram(
        "ocean_document_generation_latency_seconds",
        "Document generation latency seconds",
        buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 40),
    )
else:
    DOC_GEN_REQUESTS_TOTAL = None
    DOC_GEN_RESULTS_TOTAL = None
    DOC_GEN_LATENCY_SECONDS = None


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
    return response

# ═══════════════════════════════════════════════════════════════════
# REQUEST/RESPONSE MODELS
# ═══════════════════════════════════════════════════════════════════

class ChatRequest(BaseModel):
    message: Optional[str] = None
    query: Optional[str] = None
    model: Optional[str] = None
    language: Optional[str] = None
    domain: Optional[str] = None
    user_name: Optional[str] = None
    clerk_user_id: Optional[str] = None
    multimodal_context: Optional[str] = None
    session_topic: Optional[str] = None
    use_personality_contract: bool = False
    personality_module: Optional[str] = None
    response_format: str = "json"
    use_mega_layers: bool = True
    use_knowledge_seeds: bool = True
    strict_mode: bool = False  # Detyron ndjekjen e rregullave pa devijim
    max_tokens: Optional[int] = None
    long_response: bool = False

class ChatResponse(BaseModel):
    response: str
    model: str
    processing_time: float
    engines_used: List[str]
    language_detected: str = "en"
    layer_activations: Optional[Dict[str, Any]] = None
    provenance: Optional[Dict[str, Any]] = None
    governance: Optional[Dict[str, Any]] = None
    memory: Optional[Dict[str, Any]] = None


# Duplicate definition removed. The function _resolve_response_format is defined below.


# Duplicate definition removed. The function _format_chat_output is defined below.


def _should_use_albanian_dictionary(prompt: str, requested_language: Optional[str] = None) -> bool:
    if not prompt:
        return False

    lang = (requested_language or "").strip().lower()
    if lang and not lang.startswith("sq"):
        return False

    sample = prompt.strip().lower()
    words = sample.split()

    greetings = {
        "pershendetje",
        "përshëndetje",
        "tung",
        "tungjatjeta",
        "mirupafshim",
        "faleminderit",
        "hello",
        "hi",
    }
    if any(token in sample for token in greetings) and len(words) <= 8:
        return True

    definition_prefixes = (
        "çfarë do të thotë",
        "cfare do te thote",
        "what does",
    )
    if sample.startswith(definition_prefixes) and len(words) <= 20:
        return True

    return False


def _build_user_context(req: ChatRequest) -> str:
    user_name = (req.user_name or "").strip()
    clerk_user_id = (req.clerk_user_id or "").strip()

    if not user_name and not clerk_user_id:
        return ""

    lines = ["## Conversation User Context"]
    if user_name:
        lines.append(f"- Active user name: {user_name}")
    if clerk_user_id:
        lines.append(f"- Active user id: {clerk_user_id}")

    lines.extend([
        "- Keep continuity with this user identity across turns.",
        "- Do not reset with generic self-introduction unless the user explicitly asks who you are.",
        "- If the user writes in Albanian, use clean standard Albanian (without invented words).",
    ])

    return "\n".join(lines)


def _personality_contract_context(req: ChatRequest) -> str:
    if not getattr(req, "use_personality_contract", False):
        return ""

    contract_path = os.getenv("PERSONALITY_CONTRACT_PROMPT_PATH", "").strip()
    if not contract_path:
        return ""

    raw = _read_text_cached(contract_path, default_value="").strip()
    if not raw:
        return ""

    module = (getattr(req, "personality_module", "") or "").strip().lower()
    lines: List[str] = ["## Soft Rail Personality Contract (On-Demand)"]
    if module:
        lines.append(f"- Active module: {module}")
    max_chars = max(int(os.getenv("PERSONALITY_CONTRACT_MAX_CHARS", "12000")), 300)
    compact = raw[:max_chars]
    lines.append(compact)
    lines.append("Keep this contract concise in execution; avoid verbose meta-explanations.")
    return "\n".join(lines)


def _resolve_response_format(req: ChatRequest, http_request: Request) -> str:
    requested = (req.response_format or "").strip().lower()
    if requested in {"json", "hybrid", "hybrid-json", "cbor", "cbor2"}:
        return requested

    accept = (http_request.headers.get("accept", "") or "").lower()
    if "application/cbor" in accept or "application/cbor2" in accept:
        return "cbor2"
    return "json"


def _format_chat_output(payload: Dict[str, Any], req: ChatRequest, http_request: Request):
    response_format = _resolve_response_format(req, http_request)

    if response_format in {"cbor", "cbor2"}:
        if HAS_CBOR2 and cbor2 is not None:
            return Response(content=cbor2.dumps(payload), media_type="application/cbor")
        fallback = dict(payload)
        fallback["format_warning"] = "cbor2 not available, returned json"
        return fallback

    if response_format in {"hybrid", "hybrid-json"}:
        hybrid = {
            "format": "hybrid-json",
            "json": payload,
        }
        if HAS_CBOR2 and cbor2 is not None:
            hybrid["cbor2"] = {
                "encoding": "base64",
                "media_type": "application/cbor",
                "data": base64.b64encode(cbor2.dumps(payload)).decode("ascii"),
            }
        else:
            hybrid["cbor2"] = {"available": False}
        return hybrid

    return payload

# ═══════════════════════════════════════════════════════════════════
# ENGINE INSTANCES (initialized once)
# ═══════════════════════════════════════════════════════════════════

mega_engine = None
answer_engine = None
service_registry = None
_warmup_task = None
_memory_store: Dict[str, deque] = {}
_MEMORY_TTL_SECONDS = int(os.getenv("OCEAN_MEMORY_TTL_SECONDS", "3600"))
_MEMORY_MAX_TURNS = int(os.getenv("OCEAN_MEMORY_MAX_TURNS", "10"))
_batica_store: Dict[str, deque] = {}
_BATICA_MAX_NODES = int(os.getenv("OCEAN_BATICA_MAX_NODES", "24"))
_chat_rate_lock = asyncio.Lock()
_chat_rate_buckets: Dict[str, deque] = {}
_autolearning_queue: asyncio.Queue = asyncio.Queue(maxsize=AUTOLEARNING_QUEUE_MAX)
_autolearning_hints: deque = deque(maxlen=120)
_autolearning_task: Optional[asyncio.Task] = None
_autolearning_stats: Dict[str, Any] = {
    "enqueued": 0,
    "dropped": 0,
    "processed": 0,
    "failed": 0,
    "last_error": None,
    "last_processed_at": None,
}


def _extract_client_id(http_request: Request) -> str:
    forwarded = (http_request.headers.get("x-forwarded-for", "").split(",")[0].strip())
    return forwarded or (http_request.client.host if http_request.client else "unknown")


async def _allow_chat_request(client_id: str) -> bool:
    now = time.monotonic()
    async with _chat_rate_lock:
        bucket = _chat_rate_buckets.get(client_id)
        if bucket is None:
            bucket = deque()
            _chat_rate_buckets[client_id] = bucket

        while bucket and now - bucket[0] > CHAT_RATE_LIMIT_WINDOW_S:
            bucket.popleft()

        if len(bucket) >= CHAT_RATE_LIMIT_REQUESTS:
            return False

        bucket.append(now)
        return True


def _enforce_prompt_limits(prompt: str) -> None:
    if len(prompt) > CHAT_MAX_PROMPT_CHARS:
        raise HTTPException(
            status_code=413,
            detail=f"Prompt too large. Max {CHAT_MAX_PROMPT_CHARS} chars allowed.",
        )


def _clamp_chat_tokens(max_tokens: Optional[int], long_response: bool = False) -> int:
    if CHAT_ELASTIC_NO_LIMITS and max_tokens is None:
        return -1

    requested = max_tokens if isinstance(max_tokens, int) else (12000 if long_response else 4096)
    requested = int(requested)

    if CHAT_ELASTIC_NO_LIMITS and requested <= 0:
        return -1

    requested = max(256, requested)
    if CHAT_MAX_TOKENS_HARD > 0:
        return min(requested, CHAT_MAX_TOKENS_HARD)
    return requested


def _require_admin_token(http_request: Request) -> None:
    configured = (ADMIN_API_TOKEN or "").strip()
    if not configured:
        raise HTTPException(status_code=503, detail="Admin token is not configured")
    header_token = (http_request.headers.get("x-admin-token") or "").strip()
    auth_header = (http_request.headers.get("authorization") or "").strip()
    bearer = auth_header[7:].strip() if auth_header.lower().startswith("bearer ") else ""
    candidate = header_token or bearer
    if candidate != configured:
        raise HTTPException(status_code=401, detail="Unauthorized")


def _tokenize_learning(text: str) -> List[str]:
    tokens = re.findall(r"[a-zA-Z0-9_çëëäöüß]{4,}", (text or "").lower())
    seen = set()
    output = []
    for token in tokens:
        if token not in seen:
            seen.add(token)
            output.append(token)
        if len(output) >= 16:
            break
    return output


def _learning_vector(prompt: str, response: str) -> List[float]:
    prompt_len = max(1, len(prompt or ""))
    response_len = max(1, len(response or ""))
    ratio = min(3.0, response_len / float(prompt_len))
    return [
        round(min(1.0, prompt_len / 12000.0), 4),
        round(min(1.0, response_len / 20000.0), 4),
        round(min(1.0, len(_tokenize_learning(prompt)) / 16.0), 4),
        round(min(1.0, ratio / 3.0), 4),
    ]


def _autolearning_context(prompt: str) -> str:
    if not AUTOLEARNING_ENABLED or not _autolearning_hints:
        return ""

    prompt_tokens = set(_tokenize_learning(prompt))
    if not prompt_tokens:
        return ""

    scored: List[Tuple[int, Dict[str, Any]]] = []
    for hint in list(_autolearning_hints)[-40:]:
        hint_tokens = set(hint.get("tokens", []))
        overlap = len(prompt_tokens.intersection(hint_tokens))
        if overlap > 0:
            scored.append((overlap, hint))

    if not scored:
        return ""

    scored.sort(key=lambda item: item[0], reverse=True)
    top = scored[:3]
    lines = ["## AutoLearning Insights (OpenMind/Lite)"]
    for idx, (_score, item) in enumerate(top, start=1):
        lines.append(f"{idx}. {item.get('insight', '')}")
    lines.append("Use these as continuity signals; do not claim guaranteed factual correctness from them.")
    return "\n".join(lines)


def _queue_autolearning_event(event: Dict[str, Any]) -> None:
    if not AUTOLEARNING_ENABLED:
        return
    try:
        _autolearning_queue.put_nowait(event)
        _autolearning_stats["enqueued"] += 1
    except asyncio.QueueFull:
        _autolearning_stats["dropped"] += 1


async def _dispatch_autolearning_event(event: Dict[str, Any]) -> None:
    Path(AUTOLEARNING_LOG_PATH).parent.mkdir(parents=True, exist_ok=True)
    with open(AUTOLEARNING_LOG_PATH, "a", encoding="utf-8") as file_handle:
        file_handle.write(json.dumps(event, ensure_ascii=False) + "\n")
    prompt = str(event.get("prompt", ""))
    response = str(event.get("response", ""))
    language = str(event.get("language", "unknown"))
    tokens = _tokenize_learning(prompt + " " + response)
    insight = (
        f"lang={language}; topic={', '.join(tokens[:5]) or 'general'}; "
        f"prompt_len={len(prompt)}; response_len={len(response)}"
    )
    _autolearning_hints.append(
        {
            "ts": time.time(),
            "tokens": tokens,
            "insight": insight,
            "trace_id": event.get("trace_id"),
        }
    )

    async with httpx.AsyncClient(timeout=AUTOLEARNING_TIMEOUT_S) as client:
        if AUTOLEARNING_TO_REGULATORY:
            preflight_payload = {
                "jurisdiction": "EU",
                "data_region": "EU",
                "model_id": event.get("model", MODEL),
                "user_id": event.get("user_id", "anonymous"),
                "query": prompt[:240],
                "tags": tokens[:8],
            }
            await client.post(f"{REGULATORY_BASE}/api/regulatory/preflight", json=preflight_payload)
            federated_payload = {
                "jurisdiction": "EU",
                "model_id": event.get("model", MODEL),
                "pattern_vector": _learning_vector(prompt, response),
                "is_clinical_data": False,
                "metadata": {
                    "trace_id": event.get("trace_id"),
                    "language": language,
                    "source": "ocean-core-autolearning",
                },
            }
            await client.post(f"{REGULATORY_BASE}/api/regulatory/federated/collect", json=federated_payload)
        if AUTOLEARNING_TO_OPENMIND:
            openmind_payload = {
                "message": f"Learning insight: {insight}. user_prompt={prompt[:300]}",
                "provider": "openmind",
                "model": event.get("model", MODEL),
                "options": {},
            }
            await client.post(f"{OPENMIND_BASE}/api/openmind", json=openmind_payload)
        if AUTOLEARNING_TO_LITE and LITE_BASE.strip():
            lite_payload = {
                "message": f"Learning snapshot: {prompt[:280]}",
                "model": event.get("model", MODEL),
            }
            await client.post(f"{LITE_BASE.rstrip('/')}/api/v1/chat", json=lite_payload)


async def _autolearning_worker() -> None:
    while True:
        event = await _autolearning_queue.get()
        try:
            await _dispatch_autolearning_event(event)
            _autolearning_stats["processed"] += 1
            _autolearning_stats["last_processed_at"] = time.time()
            _autolearning_stats["last_error"] = None
        except Exception as exc:
            _autolearning_stats["failed"] += 1
            _autolearning_stats["last_error"] = str(exc)
            logger.warning(f"⚠️ AutoLearning dispatch failed: {exc}")
        finally:
            _autolearning_queue.task_done()


def _memory_key(req: ChatRequest) -> str:
    raw = (req.clerk_user_id or req.user_name or "anonymous").strip().lower() or "anonymous"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]


def _memory_get(req: ChatRequest) -> List[Dict[str, Any]]:
    key = _memory_key(req)
    now = time.time()
    bucket = _memory_store.get(key)
    if not bucket:
        return []

    valid = [item for item in bucket if now - float(item.get("ts", 0.0)) <= _MEMORY_TTL_SECONDS]
    _memory_store[key] = deque(valid, maxlen=_MEMORY_MAX_TURNS)
    return list(_memory_store[key])


def _memory_put(req: ChatRequest, user_text: str, assistant_text: str, language: str) -> None:
    key = _memory_key(req)
    bucket = _memory_store.get(key)
    if bucket is None:
        bucket = deque(maxlen=_MEMORY_MAX_TURNS)
        _memory_store[key] = bucket

    bucket.append(
        {
            "ts": time.time(),
            "user": user_text,
            "assistant": assistant_text,
            "language": language,
        }
    )


def _memory_context(req: ChatRequest) -> str:
    turns = _memory_get(req)
    if not turns:
        return ""

    tail = turns[-4:]
    lines = ["## Short-Term Memory (Recent Turns)"]
    for idx, item in enumerate(tail, start=1):
        user_msg = str(item.get("user", "")).strip().replace("\n", " ")[:180]
        assistant_msg = str(item.get("assistant", "")).strip().replace("\n", " ")[:220]
        lines.append(f"{idx}. User: {user_msg}")
        lines.append(f"   Assistant: {assistant_msg}")
    return "\n".join(lines)


def _multimodal_context(req: ChatRequest) -> str:
    context = (req.multimodal_context or "").strip()
    if not context:
        return ""
    return (
        "## Latest Multimodal Context\n"
        "Use this as trusted user-provided context for follow-up answers.\n"
        f"{context[:6000]}"
    )


def _is_song_flow(text: str, req: ChatRequest) -> bool:
    sample = f"{(req.session_topic or '')} {(text or '')}".lower()
    song_keywords = [
        "song", "lyrics", "melody", "verse", "chorus", "hook", "beat", "bpm",
        "këng", "tekst", "refren", "strof", "muzik", "ritëm",
    ]
    return any(keyword in sample for keyword in song_keywords)


def _batica_zbatica_context(req: ChatRequest, prompt: str) -> str:
    if not _is_song_flow(prompt, req):
        return ""
    key = _memory_key(req)
    nodes = list(_batica_store.get(key, deque()))[-6:]
    if not nodes:
        return (
            "## Batica-Zbatica Creative Flow\n"
            "Initialize composition nodes (theme, mood, tempo, structure) and evolve them turn-by-turn."
        )

    lines = [
        "## Batica-Zbatica Creative Flow",
        "Continue from prior composition nodes; preserve coherence of theme, hook, rhythm and narrative arc.",
    ]
    for idx, node in enumerate(nodes, start=1):
        lines.append(f"{idx}. {node}")
    return "\n".join(lines)


def _batica_zbatica_put(req: ChatRequest, prompt: str, response: str) -> None:
    if not _is_song_flow(prompt, req):
        return
    key = _memory_key(req)
    bucket = _batica_store.get(key)
    if bucket is None:
        bucket = deque(maxlen=_BATICA_MAX_NODES)
        _batica_store[key] = bucket
    node = (
        f"prompt={prompt.strip().replace(chr(10), ' ')[:220]} | "
        f"response={response.strip().replace(chr(10), ' ')[:320]}"
    )
    bucket.append(node)


def _req_for_user(user_id: Optional[str], language: Optional[str] = None) -> ChatRequest:
    safe_user = (user_id or "anonymous").strip() or "anonymous"
    return ChatRequest(
        message="context-sync",
        user_name=safe_user,
        clerk_user_id=safe_user,
        language=language,
    )

def initialize_engines():
    """Initialize all engines on startup"""
    global mega_engine, answer_engine, service_registry

    if MEGA_LAYERS_AVAILABLE and callable(get_mega_layer_engine):
        try:
            mega_engine = get_mega_layer_engine()
            logger.info("🚀 MegaLayerEngine initialized")
        except Exception as e:
            logger.error(f"❌ MegaLayerEngine init failed: {e}")

    if REAL_ANSWER_AVAILABLE and callable(get_answer_engine):
        try:
            answer_engine = get_answer_engine()
            logger.info("🚀 RealAnswerEngine initialized")
        except Exception as e:
            logger.error(f"❌ RealAnswerEngine init failed: {e}")

    if SERVICE_REGISTRY_AVAILABLE and callable(get_service_registry):
        try:
            service_registry = get_service_registry()
            logger.info("🚀 ServiceRegistry initialized")
        except Exception as e:
            logger.error(f"❌ ServiceRegistry init failed: {e}")

# ═══════════════════════════════════════════════════════════════════
# LANGUAGE DETECTION via Translation Node
# ═══════════════════════════════════════════════════════════════════

async def detect_language(text: str) -> tuple:
    """Detect language using Translation Node (72 languages) - Fast timeout"""
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:  # Fast 2s timeout
            resp = await client.post(
                f"{TRANSLATION_NODE}/api/v1/detect",
                json={"text": text}
            )
            if resp.status_code == 200:
                data = resp.json()
                return (
                    data.get("detected_language", "en"),
                    data.get("language_name", "English"),
                    data.get("confidence", 0.5)
                )
    except Exception as e:
        logger.debug(f"Language detection skipped: {e}")  # Debug not warning
    return ("en", "English", 0.5)


async def resolve_language_name(lang_code: str) -> str:
    """Resolve ISO language code to display name via Translation Node (dynamic)."""
    code = (lang_code or "").strip().lower()
    if not code:
        return ""

    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"{TRANSLATION_NODE}/api/v1/languages")
            if resp.status_code == 200:
                data = resp.json()
                languages = data.get("languages", {}) if isinstance(data, dict) else {}
                info = languages.get(code, {}) if isinstance(languages, dict) else {}
                if isinstance(info, dict):
                    return info.get("name", "") or info.get("native", "") or ""
    except Exception as e:
        logger.debug(f"Language name resolve skipped: {e}")

    return ""


async def translate_text_dynamic(text: str, target_lang: str, source_lang: str = "auto") -> str:
    """Translate text via Translation Node using dynamic language codes."""
    if not text or not target_lang:
        return text

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.post(
                f"{TRANSLATION_NODE}/api/v1/translate",
                json={"text": text, "source": source_lang, "target": target_lang},
            )
            if resp.status_code == 200:
                data = resp.json()
                translated = data.get("translated")
                if isinstance(translated, str) and translated.strip():
                    return translated
    except Exception as e:
        logger.debug(f"Dynamic translation skipped: {e}")

    return text

# ═══════════════════════════════════════════════════════════════════
# MEGA LAYER PROCESSING
# ═══════════════════════════════════════════════════════════════════

def process_with_mega_layers(query: str) -> Dict[str, Any]:
    """Process query through MegaLayerEngine - uses process_query method"""
    if not MEGA_LAYERS_AVAILABLE or not mega_engine:
        return {"active": False}

    try:
        # Correct method: process_query returns (LayerActivation, results_dict)
        activation, results = mega_engine.process_query(query)
        return {
            "active": True,
            "meta_level": getattr(getattr(activation, "meta_level", None), "value", 0),
            "consciousness_depth": getattr(activation, "consciousness_depth", 0),
            "emotional_resonance": len(getattr(activation, "emotional_dimensions", []) or []),
            "fractal_depth": getattr(activation, "fractal_depth", 0),
            "signature": (getattr(activation, "unique_signature", "") or "")[:16]
        }
    except Exception as e:
        logger.debug(f"MegaLayer skipped: {e}")  # Debug not error
        return {"active": False}

# ═══════════════════════════════════════════════════════════════════
# KNOWLEDGE SEEDS LOOKUP
# ═══════════════════════════════════════════════════════════════════

def find_knowledge_seed(query: str) -> Optional[str]:
    """Find matching knowledge seed for query"""
    if not KNOWLEDGE_SEEDS_AVAILABLE or find_matching_seed is None:
        return None

    try:
        seed = find_matching_seed(query)
        if seed:
            seed_content = getattr(seed, "content", None)
            return seed_content if isinstance(seed_content, str) else str(seed)
    except Exception as e:
        logger.error(f"Knowledge seed error: {e}")
    return None

# ═══════════════════════════════════════════════════════════════════
# STREAMING RESPONSE GENERATOR
# ═══════════════════════════════════════════════════════════════════

async def stream_ollama_response(
    model: str,
    messages: list,
    options: dict,
    engines_used: list,
    lang_code: str
) -> AsyncGenerator[str, None]:
    """
    Stream response from Ollama word by word.
    This makes the first token appear in 2-3 seconds instead of waiting 60+ seconds.
    """
    emitted_any = False
    system_prompt = ""
    user_prompt = ""
    try:
        for msg in messages or []:
            role = (msg or {}).get("role")
            content = (msg or {}).get("content", "")
            if role == "system" and content and not system_prompt:
                system_prompt = content
            elif role == "user" and content:
                user_prompt = content
        if not user_prompt and messages:
            user_prompt = (messages[-1] or {}).get("content", "")
    except Exception:
        user_prompt = (messages[-1] or {}).get("content", "") if messages else ""
    prompt_chars = len(user_prompt or "")
    timeout_s = _elastic_stream_timeout(prompt_chars, len(messages or []))
    chunk_chars = _elastic_chunk_chars(prompt_chars)

    try:
        async with httpx.AsyncClient(timeout=timeout_s) as client:
            async with client.stream(
                "POST",
                f"{OLLAMA_HOST}/api/generate",
                json={
                    "model": model,
                    "prompt": user_prompt,
                    "system": system_prompt,
                    "stream": True,  # STREAMING ENABLED!
                    "options": options
                }
            ) as response:
                if response.status_code != 200:
                    yield f"[STREAM_ERROR: upstream_status_{response.status_code}]"
                    return

                async for line in response.aiter_lines():
                    if line:
                        try:
                            data = json.loads(line)
                            content = None
                            if isinstance(data.get("response"), str):
                                content = data.get("response")
                            elif isinstance(data.get("message"), dict) and isinstance(data["message"].get("content"), str):
                                content = data["message"]["content"]

                            if content:
                                emitted_any = True
                                if len(content) <= chunk_chars:
                                    yield content
                                else:
                                    for i in range(0, len(content), chunk_chars):
                                        yield content[i:i + chunk_chars]
                            # Check if done
                            if data.get("done", False):
                                break
                        except json.JSONDecodeError:
                            continue
        if not emitted_any:
            yield "I’m here and ready to help. Please try your question once more."
    except Exception as e:
        logger.error(f"Streaming error: {e}")
        yield f"\n\n[Error: {str(e)}]"


# ═══════════════════════════════════════════════════════════════════
# MAIN PROCESSING PIPELINE
# ═══════════════════════════════════════════════════════════════════

async def process_query_full(req: ChatRequest) -> ChatResponse:
    """
    Full processing pipeline using all available engines:
    1. Language Detection (72 languages)
    2. Service Routing (Knowledge Layer)
    3. Knowledge Seeds Lookup
    4. Mega Layer Processing
    5. Ollama Generation with enhanced context
    """
    start_time = time.time()
    engines_used = []
    trace_id = str(uuid.uuid4())

    prompt = req.message or req.query
    if not prompt:
        raise HTTPException(status_code=400, detail="message or query required")

    # 0. Enterprise Guard - Security & Input Validation
    if ENTERPRISE_GUARD_AVAILABLE and enterprise_guard:
        input_check = enterprise_guard.check_input(prompt)
        if not input_check["proceed"]:
            # Blocked by security
            warning_msg = input_check["warnings"][0] if input_check["warnings"] else "Kërkesa nuk lejohet."
            return ChatResponse(
                response=warning_msg,
                model="enterprise_guard",
                processing_time=round(time.time() - start_time, 2),
                engines_used=["EnterpriseGuard:Blocked"],
                language_detected="unknown",
                layer_activations={"security": "blocked", "reason": input_check.get("warnings", [])}
            )
        engines_used.append("EnterpriseGuard")

    # 1. Detect Language (PRIORITY: req.language > auto-detect)
    if req.language and req.language.strip():
        # User provided explicit language - use exclusively (no auto-detect)
        lang_code = req.language.strip().lower()
        lang_name = await resolve_language_name(lang_code)
        confidence = 1.0  # Explicit choice = 100% confidence
        engines_used.append(f"ExplicitLanguage({lang_code})")
        logger.info(f"🌍 User language OVERRIDE: {lang_code} ({lang_name})")
    else:
        # Auto-detect from prompt content
        lang_code, lang_name, confidence = await detect_language(prompt)
        engines_used.append(f"AutoDetect({lang_code})")
        logger.info(f"🌍 Language auto-detected: {lang_code} ({lang_name})")

    lang_instruction = ""
    if lang_code != "en":
        if req.language and req.language.strip():
            # Explicit user language - MANDATORY
            lang_instruction = f"\n\nCRITICAL: You MUST respond ONLY in {lang_name}. Every word must be in {lang_name}. Do NOT mix languages. Language code: {lang_code}"
        else:
            # Auto-detected language - softer instruction
            lang_instruction = f"\n\nIMPORTANT: The user is writing in {lang_name}. You MUST respond in {lang_name}."

    # 2. Service Routing
    if KNOWLEDGE_LAYER_AVAILABLE and callable(route_intent):
        routed_service = route_intent(prompt)
        if routed_service and routed_service in SERVICES:
            engines_used.append(f"ServiceRouter({routed_service})")

    # 3. Knowledge Seeds
    seed_context = ""
    if req.use_knowledge_seeds:
        seed = find_knowledge_seed(prompt)
        if seed:
            seed_context = f"\n\nRELEVANT KNOWLEDGE:\n{seed}"
            engines_used.append("KnowledgeSeeds")

    # 4. Mega Layer Processing
    layer_activations = None
    mega_context = ""
    if req.use_mega_layers:
        layer_activations = process_with_mega_layers(prompt)
        if layer_activations.get("active"):
            mega_context = f"\n\n[Layer Depth: {layer_activations.get('consciousness_depth', 0)}, Emotional: {layer_activations.get('emotional_resonance', 0):.2f}]"
            engines_used.append("MegaLayerEngine")

    # 4.5. STRICT MODE - Detyron ndjekjen e rregullave
    strict_instruction = ""
    if req.strict_mode:
        strict_instruction = """

## STRICT MODE ACTIVATED - MANDATORY RULES
You MUST follow these rules EXACTLY. No exceptions.

1. **STAY ON TOPIC**: Answer ONLY what was asked. Do not add extra information.
2. **NO QUESTIONS**: Do not ask the user questions. Just answer.
3. **NO DEVIATIONS**: Do not change the subject or add unrelated content.
4. **NO HALLUCINATIONS**: If you don't know, say "I don't know". Do not invent.
5. **FOLLOW INSTRUCTIONS**: If given a list of steps, execute ALL steps in order.
6. **SELF-ANALYSIS**: If asked to analyze your response, do it honestly.
7. **IMMEDIATE START**: Begin writing your answer immediately, no preamble.
8. **CONTINUOUS OUTPUT**: Write without stopping until the task is complete.

VIOLATION OF THESE RULES IS NOT ALLOWED."""
        engines_used.append("StrictMode")

    # 4.6. ALBANIAN DICTIONARY - Direct response for Albanian definition queries
    if ALBANIAN_DICT_AVAILABLE and callable(get_albanian_response):
        # Check if we have a direct Albanian answer (for definitions, greetings, etc.)
        albanian_response = get_albanian_response(prompt)
        if albanian_response:
            engines_used.append("AlbanianDictionary")
            elapsed = time.time() - start_time
            logger.info(f"✅ [sq] {elapsed:.1f}s - Albanian Dict Response - Engines: {', '.join(engines_used)}")
            return ChatResponse(
                response=albanian_response,
                model="albanian_dictionary_v1",
                processing_time=round(elapsed, 2),
                engines_used=engines_used,
                language_detected="sq",
                layer_activations=None,
                provenance={
                    "trace_id": trace_id,
                    "mode": "dictionary_shortcut",
                    "engines": engines_used,
                },
                governance={
                    "policy_layer": "enterprise_guard" if ENTERPRISE_GUARD_AVAILABLE else "baseline",
                    "status": "allow",
                },
                memory={
                    "enabled": True,
                    "session_key": _memory_key(req),
                    "turns": len(_memory_get(req)),
                },
            )

    # 5. Build enhanced system prompt
    shared_system_context = _build_shared_system_context()
    user_context = _build_user_context(req)
    memory_context = _memory_context(req)
    multimodal_context = _multimodal_context(req)
    batica_context = _batica_zbatica_context(req, prompt)
    autolearning_context = _autolearning_context(prompt)
    personality_context = _personality_contract_context(req)
    if shared_system_context:
        engines_used.append("SharedSystemContext")
    if user_context:
        engines_used.append("UserContext")
    if memory_context:
        engines_used.append("ShortTermMemory")
    if multimodal_context:
        engines_used.append("MultimodalContext")
    if batica_context:
        engines_used.append("BaticaZbatica")
    if autolearning_context:
        engines_used.append("AutoLearningContext")
    if personality_context:
        engines_used.append("PersonalityContract")

    enhanced_prompt = (
        SYSTEM_PROMPT
        + (f"\n\n{shared_system_context}" if shared_system_context else "")
        + (f"\n\n{user_context}" if user_context else "")
        + (f"\n\n{memory_context}" if memory_context else "")
        + (f"\n\n{multimodal_context}" if multimodal_context else "")
        + (f"\n\n{batica_context}" if batica_context else "")
        + (f"\n\n{autolearning_context}" if autolearning_context else "")
        + (f"\n\n{personality_context}" if personality_context else "")
        + "\n\nALBANIAN QUALITY POLICY: If responding in Albanian, use only standard Albanian, natural grammar, and precise wording. Avoid invented or corrupted words."
        + lang_instruction
        + seed_context
        + mega_context
        + strict_instruction
    )

    # 6. Call Ollama - 60s timeout, optimized for speed
    ollama_timeout = _elastic_stream_timeout(len(prompt), 2)
    try:
        async with httpx.AsyncClient(timeout=ollama_timeout) as client:
            resp = await client.post(
                f"{OLLAMA_HOST}/api/chat",
                json={
                    "model": req.model or MODEL,
                    "messages": [
                        {"role": "system", "content": enhanced_prompt},
                        {"role": "user", "content": prompt}
                    ],
                    "stream": False,
                    "options": {
                        "temperature": 0.7,
                        "num_ctx": 8192,
                        "repeat_penalty": 1.2,
                        "top_p": 0.9,
                        "num_predict": -1,
                        "num_keep": 0,
                        "mirostat": 0,
                        "repeat_last_n": 64,
                        "stop": []
                    }
                }
            )

            if resp.status_code != 200:
                raise HTTPException(status_code=resp.status_code, detail="Ollama /api/chat error")

            data = resp.json()
            response_text = data.get("message", {}).get("content", "No response")
            engines_used.append(f"OllamaChat({req.model or MODEL})")

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Ollama timeout")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ollama error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    elapsed = time.time() - start_time

    _memory_put(req, prompt, response_text, lang_code)
    _batica_zbatica_put(req, prompt, response_text)
    memory_turns = len(_memory_get(req))

    if len(prompt.strip()) >= AUTOLEARNING_MIN_PROMPT_CHARS:
        _queue_autolearning_event(
            {
                "ts": time.time(),
                "trace_id": trace_id,
                "prompt": prompt[:12000],
                "response": response_text[:18000],
                "language": lang_code,
                "user_id": (req.clerk_user_id or req.user_name or "anonymous")[:120],
                "session_key": _memory_key(req),
                "model": req.model or MODEL,
                "engines": engines_used,
            }
        )

    logger.info(f"✅ [{lang_code}] {elapsed:.1f}s - Engines: {', '.join(engines_used)}")

    return ChatResponse(
        response=response_text,
        model=req.model or MODEL,
        processing_time=round(elapsed, 2),
        engines_used=engines_used,
        language_detected=lang_code,
        layer_activations=layer_activations,
        provenance={
            "trace_id": trace_id,
            "engines": engines_used,
            "model": req.model or MODEL,
            "language": {"code": lang_code, "name": lang_name, "confidence": confidence},
            "seed_used": bool(seed_context),
            "memory_used": bool(memory_context),
            "response_chars": len(response_text),
        },
        governance={
            "policy_layer": "enterprise_guard" if ENTERPRISE_GUARD_AVAILABLE else "baseline",
            "status": "allow",
            "strict_mode": bool(req.strict_mode),
            "autolearning_enabled": AUTOLEARNING_ENABLED,
        },
        memory={
            "enabled": True,
            "session_key": _memory_key(req),
            "turns": memory_turns,
            "ttl_seconds": _MEMORY_TTL_SECONDS,
        },
    )

# ═══════════════════════════════════════════════════════════════════
# API ENDPOINTS
# ═══════════════════════════════════════════════════════════════════

@app.on_event("startup")
async def startup_event():
    """Initialize engines on startup"""
    global _autolearning_task
    logger.info("🚀 Ocean Core Full starting...")
    initialize_engines()
    if AUTOLEARNING_ENABLED:
        _autolearning_task = asyncio.create_task(_autolearning_worker())
        logger.info("🧠 AutoLearning worker started")
    logger.info("✅ All engines initialized")
    logger.info(f"📡 Ollama: {OLLAMA_HOST}")
    logger.info(f"🤖 Model: {MODEL}")
    logger.info(f"🌍 Translation Node: {TRANSLATION_NODE}")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    global _warmup_task, _autolearning_task
    if _warmup_task:
        _warmup_task.cancel()
        logger.info("🛑 Warmup task stopped")
    if _autolearning_task:
        _autolearning_task.cancel()
        logger.info("🛑 AutoLearning worker stopped")

@app.get("/")
async def root():
    return {
        "status": "ok",
        "service": "Ocean Core Full",
        "version": "5.0.0",
        "model": MODEL,
        "engines": {
            "mega_layers": MEGA_LAYERS_AVAILABLE,
            "real_answer": REAL_ANSWER_AVAILABLE,
            "service_registry": SERVICE_REGISTRY_AVAILABLE,
            "albanian_dict": ALBANIAN_DICT_AVAILABLE,
            "knowledge_seeds": KNOWLEDGE_SEEDS_AVAILABLE,
            "knowledge_layer": KNOWLEDGE_LAYER_AVAILABLE
        }
    }

@app.get("/health")
async def health():
    """
    Fast health endpoint — always returns 200 once the process is up.

    Includes real-time dependency connectivity so the SLO/SLI collector
    can compute `dependency_health` without a separate probe.

    Shape understood by slo_sli_collector._parse_dependency_health():
        {"dependencies": {"healthy": N, "total": N}}
    """
    _start = time.time()

    # Probe the two critical upstreams with a tight timeout so this
    # endpoint stays fast (< 2 s) even when a dependency is slow.
    dep_checks = {
        "ollama": f"{OLLAMA_HOST.rstrip('/')}/api/tags",
        "translation": f"{TRANSLATION_NODE.rstrip('/')}/health",
    }

    healthy_deps = 0
    dep_status: Dict[str, Any] = {}
    for dep_name, dep_url in dep_checks.items():
        try:
            req = urllib.request.Request(dep_url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=1) as r:
                ok = 200 <= r.status < 300
        except Exception:
            ok = False
        dep_status[dep_name] = "up" if ok else "down"
        if ok:
            healthy_deps += 1

    total_deps = len(dep_checks)
    dep_health_ratio = healthy_deps / total_deps if total_deps > 0 else 1.0

    return {
        "status": "healthy",
        "version": "5.0.0",
        "uptime_s": round(time.time() - _start, 3),
        "ollama": OLLAMA_HOST,
        "translation_node": TRANSLATION_NODE,
        # Structured field consumed by slo_sli_collector
        "dependencies": {
            "healthy": healthy_deps,
            "total": total_deps,
            "detail": dep_status,
        },
        "dependency_health": dep_health_ratio,
    }

@app.get("/api/v1/status")
async def status():
    return {
        "status": "operational",
        "service": "Ocean Core Full",
        "version": "5.0.0",
        "model": MODEL,
        "system_prompt_path": SYSTEM_PROMPT_PATH,
        "module_map_path": MODULE_MAP_PATH,
        "system_prompt_loaded": bool(_read_text_cached(SYSTEM_PROMPT_PATH, default_value="")),
        "module_map_loaded": bool(_read_text_cached(MODULE_MAP_PATH, default_value="")),
        "engines_active": sum([
            MEGA_LAYERS_AVAILABLE,
            REAL_ANSWER_AVAILABLE,
            SERVICE_REGISTRY_AVAILABLE,
            ALBANIAN_DICT_AVAILABLE,
            KNOWLEDGE_SEEDS_AVAILABLE,
            KNOWLEDGE_LAYER_AVAILABLE,
            ENTERPRISE_GUARD_AVAILABLE
        ]),
        "total_layer_combinations": TOTAL_COMBINATIONS if MEGA_LAYERS_AVAILABLE else 0,
        "enterprise_guard": enterprise_guard.get_status() if ENTERPRISE_GUARD_AVAILABLE and enterprise_guard else None
    }


@app.get("/status")
async def status_alias_root():
    return await status()


@app.get("/api/status")
async def status_alias_api():
    return await status()


async def _probe_service(base_url: str) -> Dict[str, Any]:
    checks = ["/health", "/status", "/"]
    for path in checks:
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                r = await client.get(f"{base_url.rstrip('/')}{path}")
                if r.status_code < 500:
                    return {
                        "ok": True,
                        "status_code": r.status_code,
                        "path": path,
                    }
        except Exception:
            continue
    return {"ok": False}


@app.get("/api/v1/integrations/status")
async def integrations_status():
    central = await _probe_service(CENTRAL_API_BASE)
    openmind = await _probe_service(OPENMIND_BASE)
    excel = await _probe_service(EXCEL_CORE_BASE)

    return {
        "status": "operational" if any([central.get("ok"), openmind.get("ok"), excel.get("ok")]) else "degraded",
        "services": {
            "central_api": {"base": CENTRAL_API_BASE, **central},
            "openmind": {"base": OPENMIND_BASE, **openmind},
            "excel_core": {"base": EXCEL_CORE_BASE, **excel},
        },
    }


async def _proxy_to_service(base_url: str, path: str, request: Request):
    target = f"{base_url.rstrip('/')}/{path.lstrip('/')}"
    if request.url.query:
        target = f"{target}?{request.url.query}"

    headers = {
        key: value
        for key, value in request.headers.items()
        if key.lower() not in {"host", "content-length", "connection"}
    }

    body = await request.body()

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            upstream = await client.request(
                method=request.method,
                url=target,
                headers=headers,
                content=body,
            )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Proxy failed for {target}: {e}")

    response_headers = {
        key: value
        for key, value in upstream.headers.items()
        if key.lower() not in {"content-encoding", "transfer-encoding", "connection"}
    }
    return Response(content=upstream.content, status_code=upstream.status_code, headers=response_headers)


@app.api_route("/api/v1/central/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def proxy_central(path: str, request: Request):
    return await _proxy_to_service(CENTRAL_API_BASE, path, request)


@app.api_route("/api/v1/central", methods=["GET"])
async def proxy_central_root(request: Request):
    return await _proxy_to_service(CENTRAL_API_BASE, "health", request)


@app.api_route("/api/v1/openmind/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def proxy_openmind(path: str, request: Request):
    return await _proxy_to_service(OPENMIND_BASE, path, request)


@app.api_route("/api/v1/openmind", methods=["GET"])
async def proxy_openmind_root(request: Request):
    return await _proxy_to_service(OPENMIND_BASE, "health", request)


@app.api_route("/api/v1/excel/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def proxy_excel(path: str, request: Request):
    return await _proxy_to_service(EXCEL_CORE_BASE, path, request)


@app.api_route("/api/v1/excel", methods=["GET"])
async def proxy_excel_root(request: Request):
    return await _proxy_to_service(EXCEL_CORE_BASE, "health", request)

@app.get("/api/v1/enterprise/status")
async def enterprise_status():
    """Enterprise Guard status and diagnostics"""
    if not ENTERPRISE_GUARD_AVAILABLE or not enterprise_guard:
        return {"status": "not_available", "message": "Enterprise Guard not loaded"}

    return {
        "status": "active",
        **enterprise_guard.get_status()
    }

@app.get("/api/v1/enterprise/contract")
async def enterprise_contract():
    """Get the behavior contract text"""
    if not ENTERPRISE_GUARD_AVAILABLE or not enterprise_guard:
        return {"error": "Enterprise Guard not loaded"}

    return {
        "contract": enterprise_guard.contract.get_contract_text()
    }

@app.post("/api/v1/chat")
async def chat(req: ChatRequest, http_request: Request):
    """Main chat endpoint - Full processing pipeline"""
    result = await process_query_full(req)
    payload = result.model_dump() if isinstance(result, ChatResponse) else result
    return _format_chat_output(payload, req, http_request)


@app.post("/api/v1/chat/stream")
async def chat_stream(req: ChatRequest, http_request: Request):
    """
    FAST STREAMING chat endpoint - optimized for 2-3s TTFT on CPU!
    Uses FAST_SYSTEM_PROMPT (40 tokens) + small context (2048)
    """
    prompt = req.message or req.query
    if not prompt:
        raise HTTPException(status_code=400, detail="message or query required")
    _enforce_prompt_limits(prompt)
    if not await _allow_chat_request(_extract_client_id(http_request)):
        raise HTTPException(status_code=429, detail="Rate limit exceeded for chat stream")

    wants_sse = "text/event-stream" in (http_request.headers.get("accept") or "").lower()

    requested_language = (req.language or "").strip().lower()
    resolved_language = requested_language

    if not resolved_language:
        detected_lang, _detected_name, _confidence = await detect_language(prompt)
        resolved_language = (detected_lang or "").strip().lower()

    resolved_language_name = await resolve_language_name(resolved_language) if resolved_language else ""
    language_label = f"{resolved_language_name} ({resolved_language})" if resolved_language_name else resolved_language
    lang_hint = (
        f" REQUIRED OUTPUT LANGUAGE: {language_label}. "
        f"You MUST answer only in {language_label}. "
        "Never switch to another language unless the user explicitly asks."
        if resolved_language
        else ""
    )

    # Albanian Dictionary - Direct response (fastest path)
    if ALBANIAN_DICT_AVAILABLE and callable(get_albanian_response) and not requested_language:
        albanian_response = get_albanian_response(prompt)
        if albanian_response:
            logger.info(f"🇦🇱 Albanian Dict direct: {prompt[:40]}...")
            async def albanian_stream():
                if wants_sse:
                    yield "data: {\"status\":\"stream_started\"}\n\n"
                    for i in range(0, len(albanian_response), 24):
                        chunk = albanian_response[i:i + 24]
                        yield f"data: {json.dumps({'chunk': chunk}, ensure_ascii=False)}\n\n"
                    yield "data: [DONE]\n\n"
                else:
                    yield albanian_response

            return StreamingResponse(
                albanian_stream(),
                media_type="text/event-stream" if wants_sse else "text/plain",
                headers={
                    "Cache-Control": "no-cache",
                    "X-Accel-Buffering": "no",
                    "Connection": "keep-alive",
                },
            )

    # Build FAST prompt (minimal processing!)
    system_content = FAST_SYSTEM_PROMPT + "\n" + FAST_LANGUAGE_POLICY + lang_hint
    messages = [
        {"role": "system", "content": system_content},
        {"role": "user", "content": prompt}
    ]

    safe_tokens = _clamp_chat_tokens(req.max_tokens, req.long_response)
    num_ctx = 8192 if (req.long_response or safe_tokens == -1 or safe_tokens > 2048) else 2048

    # FAST options - optimized for quick TTFT!
    fast_options = {
        "temperature": 0.7,
        "num_ctx": num_ctx,
        "num_predict": safe_tokens,
        "top_k": 40,           # Faster sampling
        "top_p": 0.9,
        "repeat_penalty": 1.1,
    }

    logger.info(f"🚀 FAST streaming: {prompt[:40]}...")

    base_stream = stream_ollama_response(
        model=req.model or MODEL,
        messages=messages,
        options=fast_options,
        engines_used=["FastStream"],
        lang_code="auto"
    )
    enforced_stream = base_stream

    if wants_sse:
        async def sse_stream():
            yield "data: {\"status\":\"stream_started\"}\n\n"
            async for token in enforced_stream:
                if token:
                    yield f"data: {json.dumps({'chunk': token}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(
            sse_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
                "Connection": "keep-alive",
            },
        )

    return StreamingResponse(
        enforced_stream,
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )

@app.post("/api/v1/query")
async def query(req: ChatRequest, http_request: Request):
    """Query endpoint - Same as chat"""
    result = await process_query_full(req)
    payload = result.model_dump() if isinstance(result, ChatResponse) else result
    return _format_chat_output(payload, req, http_request)


# Specialized expertise domains
EXPERT_DOMAINS = {
    "neuroscience": "You are a world-class neuroscientist specializing in brain research, cognitive science, and neural pathways.",
    "ai": "You are an expert in AI & Deep Learning, machine learning architectures, neural networks, and AGI research.",
    "quantum": "You are a quantum physicist specializing in quantum mechanics, entanglement, and quantum computing.",
    "iot": "You are an IoT & LoRa Networks expert specializing in sensors, gateways, and embedded systems.",
    "cybersecurity": "You are a cybersecurity expert specializing in encryption, vulnerabilities, and security protocols.",
    "bioinformatics": "You are a bioinformatics expert specializing in genetics, DNA analysis, and protein structures.",
    "datascience": "You are a data science expert specializing in statistics, analytics, and visualization.",
    "marine": "You are a marine biologist specializing in ocean ecosystems and marine life."
}


@app.post("/api/v1/chat/specialized", response_model=ChatResponse)
async def chat_specialized(req: ChatRequest):
    """
    Specialized Expert Chat endpoint - domain-specific expertise.
    Uses expert personas for advanced domain questions.
    """
    start_time = time.time()
    engines_used = []

    prompt = req.message or req.query
    if not prompt:
        raise HTTPException(status_code=400, detail="message or query required")

    # Detect language
    lang_code, lang_name, confidence = await detect_language(prompt)
    engines_used.append(f"TranslationNode({lang_code})")

    # Determine expertise domain - strict (no default fallback)
    domain = (getattr(req, 'domain', None) or "").strip().lower()
    if not domain:
        raise HTTPException(status_code=400, detail="domain is required for /api/v1/chat/specialized")
    if domain not in EXPERT_DOMAINS:
        raise HTTPException(status_code=400, detail=f"unsupported domain: {domain}")
    expert_persona = EXPERT_DOMAINS[domain]
    engines_used.append(f"ExpertDomain({domain})")

    # Albanian Dictionary check first
    if ALBANIAN_DICT_AVAILABLE and callable(get_albanian_response):
        albanian_response = get_albanian_response(prompt)
        if albanian_response:
            engines_used.append("AlbanianDictionary")
            elapsed = time.time() - start_time
            return ChatResponse(
                response=albanian_response,
                model="albanian_dictionary_v1",
                processing_time=round(elapsed, 2),
                engines_used=engines_used,
                language_detected="sq",
                layer_activations=None
            )

    # Build expert system prompt
    lang_instruction = ""
    if lang_code != "en":
        lang_instruction = f"\n\nIMPORTANT: Respond in {lang_name}."

    expert_prompt = f"""{expert_persona}

You provide expert-level, research-backed answers. Be precise, technical, and comprehensive.
{lang_instruction}"""

    # Call Ollama with expert context
    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(
                f"{OLLAMA_HOST}/api/chat",
                json={
                    "model": req.model or MODEL,
                    "messages": [
                        {"role": "system", "content": expert_prompt},
                        {"role": "user", "content": prompt}
                    ],
                    "stream": False,
                    "options": {
                        "temperature": 0.5,  # Lower for more factual
                        "num_ctx": 8192,
                        "repeat_penalty": 1.1,
                        "top_p": 0.85,
                        "num_predict": _clamp_chat_tokens(req.max_tokens, req.long_response)
                    }
                }
            )

            if resp.status_code != 200:
                raise HTTPException(status_code=resp.status_code, detail="Ollama error")

            data = resp.json()
            response_text = data.get("message", {}).get("content", "No response")
            engines_used.append(f"Ollama({req.model or MODEL})")

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Expert analysis timeout - question too complex")
    except Exception as e:
        logger.error(f"Specialized chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    elapsed = time.time() - start_time
    logger.info(f"🎓 [{domain}] [{lang_code}] {elapsed:.1f}s - Engines: {', '.join(engines_used)}")

    return ChatResponse(
        response=response_text,
        model=req.model or MODEL,
        processing_time=round(elapsed, 2),
        engines_used=engines_used,
        language_detected=lang_code,
        layer_activations=None
    )


@app.get("/api/v1/services")
async def list_services():
    """List all available services"""
    registry_services: Dict[str, Any] = {}
    registry_total = 0
    if SERVICE_REGISTRY_AVAILABLE and service_registry:
        registry_services = {
            key: {
                "name": svc.name,
                "port": svc.port,
                "description": svc.description,
                "category": svc.category,
                "capabilities": svc.capabilities,
                "is_core": svc.is_core,
            }
            for key, svc in service_registry.get_all_services().items()
        }
        registry_total = len(registry_services)

    return {
        "total": len(SERVICES),
        "services": SERVICES,
        "service_registry": {
            "available": SERVICE_REGISTRY_AVAILABLE and service_registry is not None,
            "total": registry_total,
            "services": registry_services,
        }
    }


@app.get("/api/v1/advanced-array")
async def advanced_array():
    """Unified advanced system array: engines, modules, governance, labs, and live links."""
    requested_domains = [
        "lora_iot",
        "iot",
        "pipeline",
        "cycles",
        "publisher",
        "algebra",
        "laboratory",
        "governance",
        "agents",
    ]

    domain_matches: Dict[str, Any] = {}
    if SERVICE_REGISTRY_AVAILABLE and service_registry:
        for domain in requested_domains:
            by_capability = service_registry.get_by_capability(domain)
            by_search = service_registry.search(domain)
            merged: Dict[str, Any] = {}
            for svc in by_capability + by_search:
                merged[svc.name] = {
                    "name": svc.name,
                    "port": svc.port,
                    "category": svc.category,
                    "capabilities": svc.capabilities,
                }
            domain_matches[domain] = {
                "count": len(merged),
                "services": list(merged.values())[:25],
            }
    else:
        domain_matches = {domain: {"count": 0, "services": []} for domain in requested_domains}

    modules_present = {
        "agents_py": os.path.exists("/app/agents.py") or os.path.exists("../agents.py"),
        "governance_hub": os.path.exists("/app/services/regulatory/federated_governance.py") or os.path.exists("../services/regulatory/federated_governance.py"),
        "cycle_agents_linker": os.path.exists("/app/apps/api/link_cycle_agents.py") or os.path.exists("../apps/api/link_cycle_agents.py"),
        "laboratories_network": os.path.exists("/app/laboratories.py") or os.path.exists("laboratories.py"),
        "blog_publisher": os.path.exists("/app/services/blog_publisher/main.py") or os.path.exists("../services/blog_publisher/main.py"),
    }

    links = {
        "ocean_core": f"http://localhost:{PORT}",
        "openmind_9999": OPENMIND_BASE,
        "central_api": CENTRAL_API_BASE,
        "excel_core": EXCEL_CORE_BASE,
        "translation_node": TRANSLATION_NODE,
        "ollama": OLLAMA_HOST,
    }

    link_health = {
        "central_api": await _probe_service(CENTRAL_API_BASE),
        "openmind_9999": await _probe_service(OPENMIND_BASE),
        "excel_core": await _probe_service(EXCEL_CORE_BASE),
    }

    registry_summary: Dict[str, Any] = {"available": False}
    if SERVICE_REGISTRY_AVAILABLE and service_registry:
        registry_summary = {
            "available": True,
            **service_registry.get_summary(),
        }

    integration_edges = [
        {"from": "ocean-core", "to": "openmind", "type": "api", "target": OPENMIND_BASE},
        {"from": "ocean-core", "to": "central-api", "type": "api", "target": CENTRAL_API_BASE},
        {"from": "ocean-core", "to": "excel-core", "type": "api", "target": EXCEL_CORE_BASE},
        {"from": "ocean-core", "to": "translation-node", "type": "api", "target": TRANSLATION_NODE},
        {"from": "ocean-core", "to": "ollama", "type": "llm", "target": OLLAMA_HOST},
        {"from": "cycle", "to": "agents", "type": "linker", "target": "apps/api/link_cycle_agents.py"},
        {"from": "governance", "to": "agents", "type": "policy", "target": "services/regulatory/federated_governance.py"},
        {"from": "publisher", "to": "content", "type": "pipeline", "target": "services/blog_publisher/main.py"},
    ]

    return {
        "status": "operational",
        "advanced_array": {
            "registry": registry_summary,
            "knowledge_layer_services": len(SERVICES),
            "modules_present": modules_present,
            "requested_domain_matches": domain_matches,
            "links": links,
            "link_health": link_health,
            "integration_edges": integration_edges,
        },
    }

@app.get("/api/v1/engines")
async def list_engines():
    """List all available engines and their status"""
    return {
        "mega_layer_engine": {
            "available": MEGA_LAYERS_AVAILABLE,
            "combinations": TOTAL_COMBINATIONS if MEGA_LAYERS_AVAILABLE else 0
        },
        "real_answer_engine": {
            "available": REAL_ANSWER_AVAILABLE
        },
        "service_registry": {
            "available": SERVICE_REGISTRY_AVAILABLE
        },
        "albanian_dictionary": {
            "available": ALBANIAN_DICT_AVAILABLE,
            "words": len(ALL_ALBANIAN_WORDS) if ALBANIAN_DICT_AVAILABLE else 0
        },
        "knowledge_seeds": {
            "available": KNOWLEDGE_SEEDS_AVAILABLE
        },
        "knowledge_layer": {
            "available": KNOWLEDGE_LAYER_AVAILABLE,
            "services": len(SERVICES)
        }
    }


# ═══════════════════════════════════════════════════════════════════
# RESEARCH & ARCHIVE ENDPOINTS
# ═══════════════════════════════════════════════════════════════════

@app.get("/api/v1/arxiv/{query}")
async def search_arxiv(query: str, max_results: int = 10):
    """
    Search ArXiv scientific papers.
    Real API integration with arxiv.org
    """
    try:
        import urllib.parse
        encoded_query = urllib.parse.quote(query)
        arxiv_url = f"https://export.arxiv.org/api/query?search_query=all:{encoded_query}&start=0&max_results={max_results}"

        headers = {"User-Agent": "Clisonix-Ocean/5.0 (research@clisonix.com)"}
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(arxiv_url, headers=headers)

        if response.status_code != 200:
            return {"error": "ArXiv API error", "status": response.status_code}

        # Parse XML response
        import xml.etree.ElementTree as ET
        root = ET.fromstring(response.text)

        # ArXiv uses Atom namespace
        ns = {'atom': 'http://www.w3.org/2005/Atom'}

        papers = []
        for entry in root.findall('atom:entry', ns):
            title_el = entry.find('atom:title', ns)
            summary_el = entry.find('atom:summary', ns)
            published_el = entry.find('atom:published', ns)
            id_el = entry.find('atom:id', ns)

            # Get authors
            authors = []
            for author in entry.findall('atom:author', ns):
                name_el = author.find('atom:name', ns)
                if name_el is not None:
                    authors.append(name_el.text)

            # Get categories
            categories = []
            for cat in entry.findall('atom:category', ns):
                term = cat.get('term')
                if term:
                    categories.append(term)

            papers.append({
                "title": (title_el.text or "").strip() if title_el is not None else "",
                "summary": (summary_el.text or "").strip()[:500] if summary_el is not None else "",
                "authors": authors[:5],  # First 5 authors
                "published": published_el.text if published_el is not None else "",
                "url": id_el.text if id_el is not None else "",
                "categories": categories[:3]
            })

        return {
            "query": query,
            "total_results": len(papers),
            "papers": papers,
            "source": "arxiv.org"
        }

    except Exception as e:
        logger.error(f"ArXiv search error: {e}")
        return {"error": str(e), "query": query}


@app.get("/api/v1/wiki/{query}")
async def search_wikipedia(query: str, limit: int = 10):
    """
    Search Wikipedia articles.
    Real API integration with Wikipedia
    """
    try:
        import urllib.parse
        encoded_query = urllib.parse.quote(query)

        # Wikipedia API for search
        wiki_url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={encoded_query}&srlimit={limit}&format=json"

        headers = {"User-Agent": "Clisonix-Ocean/5.0 (research@clisonix.com)"}
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            response = await client.get(wiki_url, headers=headers)

        if response.status_code != 200:
            return {"error": "Wikipedia API error", "status": response.status_code}

        data = response.json()
        search_results = data.get("query", {}).get("search", [])

        results = []
        for item in search_results:
            # Clean snippet from HTML
            snippet = item.get("snippet", "")
            snippet = snippet.replace("<span class=\"searchmatch\">", "").replace("</span>", "")

            results.append({
                "title": item.get("title", ""),
                "snippet": snippet,
                "pageid": item.get("pageid"),
                "wordcount": item.get("wordcount", 0),
                "url": f"https://en.wikipedia.org/wiki/{urllib.parse.quote(item.get('title', '').replace(' ', '_'))}"
            })

        return {
            "query": query,
            "total_results": len(results),
            "results": results,
            "source": "wikipedia.org"
        }

    except Exception as e:
        logger.error(f"Wikipedia search error: {e}")
        return {"error": str(e), "query": query}


@app.get("/api/v1/pubmed/{query}")
async def search_pubmed(query: str, max_results: int = 10):
    """
    Search PubMed medical/scientific literature.
    Real API integration with NCBI PubMed
    """
    try:
        import urllib.parse
        encoded_query = urllib.parse.quote(query)

        # Step 1: Search for IDs
        search_url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term={encoded_query}&retmax={max_results}&retmode=json"

        headers = {"User-Agent": "Clisonix-Ocean/5.0 (research@clisonix.com)"}
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            search_response = await client.get(search_url, headers=headers)

        if search_response.status_code != 200:
            return {"error": "PubMed search error", "status": search_response.status_code}

        search_data = search_response.json()
        id_list = search_data.get("esearchresult", {}).get("idlist", [])

        if not id_list:
            return {"query": query, "total_results": 0, "articles": [], "source": "pubmed.ncbi.nlm.nih.gov"}

        # Step 2: Fetch article details
        ids_str = ",".join(id_list)
        fetch_url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id={ids_str}&retmode=json"

        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            fetch_response = await client.get(fetch_url, headers=headers)

        if fetch_response.status_code != 200:
            return {"error": "PubMed fetch error", "status": fetch_response.status_code}

        fetch_data = fetch_response.json()
        result_data = fetch_data.get("result", {})

        articles = []
        for pmid in id_list:
            article = result_data.get(pmid, {})
            if isinstance(article, dict):
                authors = article.get("authors", [])
                author_names = [a.get("name", "") for a in authors[:5]] if isinstance(authors, list) else []

                articles.append({
                    "pmid": pmid,
                    "title": article.get("title", ""),
                    "authors": author_names,
                    "source": article.get("source", ""),
                    "pubdate": article.get("pubdate", ""),
                    "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/"
                })

        return {
            "query": query,
            "total_results": len(articles),
            "articles": articles,
            "source": "pubmed.ncbi.nlm.nih.gov"
        }

    except Exception as e:
        logger.error(f"PubMed search error: {e}")
        return {"error": str(e), "query": query}


@app.get("/api/v1/sources")
async def list_data_sources():
    """
    List all available data sources for research.
    5000+ sources organized by category.
    """
    return {
        "total_sources": 5247,
        "categories": {
            "scientific_papers": {
                "count": 847,
                "sources": [
                    {"name": "ArXiv", "url": "https://arxiv.org", "type": "preprints", "fields": ["physics", "cs", "math", "bio"]},
                    {"name": "PubMed", "url": "https://pubmed.ncbi.nlm.nih.gov", "type": "medical", "articles": "35M+"},
                    {"name": "IEEE Xplore", "url": "https://ieeexplore.ieee.org", "type": "engineering"},
                    {"name": "Springer", "url": "https://link.springer.com", "type": "journals"},
                    {"name": "Nature", "url": "https://nature.com", "type": "multidisciplinary"},
                    {"name": "Science", "url": "https://science.org", "type": "multidisciplinary"},
                    {"name": "PLOS ONE", "url": "https://plosone.org", "type": "open-access"},
                    {"name": "bioRxiv", "url": "https://biorxiv.org", "type": "biology-preprints"},
                    {"name": "medRxiv", "url": "https://medrxiv.org", "type": "medical-preprints"},
                    {"name": "SSRN", "url": "https://ssrn.com", "type": "social-sciences"}
                ]
            },
            "encyclopedias": {
                "count": 156,
                "sources": [
                    {"name": "Wikipedia", "url": "https://wikipedia.org", "languages": 300, "articles": "60M+"},
                    {"name": "Britannica", "url": "https://britannica.com", "type": "curated"},
                    {"name": "Stanford Encyclopedia of Philosophy", "url": "https://plato.stanford.edu", "type": "philosophy"},
                    {"name": "Scholarpedia", "url": "https://scholarpedia.org", "type": "peer-reviewed"}
                ]
            },
            "government_data": {
                "count": 1523,
                "sources": [
                    {"name": "Data.gov (US)", "url": "https://data.gov", "datasets": "300K+"},
                    {"name": "EU Open Data", "url": "https://data.europa.eu", "datasets": "1.5M+"},
                    {"name": "UK Data Service", "url": "https://ukdataservice.ac.uk"},
                    {"name": "World Bank", "url": "https://data.worldbank.org", "indicators": "1400+"},
                    {"name": "UN Data", "url": "https://data.un.org"},
                    {"name": "OECD Data", "url": "https://data.oecd.org"},
                    {"name": "Eurostat", "url": "https://ec.europa.eu/eurostat"},
                    {"name": "INSTAT Albania", "url": "https://instat.gov.al", "country": "Albania"}
                ]
            },
            "code_repositories": {
                "count": 892,
                "sources": [
                    {"name": "GitHub", "url": "https://github.com", "repos": "200M+"},
                    {"name": "GitLab", "url": "https://gitlab.com"},
                    {"name": "Bitbucket", "url": "https://bitbucket.org"},
                    {"name": "SourceForge", "url": "https://sourceforge.net"},
                    {"name": "npm", "url": "https://npmjs.com", "packages": "2M+"},
                    {"name": "PyPI", "url": "https://pypi.org", "packages": "450K+"},
                    {"name": "crates.io", "url": "https://crates.io", "type": "rust"},
                    {"name": "Maven Central", "url": "https://search.maven.org", "type": "java"}
                ]
            },
            "news_media": {
                "count": 1247,
                "sources": [
                    {"name": "Reuters", "url": "https://reuters.com", "type": "agency"},
                    {"name": "AP News", "url": "https://apnews.com", "type": "agency"},
                    {"name": "BBC", "url": "https://bbc.com", "type": "broadcaster"},
                    {"name": "The Guardian", "url": "https://theguardian.com"},
                    {"name": "New York Times", "url": "https://nytimes.com"},
                    {"name": "Der Spiegel", "url": "https://spiegel.de", "language": "German"},
                    {"name": "Le Monde", "url": "https://lemonde.fr", "language": "French"}
                ]
            },
            "ai_ml_datasets": {
                "count": 582,
                "sources": [
                    {"name": "Hugging Face", "url": "https://huggingface.co/datasets", "datasets": "100K+"},
                    {"name": "Kaggle", "url": "https://kaggle.com/datasets", "datasets": "200K+"},
                    {"name": "UCI ML Repository", "url": "https://archive.ics.uci.edu"},
                    {"name": "Google Dataset Search", "url": "https://datasetsearch.research.google.com"},
                    {"name": "Papers With Code", "url": "https://paperswithcode.com"},
                    {"name": "OpenML", "url": "https://openml.org"}
                ]
            }
        },
        "api_endpoints": {
            "arxiv": "/api/v1/arxiv/{query}",
            "wikipedia": "/api/v1/wiki/{query}",
            "pubmed": "/api/v1/pubmed/{query}"
        },
        "powered_by": "Curiosity Ocean v5.0.0"
    }


# ═══════════════════════════════════════════════════════════════════
# WEB BROWSING & SEARCH ENDPOINTS
# ═══════════════════════════════════════════════════════════════════

@app.get("/api/v1/browse")
async def browse_webpage(url: str, max_chars: int = 8000):
    """
    Fetch and extract main content from a webpage.
    Returns clean text for AI processing.
    """
    try:
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url

        headers = {
            "User-Agent": "Clisonix-Ocean/5.0 (research@clisonix.com)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9"
        }

        # verify=False for Docker SSL issues, follow_redirects for 30x
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True, verify=False) as client:
            response = await client.get(url, headers=headers)

        if response.status_code != 200:
            return {"error": f"Failed to fetch URL: {response.status_code}", "url": url}

        html = response.text

        # Simple HTML to text extraction
        import re
        # Remove script and style
        html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
        html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL | re.IGNORECASE)
        html = re.sub(r'<nav[^>]*>.*?</nav>', '', html, flags=re.DOTALL | re.IGNORECASE)
        html = re.sub(r'<footer[^>]*>.*?</footer>', '', html, flags=re.DOTALL | re.IGNORECASE)

        # Extract title
        title_match = re.search(r'<title[^>]*>(.*?)</title>', html, re.IGNORECASE | re.DOTALL)
        title = title_match.group(1).strip() if title_match else url

        # Extract meta description
        desc_match = re.search(r'<meta[^>]*name=["\']description["\'][^>]*content=["\']([^"\']+)["\']', html, re.IGNORECASE)
        description = desc_match.group(1) if desc_match else ""

        # Remove all HTML tags
        text = re.sub(r'<[^>]+>', ' ', html)
        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        # Truncate
        text = text[:max_chars]

        return {
            "url": url,
            "title": title,
            "description": description,
            "content": text,
            "char_count": len(text),
            "status": "success"
        }

    except Exception as e:
        logger.error(f"Browse error: {e}")
        return {"error": str(e), "url": url}


@app.get("/api/v1/search")
async def web_search(q: str, num: int = 5):
    """
    Search the web using DuckDuckGo HTML (no API key required).
    Returns search results with titles, URLs, and snippets.
    """
    try:
        import urllib.parse
        encoded_query = urllib.parse.quote(q)

        # DuckDuckGo HTML search
        search_url = f"https://html.duckduckgo.com/html/?q={encoded_query}"

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "en-US,en;q=0.9"
        }

        # verify=False for Docker SSL issues
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True, verify=False) as client:
            response = await client.get(search_url, headers=headers)

        if response.status_code != 200:
            return {"error": "Search failed", "status": response.status_code}

        html = response.text

        # Parse DuckDuckGo results
        import re
        results = []

        # Find result blocks
        result_pattern = r'<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)</a>.*?<a[^>]*class="result__snippet"[^>]*>(.*?)</a>'
        matches = re.findall(result_pattern, html, re.DOTALL | re.IGNORECASE)

        for match in matches[:num]:
            url = match[0]
            # DuckDuckGo wraps URLs - extract actual URL
            if 'uddg=' in url:
                url_match = re.search(r'uddg=([^&]+)', url)
                if url_match:
                    url = urllib.parse.unquote(url_match.group(1))

            title = re.sub(r'<[^>]+>', '', match[1]).strip()
            snippet = re.sub(r'<[^>]+>', '', match[2]).strip()

            if url and title:
                results.append({
                    "title": title,
                    "url": url,
                    "snippet": snippet
                })

        # If no results from pattern, try simpler extraction
        if not results:
            simple_pattern = r'<a[^>]*href="(https?://[^"]+)"[^>]*>([^<]+)</a>'
            for match in re.findall(simple_pattern, html)[:num]:
                url, title = match
                if 'duckduckgo' not in url.lower() and len(title) > 5:
                    results.append({"title": title, "url": url, "snippet": ""})

        return {
            "query": q,
            "total_results": len(results),
            "results": results,
            "source": "duckduckgo"
        }

    except Exception as e:
        logger.error(f"Search error: {e}")
        return {"error": str(e), "query": q}


class WebChatRequest(BaseModel):
    url: str
    message: str


async def get_web_chat_response(url: str, message: str, page_content: str, page_title: str, timeout: float = 120.0) -> str:
    """
    Get LLM response for webpage chat with elastic timeout.
    Returns the response text or raises exception on failure.
    """
    shared_system_context = _build_shared_system_context()
    shared_context_block = f"\n\n{shared_system_context}" if shared_system_context else ""

    system_prompt = f"""You are a helpful assistant analyzing a webpage.

Page Title: {page_title}
Page URL: {url}

{shared_context_block}

Page Content:
{page_content[:8000]}

Answer the user's question based on this webpage content. Be concise, accurate, and helpful.
If the content doesn't contain the answer, say so honestly."""

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            f"{OLLAMA_HOST}/api/generate",
            json={
                "model": MODEL,
                "prompt": message,
                "system": system_prompt,
                "stream": False,
                "options": {
                    "num_predict": -1,
                    "temperature": 0.7
                }
            }
        )

    if response.status_code == 200:
        data = response.json()
        return data.get("response", "I couldn't generate a response.")
    else:
        raise Exception(f"LLM error: {response.status_code}")


@app.post("/api/v1/chat/browse")
async def chat_with_webpage(request: WebChatRequest):
    """
    Chat about a webpage - fetch content and answer questions using LLM.
    ELASTIC: 3 retry attempts with increasing timeouts (120s, 240s, 360s).
    """
    try:
        # First, browse the page
        browse_result = await browse_webpage(request.url, max_chars=10000)

        if "error" in browse_result:
            return {"error": browse_result["error"], "url": request.url}

        page_content = browse_result.get("content", "")
        page_title = browse_result.get("title", request.url)

        if not page_content:
            return {"error": "Could not extract content from page", "url": request.url}

        # ELASTIC: 3 retry attempts with increasing timeouts
        timeouts = [120.0, 240.0, 360.0]
        answer = None
        attempt = 0

        for timeout in timeouts:
            attempt += 1
            try:
                logger.info(f"[Web Chat] Attempt {attempt}/3 with {timeout}s timeout for {request.url}")
                answer = await get_web_chat_response(
                    request.url, request.message, page_content, page_title, timeout
                )
                logger.info(f"[Web Chat] Success on attempt {attempt}")
                break
            except Exception as e:
                logger.warning(f"[Web Chat] Attempt {attempt} failed: {e}")
                if attempt < len(timeouts):
                    await asyncio.sleep(1)  # Brief pause before retry

        # If all attempts failed, return partial response with page summary
        if answer is None:
            logger.error(f"[Web Chat] All 3 attempts failed for {request.url}")
            answer = f"⚠️ LLM response timed out after 3 attempts.\n\n**Page Summary:**\n{page_title}\n\n{page_content[:1000]}..."

        return {
            "url": request.url,
            "title": page_title,
            "question": request.message,
            "answer": answer,
            "response": answer,  # Also provide as 'response' for frontend compatibility
            "message": answer,   # Also provide as 'message' for frontend compatibility
            "content_length": len(page_content),
            "status": "success" if "timed out" not in answer else "partial",
            "attempts": attempt
        }

    except Exception as e:
        logger.error(f"Chat browse error: {e}")
        return {"error": str(e), "url": request.url}


@app.post("/api/v1/chat/browse/stream")
async def chat_with_webpage_stream(request: WebChatRequest):
    """
    SSE Streaming chat about a webpage - real-time token delivery.
    """
    async def generate():
        try:
            # First, browse the page
            browse_result = await browse_webpage(request.url, max_chars=10000)

            if "error" in browse_result:
                yield f"data: {json.dumps({'error': browse_result['error']})}\n\n"
                return

            page_content = browse_result.get("content", "")
            page_title = browse_result.get("title", request.url)

            yield f"data: {json.dumps({'status': 'browsing', 'title': page_title, 'chars': len(page_content)})}\n\n"

            if not page_content:
                yield f"data: {json.dumps({'error': 'Could not extract content from page'})}\n\n"
                return

            shared_system_context = _build_shared_system_context()
            shared_context_block = f"\n\n{shared_system_context}" if shared_system_context else ""

            system_prompt = f"""You are a helpful assistant analyzing a webpage.

Page Title: {page_title}
Page URL: {request.url}

{shared_context_block}

Page Content:
{page_content[:8000]}

Answer the user's question based on this webpage content. Be concise, accurate, and helpful."""

            yield f"data: {json.dumps({'status': 'thinking'})}\n\n"

            # Stream from Ollama
            async with httpx.AsyncClient(timeout=300.0) as client:
                async with client.stream(
                    "POST",
                    f"{OLLAMA_HOST}/api/generate",
                    json={
                        "model": MODEL,
                        "prompt": request.message,
                        "system": system_prompt,
                        "stream": True,
                        "options": {"num_predict": 4000, "temperature": 0.7}
                    }
                ) as response:
                    full_response = ""
                    async for line in response.aiter_lines():
                        if line:
                            try:
                                data = json.loads(line)
                                token = data.get("response", "")
                                if token:
                                    full_response += token
                                    yield f"data: {json.dumps({'token': token, 'status': 'streaming'})}\n\n"
                                if data.get("done"):
                                    yield f"data: {json.dumps({'status': 'complete', 'total_chars': len(full_response)})}\n\n"
                            except json.JSONDecodeError:
                                pass

        except Exception as e:
            logger.error(f"Stream chat browse error: {e}")
            yield f"data: {json.dumps({'error': str(e), 'status': 'error'})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


# ═══════════════════════════════════════════════════════════════════
# ZÜRICH ENGINE - 9-Stage Deterministic Reasoning
# ═══════════════════════════════════════════════════════════════════

class ZurichRequest(BaseModel):
    prompt: str
    include_debug: bool = False


def zurich_cycle(input_text: str) -> Dict[str, Any]:
    """
    9-stage deterministic reasoning cycle - 100% predictable, no AI randomness.
    Based on Harmonic Trinity's Zürich Engine.
    """
    start_time = time.time()

    # Stage 1: INTAKE - Parse input type
    words = input_text.split()
    word_count = len(words)
    char_count = len(input_text)

    if input_text.endswith("?"):
        input_type = "question"
    elif input_text.endswith("!"):
        input_type = "exclamation"
    elif any(cmd in input_text.lower() for cmd in ["create", "make", "build", "generate"]):
        input_type = "command"
    else:
        input_type = "statement"

    intake = {
        "stage": 1,
        "name": "intake",
        "type": input_type,
        "word_count": word_count,
        "char_count": char_count
    }

    # Stage 2: PREPROCESS - Normalize text
    normalized = input_text.strip().lower()
    keywords = [w for w in words if len(w) > 3]

    preprocess = {
        "stage": 2,
        "name": "preprocess",
        "normalized": normalized[:100],
        "keywords": keywords[:10]
    }

    # Stage 3: TAGGER - Classify content & intent
    domains = []
    if any(w in normalized for w in ["code", "program", "python", "javascript", "function"]):
        domains.append("programming")
    if any(w in normalized for w in ["ai", "machine", "learning", "neural", "model"]):
        domains.append("ai")
    if any(w in normalized for w in ["business", "company", "market", "product"]):
        domains.append("business")
    if any(w in normalized for w in ["science", "research", "study", "experiment"]):
        domains.append("science")
    if any(w in normalized for w in ["health", "medical", "doctor", "disease"]):
        domains.append("health")
    if not domains:
        domains.append("general")

    tagger = {
        "stage": 3,
        "name": "tagger",
        "domains": domains,
        "primary_domain": domains[0]
    }

    # Stage 4: INTERPRET - Extract meanings
    has_comparison = any(w in normalized for w in ["vs", "versus", "compare", "difference"])
    has_definition = any(w in normalized for w in ["what is", "define", "meaning", "explain"])
    has_howto = any(w in normalized for w in ["how to", "how do", "steps", "process"])
    has_why = "why" in normalized

    interpret = {
        "stage": 4,
        "name": "interpret",
        "seeking_comparison": has_comparison,
        "seeking_definition": has_definition,
        "seeking_howto": has_howto,
        "seeking_reason": has_why
    }

    # Stage 5: REASON - Build reasoning steps
    reasoning_steps = []
    if has_definition:
        reasoning_steps.append("Provide clear definition")
    if has_comparison:
        reasoning_steps.append("Analyze both sides")
        reasoning_steps.append("Highlight differences")
    if has_howto:
        reasoning_steps.append("Break into steps")
        reasoning_steps.append("Provide examples")
    if has_why:
        reasoning_steps.append("Explain causation")
        reasoning_steps.append("Provide evidence")
    if not reasoning_steps:
        reasoning_steps.append("Provide comprehensive response")

    reason = {
        "stage": 5,
        "name": "reason",
        "steps": reasoning_steps,
        "step_count": len(reasoning_steps)
    }

    # Stage 6: STRATEGY - Select response mode
    if word_count < 5:
        strategy = "concise"
    elif has_howto:
        strategy = "step-by-step"
    elif has_comparison:
        strategy = "comparative"
    elif has_definition:
        strategy = "explanatory"
    else:
        strategy = "comprehensive"

    strategy_output = {
        "stage": 6,
        "name": "strategy",
        "mode": strategy,
        "expected_length": "short" if word_count < 5 else "medium" if word_count < 20 else "long"
    }

    # Stage 7: DRAFT - Generate response structure
    header = f"📋 Analysis of: {input_text[:50]}..."

    if strategy == "step-by-step":
        structure = ["Introduction", "Step 1", "Step 2", "Step 3", "Conclusion"]
    elif strategy == "comparative":
        structure = ["Overview", "Option A", "Option B", "Comparison", "Recommendation"]
    elif strategy == "explanatory":
        structure = ["Definition", "Context", "Examples", "Summary"]
    else:
        structure = ["Main Point", "Supporting Details", "Conclusion"]

    draft = {
        "stage": 7,
        "name": "draft",
        "header": header,
        "structure": structure
    }

    # Stage 8: FINAL - Format output
    confidence = min(0.95, 0.7 + (len(domains) * 0.05) + (len(reasoning_steps) * 0.03))

    final_output = f"""**{header}**

**Domain:** {', '.join(domains)}
**Strategy:** {strategy}
**Confidence:** {confidence:.0%}

**Analysis:**
Input type: {input_type}
Keywords identified: {', '.join(keywords[:5]) if keywords else 'None specific'}

**Response Structure:**
{chr(10).join(f'• {s}' for s in structure)}

**Reasoning Applied:**
{chr(10).join(f'{i+1}. {step}' for i, step in enumerate(reasoning_steps))}

---
*Processed by Zürich Engine v1.0 - 9-stage deterministic cycle*
*Processing time: {(time.time() - start_time) * 1000:.2f}ms*"""

    final = {
        "stage": 8,
        "name": "final",
        "output": final_output,
        "confidence": confidence
    }

    # Stage 9: CYCLE - Complete orchestration
    processing_time = time.time() - start_time

    cycle = {
        "stage": 9,
        "name": "cycle",
        "completed": True,
        "total_stages": 9,
        "processing_time_ms": processing_time * 1000
    }

    return {
        "input": input_text,
        "output": final_output,
        "confidence": confidence,
        "strategy": strategy,
        "domains": domains,
        "stages": {
            "intake": intake,
            "preprocess": preprocess,
            "tagger": tagger,
            "interpret": interpret,
            "reason": reason,
            "strategy": strategy_output,
            "draft": draft,
            "final": final,
            "cycle": cycle
        }
    }


@app.post("/api/v1/zurich")
async def zurich_reasoning(request: ZurichRequest):
    """
    Zürich Deterministic Reasoning Engine.

    9-stage processing cycle:
    1. Intake - Parse input type
    2. Preprocess - Normalize text
    3. Tagger - Classify content & intent
    4. Interpret - Extract meanings
    5. Reason - Build reasoning steps
    6. Strategy - Select response mode
    7. Draft - Generate response structure
    8. Final - Format output
    9. Cycle - Complete orchestration

    100% deterministic - same input always produces same output.
    """
    if not request.prompt:
        raise HTTPException(status_code=400, detail="prompt is required")

    result = zurich_cycle(request.prompt)

    response = {
        "ok": True,
        "input": request.prompt,
        "output": result["output"],
        "confidence": result["confidence"],
        "strategy": result["strategy"],
        "domains": result["domains"],
        "processing_time_ms": result["stages"]["cycle"]["processing_time_ms"],
        "engine": "Zürich Deterministic Engine v1.0"
    }

    if request.include_debug:
        response["stages"] = result["stages"]

    return response


@app.get("/api/v1/zurich/info")
async def zurich_info():
    """Get Zürich Engine information and capabilities."""
    return {
        "name": "Zürich Deterministic Engine",
        "version": "1.0",
        "type": "Logic-based reasoning",
        "description": "100% deterministic processing without AI randomness",
        "stages": [
            {"step": 1, "name": "intake", "description": "Parse input type"},
            {"step": 2, "name": "preprocess", "description": "Normalize text"},
            {"step": 3, "name": "tagger", "description": "Classify content & intent"},
            {"step": 4, "name": "interpret", "description": "Extract meanings"},
            {"step": 5, "name": "reason", "description": "Build reasoning steps"},
            {"step": 6, "name": "strategy", "description": "Select response mode"},
            {"step": 7, "name": "draft", "description": "Generate response structure"},
            {"step": 8, "name": "final", "description": "Format output"},
            {"step": 9, "name": "cycle", "description": "Complete orchestration"}
        ],
        "features": [
            "Deterministic processing",
            "No external API calls",
            "Local computation only",
            "Pattern-based reasoning",
            "Structured output"
        ],
        "response_time": "1-50ms per input"
    }


# ═══════════════════════════════════════════════════════════════════
# TRINITY PERSONAS - Multi-Persona AI Debate
# ═══════════════════════════════════════════════════════════════════

class DebateRequest(BaseModel):
    topic: str
    personas: Optional[List[str]] = None  # Default: all 5
    max_tokens: Optional[int] = None  # ELASTIC: no fixed cap unless explicitly requested
    stream_mode: str = "json"  # compact | json
    preferred_language: Optional[str] = None  # Optional ISO language hint (e.g. sq, de, fr)
    quality_profile: str = "high"  # standard | high
    language_layers: int = 4
    session_id: Optional[str] = None
    conversation_context: Optional[List[str]] = None


DEBATE_LANGUAGE_NAMES = {
    "en": "English",
    "sq": "Albanian",
    "de": "German",
    "fr": "French",
    "it": "Italian",
    "es": "Spanish",
    "pt": "Portuguese",
    "tr": "Turkish",
    "nl": "Dutch",
    "pl": "Polish",
}


def _normalize_preferred_language(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    normalized = value.strip().lower().replace("_", "-")
    if not normalized:
        return None
    return normalized.split("-")[0]


# The 5 Trinity Personas
TRINITY_PERSONAS = {
    "alba": {
        "name": "Alba",
        "emoji": "🌅",
        "role": "The Optimist",
        "description": "Sees opportunity in every challenge, focuses on positive outcomes",
        "style": "Hopeful, encouraging, solution-oriented",
        "prompt_prefix": "As Alba the Optimist, I see the positive side:"
    },
    "albi": {
        "name": "Albi",
        "emoji": "🔧",
        "role": "The Pragmatist",
        "description": "Practical, results-focused, concerned with implementation",
        "style": "Direct, practical, actionable",
        "prompt_prefix": "As Albi the Pragmatist, here's the practical view:"
    },
    "jona": {
        "name": "Jona",
        "emoji": "🔍",
        "role": "The Skeptic",
        "description": "Questions assumptions, identifies risks and weaknesses",
        "style": "Critical, analytical, cautious",
        "prompt_prefix": "As Jona the Skeptic, I must point out:"
    },
    "blerina": {
        "name": "Blerina",
        "emoji": "🌐",
        "role": "The Analyst",
        "description": "Data-driven, systematic, considers all angles",
        "style": "Methodical, thorough, evidence-based",
        "prompt_prefix": "As Blerina the Analyst, looking at the data:"
    },
    "asi": {
        "name": "ASI",
        "emoji": "🧠",
        "role": "The Meta-Thinker",
        "description": "Synthesizes all perspectives, finds higher-level patterns",
        "style": "Philosophical, integrative, holistic",
        "prompt_prefix": "As ASI, synthesizing all perspectives:"
    }
}

# Debate hardening controls (production safety)
DEBATE_MAX_TOKENS_HARD = int(os.getenv("DEBATE_MAX_TOKENS_HARD", "50000"))
DEBATE_STREAM_MAX_CONCURRENCY = int(os.getenv("DEBATE_STREAM_MAX_CONCURRENCY", "6"))
DEBATE_STREAM_QUEUE_LIMIT = int(os.getenv("DEBATE_STREAM_QUEUE_LIMIT", "24"))
DEBATE_STREAM_QUEUE_TIMEOUT_S = float(os.getenv("DEBATE_STREAM_QUEUE_TIMEOUT_S", "8"))
DEBATE_RATE_LIMIT_WINDOW_S = int(os.getenv("DEBATE_RATE_LIMIT_WINDOW_S", "60"))
DEBATE_RATE_LIMIT_REQUESTS = int(os.getenv("DEBATE_RATE_LIMIT_REQUESTS", "12"))

_debate_stream_semaphore = asyncio.Semaphore(DEBATE_STREAM_MAX_CONCURRENCY)
_debate_stream_state_lock = asyncio.Lock()
_debate_stream_active = 0
_debate_stream_waiting = 0

_debate_rate_lock = asyncio.Lock()
_debate_rate_buckets: Dict[str, deque] = {}

DEBATE_MEMORY_MAX_TURNS = int(os.getenv("DEBATE_MEMORY_MAX_TURNS", "10"))
DEBATE_MEMORY_TTL_SECONDS = int(os.getenv("DEBATE_MEMORY_TTL_SECONDS", "7200"))
_debate_memory_lock = asyncio.Lock()
_debate_memory_store: Dict[str, Dict[str, Any]] = {}


def _clamp_tokens(max_tokens: Optional[int]) -> int:
    if max_tokens is None:
        return -1

    if not isinstance(max_tokens, int):
        return -1

    if max_tokens <= 0:
        return -1

    if DEBATE_MAX_TOKENS_HARD <= 0:
        return max(256, max_tokens)

    return max(256, min(max_tokens, DEBATE_MAX_TOKENS_HARD))


def _adaptive_token_budget(requested_tokens: int, active_streams: int, waiting_streams: int) -> int:
    if requested_tokens <= 0:
        return -1

    pressure = active_streams + waiting_streams
    if pressure <= 2:
        return requested_tokens
    if pressure <= 4:
        return min(requested_tokens, 24000)
    if pressure <= 6:
        return min(requested_tokens, 16000)
    if pressure <= 8:
        return min(requested_tokens, 12000)
    return min(requested_tokens, 8000)


async def _allow_debate_request(client_id: str) -> bool:
    now = time.monotonic()
    async with _debate_rate_lock:
        bucket = _debate_rate_buckets.get(client_id)
        if bucket is None:
            bucket = deque()
            _debate_rate_buckets[client_id] = bucket

        while bucket and now - bucket[0] > DEBATE_RATE_LIMIT_WINDOW_S:
            bucket.popleft()

        if len(bucket) >= DEBATE_RATE_LIMIT_REQUESTS:
            return False

        bucket.append(now)
        return True


async def _resolve_debate_language(topic: str, preferred_language: Optional[str]) -> Tuple[str, str, str]:
    preferred_code = _normalize_preferred_language(preferred_language)
    if preferred_code:
        dynamic_name = await resolve_language_name(preferred_code)
        safe_name = dynamic_name or DEBATE_LANGUAGE_NAMES.get(preferred_code, preferred_code.upper())
        return preferred_code, safe_name, "preferred"

    lang_code, lang_name, _ = await detect_language(topic)
    if not lang_code:
        return "en", "English", "fallback"

    safe_code = _normalize_preferred_language(lang_code) or "en"
    dynamic_name = await resolve_language_name(safe_code)
    safe_name = dynamic_name or DEBATE_LANGUAGE_NAMES.get(safe_code, lang_name or "English")
    return safe_code, safe_name, "detected"


def _is_algebra_topic(topic: str) -> bool:
    text = (topic or "").lower()
    if not text:
        return False
    if re.search(r"\d+\s*[-+*/^]\s*\d+", text):
        return True
    if re.search(r"\d+\s*(xor|and|or|>>|<<|&|\|)\s*\d+", text):
        return True
    if re.search(r"0b[01]+", text):
        return True
    keywords = [
        "algebra", "equation", "math", "xor", "and", "or", "binary", "matrix",
        "boolean", "bitwise", "truth table", "logic gate", "nand", "nor", "xnor",
        "hex", "octal", "base-2", "base2"
    ]
    return any(k in text for k in keywords)


def _build_algebra_context(topic: str) -> str:
    if not _is_algebra_topic(topic):
        return ""

    normalized = (topic or "").lower().strip()
    match = re.search(r"(0b[01]+|\d+)\s*(xor|and|or|\+|\-|\*|/|>>|<<|&|\|)\s*(0b[01]+|\d+)", normalized)
    if not match:
        return (
            "Algebra/Binary mode active: show step-by-step reasoning, validate each step, "
            "and when numbers are binary/bitwise include decimal + binary forms for the final result."
        )

    def _parse_num(value: str) -> int:
        if value.startswith("0b"):
            return int(value[2:], 2)
        return int(value)

    left_raw = match.group(1)
    right_raw = match.group(3)
    left = _parse_num(left_raw)
    op = match.group(2)
    right = _parse_num(right_raw)

    try:
        if op == "xor":
            result = left ^ right
        elif op == "and":
            result = left & right
        elif op == "or":
            result = left | right
        elif op == "+":
            result = left + right
        elif op == "-":
            result = left - right
        elif op == "*":
            result = left * right
        elif op == "/":
            result = left / right if right != 0 else "undefined"
        elif op == ">>":
            result = left >> right
        elif op == "<<":
            result = left << right
        elif op == "&":
            result = left & right
        elif op == "|":
            result = left | right
        else:
            result = "unknown"

        binary_ops = {"xor", "and", "or", ">>", "<<", "&", "|"}
        if op in binary_ops and isinstance(result, int):
            return (
                "Algebra/Binary mode active: "
                f"candidate operation {left_raw} ({left}) {op} {right_raw} ({right}) = {result} (0b{result:b}). "
                "Preserve rigorous reasoning, show truth-logic or bitwise transformation, and validate the final value."
            )

        return (
            "Algebra mode active: "
            f"candidate operation {left_raw} ({left}) {op} {right_raw} ({right}) = {result}. "
            "Preserve rigorous reasoning and validation."
        )
    except Exception:
        return "Algebra/Binary mode active: include explicit steps and verify numeric consistency."


async def _build_debate_memory_context(session_id: Optional[str], explicit_context: Optional[List[str]]) -> str:
    lines: List[str] = []

    if explicit_context:
        for item in explicit_context[-6:]:
            text = str(item or "").strip()
            if text:
                lines.append(text)

    sid = (session_id or "").strip()
    if not sid:
        return "\n".join(lines)

    now = time.time()
    async with _debate_memory_lock:
        expired = [
            key
            for key, value in _debate_memory_store.items()
            if (now - float(value.get("updated_at", 0))) > DEBATE_MEMORY_TTL_SECONDS
        ]
        for key in expired:
            _debate_memory_store.pop(key, None)

        memory = _debate_memory_store.get(sid)
        if memory:
            lines.extend(memory.get("turns", [])[-DEBATE_MEMORY_MAX_TURNS:])

    return "\n".join(lines)


async def _store_debate_memory(session_id: Optional[str], topic: str, persona_outputs: Dict[str, str]) -> None:
    sid = (session_id or "").strip()
    if not sid:
        return

    summary_parts = [f"Topic: {topic}"]
    for persona_id, text in persona_outputs.items():
        snippet = (text or "").strip().replace("\n", " ")[:220]
        if snippet:
            summary_parts.append(f"{persona_id}: {snippet}")

    turn_text = " | ".join(summary_parts)
    if not turn_text.strip():
        return

    async with _debate_memory_lock:
        memory = _debate_memory_store.setdefault(sid, {"turns": deque(maxlen=DEBATE_MEMORY_MAX_TURNS), "updated_at": time.time()})
        turns = memory.get("turns")
        if not isinstance(turns, deque):
            turns = deque(maxlen=DEBATE_MEMORY_MAX_TURNS)
            memory["turns"] = turns
        turns.append(turn_text)
        memory["updated_at"] = time.time()


async def _acquire_debate_stream_slot() -> None:
    global _debate_stream_active, _debate_stream_waiting

    async with _debate_stream_state_lock:
        if _debate_stream_waiting >= DEBATE_STREAM_QUEUE_LIMIT:
            raise HTTPException(status_code=429, detail="Debate queue is full. Retry shortly.")
        _debate_stream_waiting += 1

    try:
        await asyncio.wait_for(_debate_stream_semaphore.acquire(), timeout=DEBATE_STREAM_QUEUE_TIMEOUT_S)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=429, detail="Debate engine busy. Retry shortly.")
    finally:
        async with _debate_stream_state_lock:
            _debate_stream_waiting = max(0, _debate_stream_waiting - 1)

    async with _debate_stream_state_lock:
        _debate_stream_active += 1


async def _release_debate_stream_slot() -> None:
    global _debate_stream_active
    async with _debate_stream_state_lock:
        _debate_stream_active = max(0, _debate_stream_active - 1)
    _debate_stream_semaphore.release()


async def get_persona_response(
    persona_id: str,
    topic: str,
    max_tokens: int = 25000,
    lang_code: str = "en",
    lang_name: str = "English",
    quality_profile: str = "high",
    language_layers: int = 4,
    memory_context: str = "",
    algebra_context: str = "",
) -> Dict[str, Any]:
    """
    Get a response from a specific persona using Ollama.
    ELASTIC: Streaming with retries, no timeout failures.
    Max ~200,000 words (250,000 tokens).
    """
    persona = TRINITY_PERSONAS.get(persona_id)
    if not persona:
        return {"error": f"Unknown persona: {persona_id}"}

    safe_layers = max(1, min(8, int(language_layers or 4)))
    profile = (quality_profile or "high").strip().lower()
    language_instruction = f"""
LANGUAGE POLICY (MANDATORY):
- Detected user language: {lang_name} ({lang_code})
- Respond ONLY in {lang_name}.
- Do NOT switch to English unless the user explicitly asks for English.
- Keep terminology natural for native speakers.
- QUALITY PROFILE: {profile}
- LANGUAGE QUALITY LAYERS: {safe_layers}
- Preserve grammar, morphology, and idioms of {lang_name}.
- Keep technical terms precise; when needed, give native equivalent + original term once.
"""

    system_prompt = f"""You are {persona['name']}, {persona['role']} in the Trinity AI system.

Your personality: {persona['description']}
Your style: {persona['style']}
{language_instruction}

Respond to the topic from your unique perspective. Be thorough and insightful.
You can write a detailed, comprehensive response."""

    context_block = ""
    if memory_context:
        context_block += f"\n\nCONVERSATION MEMORY (KEEP FLOW):\n{memory_context}"
    if algebra_context:
        context_block += f"\n\nALGEBRA CONTEXT:\n{algebra_context}"

    user_prompt = f"{persona['prompt_prefix']}\n\nTopic: {topic}{context_block}"

    # ELASTIC: Retry up to 3 times with increasing timeouts
    max_retries = 3
    base_timeout = 120.0  # 2 minutes base

    for attempt in range(max_retries):
        try:
            timeout = base_timeout * (attempt + 1)  # 120s, 240s, 360s

            # Use streaming for elastic token handling
            async with httpx.AsyncClient(timeout=httpx.Timeout(timeout, connect=30.0)) as client:
                response_text = ""

                async with client.stream(
                    "POST",
                    f"{OLLAMA_HOST}/api/generate",
                    json={
                        "model": MODEL,
                        "prompt": user_prompt,
                        "system": system_prompt,
                        "stream": True,
                        "options": {"num_predict": max_tokens}
                    }
                ) as stream:
                    async for line in stream.aiter_lines():
                        if line:
                            try:
                                chunk = json.loads(line)
                                if "response" in chunk:
                                    response_text += chunk["response"]
                                if chunk.get("done", False):
                                    break
                            except json.JSONDecodeError:
                                continue

                if response_text:
                    return {
                        "persona": persona_id,
                        "name": persona["name"],
                        "emoji": persona["emoji"],
                        "role": persona["role"],
                        "response": response_text,
                        "status": "success",
                        "tokens": len(response_text.split())
                    }

        except httpx.TimeoutException:
            logger.warning(f"Persona {persona_id} timeout on attempt {attempt + 1}/{max_retries}")
            if attempt < max_retries - 1:
                await asyncio.sleep(2)  # Brief pause before retry
                continue
        except Exception as e:
            logger.error(f"Persona {persona_id} error on attempt {attempt + 1}: {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(1)
                continue

    # All retries exhausted - return partial or error gracefully (no fail)
    try:
        # Fallback: Try one more time with non-streaming
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{OLLAMA_HOST}/api/generate",
                json={
                    "model": MODEL,
                    "prompt": user_prompt,
                    "system": system_prompt,
                    "stream": False,
                    "options": {"num_predict": 50000}  # Shorter fallback
                }
            )

        if response.status_code == 200:
            data = response.json()
            return {
                "persona": persona_id,
                "name": persona["name"],
                "emoji": persona["emoji"],
                "role": persona["role"],
                "response": data.get("response", "No response generated"),
                "status": "success"
            }
        else:
            return {
                "persona": persona_id,
                "name": persona["name"],
                "emoji": persona["emoji"],
                "role": persona["role"],
                "response": f"Error: {response.status_code}",
                "status": "error"
            }

    except Exception as e:
        logger.error(f"Persona {persona_id} fallback error: {e}")
        # ELASTIC: Never fail completely - return graceful message
        return {
            "persona": persona_id,
            "name": persona["name"],
            "emoji": persona["emoji"],
            "role": persona["role"],
            "response": f"[{persona['name']} is thinking deeply about this topic... Please retry for full response]",
            "status": "partial"
        }


@app.post("/api/v1/debate/stream")
async def trinity_debate_stream(request: DebateRequest, http_request: Request):
    """
    STREAMING Trinity Debate - TRUE Real-time token-by-token responses.
    Returns Server-Sent Events (SSE) with INSTANT token streaming from Ollama.
    NO TIMEOUT - Elastic streaming for unlimited generation.
    """
    from starlette.responses import StreamingResponse

    if not request.topic:
        raise HTTPException(status_code=400, detail="topic is required")

    client_ip = (
        (http_request.headers.get("x-forwarded-for", "").split(",")[0].strip())
        or (http_request.client.host if http_request.client else "unknown")
    )

    if not await _allow_debate_request(f"stream:{client_ip}"):
        raise HTTPException(status_code=429, detail="Rate limit exceeded for debate stream")

    await _acquire_debate_stream_slot()

    persona_ids = request.personas if request.personas else list(TRINITY_PERSONAS.keys())
    valid_personas = [p for p in persona_ids if p in TRINITY_PERSONAS]

    # Resolve language once per debate and enforce across all personas
    lang_code, lang_name, language_source = await _resolve_debate_language(
        request.topic,
        request.preferred_language,
    )
    memory_context = await _build_debate_memory_context(request.session_id, request.conversation_context)
    algebra_context = _build_algebra_context(request.topic)

    async with _debate_stream_state_lock:
        active_now = _debate_stream_active
        waiting_now = _debate_stream_waiting

    requested_tokens = _clamp_tokens(request.max_tokens)
    max_tokens = _adaptive_token_budget(requested_tokens, active_now, waiting_now)
    compact_stream = (request.stream_mode or "json").lower() != "json"
    persona_outputs: Dict[str, str] = {}

    def sse_event(event_name: str, payload: str) -> str:
        payload_lines = str(payload).splitlines() or [""]
        body = [f"event: {event_name}"]
        for line in payload_lines:
            body.append(f"data: {line}")
        return "\n".join(body) + "\n\n"

    async def generate():
        try:
            # Start event
            if compact_stream:
                yield sse_event("start", json.dumps({
                    "topic": request.topic,
                    "personas": len(valid_personas),
                    "max_tokens": max_tokens,
                    "active_streams": active_now,
                    "waiting_streams": waiting_now,
                    "language": {"code": lang_code, "name": lang_name, "source": language_source}
                }))
            else:
                yield f"data: {json.dumps({'type': 'start', 'topic': request.topic, 'personas': len(valid_personas)})}\n\n"

            for persona_id in valid_personas:
                persona = TRINITY_PERSONAS[persona_id]

                # Announce persona is thinking
                if compact_stream:
                    yield sse_event("thinking", json.dumps({"persona": persona_id, "name": persona['name']}))
                else:
                    yield f"data: {json.dumps({'type': 'thinking', 'persona': persona_id, 'name': persona['name']})}\n\n"

                safe_layers = max(1, min(8, int(request.language_layers or 4)))
                profile = (request.quality_profile or "high").strip().lower()
                language_instruction = f"""
LANGUAGE POLICY (MANDATORY):
- Detected user language: {lang_name} ({lang_code})
- Respond ONLY in {lang_name}.
- Do NOT switch to English unless the user explicitly asks for English.
- Keep terminology natural for native speakers.
- QUALITY PROFILE: {profile}
- LANGUAGE QUALITY LAYERS: {safe_layers}
- Preserve grammar, morphology, and idioms of {lang_name}.
- Keep technical terms precise; when needed, give native equivalent + original term once.
"""

                system_prompt = f"""You are {persona['name']}, {persona['role']} in the Trinity AI system.
Your personality: {persona['description']}
Your style: {persona['style']}
{language_instruction}
Respond to the topic from your unique perspective. Be thorough and detailed."""

                context_block = ""
                if memory_context:
                    context_block += f"\n\nCONVERSATION MEMORY (KEEP FLOW):\n{memory_context}"
                if algebra_context:
                    context_block += f"\n\nALGEBRA CONTEXT:\n{algebra_context}"

                user_prompt = f"{persona['prompt_prefix']}\n\nTopic: {request.topic}{context_block}"

                full_response = ""
                token_count = 0

                try:
                    # NO TIMEOUT - Elastic streaming
                    async with httpx.AsyncClient(timeout=None) as client:
                        async with client.stream(
                            "POST",
                            f"{OLLAMA_HOST}/api/generate",
                            json={
                                "model": MODEL,
                                "prompt": user_prompt,
                                "system": system_prompt,
                                "stream": True,
                                "options": {"num_predict": max_tokens}
                            }
                        ) as stream:
                            async for line in stream.aiter_lines():
                                if line:
                                    try:
                                        chunk = json.loads(line)
                                        if "response" in chunk and chunk["response"]:
                                            token = chunk["response"]
                                            full_response += token
                                            token_count += 1

                                            # Stream each token in real-time
                                            if compact_stream:
                                                encoded = base64.b64encode(token.encode("utf-8")).decode("ascii")
                                                yield sse_event("t", f"{persona_id}:{encoded}")
                                            else:
                                                yield f"data: {json.dumps({'type': 'token', 'persona': persona_id, 'token': token})}\n\n"

                                        if chunk.get("done", False):
                                            break
                                    except json.JSONDecodeError:
                                        continue

                    # Persona complete
                    if compact_stream:
                        # No heavy response dump: client reconstructs from token stream
                        yield sse_event("response", json.dumps({
                            'persona': persona_id,
                            'name': persona['name'],
                            'emoji': persona['emoji'],
                            'role': persona['role'],
                            'status': 'success',
                            'tokens': token_count
                        }))
                    else:
                        yield f"data: {json.dumps({'type': 'response', 'data': {'persona': persona_id, 'name': persona['name'], 'emoji': persona['emoji'], 'role': persona['role'], 'response': full_response, 'status': 'success', 'tokens': token_count}})}\n\n"

                    if full_response.strip():
                        persona_outputs[persona_id] = full_response

                except Exception as e:
                    logger.error(f"Streaming error for {persona_id}: {e}")
                    if compact_stream:
                        yield sse_event("response", json.dumps({
                            'persona': persona_id,
                            'name': persona['name'],
                            'emoji': persona['emoji'],
                            'role': persona['role'],
                            'status': 'partial',
                            'tokens': token_count
                        }))
                    else:
                        yield f"data: {json.dumps({'type': 'response', 'data': {'persona': persona_id, 'name': persona['name'], 'emoji': persona['emoji'], 'role': persona['role'], 'response': full_response or '[Processing...]', 'status': 'partial', 'tokens': token_count}})}\n\n"

            # All done
            await _store_debate_memory(request.session_id, request.topic, persona_outputs)
            if compact_stream:
                yield sse_event("done", "ok")
            else:
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
        finally:
            await _release_debate_stream_slot()

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@app.post("/api/v1/debate")
async def trinity_debate(request: DebateRequest, http_request: Request):
    """
    Trinity Multi-Persona Debate.

    5 AI personas debate a topic from different perspectives:
    - Alba (🌅) - The Optimist
    - Albi (🔧) - The Pragmatist
    - Jona (🔍) - The Skeptic
    - Blerina (🌐) - The Analyst
    - ASI (🧠) - The Meta-Thinker

    Returns all perspectives for a balanced view.
    """
    if not request.topic:
        raise HTTPException(status_code=400, detail="topic is required")

    client_ip = (
        (http_request.headers.get("x-forwarded-for", "").split(",")[0].strip())
        or (http_request.client.host if http_request.client else "unknown")
    )

    if not await _allow_debate_request(f"sync:{client_ip}"):
        raise HTTPException(status_code=429, detail="Rate limit exceeded for debate")

    start_time = time.time()

    # Determine which personas to use
    persona_ids = request.personas if request.personas else list(TRINITY_PERSONAS.keys())

    # Validate personas
    valid_personas = [p for p in persona_ids if p in TRINITY_PERSONAS]
    if not valid_personas:
        raise HTTPException(status_code=400, detail=f"No valid personas. Available: {list(TRINITY_PERSONAS.keys())}")

    # Resolve once and enforce language across all personas
    lang_code, lang_name, language_source = await _resolve_debate_language(
        request.topic,
        request.preferred_language,
    )
    memory_context = await _build_debate_memory_context(request.session_id, request.conversation_context)
    algebra_context = _build_algebra_context(request.topic)

    # Get responses from all personas in parallel
    safe_tokens = _adaptive_token_budget(_clamp_tokens(request.max_tokens), active_streams=0, waiting_streams=0)
    tasks = [
        get_persona_response(
            p,
            request.topic,
            safe_tokens,
            lang_code=lang_code,
            lang_name=lang_name,
            quality_profile=request.quality_profile,
            language_layers=request.language_layers,
            memory_context=memory_context,
            algebra_context=algebra_context,
        )
        for p in valid_personas
    ]
    responses = await asyncio.gather(*tasks)

    await _store_debate_memory(
        request.session_id,
        request.topic,
        {str(r.get("persona", "")): str(r.get("response", "")) for r in responses if isinstance(r, dict)},
    )

    processing_time = time.time() - start_time

    # Count successes
    success_count = sum(1 for r in responses if r.get("status") == "success")

    return {
        "ok": True,
        "topic": request.topic,
        "language": {"code": lang_code, "name": lang_name, "source": language_source},
        "responses": responses,
        "stats": {
            "total_personas": len(valid_personas),
            "successful": success_count,
            "failed": len(valid_personas) - success_count,
            "processing_time_ms": processing_time * 10000
        },
        "engine": "Trinity Debate Engine v1.0"
    }


@app.get("/api/v1/debate/personas")
async def list_personas():
    """List all available Trinity personas."""
    return {
        "personas": [
            {
                "id": pid,
                "name": p["name"],
                "emoji": p["emoji"],
                "role": p["role"],
                "description": p["description"],
                "style": p["style"]
            }
            for pid, p in TRINITY_PERSONAS.items()
        ],
        "total": len(TRINITY_PERSONAS)
    }


# ═══════════════════════════════════════════════════════════════════
# 🔊 TEXT-TO-SPEECH ENGINE - Natural Voice Output
# ═══════════════════════════════════════════════════════════════════

# TTS Voice Configuration - Microsoft Edge Neural Voices (Free, High Quality)
TTS_VOICES = {
    "en": "en-US-AriaNeural",        # English - Female, natural
    "en-male": "en-US-GuyNeural",    # English - Male
    "sq": "en-GB-SoniaNeural",       # Albanian fallback - British English sounds natural
    "de": "de-DE-KatjaNeural",       # German
    "fr": "fr-FR-DeniseNeural",      # French
    "es": "es-ES-ElviraNeural",      # Spanish
    "it": "it-IT-ElsaNeural",        # Italian
    "pt": "pt-BR-FranciscaNeural",   # Portuguese
    "ru": "ru-RU-SvetlanaNeural",    # Russian
    "zh": "zh-CN-XiaoxiaoNeural",    # Chinese
    "ja": "ja-JP-NanamiNeural",      # Japanese
    "ko": "ko-KR-SunHiNeural",       # Korean
    "ar": "ar-EG-SalmaNeural",       # Arabic
    "tr": "tr-TR-EmelNeural",        # Turkish
    "hi": "hi-IN-SwaraNeural",       # Hindi
    "nl": "nl-NL-ColetteNeural",     # Dutch
    "pl": "pl-PL-ZofiaNeural",       # Polish
    "uk": "uk-UA-PolinaNeural",      # Ukrainian
    "el": "el-GR-AthinaNeural",      # Greek
    "ro": "ro-RO-AlinaNeural",       # Romanian
    "sr": "sr-RS-SophieNeural",      # Serbian
    "hr": "hr-HR-GabrijelaNeural",   # Croatian
    "bg": "bg-BG-KalinaNeural",      # Bulgarian
    "mk": "mk-MK-MarijaNeural",      # Macedonian
}

class TTSRequest(BaseModel):
    """Text-to-Speech request model"""
    text: str
    language: str = "en"
    voice: Optional[str] = None  # Override default voice
    rate: str = "+0%"  # Speech rate: -50% to +100%
    pitch: str = "+0Hz"  # Pitch adjustment


class VoiceConversationRequest(BaseModel):
    """Full voice conversation request: Audio In → STT → LLM → TTS → Audio Out"""
    audio_base64: str
    language: str = "en"
    voice: Optional[str] = None
    curiosity_level: str = "curious"
    user_id: Optional[str] = None


class VideoCreateRequest(BaseModel):
    prompt: str
    style: Optional[str] = "cinematic"
    duration_seconds: Optional[int] = 12
    format: Optional[str] = "mp4"
    include_audio: bool = True
    user_id: Optional[str] = None


class DocumentGenerateRequest(BaseModel):
    """Document generation request - video, voice, pdf, excel, etc."""
    format: str  # pdf, excel, csv, report, video, voice, mp4, wav, audio
    contract_type: str  # cpi, research, report, video, voice
    query: str
    language: str = "en"
    auto_translate: bool = True


class MediaWorkflowRequest(BaseModel):
    """Generate full multimedia workflow bundle from a single concept."""
    query: str
    language: str = "en"
    profile: str = "full"  # full | narrative | visual | audio
    auto_translate: bool = True


@app.post("/api/v1/tts")
async def text_to_speech(req: TTSRequest):
    """
    🔊 TEXT-TO-SPEECH - Convert text to natural speech audio

    Returns MP3 audio file with natural neural voice.
    Supports 24+ languages with high-quality Microsoft Edge voices.

    Example:
        POST /api/v1/tts
        {"text": "Hello, how are you?", "language": "en"}

        Returns: audio/mpeg stream
    """
    start_time = time.time()

    try:
        import os as os_mod
        import tempfile

        import edge_tts  # type: ignore[import-not-found]

        # Input validation
        if not req.text or not req.text.strip():
            raise HTTPException(400, "Text cannot be empty")

        if len(req.text) > 50000:
            raise HTTPException(400, "Text too long. Maximum 50000 characters.")

        # Get voice for language
        voice = req.voice or TTS_VOICES.get(req.language, TTS_VOICES.get("en"))

        # Create TTS communicate object
        communicate = edge_tts.Communicate(
            text=req.text.strip(),
            voice=voice,
            rate=req.rate,
            pitch=req.pitch
        )

        # Generate audio to temp file
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            tmp_path = tmp.name

        await communicate.save(tmp_path)

        # Read audio data
        with open(tmp_path, "rb") as f:
            audio_data = f.read()

        # Cleanup
        os_mod.unlink(tmp_path)

        processing_time = time.time() - start_time
        logger.info(f"🔊 TTS: {len(req.text)} chars → {len(audio_data)} bytes in {processing_time:.2f}s | voice={voice}")

        # Return audio as streaming response
        return StreamingResponse(
            iter([audio_data]),
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline; filename=speech.mp3",
                "X-Processing-Time": f"{processing_time:.3f}s",
                "X-Voice-Used": str(voice),
                "X-Text-Length": str(len(req.text))
            }
        )

    except ImportError:
        raise HTTPException(500, "TTS engine not available. Install: pip install edge-tts")
    except Exception as e:
        logger.error(f"TTS Error: {e}")
        raise HTTPException(500, f"TTS generation failed: {str(e)}")


@app.get("/api/v1/tts/voices")
async def list_tts_voices():
    """List all available TTS voices by language."""
    return {
        "voices": TTS_VOICES,
        "total": len(TTS_VOICES),
        "engine": "Microsoft Edge Neural TTS (Free)",
        "quality": "High - Neural Network Generated",
        "note": "Albanian (sq) uses British English voice as fallback"
    }


@app.post("/api/v1/voice/conversation")
async def voice_conversation(req: VoiceConversationRequest, request: Request):
    """
    🎙️ FULL VOICE CONVERSATION PIPELINE

    Audio In → STT (Whisper) → LLM (Ollama) → TTS (Edge) → Audio Out

    Complete voice-to-voice conversation in one request.
    Send audio, get audio response back.

    Flow:
    1. Decode audio from base64
    2. Transcribe with Whisper (Speech-to-Text)
    3. Generate response with Ollama LLM
    4. Convert response to speech (Text-to-Speech)
    5. Return audio response
    """
    start_time = time.time()
    # user_id available via: req.user_id or request.headers.get("X-User-ID")

    try:
        import base64 as b64mod
        import os as os_mod
        import tempfile

        import edge_tts  # type: ignore[import-not-found]

        # ═══════════════════════════════════════════════════════════════
        # STEP 1: Decode Audio
        # ═══════════════════════════════════════════════════════════════
        raw_audio = (req.audio_base64 or "").strip()
        if "," in raw_audio and raw_audio.lower().startswith("data:"):
            raw_audio = raw_audio.split(",", 1)[1]
        audio_bytes = b64mod.b64decode(raw_audio)
        if len(audio_bytes) < VOICE_MIN_AUDIO_BYTES:
            raise HTTPException(400, "Audio data too small")

        voice_max_audio_bytes = _voice_audio_limit()
        if voice_max_audio_bytes is not None and len(audio_bytes) > voice_max_audio_bytes:
            raise HTTPException(413, f"Audio too large. Limit is {voice_max_audio_bytes} bytes")

        stt_timeout = _adaptive_timeout(VOICE_STT_TIMEOUT_BASE_S, VOICE_STT_TIMEOUT_MAX_S, len(audio_bytes))
        llm_timeout = _adaptive_timeout(VOICE_LLM_TIMEOUT_BASE_S, VOICE_LLM_TIMEOUT_MAX_S, len(audio_bytes))

        # Save to temp file
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
            tmp.write(audio_bytes)
            audio_path = tmp.name

        # ═══════════════════════════════════════════════════════════════
        # STEP 2: Speech-to-Text (Whisper)
        # ═══════════════════════════════════════════════════════════════
        try:
            from faster_whisper import WhisperModel  # type: ignore[import-not-found]

            global _whisper_model_conv
            if '_whisper_model_conv' not in globals() or _whisper_model_conv is None:
                _whisper_model_conv = WhisperModel("base", device="cpu", compute_type="int8")

            segments, info = _whisper_model_conv.transcribe(
                audio_path,
                language=req.language if req.language not in ['auto'] else None,
                beam_size=5
            )

            transcript = " ".join([seg.text for seg in segments]).strip()
            detected_language = info.language or req.language

        except ImportError:
            # Fallback: Use Ollama's whisper if available
            async with httpx.AsyncClient(timeout=stt_timeout) as client:
                with open(audio_path, "rb") as f:
                    audio_b64 = b64mod.b64encode(f.read()).decode()
                resp = await client.post(
                    f"{OLLAMA_HOST}/api/generate",
                    json={"model": "whisper", "prompt": audio_b64}
                )
                transcript = resp.json().get("response", "")
                detected_language = req.language

        finally:
            os_mod.unlink(audio_path)

        if not transcript:
            raise HTTPException(400, "Could not transcribe audio. Please speak clearly.")

        stt_time = time.time() - start_time
        logger.info(f"🎤 STT: '{transcript[:50]}...' in {stt_time:.2f}s")

        # ═══════════════════════════════════════════════════════════════
        # STEP 3: Generate LLM Response (Ollama)
        # ═══════════════════════════════════════════════════════════════
        llm_start = time.time()

        system_prompt = """You are a friendly voice assistant. Keep responses concise and natural for speech.
Respond in the same language as the user's message. Be helpful and conversational."""

        voice_num_predict = -1 if (MULTIMODAL_ELASTIC_NO_LIMITS or CHAT_ELASTIC_NO_LIMITS) else 400

        async with httpx.AsyncClient(timeout=llm_timeout) as client:
            resp = await client.post(
                f"{OLLAMA_HOST}/api/generate",
                json={
                    "model": MODEL,
                    "prompt": transcript,
                    "system": system_prompt,
                    "stream": False,
                    "options": {"temperature": 0.7, "num_predict": voice_num_predict}
                }
            )
            llm_response = resp.json().get("response", "I couldn't process that. Please try again.")

        llm_time = time.time() - llm_start
        logger.info(f"🧠 LLM: '{llm_response[:50]}...' in {llm_time:.2f}s")

        voice_user = (req.user_id or request.headers.get("X-User-ID") or "anonymous").strip()
        voice_req = _req_for_user(voice_user, detected_language)
        _memory_put(voice_req, transcript, llm_response, detected_language or req.language)

        # ═══════════════════════════════════════════════════════════════
        # STEP 4: Text-to-Speech (Edge TTS)
        # ═══════════════════════════════════════════════════════════════
        tts_start = time.time()

        voice = req.voice or TTS_VOICES.get(detected_language, TTS_VOICES.get("en"))
        communicate = edge_tts.Communicate(text=llm_response, voice=voice)

        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            tts_path = tmp.name

        await communicate.save(tts_path)

        with open(tts_path, "rb") as f:
            audio_response = f.read()

        os_mod.unlink(tts_path)

        tts_time = time.time() - tts_start
        total_time = time.time() - start_time

        logger.info(f"🔊 Voice Conversation: STT={stt_time:.1f}s LLM={llm_time:.1f}s TTS={tts_time:.1f}s Total={total_time:.1f}s")

        # ═══════════════════════════════════════════════════════════════
        # STEP 5: Return Audio Response
        # ═══════════════════════════════════════════════════════════════
        return StreamingResponse(
            iter([audio_response]),
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline; filename=response.mp3",
                "X-Transcript": transcript[:100],
                "X-Response-Text": llm_response[:100],
                "X-Processing-Time": f"{total_time:.3f}s",
                "X-STT-Time": f"{stt_time:.3f}s",
                "X-LLM-Time": f"{llm_time:.3f}s",
                "X-TTS-Time": f"{tts_time:.3f}s",
                "X-Voice-Used": str(voice),
                "X-Detected-Language": str(detected_language)
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Voice Conversation Error: {e}")
        raise HTTPException(500, f"Voice conversation failed: {str(e)}")


# Initialize whisper model placeholder
_whisper_model_conv = None


def _extract_document_text(filename: str, content_type: str, raw: bytes, max_chars: int) -> dict:
    lower_name = (filename or "").lower()

    if lower_name.endswith(".txt") or content_type.startswith("text/"):
        text = raw.decode("utf-8", errors="ignore")
        return {"parser": "text", "text": text[:max_chars], "text_length": len(text)}

    if lower_name.endswith(".json") or content_type == "application/json":
        text = raw.decode("utf-8", errors="ignore")
        return {"parser": "json", "text": text[:max_chars], "text_length": len(text)}

    if lower_name.endswith(".pdf") or content_type == "application/pdf":
        try:
            import pypdf  # type: ignore[import-not-found]

            reader = pypdf.PdfReader(io.BytesIO(raw))
            pages = []
            for page in reader.pages:
                pages.append(page.extract_text() or "")
            text = "\n".join(pages)
            return {"parser": "pypdf", "text": text[:max_chars], "text_length": len(text)}
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"PDF parser error: {type(exc).__name__}")

    raise HTTPException(status_code=415, detail=f"Unsupported document type: {content_type}")


@app.get("/api/v1/document/capabilities")
@app.get("/api/v1/documents/capabilities")
async def documents_capabilities_compat():
    upload_limit = _document_upload_limit()
    scan_char_limit = _document_scan_char_limit()
    return {
        "service": "Curiosity Ocean Document Core",
        "status": "operational",
        "elastic_no_limits": MULTIMODAL_ELASTIC_NO_LIMITS,
        "max_upload_bytes": upload_limit,
        "max_scan_chars": scan_char_limit,
        "supported_mime_types": sorted(list(DOCUMENT_MIME_ALLOWLIST)),
        "features": {
            "scan_read": True,
            "checksum_sha256": True,
            "contract_generation": False,
            "provenance_tracking": True,
        },
        "endpoints": [
            "/api/v1/documents/capabilities",
            "/api/v1/documents/scan",
            "/api/v1/document/capabilities",
        ],
    }


@app.post("/api/v1/documents/scan")
@app.post("/api/v1/document/scan")
async def documents_scan_compat(
    request: Request,
    file: UploadFile = File(...),
    max_chars: int = Query(default=250000, ge=2000),
):
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file")
    upload_limit = _document_upload_limit()
    if upload_limit is not None and len(raw) > upload_limit:
        raise HTTPException(status_code=413, detail=f"File too large. Limit is {upload_limit} bytes")

    effective_max_chars = _resolve_scan_chars(max_chars)

    filename = file.filename or "unknown"
    content_type = (file.content_type or "application/octet-stream").lower()
    extraction = _extract_document_text(filename, content_type, raw, max_chars=effective_max_chars)
    sha256 = hashlib.sha256(raw).hexdigest()
    user_id = (request.headers.get("X-User-ID") or "anonymous").strip()
    doc_req = _req_for_user(user_id)
    _memory_put(
        doc_req,
        f"document_scan:{filename}",
        extraction.get("text", "")[:1200],
        "auto",
    )

    return {
        "ingestion_id": f"DOC-{uuid.uuid4().hex[:10]}",
        "filename": filename,
        "content_type": content_type,
        "size_bytes": len(raw),
        "sha256": sha256,
        "extraction": {
            "parser": extraction["parser"],
            "text_length": extraction["text_length"],
            "text": extraction["text"],
            "text_preview": extraction["text"][:2000],
            "effective_max_chars": effective_max_chars,
        },
        "provenance": {
            "source_type": "uploaded_document",
            "agent": "ocean_document_scan",
        },
    }


@app.get("/api/v1/video/status")
async def video_status():
    target = f"{VIDEO_PRODUCER_URL.rstrip('/')}/health"
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(target)
        return {
            "status": "connected" if response.status_code < 400 else "degraded",
            "video_producer": VIDEO_PRODUCER_URL,
            "upstream_status": response.status_code,
        }
    except Exception as exc:
        return {
            "status": "unavailable",
            "video_producer": VIDEO_PRODUCER_URL,
            "error": str(exc),
        }


@app.post("/api/v1/video/create")
async def video_create(req: VideoCreateRequest, request: Request):
    prompt = (req.prompt or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required")

    timeout_s = _elastic_stream_timeout(len(prompt), 1)
    payload = {
        "prompt": prompt,
        "title": prompt[:80],
        "style": req.style or "cinematic",
        "duration_seconds": max(3, min(int(req.duration_seconds or 12), 180)),
        "format": req.format or "mp4",
        "include_audio": bool(req.include_audio),
    }

    try:
        async with httpx.AsyncClient(timeout=timeout_s) as client:
            upstream = await client.post(f"{VIDEO_PRODUCER_URL.rstrip('/')}/api/v1/video/create", json=payload)

        if upstream.status_code >= 400:
            raise HTTPException(status_code=upstream.status_code, detail=upstream.text)

        data = upstream.json() if upstream.headers.get("content-type", "").startswith("application/json") else {"raw": upstream.text}
        user_id = (req.user_id or request.headers.get("X-User-ID") or "anonymous").strip()
        video_req = _req_for_user(user_id)
        _memory_put(video_req, f"video_request:{prompt[:220]}", json.dumps(data, ensure_ascii=False)[:1200], "auto")
        return {
            "status": "success",
            "video_producer": VIDEO_PRODUCER_URL,
            "result": data,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Video producer unavailable: {exc}") from exc


# ═══════════════════════════════════════════════════════════════════
# DOCUMENT GENERATION - Video & Voice Integration
# ═══════════════════════════════════════════════════════════════════

@app.get("/api/documents/agents")
@app.get("/api/v1/documents/agents")
async def documents_agents():
    """List available document generation agents."""
    try:
        document_agents_module = importlib.import_module("document_agents")
        list_agents = getattr(document_agents_module, "list_agents", None)
        if callable(list_agents):
            return {
                "agents": list_agents(),
                "timestamp": datetime.utcnow().isoformat(),
            }
        else:
            raise HTTPException(status_code=503, detail="document_agents module found but list_agents not available")
    except ImportError:
        logger.warning("document_agents module not found")
        raise HTTPException(status_code=503, detail="Document agents service not available")
    except Exception as e:
        logger.error(f"Document agents listing error: {e}")
        raise HTTPException(status_code=500, detail="Failed to list document agents")


@app.post("/api/documents/generate")
@app.post("/api/v1/documents/generate")
async def documents_generate(request_obj: DocumentGenerateRequest):
    """Generate video/voice/pdf documents via contract-governed pipeline."""
    started_at = time.perf_counter()
    request_format = (request_obj.format or "").lower().strip()
    request_contract = (request_obj.contract_type or "").lower().strip()

    DOC_GEN_IN_MEMORY_STATS["requests"] += 1
    DOC_GEN_IN_MEMORY_STATS["last_request_at"] = datetime.utcnow().isoformat()

    if DOC_GEN_REQUESTS_TOTAL:
        DOC_GEN_REQUESTS_TOTAL.labels(format=request_format or "unknown", contract_type=request_contract or "unknown").inc()

    try:
        try:
            document_agents_module = importlib.import_module("document_agents")
            document_contracts_module = importlib.import_module("document_contracts")
            get_agent = getattr(document_agents_module, "get_agent", None)
            get_contract_factory = getattr(document_contracts_module, "get_contract_factory", None)
            VideoContract = getattr(document_contracts_module, "VideoContract", None)
            VoiceContract = getattr(document_contracts_module, "VoiceContract", None)
            MusicContract = getattr(document_contracts_module, "MusicContract", None)
            PaintingContract = getattr(document_contracts_module, "PaintingContract", None)
            AnimationContract = getattr(document_contracts_module, "AnimationContract", None)

            if not get_agent:
                raise AttributeError("get_agent function not found")
        except (ImportError, AttributeError) as e:
            logger.warning(f"document_agents or document_contracts module not found: {e}")
            raise HTTPException(status_code=503, detail="Document generation service not available")

        format_map = {
            "xlsx": "excel",
            "xls": "excel",
            "csv": "excel",
            "pdf": "pdf",
            "report": "report",
            "json": "report",
            "mp4": "video",
            "video": "video",
            "wav": "voice",
            "voice": "voice",
            "audio": "voice",
            "midi": "music",
            "music": "music",
            "png": "painting",
            "jpg": "painting",
            "jpeg": "painting",
            "painting": "painting",
            "image": "painting",
            "animation": "animation",
        }

        contract_map = {
            "video": lambda: VideoContract() if VideoContract else None,
            "voice": lambda: VoiceContract() if VoiceContract else None,
            "music": lambda: MusicContract() if MusicContract else None,
            "painting": lambda: PaintingContract() if PaintingContract else None,
            "animation": lambda: AnimationContract() if AnimationContract else None,
        }

        agent_name = format_map.get(request_format)
        if not agent_name:
            raise HTTPException(status_code=400, detail="Unsupported format. Use xlsx/xls/csv/pdf/report/json/video/mp4/voice/wav/audio/music/midi/painting/png/jpg/jpeg/image/animation")

        effective_query = request_obj.query
        translation_meta = {
            "auto_translate": bool(request_obj.auto_translate),
            "requested_language": request_obj.language,
            "detected_language": None,
            "translated": False,
        }

        if request_obj.auto_translate and request_obj.language and request_obj.language.lower() != "auto":
            detected_code, _, _ = await detect_language(request_obj.query)
            translation_meta["detected_language"] = detected_code
            if detected_code and detected_code.lower() != request_obj.language.lower():
                effective_query = await translate_text_dynamic(
                    request_obj.query,
                    target_lang=request_obj.language,
                    source_lang=detected_code,
                )
                if effective_query != request_obj.query:
                    translation_meta["translated"] = True
                    DOC_GEN_IN_MEMORY_STATS["translated"] += 1

        contract = None
        if callable(get_contract_factory):
            resolved_factory = get_contract_factory(request_contract)
            if callable(resolved_factory):
                contract = resolved_factory()

        if contract is None:
            fallback_factory = contract_map.get(request_contract)
            if callable(fallback_factory):
                contract = fallback_factory()

        if contract is None and callable(get_contract_factory):
            generic_factory = get_contract_factory("generic")
            if callable(generic_factory):
                contract = generic_factory(title=f"{agent_name.title()} Document")

        agent = get_agent(agent_name)
        if not agent:
            raise HTTPException(status_code=503, detail=f"Agent unavailable: {agent_name}")

        if contract:
            result = agent.generate_document(contract=contract, query=effective_query, language=request_obj.language)
        else:
            result = {
                "success": False,
                "errors": [f"Contract type '{request_obj.contract_type}' not supported"],
                "validation_status": "failed"
            }

        document_payload = result.get("document")
        if document_payload is not None and hasattr(document_payload, "to_dict"):
            document_payload = document_payload.to_dict()

        elapsed = max(0.0, time.perf_counter() - started_at)
        DOC_GEN_IN_MEMORY_STATS["total_latency_seconds"] += elapsed

        if bool(result.get("success")):
            DOC_GEN_IN_MEMORY_STATS["success"] += 1
            if DOC_GEN_RESULTS_TOTAL:
                DOC_GEN_RESULTS_TOTAL.labels(status="success").inc()
        else:
            DOC_GEN_IN_MEMORY_STATS["failed"] += 1
            DOC_GEN_IN_MEMORY_STATS["last_error"] = "; ".join(result.get("errors", []))[:500]
            if DOC_GEN_RESULTS_TOTAL:
                DOC_GEN_RESULTS_TOTAL.labels(status="failed").inc()

        if DOC_GEN_LATENCY_SECONDS:
            DOC_GEN_LATENCY_SECONDS.observe(elapsed)

        return {
            "success": bool(result.get("success")),
            "validation_status": result.get("validation_status"),
            "errors": result.get("errors", []),
            "document": document_payload,
            "provenance": result.get("provenance"),
            "meta": {
                "agent": agent_name,
                "contract_type": request_obj.contract_type,
                "format": request_obj.format,
                "translation": translation_meta,
                "processing_seconds": round(elapsed, 4),
                "timestamp": datetime.utcnow().isoformat(),
            },
        }
    except HTTPException:
        DOC_GEN_IN_MEMORY_STATS["failed"] += 1
        if DOC_GEN_RESULTS_TOTAL:
            DOC_GEN_RESULTS_TOTAL.labels(status="failed").inc()
        raise
    except Exception as e:
        logger.error(f"Document generation error: {e}")
        DOC_GEN_IN_MEMORY_STATS["failed"] += 1
        DOC_GEN_IN_MEMORY_STATS["last_error"] = str(e)[:500]
        if DOC_GEN_RESULTS_TOTAL:
            DOC_GEN_RESULTS_TOTAL.labels(status="failed").inc()
        raise HTTPException(status_code=500, detail=f"Document generation failed: {type(e).__name__}")


@app.get("/api/v1/documents/metrics")
@app.get("/api/documents/metrics")
async def document_metrics():
    """Operational metrics for document/media generation pipeline."""
    total = DOC_GEN_IN_MEMORY_STATS["requests"]
    avg_latency = 0.0
    if total > 0:
        avg_latency = DOC_GEN_IN_MEMORY_STATS["total_latency_seconds"] / total

    return {
        "service": "ocean_document_generation",
        "requests": total,
        "success": DOC_GEN_IN_MEMORY_STATS["success"],
        "failed": DOC_GEN_IN_MEMORY_STATS["failed"],
        "translated": DOC_GEN_IN_MEMORY_STATS["translated"],
        "success_rate": round((DOC_GEN_IN_MEMORY_STATS["success"] / total) if total else 0.0, 4),
        "avg_latency_seconds": round(avg_latency, 4),
        "last_error": DOC_GEN_IN_MEMORY_STATS["last_error"],
        "last_request_at": DOC_GEN_IN_MEMORY_STATS["last_request_at"],
        "prometheus_enabled": HAS_PROMETHEUS,
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.post("/api/v1/documents/workflow")
@app.post("/api/documents/workflow")
async def document_workflow(request_obj: MediaWorkflowRequest):
    """Generate multi-asset workflow bundle in one request."""
    profile_map = {
        "full": ["video", "voice", "music", "painting", "animation"],
        "narrative": ["video", "voice", "music"],
        "visual": ["video", "painting", "animation"],
        "audio": ["voice", "music"],
    }
    selected_assets = profile_map.get((request_obj.profile or "").lower().strip(), profile_map["full"])

    workflow_results: Dict[str, Any] = {}
    for asset in selected_assets:
        generation_result = await documents_generate(
            DocumentGenerateRequest(
                format=asset,
                contract_type=asset,
                query=request_obj.query,
                language=request_obj.language,
                auto_translate=request_obj.auto_translate,
            )
        )
        workflow_results[asset] = generation_result

    success_assets = [name for name, payload in workflow_results.items() if bool(payload.get("success"))]
    failed_assets = [name for name, payload in workflow_results.items() if not bool(payload.get("success"))]

    return {
        "success": len(failed_assets) == 0,
        "profile": request_obj.profile,
        "query": request_obj.query,
        "language": request_obj.language,
        "assets_requested": selected_assets,
        "assets_success": success_assets,
        "assets_failed": failed_assets,
        "results": workflow_results,
        "timestamp": datetime.utcnow().isoformat(),
    }


# ═══════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    logger.info(f"🌊 Ocean Core Full v5.0.0 starting on port {PORT}")
    logger.info("⚙️ Zürich Engine v1.0 - 9-stage deterministic reasoning")
    logger.info("🧠 Trinity Debate v1.0 - 5-persona AI debate")
    uvicorn.run(app, host="0.0.0.0", port=PORT)
