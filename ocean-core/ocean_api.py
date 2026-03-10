"""
OCEAN CORE 8030 API
===================
Standalone FastAPI application - completely isolated from main.py

Port: 8030
Features:
- Query endpoint (natural language → intelligent response)
- Data sources status
- Knowledge exploration
- Curiosity threads
"""

import asyncio
import hashlib
import importlib
import io
import json
import logging
import os
import time
from datetime import datetime
from typing import Any
from uuid import uuid4

import httpx
from fastapi import FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from pydantic import BaseModel

# Binary protocol support (CBOR2, MessagePack)
try:
    cbor2 = importlib.import_module("cbor2")
    HAS_CBOR2 = True
except ImportError:
    HAS_CBOR2 = False

try:
    msgpack = importlib.import_module("msgpack")
    HAS_MSGPACK = True
except ImportError:
    HAS_MSGPACK = False

# Local imports - NANOGRID: Minimal
# DISABLED: from query_processor import get_query_processor, QueryIntent
# DISABLED: from knowledge_engine import get_knowledge_engine, KnowledgeResponse
# DISABLED: from persona_router import PersonaRouter
# DISABLED: from laboratories import get_laboratory_network
# DISABLED: from real_data_engine import get_real_data_engine
# DISABLED: from specialized_chat_engine import get_specialized_chat, initialize_specialized_chat
# ORCHESTRATOR - Ollama only
from laboratories import get_laboratory_network
from response_orchestrator_v5 import get_orchestrator_v5

_data_sources_module = importlib.import_module("data_sources")


def get_all_sources() -> Any:
    factory = getattr(_data_sources_module, "get_internal_data_sources", None)
    if callable(factory):
        return factory()

    cls = getattr(_data_sources_module, "InternalDataSources", None)
    if cls is None:
        raise RuntimeError("data_sources module missing InternalDataSources")
    return cls()

# DISABLED: from autolearning_engine import get_autolearning_engine, AutolearningEngine
# DISABLED: Curiosity Algebra - creates loops
# from curiosity_algebra.api import router as curiosity_router


async def get_knowledge_engine_hybrid(data_sources):
    """Create hybrid knowledge engine that only uses internal data"""
    # For now, use the standard knowledge engine but we'll filter external APIs
    # This is a wrapper that ensures no external data is used
    try:
        from knowledge_engine import KnowledgeEngine
        
        if data_sources is None:
            logger.error("❌ Cannot initialize knowledge engine: data_sources is None!")
            return None
        
        logger.info("🧠 Initializing KnowledgeEngine with internal data sources...")
        ke = KnowledgeEngine(data_sources, None)  # No external_apis_manager
        
        if ke is None:
            logger.error("❌ KnowledgeEngine() returned None!")
            return None
        
        logger.info("⏳ Initializing knowledge engine...")
        await ke.initialize()
        logger.info("✅ Knowledge engine initialized successfully!")
        return ke
    except Exception as e:
        logger.error(f"❌ Error initializing hybrid knowledge engine: {type(e).__name__}: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return None

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("ocean_api")

# API Version prefix - SECURITY REQUIREMENT
API_VERSION = "v1"
API_PREFIX = f"/api/{API_VERSION}"
EXCEL_SERVICE_URL = os.getenv("EXCEL_SERVICE_URL", "http://localhost:8002")
DOCUMENT_MAX_BYTES = int(os.getenv("DOCUMENT_MAX_BYTES", str(25 * 1024 * 1024)))

DOCUMENT_MIME_ALLOWLIST = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/json",
    "text/plain",
    "text/csv",
    "text/markdown",
}

# Initialize FastAPI app
app = FastAPI(
    title="Curiosity Ocean",
    description="Universal Knowledge Aggregation Engine with 14 Expert Personas - Internal Data Only",
    version="4.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# DISABLED: Curiosity Algebra - creates loops
# app.include_router(curiosity_router)
# logger.info("✅ Curiosity Algebra System integrated - /api/curiosity endpoints active")

# Global instances - NANOGRID: Minimal
internal_data_sources: Any = None
persona_router: Any = None
query_processor: Any = None
knowledge_engine: Any = None
laboratory_network: Any = None
real_data_engine: Any = None
specialized_chat: Any = None
orchestrator: Any = None
autolearning_engine: Any = None  # New: Autolearning Engine


SYSTEM_ANATOMY = {
    "layers_layout_governance": {
        "label": "Layers • Layout • Governance",
        "activation_query": "layers layout governance mapping alignment policy",
        "description": "Semantic layers, routing layout, governance and alignment policies.",
    },
    "powernance_provenance": {
        "label": "Powernance • Provenance",
        "activation_query": "provenance powernance trace trust",
        "description": "Data trust, provenance lineage, activation traceability.",
    },
    "excel_core": {
        "label": "Excel Core",
        "activation_query": "excel spreadsheet csv data table process",
        "description": "Excel/data-table processing and analytics pathways.",
    },
    "openmind_core": {
        "label": "OpenMind Core",
        "activation_query": "openmind reasoning think orchestrator",
        "description": "OpenMind reasoning bridge and orchestration context.",
    },
    "agents_laboratories": {
        "label": "Agents • Laboratories",
        "activation_query": "agents laboratories specialized roles",
        "description": "Agent systems and laboratory capabilities.",
    },
    "pulse_publish_pillar": {
        "label": "Pulse • Publish • Pillar",
        "activation_query": "pulse publish pillar telemetry stream",
        "description": "Signal pulse, publish flows and core pillars.",
    },
    "asi_saas": {
        "label": "ASI SaaS",
        "activation_query": "asi saas superintelligence service mesh",
        "description": "ASI service domain and SaaS orchestration touchpoints.",
    },
    "internal_apis": {
        "label": "Internal APIs",
        "activation_query": "internal api service routing endpoint",
        "description": "Internal service APIs and cross-service routing.",
    },
    "open_data_sources": {
        "label": "Open Links • Free Data Sources",
        "activation_query": "open data sources free api public datasets",
        "description": "Open/public data sources and discovery graph.",
    },
    "i18n_translate_mapping": {
        "label": "i18n • Translate • Mapping",
        "activation_query": "i18n translate multilingual mapping",
        "description": "Translation and multilingual mapping pathways.",
    },
}


class AnatomyActivateRequest(BaseModel):
    targets: list[str] | None = None
    include_overview: bool = True


class DocumentGenerateRequest(BaseModel):
    query: str
    format: str = "xlsx"
    contract_type: str = "cpi"
    language: str = "en"


def _extract_text_from_document(filename: str, content_type: str, data: bytes, max_chars: int = 200_000) -> dict[str, Any]:
    """Industrial multi-format text extraction with parser fallback chain."""
    lower_name = filename.lower()
    extracted_text = ""
    parser_used = "none"
    pages_or_rows = 0

    try:
        if lower_name.endswith((".txt", ".md", ".csv")) or content_type in {"text/plain", "text/markdown", "text/csv"}:
            extracted_text = data.decode("utf-8", errors="ignore")
            parser_used = "utf8_text"
            pages_or_rows = extracted_text.count("\n") + 1 if extracted_text else 0
        elif lower_name.endswith(".json") or content_type == "application/json":
            parsed = json.loads(data.decode("utf-8", errors="ignore"))
            extracted_text = json.dumps(parsed, ensure_ascii=False, indent=2)
            parser_used = "json"
            pages_or_rows = 1
        elif lower_name.endswith(".pdf") or content_type == "application/pdf":
            pypdf = None
            for mod_name in ("pypdf", "PyPDF2"):
                try:
                    pypdf = importlib.import_module(mod_name)
                    break
                except Exception:
                    continue

            if pypdf:
                stream = io.BytesIO(data)
                reader = pypdf.PdfReader(stream)
                pages_or_rows = len(reader.pages)
                texts: list[str] = []
                for page in reader.pages[:50]:
                    texts.append((page.extract_text() or "").strip())
                extracted_text = "\n\n".join(t for t in texts if t)
                parser_used = "pypdf"
            else:
                parser_used = "pdf_parser_unavailable"
        elif lower_name.endswith(".docx") or content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            try:
                docx = importlib.import_module("docx")
                doc = docx.Document(io.BytesIO(data))
                paragraphs = [p.text for p in doc.paragraphs if p.text and p.text.strip()]
                extracted_text = "\n".join(paragraphs)
                parser_used = "python-docx"
                pages_or_rows = len(paragraphs)
            except Exception:
                parser_used = "docx_parser_unavailable"
        elif lower_name.endswith((".xlsx", ".xls")) or content_type in {
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
        }:
            try:
                openpyxl = importlib.import_module("openpyxl")
                wb = openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=True)
                fragments: list[str] = []
                row_counter = 0
                for ws in wb.worksheets[:5]:
                    fragments.append(f"# Sheet: {ws.title}")
                    for row in ws.iter_rows(min_row=1, max_row=200, values_only=True):
                        values = [str(v).strip() for v in row if v is not None and str(v).strip()]
                        if values:
                            fragments.append(" | ".join(values))
                            row_counter += 1
                extracted_text = "\n".join(fragments)
                parser_used = "openpyxl"
                pages_or_rows = row_counter
            except Exception:
                parser_used = "xlsx_parser_unavailable"
        else:
            parser_used = "unsupported_format"
    except Exception as ex:
        parser_used = f"parser_error:{type(ex).__name__}"
        extracted_text = ""

    extracted_text = (extracted_text or "")[:max_chars]
    return {
        "text": extracted_text,
        "parser": parser_used,
        "units": pages_or_rows,
        "text_length": len(extracted_text),
    }


@app.on_event("startup")
async def startup_event():
    """Initialize all managers on startup"""
    global internal_data_sources, persona_router, query_processor, knowledge_engine, laboratory_network, real_data_engine, specialized_chat, orchestrator, autolearning_engine
    
    logger.info("[OCEAN] Ocean Core 8030 starting up with 14 personas...")
    
    try:
        # Initialize all managers in parallel
        logger.info("→ Initializing internal data sources...")
        internal_data_sources = get_all_sources()
        
        if internal_data_sources is None:
            logger.error("❌ CRITICAL: get_all_sources() returned None!")
            raise RuntimeError("Failed to initialize data sources")
        
        logger.info("[OK] Data sources initialized")
        
        # NANOGRID: Minimal initialization - only what's needed
        persona_router = None  # DISABLED
        query_processor = None  # DISABLED - Ollama handles queries
        laboratory_network = None  # DISABLED
        real_data_engine = None  # DISABLED
        knowledge_engine = None  # DISABLED
        autolearning_engine = None  # DISABLED
        
        # Initialize specialized chat if available
        try:
            from specialized_chat_engine import get_specialized_chat, initialize_specialized_chat
            logger.info("→ Initializing Specialized Chat Engine...")
            specialized_chat = get_specialized_chat()
            if specialized_chat:
                await initialize_specialized_chat()
                logger.info("✅ Specialized Chat Engine initialized")
            else:
                specialized_chat = None
                logger.info("⏭️  Specialized Chat Engine not available")
        except Exception as e:
            logger.warning(f"⚠️  Specialized Chat Engine initialization failed: {e}")
            specialized_chat = None
        
        # Initialize orchestrator v5 - ONLY OLLAMA
        logger.info("→ Initializing Orchestrator (Ollama only)...")
        orchestrator = get_orchestrator_v5()
        logger.info("🦙 [OK] Orchestrator ready - Ollama ONLY!")
        
        logger.info("✅ Ocean Core 8030 initialized - NANOGRID mode")
        logger.info("   - Ollama: ✅ Ready")
    except Exception as e:
        logger.error(f"❌ Ocean Core 8030 initialization failed: {type(e).__name__}: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise


@app.get("/api/info")
@app.get(f"{API_PREFIX}/info")
async def api_info():
    """API info endpoint"""
    internal_data = internal_data_sources.get_all_data() if internal_data_sources else {}
    
    return {
        "service": "Curiosity Ocean 8030",
        "version": "4.0.0",
        "status": "operational",
        "personas": len(persona_router.mapping) if persona_router else 0,
        "data_sources": len(internal_data) if internal_data else 0,
        "description": "Universal Knowledge Aggregation Engine with 14 Expert Personas",
        "features": [
            "14 specialist personas",
            "Internal data sources only",
            "Query routing via personas",
            "Knowledge exploration",
            "Curiosity threads"
        ],
        "endpoints": [
            "GET /api/personas - List all 14 specialists",
            "POST /api/query - Query with persona routing",
            "GET /api/v1/excel/status - Excel service status via Ocean",
            "GET /api/v1/excel/generate - Generate Excel via Ocean",
            "GET /api/status - Service status",
            "GET /api/labs - Location lab data",
            "GET /api/agents - Agent telemetry",
            "GET /health - Health check"
        ]
    }


@app.get("/favicon.ico")
async def favicon():
    """Serve favicon - Ocean blue icon"""
    # Return a simple 1x1 pixel transparent GIF to prevent 404
    import base64
    # Minimal valid ICO (1x1 blue pixel)
    favicon_bytes = base64.b64decode(
        "AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
        "AAD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP//"
        "/wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP//"
        "/wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP//"
        "/wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP//"
        "/wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP//"
        "/wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP//"
        "/wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP//"
        "/wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP//"
        "/wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP//"
        "/wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP//"
        "/wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP//"
        "/wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP//"
        "/wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP//"
        "/wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP//"
        "/wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AAAA"
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    )
    from fastapi.responses import Response
    return Response(content=favicon_bytes, media_type="image/x-icon")


@app.get("/")
async def root_chat_ui():
    """Serve the specialized chat interface at root"""
    import os
    file_path = os.path.join(os.path.dirname(__file__), "specialized_chat.html")
    if os.path.exists(file_path):
        return FileResponse(file_path, media_type="text/html")
    return {"error": "Chat UI not found", "tip": "Try /api/info for API info"}


@app.get("/chat")
async def chat_ui():
    """Serve the specialized chat interface"""
    import os
    file_path = os.path.join(os.path.dirname(__file__), "specialized_chat.html")
    if os.path.exists(file_path):
        return FileResponse(file_path, media_type="text/html")
    else:
        return {"error": "Chat UI not found"}


@app.get("/status")
@app.get(f"{API_PREFIX}/status")
async def get_status():
    """Get service status"""
    if not internal_data_sources:
        return {"status": "initializing"}
    
    try:
        internal_data = internal_data_sources.get_all_data()
        
        return {
            "service": "Curiosity Ocean 8030",
            "version": "4.0.0",
            "status": "operational",
            "initialized": True,
            "personas": len(persona_router.mapping),
            "knowledge_engine": "operational" if knowledge_engine else "degraded",
            "timestamp": datetime.now().isoformat(),
            "data_sources": {
                "timestamp": internal_data.get("timestamp"),
                "source": internal_data.get("source"),
                "central_api_connected": internal_data.get("central_api_connected", False),
                "laboratories": len(internal_data.get("laboratories", {}).get("labs", [])),
                "system_metrics": len(internal_data.get("system_metrics", {})),
                "asi_status": bool(internal_data.get("asi_status")),
                "ocean_labs_list": len(internal_data.get("ocean_labs_list", {}).get("laboratories", [])),
                "ai_agents_status": len(internal_data.get("ai_agents_status", {})),
                "all_keys": list(internal_data.keys())
            },
            "components": {
                "persona_router": "operational",
                "internal_data_sources": "operational",
                "query_processor": "operational",
                "knowledge_engine": "operational" if knowledge_engine else "not_initialized"
            }
        }
    except Exception as e:
        logger.error(f"Status check error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get(f"{API_PREFIX}/system-full")
async def get_full_system_status():
    """
    Get COMPLETE system status with ALL components:
    - 14 Personas
    - 23 Laboratories
    - 61 Alphabet Layers
    - 12 Backend Layers (0-12)
    - ASI Trinity (Alba/Albi/Jona)
    - Open Data Sources
    - Enforcement Manager
    - ML Manager
    - Cycle Engine
    """
    try:
        status = {
            "service": "Clisonix Ocean Core",
            "version": "4.0.0 - Full Integration",
            "timestamp": datetime.now().isoformat(),
            "components": {}
        }
        
        # Personas
        status["components"]["personas"] = {
            "count": len(persona_router.mapping) if persona_router else 0,
            "status": "active" if persona_router else "unavailable",
            "list": list(persona_router.mapping.keys()) if persona_router else []
        }
        
        # Laboratories
        if laboratory_network:
            labs = laboratory_network.get_all_labs()
            status["components"]["laboratories"] = {
                "count": len(labs),
                "status": "active",
                "locations": [lab.location for lab in labs[:5]]
            }
        else:
            status["components"]["laboratories"] = {"count": 0, "status": "unavailable"}
        
        # Orchestrator with Alphabet Layers & Universal Connector
        if orchestrator:
            status["components"]["orchestrator"] = {
                "status": "active",
                "alphabet_layers": orchestrator.alphabet_layers.alphabet['size'] if orchestrator.alphabet_layers else 0,
                "universal_connector": "connected" if hasattr(orchestrator, 'universal_connector') and orchestrator.universal_connector else "not_connected"
            }
            
            # Get Universal Connector summary
            if hasattr(orchestrator, 'universal_connector') and orchestrator.universal_connector:
                status["components"]["universal_system"] = orchestrator.universal_connector.get_system_summary()
        
        # Real Data Engine
        status["components"]["real_data_engine"] = {
            "status": "active" if real_data_engine else "unavailable"
        }
        
        # Knowledge Engine
        status["components"]["knowledge_engine"] = {
            "status": "active" if knowledge_engine else "degraded"
        }
        
        # Summary
        active_count = sum(1 for c in status["components"].values() if c.get("status") == "active" or c.get("status") == "connected")
        status["summary"] = {
            "total_components": len(status["components"]),
            "active_components": active_count,
            "health": "healthy" if active_count > 4 else "degraded"
        }
        
        return status
        
    except Exception as e:
        logger.error(f"Full system status error: {e}")
        return {"error": str(e), "status": "error"}


@app.get(f"{API_PREFIX}/sources")
async def get_sources():
    """List available data sources (INTERNAL ONLY)"""
    if not internal_data_sources:
        raise HTTPException(status_code=503, detail="Service initializing")
    
    internal_data = internal_data_sources.get_all_data()
    
    # REAL SOURCES from actual data
    return {
        "timestamp": datetime.now().isoformat(),
        "internal_sources_operational": list(internal_data.keys()),
        "central_api": {
            "url": internal_data.get("central_api_url", "http://localhost:8000"),
            "connected": internal_data.get("central_api_connected", False),
            "health": internal_data.get("health", {}),
            "status_code": internal_data.get("status")
        },
        "laboratories_network": {
            "description": "23 Specialized Research Laboratories across EU",
            "total": internal_data.get("laboratories", {}).get("total_labs", 0),
            "list_count": len(internal_data.get("ocean_labs_list", {}).get("laboratories", [])),
            "status": "operational",
            "locations": [
                "Elbasan, Albania (AI)",
                "Tirana, Albania (Medical)", 
                "Prishtina, Kosovo (Security)",
                "Vienna, Austria (Neuroscience)",
                "Zurich, Switzerland (Finance)",
                "Prague, Czech Republic (Robotics)",
                "Budapest, Hungary (Data)",
                "Ljubljana, Slovenia (Quantum)",
                "Zagreb, Croatia (Biotech)",
                "Sofia, Bulgaria (Chemistry)",
                "Beograd, Serbia (Industrial)",
                "Bucharest, Romania (Nanotechnology)",
                "Istanbul, Turkey (Trade)",
                "Cairo, Egypt (Archeology)",
                "Jerusalem, Palestine (Heritage)",
                "Rome, Italy (Architecture)",
                "Athens, Greece (Classical)",
                "Kostur, Greece (Energy)",
                "Durrës, Albania (IoT)",
                "Shkodër, Albania (Marine)",
                "Vlorë, Albania (Environmental)",
                "Korça, Albania (Agricultural)",
                "Sarandë, Albania (Underwater)"
            ]
        },
        "agi_agents": {
            "description": "ASI Trinity - 3 Superintelligences",
            "alba": {
                "role": "Network Monitor",
                "health": internal_data.get("asi_status", {}).get("trinity", {}).get("alba", {}).get("health", 0),
                "operational": internal_data.get("asi_status", {}).get("trinity", {}).get("alba", {}).get("operational", False)
            },
            "albi": {
                "role": "Neural Processor", 
                "health": internal_data.get("asi_status", {}).get("trinity", {}).get("albi", {}).get("health", 0),
                "operational": internal_data.get("asi_status", {}).get("trinity", {}).get("albi", {}).get("operational", False)
            },
            "jona": {
                "role": "Data Coordinator",
                "health": internal_data.get("asi_status", {}).get("trinity", {}).get("jona", {}).get("health", 0),
                "operational": internal_data.get("asi_status", {}).get("trinity", {}).get("jona", {}).get("operational", False)
            },
            "count": len(internal_data.get("ai_agents_status", {})),
            "status": "operational"
        },
        "system_metrics": {
            "description": "Real-time system health monitoring",
            "cpu_percent": internal_data.get("system_metrics", {}).get("cpu_percent"),
            "memory_percent": internal_data.get("system_metrics", {}).get("memory_percent"),
            "disk_percent": internal_data.get("system_metrics", {}).get("disk_percent"),
            "status": "operational"
        },
        "data_quality": {
            "laboratories": len(internal_data.get("laboratories", {}).get("labs", [])),
            "ocean_labs_list": len(internal_data.get("ocean_labs_list", {}).get("laboratories", [])),
            "ai_agents": len(internal_data.get("ai_agents_status", {})),
            "total_data_records": sum([
                len(v) if isinstance(v, list) else (len(v) if isinstance(v, dict) else 1) 
                for v in internal_data.values() if v
            ])
        },
        "note": "✅ ONLY internal Clisonix APIs - NO external data sources (Wikipedia, ArXiv, GitHub disabled)"
    }


def generate_key_findings(question: str, response: str | None) -> list:
    """Generate key findings from response"""
    findings = []
    
    # Extract sentences that look like findings
    if response:
        sentences = response.split('. ')
        for i, sentence in enumerate(sentences[:5]):  # Top 5 findings
            if len(sentence.strip()) > 20:
                findings.append({
                    "finding": sentence.strip(),
                    "importance": 0.8 - (i * 0.1),
                    "source": "persona_analysis"
                })
    
    return findings


def generate_curiosity_threads(question: str, findings: list) -> list:
    """Generate curiosity threads for deeper exploration"""
    # Common curiosity thread patterns
    thread_templates = [
        {
            "title": "Deep Dive",
            "hook": f"Let's explore the underlying mechanisms behind: {question[:50]}...",
            "depth_level": "expert"
        },
        {
            "title": "Historical Context",
            "hook": "How did our understanding of this topic evolve?",
            "depth_level": "medium"
        },
        {
            "title": "Practical Applications",
            "hook": "How can we apply this knowledge in real-world scenarios?",
            "depth_level": "beginner"
        },
        {
            "title": "Related Concepts",
            "hook": "What other topics are connected to this?",
            "depth_level": "medium"
        }
    ]
    
    # Adjust depth based on number of findings
    if len(findings) > 5:
        for thread in thread_templates:
            thread["depth_level"] = "expert"
    
    return thread_templates[:3]  # Return top 3 threads


@app.get("/api/excel/status")
@app.get(f"{API_PREFIX}/excel/status")
async def excel_status_proxy():
    """Proxy Excel service status via Ocean Core."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{EXCEL_SERVICE_URL}/status")
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail="Excel service returned an error")
    except Exception as e:
        logger.error(f"Excel status proxy error: {e}")
        raise HTTPException(status_code=502, detail="Excel service unavailable")


@app.get("/api/excel/templates")
@app.get(f"{API_PREFIX}/excel/templates")
async def excel_templates_proxy():
    """Proxy Excel templates endpoint via Ocean Core."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{EXCEL_SERVICE_URL}/api/excel/templates")
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail="Excel templates endpoint returned an error")
    except Exception as e:
        logger.error(f"Excel templates proxy error: {e}")
        raise HTTPException(status_code=502, detail="Excel service unavailable")


@app.get("/api/excel/formulas")
@app.get(f"{API_PREFIX}/excel/formulas")
async def excel_formulas_proxy():
    """Proxy Excel formulas endpoint via Ocean Core."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{EXCEL_SERVICE_URL}/api/excel/formulas")
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail="Excel formulas endpoint returned an error")
    except Exception as e:
        logger.error(f"Excel formulas proxy error: {e}")
        raise HTTPException(status_code=502, detail="Excel service unavailable")


@app.get("/api/excel/generate")
@app.get(f"{API_PREFIX}/excel/generate")
async def excel_generate_proxy(title: str = "Clisonix Data Export", include_metrics: bool = True):
    """Generate Excel file through Excel service and return binary content."""
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(
                f"{EXCEL_SERVICE_URL}/api/excel/generate",
                params={"title": title, "include_metrics": include_metrics}
            )
            response.raise_for_status()
            content_disposition = response.headers.get("content-disposition", "attachment; filename=clisonix_export.xlsx")
            return Response(
                content=response.content,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": content_disposition}
            )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail="Excel generate endpoint returned an error")
    except Exception as e:
        logger.error(f"Excel generate proxy error: {e}")
        raise HTTPException(status_code=502, detail="Excel service unavailable")


@app.post("/api/excel/validate")
@app.post(f"{API_PREFIX}/excel/validate")
async def excel_validate_proxy(file: UploadFile = File(...)):
    """Validate uploaded Excel file via Excel service."""
    try:
        file_bytes = await file.read()
        files = {
            "file": (
                file.filename or "upload.xlsx",
                file_bytes,
                file.content_type or "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(f"{EXCEL_SERVICE_URL}/api/excel/validate", files=files)
            return JSONResponse(status_code=response.status_code, content=response.json())
    except Exception as e:
        logger.error(f"Excel validate proxy error: {e}")
        raise HTTPException(status_code=502, detail="Excel service unavailable")


@app.post("/api/excel/parse")
@app.post(f"{API_PREFIX}/excel/parse")
async def excel_parse_proxy(file: UploadFile = File(...), sheet: str | None = None):
    """Parse uploaded Excel file via Excel service."""
    try:
        file_bytes = await file.read()
        files = {
            "file": (
                file.filename or "upload.xlsx",
                file_bytes,
                file.content_type or "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        }
        params = {"sheet": sheet} if sheet else None
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(f"{EXCEL_SERVICE_URL}/api/excel/parse", files=files, params=params)
            return JSONResponse(status_code=response.status_code, content=response.json())
    except Exception as e:
        logger.error(f"Excel parse proxy error: {e}")
        raise HTTPException(status_code=502, detail="Excel service unavailable")


@app.get(f"{API_PREFIX}/personas")
async def get_personas():
    """List all 14 specialist personas"""
    if not persona_router:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    personas_list = []
    for domain, keywords in persona_router.mapping.items():
        personas_list.append({
            "domain": domain,
            "keywords": keywords,
            "description": f"{domain} specialist analyst"
        })
    
    return {
        "total_personas": len(personas_list),
        "personas": personas_list,
        "timestamp": datetime.now().isoformat()
    }


@app.post(f"{API_PREFIX}/query")
async def query_ocean(request: Request):
    """
    Query Ocean with 14 Specialist Personas
    
    Accepts JSON body with:
    - query: Natural language question (required)
    - use_personas: Route through specialist personas (default: true)
    - limit_results: Limit results per source (default: 5)
    
    Routes to specialized analysts based on keywords:
    - Medical Science: brain, neuro, health, biology
    - LoRa IoT: lora, iot, sensor, gateway
    - Security: security, vulnerability, encrypted
    - Systems Architecture: api, infrastructure, system
    - Natural Science: physics, chemistry, energy, quantum
    - Industrial Process: cycle, production, factory
    - Business: kpi, revenue, growth, strategy
    - AGI Systems: agi, cognitive, autonomous
    - And 6 more specialized domains...
    """
    
    # Parse JSON body
    try:
        body = await request.json()
    except Exception as e:
        logger.error(f"JSON parse error: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid JSON body: {str(e)}")
    
    question = body.get("query") or body.get("question") or ""
    use_personas = body.get("use_personas", True)
    
    # Start timing from 0.1ms precision
    start_time = time.perf_counter()
    
    if not question or len(question.strip()) == 0:
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    
    if not query_processor or not knowledge_engine or not persona_router or not internal_data_sources:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        logger.info(f"🧠 Received query: {question}")
        
        # 0. ORCHESTRATOR V5 (Brain with Ollama/Knowledge Seeds) - First Priority!
        orchestrator_result = None
        if orchestrator:
            try:
                logger.info("🧠 Using Orchestrator v5 (Ollama + Knowledge Seeds)...")
                orchestrator_result = await orchestrator.orchestrate(question)
                # OrchestratedResponse is a dataclass - use attributes, not .get()
                if orchestrator_result and hasattr(orchestrator_result, 'fused_answer') and orchestrator_result.fused_answer:
                    sources = orchestrator_result.sources_cited if hasattr(orchestrator_result, 'sources_cited') else []
                    source_str = sources[0] if sources else "orchestrator_v5"
                    logger.info(f"✅ Orchestrator v5 answered (source: {source_str})")
            except Exception as orch_err:
                logger.warning(f"Orchestrator v5 error: {orch_err}")
        
        # If orchestrator gave real answer, use it
        if orchestrator_result and hasattr(orchestrator_result, 'fused_answer') and orchestrator_result.fused_answer:
            sources = orchestrator_result.sources_cited if hasattr(orchestrator_result, 'sources_cited') else []
            response_source = sources[0] if sources else "orchestrator_v5"
            response_content = orchestrator_result.fused_answer
            confidence = orchestrator_result.confidence if hasattr(orchestrator_result, 'confidence') else 0.9
            
            # Check if this is from Ollama or Knowledge Seeds (not a fallback/template)
            is_real_answer = any(s.startswith(("ollama", "knowledge_seed")) for s in sources) if sources else False
            
            if is_real_answer or (response_content and len(response_content) > 50):
                # Calculate elapsed time from 0.1ms to full response
                elapsed_ms = (time.perf_counter() - start_time) * 1000.0
                return {
                    "query": question,
                    "intent": str(orchestrator_result.query_category.value) if hasattr(orchestrator_result, 'query_category') else "general",
                    "response": response_content,
                    "persona_answer": response_content,
                    "key_findings": [{"finding": response_content[:500], "importance": 0.95, "source": response_source, "confidence": confidence}],
                    "sources": {"internal": sources, "external": []},
                    "confidence": confidence,
                    "processing_time_ms": round(elapsed_ms, 2),
                    "curiosity_threads": generate_curiosity_threads(question, []),
                    "data_sources_used": ["orchestrator_v5"] + sources,
                    "ollama_used": any(s.startswith("ollama") for s in sources),
                    "knowledge_seed_used": any(s.startswith("knowledge_seed") for s in sources),
                    "timestamp": datetime.now().isoformat()
                }
        
        # 1. FALLBACK: Real laboratories data
        lab_data = None
        if real_data_engine:
            logger.info("🔬 Fallback: Querying real laboratories for data...")
            try:
                lab_data = await real_data_engine.get_comprehensive_response(question)
                logger.info(f"✅ Real labs returned {lab_data.get('total_labs_queried', 0)} responses")
            except Exception as e:
                logger.warning(f"⚠️  Real data engine error: {e}")
        
        # 1. Get internal data
        internal_data = internal_data_sources.get_all_data()
        
        # 2. Route to specialist persona first (if enabled)
        persona_response = None
        if use_personas:
            persona = persona_router.route(question)
            persona_response = persona.answer(question, internal_data)
            logger.info(f"✅ Persona {persona.__class__.__name__} answered question")
        
        # 3. Process query with full knowledge engine
        processed = await query_processor.process(question)
        
        # 4. Generate comprehensive answer
        response = None
        if knowledge_engine:
            try:
                response = await knowledge_engine.answer_query(question, processed)
            except Exception as ke_error:
                logger.warning(f"Knowledge engine error: {ke_error}, using persona response")
        
        # If knowledge engine not available, create lightweight response
        if not response:
            # Generate enhanced findings - use real lab data if available!
            if lab_data and lab_data.get('lab_responses'):
                # Use REAL lab data instead of generic findings
                key_findings = [
                    {
                        "finding": lab['answer'][:200] + "...",
                        "importance": lab['quality_score'],
                        "source": lab['lab_name'],
                        "lab_domain": lab['domain'],
                        "confidence": lab['confidence']
                    }
                    for lab in lab_data.get('lab_responses', [])[:20]
                ]
            else:
                key_findings = generate_key_findings(question, persona_response)
            
            curiosity_threads = generate_curiosity_threads(question, key_findings)
            
            # Build ULTRA response with real lab data
            ultra_response = persona_response or "Analyzed based on internal data sources"
            if lab_data and lab_data.get('comprehensive_answer'):
                ultra_response = lab_data['comprehensive_answer']
            
            # Calculate elapsed time from 0.1ms to full response
            elapsed_ms = (time.perf_counter() - start_time) * 1000.0
            
            response_dict = {
                "query": question,
                "intent": processed.intent.value if processed else "unknown",
                "response": ultra_response,
                "persona_answer": persona_response if use_personas else None,
                "key_findings": key_findings,
                "sources": {"internal": ["persona_analysis", "real_laboratories"] if lab_data else ["persona_analysis"], "external": []},
                "confidence": lab_data.get('average_confidence', 0.75) if lab_data else (0.75 if persona_response else 0.5),
                "processing_time_ms": round(elapsed_ms, 2),
                "curiosity_threads": curiosity_threads,
                "data_sources_used": ["internal_only", "real_labs"] if lab_data else ["internal_only"],
                "labs_queried": lab_data.get('total_labs_queried', 0) if lab_data else 0,
                "real_lab_data": lab_data if lab_data else None,
                "timestamp": datetime.now().isoformat()
            }
        else:
            # Convert dataclass to dict
            response_dict = {
                "query": response.query,
                "intent": response.intent,
                "response": response.main_response,
                "persona_answer": persona_response if use_personas else None,
                "key_findings": response.key_findings,
                "sources": response.sources_cited,
                "confidence": response.confidence_score,
                "processing_time_ms": response.processing_time_ms,
                "curiosity_threads": [
                    {
                        "topic": thread.topic,
                        "question": thread.initial_question,
                        "related_topics": thread.related_topics,
                        "continue_with": thread.continue_suggestions,
                        "sources": thread.sources_used
                    }
                    for thread in response.curiosity_threads
                ],
                "data_sources_used": ["internal_only"],
                "timestamp": response.timestamp
            }
        
        return response_dict
        
    except ValueError as e:
        logger.warning(f"Query validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Query processing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post(f"{API_PREFIX}/chat/specialized")
async def specialized_chat_endpoint(request: Request):
    """
    Specialized Expert Chat - Clean Interface
    
    Returns real, expert answers in your advanced domains:
    - Neuroscience & Brain Research
    - AI/ML & Deep Learning
    - Quantum Physics & Energy
    - IoT/LoRa & Sensor Networks
    - Cybersecurity & Encryption
    - Bioinformatics & Genetics
    - Data Science & Analytics
    - Marine Biology & Environmental Science
    
    NO system status - JUST expert answers.
    """
    if not specialized_chat:
        raise HTTPException(status_code=503, detail="Specialized Chat Engine not initialized")
    
    try:
        body = await request.json()
        query = body.get("query", body.get("message", "")).strip()
        
        if not query:
            raise ValueError("Query cannot be empty")
        
        # Generate expert response
        response = await specialized_chat.generate_expert_response(query)
        
        return {
            "type": "specialized_chat",
            "query": query,
            "domain": response["domain"],
            "domain_expertise": response["domain_expertise"],
            "answer": response["answer"],
            "sources": response["sources"],
            "confidence": response["confidence"],
            "follow_up_topics": response["follow_up_topics"],
            "timestamp": response["timestamp"]
        }
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Chat processing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post(f"{API_PREFIX}/chat/history")
async def get_chat_history(request: Request):
    """Get chat conversation history"""
    if not specialized_chat:
        raise HTTPException(status_code=503, detail="Specialized Chat Engine not initialized")
    
    try:
        body = await request.json()
        limit = body.get("limit", 20)
        
        history = specialized_chat.get_chat_history(limit)
        stats = specialized_chat.get_statistics()
        
        return {
            "messages": history,
            "statistics": stats,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"History retrieval error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post(f"{API_PREFIX}/chat/clear")
async def clear_chat():
    """Clear chat history for new conversation"""
    if not specialized_chat:
        raise HTTPException(status_code=503, detail="Specialized Chat Engine not initialized")
    
    try:
        specialized_chat.clear_history()
        return {"status": "success", "message": "Chat history cleared", "timestamp": datetime.utcnow().isoformat()}
    except Exception as e:
        logger.error(f"Clear history error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post(f"{API_PREFIX}/chat/spontaneous")
async def spontaneous_conversation(request: Request):
    """
    SPONTANEOUS CONVERSATION MODE
    ============================
    
    This is the NEW way to chat - with full context awareness!
    
    Features:
    - Understands references to previous discussion ("what we talked about")
    - Maintains conversation topic coherence
    - Adapts responses based on full conversation history
    - Can handle follow-ups and clarifications naturally
    - Natural multi-turn dialogue
    
    Returns:
    - context_aware: boolean (true if using previous context)
    - conversation_topic: the main topic being discussed
    - turn_number: which turn of conversation this is
    - follow_up_topics: context-aware suggestions
    
    Example flow:
    1. User: "Tell me about quantum computing"
    2. User: "How does error correction work?" → System remembers quantum context
    3. User: "And what about hardware?" → Continues quantum discussion
    """
    if not specialized_chat:
        raise HTTPException(status_code=503, detail="Specialized Chat Engine not initialized")
    
    try:
        body = await request.json()
        query = body.get("query", "").strip()
        use_context = body.get("use_context", True)  # Default: use conversation context
        
        if not query:
            raise ValueError("Query cannot be empty")
        
        # Generate spontaneous response with context awareness
        response = await specialized_chat.generate_spontaneous_response(query, use_context=use_context)
        
        return {
            "type": "spontaneous_chat",
            "query": response["query"],
            "domain": response["domain"],
            "domain_expertise": response["domain_expertise"],
            "answer": response["answer"],
            "sources": response["sources"],
            "confidence": response["confidence"],
            "follow_up_topics": response["follow_up_topics"],
            "context_aware": response["context_aware"],
            "conversation_topic": response["conversation_topic"],
            "turn_number": response["turn_number"],
            "timestamp": response["timestamp"]
        }
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Spontaneous chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get(f"{API_PREFIX}/chat")
async def chat_test(message: str = Query(default="Hello", description="Mesazhi për të testuar")):
    """
    GET CHAT ENDPOINT - Për testim në browser
    ==========================================
    
    Shembull: http://localhost:8030/api/chat?message=What%20is%20neuroplasticity
    """
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")
    
    try:
        logger.info(f"💬 GET chat test: {message[:50]}...")
        result = await orchestrator.process_query_async(message)
        
        # Extract intent and complexity from understanding
        understanding = result.understanding or {}
        intent = understanding.get("intent", "exploratory")
        complexity = understanding.get("complexity_level", "simple")
        
        return {
            "response": result.fused_answer,
            "sources": result.sources_cited,
            "confidence": result.confidence,
            "query_category": result.query_category.value if hasattr(result.query_category, 'value') else str(result.query_category),
            "intent": intent,
            "complexity": complexity
        }
    except Exception as e:
        logger.error(f"GET chat error: {e}")
        return {"response": f"Gabim: {e}", "sources": [], "confidence": 0.0, "intent": "error", "complexity": "unknown"}


@app.post(f"{API_PREFIX}/chat")
async def simple_chat(request: Request):
    """
    SIMPLE CHAT ENDPOINT - ORCHESTRATOR V5
    =======================================
    
    Fast path conversational - 100% lokal, pa API të jashtme.
    
    Body:
    {
        "message": "Përshëndetje! Si je?",
        "clerk_user_id": "user_xxx" (optional)
    }
    
    Returns:
    {
        "response": "Mirëdita! Jam mirë, faleminderit...",
        "sources": ["conversational_greeting"],
        "confidence": 0.98
    }
    """
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")
    
    try:
        body = await request.json()
        message = body.get("message", body.get("query", "")).strip()
        raw_messages = body.get("messages") if isinstance(body.get("messages"), list) else []
        conversation_context = []
        for item in raw_messages[-20:]:
            if not isinstance(item, dict):
                continue
            role = str(item.get("role", "user")).strip() or "user"
            content = str(item.get("content", "")).strip()
            if content:
                conversation_context.append(f"{role}: {content}")
        
        # Get user context from request
        clerk_user_id = body.get("clerk_user_id") or request.headers.get("X-Clerk-User-Id")
        user_name = body.get("user_name")
        request_language = body.get("user_language") or body.get("language") or ""

        if not request_language:
            accept_language = request.headers.get("Accept-Language", "")
            if accept_language:
                request_language = accept_language.split(",")[0].split(";")[0]

        user_language = str(request_language or "en").split("-")[0].lower()
        if not user_language:
            user_language = "en"
        
        if not message:
            empty_messages = {
                "sq": "Ju lutem shkruani diçka për të vazhduar bisedën.",
                "de": "Bitte schreiben Sie etwas, um das Gespräch fortzusetzen.",
                "en": "Please write something to continue the conversation.",
            }
            return {
                "response": empty_messages.get(user_language, empty_messages["en"]),
                "sources": [],
                "confidence": 1.0,
                "language": user_language,
            }
        
        # Log with user context
        user_info = f"[User: {user_name or clerk_user_id or 'anonymous'}]" if clerk_user_id else ""
        logger.info(f"💬 Chat v5 {user_info}: {message[:50]}...")
        
        # Use Orchestrator v5 with conversational context for flow continuity
        fast_timeout = float(os.getenv("OCEAN_FAST_TIMEOUT_SECONDS", "2.0"))

        try:
            result = await asyncio.wait_for(
                orchestrator.orchestrate(
                    message,
                    conversation_context=conversation_context,
                    mode="conversational",
                    user_context={
                        "clerk_id": clerk_user_id,
                        "name": user_name,
                        "language": user_language,
                    },
                ),
                timeout=fast_timeout,
            )
        except asyncio.TimeoutError:
            logger.warning(f"⏱️ Chat timeout guard triggered after {fast_timeout}s")
            raise HTTPException(status_code=504, detail="Processing timeout")
        return {
            "response": result.fused_answer,
            "sources": result.sources_cited,
            "confidence": result.confidence,
            "language": result.language,
            "query_category": result.query_category.value if hasattr(result.query_category, 'value') else str(result.query_category),
            "user_identified": bool(clerk_user_id)
        }
    
    except Exception as e:
        logger.error(f"Chat v5 error: {e}")
        return {
            "response": f"Ndodhi një gabim: {str(e)}. Ju lutem provoni përsëri.",
            "sources": [],
            "confidence": 0.0
        }


@app.post(f"{API_PREFIX}/chat/fast")
async def fast_chat(request: Request):
    """
    FAST CHAT ENDPOINT - <=2s target
    =================================

    Dedicated low-latency endpoint for frontend microservice routing.
    """
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    try:
        body = await request.json()
        message = body.get("message", body.get("query", "")).strip()
        raw_messages = body.get("messages") if isinstance(body.get("messages"), list) else []
        conversation_context = []
        for item in raw_messages[-20:]:
            if not isinstance(item, dict):
                continue
            role = str(item.get("role", "user")).strip() or "user"
            content = str(item.get("content", "")).strip()
            if content:
                conversation_context.append(f"{role}: {content}")
        if not message:
            return {
                "response": "Ju lutem shkruani një pyetje.",
                "sources": [],
                "confidence": 1.0,
                "fast_path": True,
            }

        timeout_s = float(os.getenv("OCEAN_FAST_TIMEOUT_SECONDS", "2.0"))
        result = await asyncio.wait_for(
            orchestrator.orchestrate(
                message,
                conversation_context=conversation_context,
                mode="conversational",
            ),
            timeout=timeout_s,
        )

        return {
            "response": result.fused_answer,
            "sources": result.sources_cited,
            "confidence": result.confidence,
            "query_category": result.query_category.value if hasattr(result.query_category, 'value') else str(result.query_category),
            "fast_path": True,
            "timeout_seconds": timeout_s,
        }
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Processing timeout")
    except Exception as e:
        logger.error(f"Fast chat error: {e}")
        return {
            "response": f"Ndodhi një gabim: {str(e)}",
            "sources": [],
            "confidence": 0.0,
            "fast_path": True,
        }


@app.post(f"{API_PREFIX}/chat/stream")
async def streaming_chat(request: Request):
    """
    STREAMING CHAT ENDPOINT - Real-time response
    =============================================
    
    Streams response tokens as they are generated by Ollama.
    Text appears immediately instead of waiting for full response.
    
    Body:
    {
        "message": "Përshëndetje! Si je?"
    }
    
    Returns: SSE stream with chunks
    """
    from ollama_fast_engine import get_fast_engine
    
    try:
        body = await request.json()
        message = body.get("message", body.get("query", "")).strip()
        
        if not message:
            return StreamingResponse(
                iter(["data: {\"error\": \"Message required\"}\n\n"]),
                media_type="text/event-stream"
            )
        
        logger.info(f"🌊 Streaming chat: {message[:50]}...")
        
        async def generate_stream():
            engine = get_fast_engine()
            async for chunk in engine.generate_stream(message):
                # SSE format
                yield f"data: {{\"chunk\": \"{chunk}\"}}\n\n"
            yield "data: [DONE]\n\n"
        
        return StreamingResponse(
            generate_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )
    
    except Exception as e:
        logger.error(f"Streaming chat error: {e}")
        return StreamingResponse(
            iter([f"data: {{\"error\": \"{str(e)}\"}}\n\n"]),
            media_type="text/event-stream"
        )


@app.post(f"{API_PREFIX}/chat/binary")
async def binary_chat(request: Request):
    """
    BINARY CHAT ENDPOINT - CBOR2 / MessagePack
    ==========================================
    
    Pranon dhe kthen të dhëna në format binary (CBOR2 ose MessagePack).
    
    Content-Type pranuar:
    - application/cbor (CBOR2 - preferuar)
    - application/msgpack (MessagePack)
    - application/json (fallback)
    
    Returns: Same format as input (binary response)
    """
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")
    
    try:
        content_type = request.headers.get("content-type", "application/json")
        raw_body = await request.body()
        
        # Parse based on content type
        if "cbor" in content_type and HAS_CBOR2:
            body = cbor2.loads(raw_body)
            response_format = "cbor"
            logger.info("📦 CBOR2 request received")
        elif "msgpack" in content_type and HAS_MSGPACK:
            body = msgpack.loads(raw_body)
            response_format = "msgpack"
            logger.info("📦 MessagePack request received")
        else:
            import json
            body = json.loads(raw_body)
            response_format = "json"
        
        message = body.get("message", body.get("query", "")).strip()
        
        if not message:
            result_data = {
                "response": "Ju lutem shkruani diçka.",
                "sources": [],
                "confidence": 1.0,
                "format": response_format
            }
        else:
            logger.info(f"💬 Binary chat ({response_format}): {message[:50]}...")
            
            try:
                result = await orchestrator.process_query_async(message)
                result_data = {
                    "response": result.fused_answer,
                    "sources": result.sources_cited,
                    "confidence": result.confidence,
                    "query_category": result.query_category.value if hasattr(result.query_category, 'value') else str(result.query_category),
                    "format": response_format
                }
            except Exception as e:
                logger.warning(f"Async failed: {e}, using sync")
                result = orchestrator.process_query(message)
                result_data = {
                    "response": result.fused_answer,
                    "sources": result.sources_cited,
                    "confidence": result.confidence,
                    "format": response_format
                }
        
        # Return in same format
        if response_format == "cbor" and HAS_CBOR2:
            return Response(
                content=cbor2.dumps(result_data),
                media_type="application/cbor"
            )
        elif response_format == "msgpack" and HAS_MSGPACK:
            return Response(
                content=msgpack.dumps(result_data),
                media_type="application/msgpack"
            )
        else:
            return result_data
            
    except Exception as e:
        logger.error(f"Binary chat error: {e}")
        error_data = {
            "response": f"Gabim: {str(e)}",
            "sources": [],
            "confidence": 0.0
        }
        return error_data


@app.post(f"{API_PREFIX}/chat/orchestrated")
async def orchestrated_response(request: Request):
    """
    ORCHESTRATED RESPONSE - ORCHESTRATOR V5 (DEEP MODE)
    ====================================================
    
    Deep mode - përdor edhe ekspertë kur ka sens.
    100% LOKAL - pa API të jashtme me pagesë.
    
    Features:
    - RealAnswerEngine (fast path)
    - Minimal experts (1 persona + 1 lab + 1 module)
    - Multilingual support
    - Timeouts për ekspertët
    """
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator v5 not initialized")
    
    try:
        body = await request.json()
        query = body.get("query", body.get("message", "")).strip()
        conversation_context = body.get("conversation_context", [])
        mode = body.get("mode", "deep")  # Default: deep mode për orchestrated
        
        if not query:
            raise ValueError("Query cannot be empty")
        
        logger.info(f"🧠 Orchestrator v5 ({mode}): {query[:60]}...")
        
        # Check Autolearning Engine for cached responses
        knowledge_id = None
        if autolearning_engine:
            learning_result = autolearning_engine.process_query(query)
            
            # Use cached if high-confidence
            if learning_result.get('cached_knowledge'):
                cached = learning_result['cached_knowledge']
                if cached.get('helpfulness', 0) > 0.7 and cached.get('confidence', 0) > 0.85:
                    logger.info("   ✅ Using learned response")
                    return {
                        "type": "learned_response",
                        "query": query,
                        "query_category": "learned",
                        "fused_answer": cached['response'],
                        "sources_cited": ["autolearning"],
                        "confidence": cached['confidence'],
                        "timestamp": datetime.utcnow().isoformat()
                    }
            
            # Use pattern response if available
            if learning_result.get('pattern_response'):
                return {
                    "type": "pattern_response",
                    "query": query,
                    "query_category": learning_result['pattern_type'],
                    "fused_answer": learning_result['pattern_response'],
                    "sources_cited": ["pattern_detector"],
                    "confidence": 0.95,
                    "timestamp": datetime.utcnow().isoformat()
                }
        
        # Use Orchestrator v5
        orchestrated = await orchestrator.orchestrate(query, conversation_context, mode=mode)
        
        # Learn from response
        if autolearning_engine:
            knowledge_id = autolearning_engine.learn_from_response(
                query=query,
                response=orchestrated.fused_answer,
                sources=orchestrated.sources_cited,
                confidence=orchestrated.confidence
            )
        
        return {
            "type": "orchestrated_v5",
            "query": orchestrated.query,
            "query_category": orchestrated.query_category.value,
            "language": orchestrated.language,
            "understanding": orchestrated.understanding,
            "consulted_experts": [
                {
                    "type": c.expert_type,
                    "name": c.expert_name,
                    "confidence": c.confidence,
                    "relevance": c.relevance_score,
                }
                for c in orchestrated.consulted_experts
            ],
            "fused_answer": orchestrated.fused_answer,
            "sources_cited": orchestrated.sources_cited,
            "confidence": orchestrated.confidence,
            "narrative_quality": orchestrated.narrative_quality,
            "learning_record": {"knowledge_id": knowledge_id} if knowledge_id else {},
            "timestamp": orchestrated.timestamp
        }
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Orchestrator v5 error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.get(f"{API_PREFIX}/orchestrator/learning")
async def get_orchestrator_learning():
    """Get the learning stats from orchestrator v5"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator v5 not initialized")
    
    try:
        stats = orchestrator.get_stats()
        return {
            "type": "orchestrator_v5_stats",
            "version": stats.get("version", "v5"),
            "engine_active": stats.get("engine_active", False),
            "learning_history_count": stats.get("learning_history_count", 0),
            "expert_timeout_ms": stats.get("expert_timeout_ms", 500),
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Orchestrator stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get(f"{API_PREFIX}/autolearning/stats")
async def get_autolearning_stats():
    """
    Get Autolearning Engine statistics
    
    Shows:
    - Total knowledge entries learned
    - Top queries used
    - Pattern statistics
    - Session learning info
    """
    if not autolearning_engine:
        raise HTTPException(status_code=503, detail="Autolearning Engine not initialized")
    
    try:
        stats = autolearning_engine.get_learning_stats()
        return {
            "type": "autolearning_stats",
            "knowledge_base": stats["knowledge_base"],
            "patterns": stats["patterns"],
            "session": stats["session"],
            "independence": {
                "internal_sources": True,
                "external_api_dependency": False,
                "description": "Sistemi mëson dhe funksionon pa varësi nga API të jashtme"
            },
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Autolearning stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post(f"{API_PREFIX}/autolearning/feedback")
async def autolearning_feedback(request: Request):
    """
    Record user feedback for a response
    
    Body:
    - knowledge_id: ID of the knowledge entry
    - helpful: true/false
    """
    if not autolearning_engine:
        raise HTTPException(status_code=503, detail="Autolearning Engine not initialized")
    
    try:
        body = await request.json()
        knowledge_id = body.get("knowledge_id")
        helpful = body.get("helpful", True)
        
        if not knowledge_id:
            raise ValueError("knowledge_id is required")
        
        autolearning_engine.record_feedback(knowledge_id, helpful)
        
        return {
            "status": "recorded",
            "knowledge_id": knowledge_id,
            "feedback": "helpful" if helpful else "not_helpful",
            "message": "Faleminderit për feedback-un! Sistemi do të mësojë nga kjo."
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Feedback error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get(f"{API_PREFIX}/chat/domains")
async def get_domains():
    """Get available expertise domains"""
    if not specialized_chat:
        raise HTTPException(status_code=503, detail="Specialized Chat Engine not initialized")
    
    domains = {}
    for domain_name, domain_info in specialized_chat.EXPERTISE_DOMAINS.items():
        domains[domain_name] = {
            "focus": domain_info["focus"],
            "expertise_level": domain_info["expertise_level"],
            "keywords": domain_info["keywords"][:5],  # Show first 5 keywords
            "labs": domain_info["labs"]
        }
    
    return {
        "domains": domains,
        "total_domains": len(domains),
        "total_labs": len(set(lab for d in domains.values() for lab in d["labs"])),
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get(f"{API_PREFIX}/labs")
async def get_labs():
    """Get all location labs data"""
    if not laboratory_network:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        labs_dicts = laboratory_network.get_all_labs()
        # labs_dicts is already a list of dicts from get_all_labs()
        return {
            "labs": labs_dicts,
            "total": len(labs_dicts),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Labs data error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get(f"{API_PREFIX}/agents")
async def get_agents():
    """Get all agent telemetry"""
    if not internal_data_sources:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        internal_data = internal_data_sources.get_all_data()
        return {
            "agents": internal_data.get("agents", []),
            "total": len(internal_data.get("agents", [])),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Agents data error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get(API_PREFIX + "/threads/{topic}")
async def get_curiosity_thread(topic: str):
    """Get curiosity threads for exploration"""
    
    if not topic:
        raise HTTPException(status_code=400, detail="Topic required")
    
    # Map common topics to threads
    threads_map = {
        "laboratory": {
            "topic": "Geographic Laboratory Networks",
            "related": ["Elbasan", "Tirana", "Durrës", "Shkodër", "Vlorë", "Korça","Sarandë","Zürich","Roma"],
            "explore": [
                "What domains are most active?",
                "Which locations have highest quality data?",
                "What's the correlation between lab domains?",
                "How are labs interconnected across countries?"
            ]
        },
        "agents": {
            "topic": "Agent Intelligence & Decisions",
            "related": ["ALBA", "ALBI", "Blerina", "AGIEM", "ASI"],
            "explore": [
                "What are the top agent decisions?",
                "Which agent has highest confidence?",
                "What anomalies were detected?",
                "How do agents coordinate?"
            ]
        },
        "system": {
            "topic": "System Infrastructure & Performance",
            "related": ["CPU", "Memory", "Latency", "Uptime"],
            "explore": [
                "What are current metrics?",
                "Are there performance bottlenecks?",
                "How's resource utilization?",
                "What's the trend over time?"
            ]
        }
    }
    
    thread = threads_map.get(topic.lower())
    
    if not thread:
        raise HTTPException(status_code=404, detail=f"Topic '{topic}' not found")
    
    return {
        "topic": thread["topic"],
        "related_entities": thread["related"],
        "explore_further": thread["explore"],
        "timestamp": datetime.now().isoformat()
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "ocean-core-8030",
        "timestamp": datetime.now().isoformat()
    }


# =============================================================================
# AI PROCESSING ENDPOINTS
# =============================================================================

@app.post(f"{API_PREFIX}/ai/sentiment")
async def analyze_sentiment(request: Request):
    """
    Analyze sentiment and emotions in text
    
    Body: {"text": "Your text here", "use_llm": true}
    """
    try:
        from ai_processes import get_sentiment_analyzer
        
        data = await request.json()
        text = data.get("text", "")
        use_llm = data.get("use_llm", True)
        
        if not text:
            raise HTTPException(status_code=400, detail="Text is required")
        
        analyzer = get_sentiment_analyzer()
        await analyzer.initialize()
        result = await analyzer.analyze(text, use_llm=use_llm)
        
        return {
            "success": True,
            "result": result.to_dict(),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Sentiment analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post(f"{API_PREFIX}/ai/summarize")
async def summarize_text(request: Request):
    """
    Generate summary of text
    
    Body: {"text": "Long text...", "type": "hybrid", "target_ratio": 0.3}
    Types: extractive, abstractive, hybrid, bullet_points, tldr
    """
    try:
        from ai_processes import get_text_summarizer
        from ai_processes.text_summarizer import SummaryType
        
        data = await request.json()
        text = data.get("text", "")
        summary_type = data.get("type", "hybrid")
        target_ratio = data.get("target_ratio", 0.3)
        max_sentences = data.get("max_sentences", 5)
        
        if not text:
            raise HTTPException(status_code=400, detail="Text is required")
        
        # Map string to enum
        type_map = {
            "extractive": SummaryType.EXTRACTIVE,
            "abstractive": SummaryType.ABSTRACTIVE,
            "hybrid": SummaryType.HYBRID,
            "bullet_points": SummaryType.BULLET_POINTS,
            "tldr": SummaryType.TLDR
        }
        stype = type_map.get(summary_type, SummaryType.HYBRID)
        
        summarizer = get_text_summarizer()
        await summarizer.initialize()
        result = await summarizer.summarize(
            text, 
            summary_type=stype,
            target_ratio=target_ratio,
            max_sentences=max_sentences
        )
        
        return {
            "success": True,
            "result": result.to_dict(),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Summarization error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post(f"{API_PREFIX}/ai/entities")
async def extract_entities(request: Request):
    """
    Extract named entities from text (NER)
    
    Body: {"text": "Text with names, places, dates...", "use_llm": true}
    """
    try:
        from ai_processes import get_entity_extractor
        
        data = await request.json()
        text = data.get("text", "")
        use_llm = data.get("use_llm", True)
        
        if not text:
            raise HTTPException(status_code=400, detail="Text is required")
        
        extractor = get_entity_extractor()
        await extractor.initialize()
        result = await extractor.extract(text, use_llm=use_llm)
        
        return {
            "success": True,
            "result": result.to_dict(),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Entity extraction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post(f"{API_PREFIX}/ai/classify")
async def classify_text(request: Request):
    """
    Classify text into categories
    
    Body: {"text": "Text to classify...", "use_llm": true}
    """
    try:
        from ai_processes import get_text_classifier
        
        data = await request.json()
        text = data.get("text", "")
        use_llm = data.get("use_llm", True)
        
        if not text:
            raise HTTPException(status_code=400, detail="Text is required")
        
        classifier = get_text_classifier()
        await classifier.initialize()
        result = await classifier.classify(text, use_llm=use_llm)
        
        return {
            "success": True,
            "result": result.to_dict(),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Classification error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post(f"{API_PREFIX}/ai/analyze-code")
async def analyze_code(request: Request):
    """
    Analyze source code structure and quality
    
    Body: {"code": "def hello():\\n    pass", "language": "python"}
    """
    try:
        from ai_processes import get_code_analyzer
        
        data = await request.json()
        code = data.get("code", "")
        language = data.get("language")  # Optional, auto-detect if not provided
        
        if not code:
            raise HTTPException(status_code=400, detail="Code is required")
        
        analyzer = get_code_analyzer()
        await analyzer.initialize()
        result = await analyzer.analyze(code, language=language)
        
        return {
            "success": True,
            "result": result.to_dict(),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Code analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post(f"{API_PREFIX}/ai/detect-language")
async def detect_language(request: Request):
    """
    Detect language of text
    
    Body: {"text": "Përshëndetje, si jeni?"}
    """
    try:
        from ai_processes import get_language_detector
        
        data = await request.json()
        text = data.get("text", "")
        
        if not text:
            raise HTTPException(status_code=400, detail="Text is required")
        
        detector = get_language_detector()
        await detector.initialize()
        result = await detector.detect(text)
        
        return {
            "success": True,
            "result": result.to_dict(),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Language detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post(f"{API_PREFIX}/ai/intent")
async def classify_intent(request: Request):
    """
    Classify user intent from message
    
    Body: {"message": "I want to order a pizza", "use_llm": true}
    """
    try:
        from ai_processes import get_intent_classifier
        
        data = await request.json()
        message = data.get("message", "")
        use_llm = data.get("use_llm", True)
        
        if not message:
            raise HTTPException(status_code=400, detail="Message is required")
        
        classifier = get_intent_classifier()
        await classifier.initialize()
        result = await classifier.classify(message, use_llm=use_llm)
        
        return {
            "success": True,
            "result": result.to_dict(),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Intent classification error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post(f"{API_PREFIX}/ai/process")
async def unified_ai_process(request: Request):
    """
    Unified AI processing endpoint - run multiple analyses at once
    
    Body: {
        "text": "Text to analyze...",
        "processes": ["sentiment", "entities", "language", "classify"]
    }
    """
    try:
        from ai_processes import (
            get_entity_extractor,
            get_intent_classifier,
            get_language_detector,
            get_sentiment_analyzer,
            get_text_classifier,
            get_text_summarizer,
        )
        
        data = await request.json()
        text = data.get("text", "")
        processes = data.get("processes", ["sentiment", "language"])
        
        if not text:
            raise HTTPException(status_code=400, detail="Text is required")
        
        results = {}
        
        if "sentiment" in processes:
            analyzer = get_sentiment_analyzer()
            await analyzer.initialize()
            results["sentiment"] = (await analyzer.analyze(text)).to_dict()
        
        if "entities" in processes:
            extractor = get_entity_extractor()
            await extractor.initialize()
            results["entities"] = (await extractor.extract(text)).to_dict()
        
        if "language" in processes:
            detector = get_language_detector()
            await detector.initialize()
            results["language"] = (await detector.detect(text)).to_dict()
        
        if "classify" in processes:
            classifier = get_text_classifier()
            await classifier.initialize()
            results["classification"] = (await classifier.classify(text)).to_dict()
        
        if "summarize" in processes:
            summarizer = get_text_summarizer()
            await summarizer.initialize()
            results["summary"] = (await summarizer.summarize(text)).to_dict()
        
        if "intent" in processes:
            intent_clf = get_intent_classifier()
            await intent_clf.initialize()
            results["intent"] = (await intent_clf.classify(text)).to_dict()
        
        return {
            "success": True,
            "text_preview": text[:200] + "..." if len(text) > 200 else text,
            "processes_run": list(results.keys()),
            "results": results,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Unified AI processing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get(f"{API_PREFIX}/ai/capabilities")
async def ai_capabilities():
    """List all available AI processing capabilities"""
    return {
        "capabilities": [
            {
                "name": "sentiment",
                "endpoint": f"{API_PREFIX}/ai/sentiment",
                "method": "POST",
                "description": "Sentiment and emotion analysis"
            },
            {
                "name": "summarize",
                "endpoint": f"{API_PREFIX}/ai/summarize",
                "method": "POST",
                "description": "Text summarization"
            },
            {
                "name": "entities",
                "endpoint": f"{API_PREFIX}/ai/entities",
                "method": "POST",
                "description": "Named Entity Recognition"
            },
            {
                "name": "classify",
                "endpoint": f"{API_PREFIX}/ai/classify",
                "method": "POST",
                "description": "Text classification"
            },
            {
                "name": "analyze-code",
                "endpoint": f"{API_PREFIX}/ai/analyze-code",
                "method": "POST",
                "description": "Source code analysis"
            },
            {
                "name": "detect-language",
                "endpoint": f"{API_PREFIX}/ai/detect-language",
                "method": "POST",
                "description": "Language detection"
            },
            {
                "name": "intent",
                "endpoint": f"{API_PREFIX}/ai/intent",
                "method": "POST",
                "description": "User intent classification"
            },
            {
                "name": "process",
                "endpoint": f"{API_PREFIX}/ai/process",
                "method": "POST",
                "description": "Unified multi-process analysis"
            }
        ],
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }


# =============================================================================
# END AI PROCESSING ENDPOINTS
# =============================================================================


@app.get(f"{API_PREFIX}/spec")
async def api_spec():
    """OpenAPI specification"""
    return app.openapi()


@app.get("/api/chat")
async def api_chat_redirect():
    """Redirect to chat UI"""
    return FileResponse("specialized_chat.html", media_type="text/html")


@app.get("/api/status")
async def api_status_short():
    """Short status endpoint without version"""
    return {
        "service": "Curiosity Ocean",
        "version": "4.0.0",
        "status": "operational",
        "timestamp": datetime.now().isoformat()
    }


@app.get(f"{API_PREFIX}/laboratories")
async def get_all_laboratories():
    """Get all 23 specialized laboratories with their functions"""
    try:
        lab_network = get_laboratory_network()
        return {
            "total_laboratories": len(lab_network.labs),
            "laboratories": lab_network.get_all_labs(),
            "network_stats": lab_network.get_network_stats(),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Laboratories data error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get(f"{API_PREFIX}/laboratories/summary")
async def get_laboratories_summary():
    """Get summary of all 23 laboratories"""
    try:
        lab_network = get_laboratory_network()
        return lab_network.get_all_labs_summary()
    except Exception as e:
        logger.error(f"Laboratories summary error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get(f"{API_PREFIX}/laboratories/types")
async def get_laboratory_types():
    """Get all unique laboratory types"""
    try:
        lab_network = get_laboratory_network()
        return {
            "types": lab_network.get_lab_types(),
            "count": len(lab_network.get_lab_types()),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Laboratory types error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get(API_PREFIX + "/laboratories/{lab_id}")
async def get_laboratory(lab_id: str):
    """Get specific laboratory by ID"""
    try:
        lab_network = get_laboratory_network()
        lab = lab_network.get_lab_by_id(lab_id)
        
        if not lab:
            raise HTTPException(status_code=404, detail=f"Laboratory '{lab_id}' not found")
        
        return {
            "laboratory": lab.to_dict(),
            "status_summary": lab.get_status_summary(),
            "timestamp": datetime.now().isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Laboratory lookup error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get(API_PREFIX + "/laboratories/type/{lab_type}")
async def get_laboratories_by_type(lab_type: str):
    """Get laboratories by type"""
    try:
        lab_network = get_laboratory_network()
        labs = lab_network.get_labs_by_type(lab_type)
        
        if not labs:
            raise HTTPException(status_code=404, detail=f"No laboratories of type '{lab_type}' found")
        
        return {
            "type": lab_type,
            "count": len(labs),
            "laboratories": [lab.to_dict() for lab in labs],
            "timestamp": datetime.now().isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Laboratory type lookup error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get(API_PREFIX + "/laboratories/location/{location}")
async def get_laboratories_by_location(location: str):
    """Get laboratories by location"""
    try:
        lab_network = get_laboratory_network()
        labs = lab_network.get_labs_by_location(location)
        
        if not labs:
            raise HTTPException(status_code=404, detail=f"No laboratories in '{location}' found")
        
        return {
            "location": location,
            "count": len(labs),
            "laboratories": [lab.to_dict() for lab in labs],
            "timestamp": datetime.now().isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Laboratory location lookup error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get(API_PREFIX + "/laboratories/function/{keyword}")
async def get_laboratories_by_function(keyword: str):
    """Get laboratories by function keyword"""
    try:
        lab_network = get_laboratory_network()
        labs = lab_network.get_labs_by_function_keyword(keyword)
        
        if not labs:
            raise HTTPException(status_code=404, detail=f"No laboratories with function containing '{keyword}' found")
        
        return {
            "keyword": keyword,
            "count": len(labs),
            "laboratories": [lab.to_dict() for lab in labs],
            "timestamp": datetime.now().isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Laboratory function lookup error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# MEGA SIGNAL INTEGRATOR ENDPOINTS
# =============================================================================

@app.get(f"{API_PREFIX}/signals/overview")
async def get_signals_overview():
    """
    🌊 MEGA SIGNAL SYSTEM OVERVIEW
    
    Returns status of all signal managers:
    - Cycles, Alignments, Proposals
    - Kubernetes, CI/CD
    - News, Data Sources (5000+ from 200+ countries)
    """
    try:
        from mega_signal_integrator import get_mega_signal_integrator
        integrator = get_mega_signal_integrator()
        overview = integrator.get_system_overview()
        
        return {
            "type": "mega_signal_overview",
            "status": "connected",
            "overview": overview,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Mega Signal overview error: {e}")
        return {
            "type": "mega_signal_overview",
            "status": "error",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


@app.get(f"{API_PREFIX}/signals/anatomy")
async def get_system_anatomy():
    """
    🫀 SYSTEM ANATOMY MAP

    Returns the unified Clisonix body-map domains and their activation intents.
    """
    return {
        "type": "system_anatomy",
        "status": "ready",
        "domains": SYSTEM_ANATOMY,
        "activate_endpoint": f"{API_PREFIX}/signals/activate",
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.post(f"{API_PREFIX}/signals/activate")
async def activate_system_domains(payload: AnatomyActivateRequest):
    """
    ⚡ ACTIVATE SYSTEM DOMAINS (SAFE MODE)

    Activates selected domains by running orchestrated intent queries through
    Mega Signal Integrator (read-safe, no destructive operations).
    """
    try:
        from mega_signal_integrator import get_mega_signal_integrator
        integrator = get_mega_signal_integrator()

        targets = payload.targets or list(SYSTEM_ANATOMY.keys())
        normalized_targets = [t for t in targets if t in SYSTEM_ANATOMY]

        if not normalized_targets:
            raise HTTPException(
                status_code=400,
                detail="No valid targets. Use keys from /signals/anatomy",
            )

        activated = []
        for target in normalized_targets:
            spec = SYSTEM_ANATOMY[target]
            result = await integrator.process_query(spec["activation_query"])
            activated.append(
                {
                    "target": target,
                    "label": spec["label"],
                    "query": spec["activation_query"],
                    "sources_checked": result.get("sources_checked", []),
                    "status": "active" if result.get("sources_checked") else "partial",
                }
            )

        response = {
            "type": "system_activation",
            "mode": "safe-read",
            "requested": targets,
            "activated": activated,
            "activated_count": len(activated),
            "timestamp": datetime.utcnow().isoformat(),
        }

        if payload.include_overview:
            response["overview"] = integrator.get_system_overview()

        return response
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"System activation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post(f"{API_PREFIX}/signals/query")
async def query_signals(request: Request):
    """
    🔍 QUERY MEGA SIGNAL SYSTEM
    
    Ask about cycles, alignments, proposals, kubernetes, 
    data sources, and more!
    """
    try:
        from mega_signal_integrator import get_mega_signal_integrator
        integrator = get_mega_signal_integrator()
        
        body = await request.json()
        query = body.get("query", body.get("message", "")).strip()
        
        if not query:
            raise ValueError("Query cannot be empty")
        
        result = await integrator.process_query(query)
        
        return {
            "type": "mega_signal_query",
            "query": query,
            "response": result.get("response", ""),
            "sources_checked": result.get("sources_checked", []),
            "signals": result.get("signals", []),
            "timestamp": datetime.utcnow().isoformat()
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Mega Signal query error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get(f"{API_PREFIX}/signals/cycles")
async def get_cycles():
    """Get all active cycles"""
    try:
        from mega_signal_integrator import get_mega_signal_integrator
        integrator = get_mega_signal_integrator()
        cycles = integrator.cycle_manager.get_active_cycles()
        
        return {
            "type": "cycles",
            "count": len(cycles),
            "cycles": cycles,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Cycles error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post(f"{API_PREFIX}/signals/cycles")
async def create_cycle(request: Request):
    """Create a new cycle"""
    try:
        from mega_signal_integrator import get_mega_signal_integrator
        integrator = get_mega_signal_integrator()
        
        body = await request.json()
        domain = body.get("domain", "general")
        source = body.get("source", "api")
        interval = body.get("interval_seconds", 300)
        
        signal = integrator.cycle_manager.create_cycle(domain, source, interval)
        
        return {
            "type": "cycle_created",
            "signal": {
                "id": signal.signal_id,
                "message": signal.message,
                "data": signal.data
            },
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Create cycle error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post(f"{API_PREFIX}/signals/proposals")
async def create_proposal(request: Request):
    """Create a new proposal"""
    try:
        from mega_signal_integrator import get_mega_signal_integrator
        integrator = get_mega_signal_integrator()
        
        body = await request.json()
        title = body.get("title", "New Proposal")
        domain = body.get("domain", "general")
        description = body.get("description", "")
        
        signal = integrator.proposal_manager.create_proposal(title, domain, description)
        
        return {
            "type": "proposal_created",
            "signal": {
                "id": signal.signal_id,
                "message": signal.message,
                "data": signal.data
            },
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Create proposal error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get(f"{API_PREFIX}/signals/kubernetes")
async def get_kubernetes_status():
    """Get Kubernetes cluster status"""
    try:
        from mega_signal_integrator import get_mega_signal_integrator
        integrator = get_mega_signal_integrator()
        signal = integrator.devops_manager.get_kubernetes_status()
        
        return {
            "type": "kubernetes_status",
            "message": signal.message,
            "data": signal.data,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Kubernetes status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get(f"{API_PREFIX}/signals/data-sources")
async def get_data_sources_summary():
    """
    🌍 GET 5000+ DATA SOURCES FROM 200+ COUNTRIES
    
    Returns summary of all available data sources:
    - EEG/Neuro (OpenNeuro, PhysioNet)
    - Scientific (PubMed, ArXiv, NCBI)
    - Statistics EU (Eurostat, Destatis, INSEE)
    - Statistics Asia (China NBS, Japan, Korea)
    - Finance (ECB, IMF, World Bank, CoinGecko)
    - Environment (Copernicus, NASA, NOAA)
    - Health (WHO, CDC, ECDC)
    - News (NewsAPI, Guardian, NY Times)
    - IoT (FIWARE, Smart Data Models)
    - International (UN Data, WTO, ILO, FAO)
    """
    try:
        from mega_signal_integrator import get_mega_signal_integrator
        integrator = get_mega_signal_integrator()
        signal = integrator.news_data_manager.get_data_sources_summary()
        
        return {
            "type": "data_sources",
            "message": signal.message,
            "total_sources": signal.data.get("total", 0),
            "categories": signal.data.get("categories", {}),
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Data sources error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get(f"{API_PREFIX}/signals/data-sources/search")
async def search_data_sources(query: str = Query(..., description="Search query for data sources")):
    """Search data sources by keyword"""
    try:
        from mega_signal_integrator import get_mega_signal_integrator
        integrator = get_mega_signal_integrator()
        results = integrator.news_data_manager.search_sources(query)
        
        return {
            "type": "data_sources_search",
            "query": query,
            "count": len(results),
            "results": results,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Data sources search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get(f"{API_PREFIX}/signals/lora")
async def get_lora_status():
    """
    📡 GET LORA/LORAWAN NETWORK STATUS
    
    Returns status of LoRa gateways and nodes.
    Low-power wide-area network for IoT.
    """
    try:
        from mega_signal_integrator import get_mega_signal_integrator
        integrator = get_mega_signal_integrator()
        signal = integrator.lora_manager.get_network_status()
        
        return {
            "type": "lora_status",
            "message": signal.message,
            "data": signal.data,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"LoRa status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post(f"{API_PREFIX}/signals/lora/nodes")
async def register_lora_node(request: Request):
    """Register a new LoRa node"""
    try:
        from mega_signal_integrator import get_mega_signal_integrator
        integrator = get_mega_signal_integrator()
        
        body = await request.json()
        node_id = body.get("node_id", f"node_{datetime.utcnow().timestamp()}")
        node_type = body.get("node_type", "sensor")
        metadata = body.get("metadata", {})
        
        signal = integrator.lora_manager.register_node(node_id, node_type, metadata)
        
        return {
            "type": "lora_node_registered",
            "signal": {"id": signal.signal_id, "message": signal.message, "data": signal.data},
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"LoRa node registration error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get(f"{API_PREFIX}/signals/nanogrid")
async def get_nanogrid_status():
    """
    🔌 GET NANOGRID GATEWAY STATUS
    
    Returns status of embedded devices:
    - ESP32 (WiFi, BLE, I2C)
    - STM32 (LoRa, UART, DMA)
    - ASIC (LoRa, UART)
    - Raspberry Pi
    """
    try:
        from mega_signal_integrator import get_mega_signal_integrator
        integrator = get_mega_signal_integrator()
        signal = integrator.nanogrid_manager.get_gateway_status()
        
        return {
            "type": "nanogrid_status",
            "message": signal.message,
            "data": signal.data,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Nanogrid status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post(f"{API_PREFIX}/signals/nanogrid/devices")
async def register_nanogrid_device(request: Request):
    """Register a new Nanogrid device"""
    try:
        from mega_signal_integrator import get_mega_signal_integrator
        integrator = get_mega_signal_integrator()
        
        body = await request.json()
        device_id = body.get("device_id", f"dev_{datetime.utcnow().timestamp()}")
        model = body.get("model", "CUSTOM_IOT")
        metadata = body.get("metadata", {})
        
        signal = integrator.nanogrid_manager.register_device(device_id, model, metadata)
        
        return {
            "type": "nanogrid_device_registered",
            "signal": {"id": signal.signal_id, "message": signal.message, "data": signal.data},
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Nanogrid device registration error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post(f"{API_PREFIX}/signals/nanogrid/telemetry")
async def receive_telemetry(request: Request):
    """Receive telemetry from Nanogrid device"""
    try:
        from mega_signal_integrator import get_mega_signal_integrator
        integrator = get_mega_signal_integrator()
        
        body = await request.json()
        device_id = body.get("device_id")
        payload = body.get("payload", {})
        
        if not device_id:
            raise ValueError("device_id is required")
        
        signal = integrator.nanogrid_manager.process_telemetry(device_id, payload)
        
        return {
            "type": "telemetry_received",
            "signal": {"id": signal.signal_id, "message": signal.message},
            "timestamp": datetime.utcnow().isoformat()
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Telemetry error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get(f"{API_PREFIX}/signals/nodes")
async def get_nodes_status():
    """Get nodes, arrays, and buffers status"""
    try:
        from mega_signal_integrator import get_mega_signal_integrator
        integrator = get_mega_signal_integrator()
        status = integrator.node_array_manager.get_status()
        
        return {
            "type": "node_array_status",
            "data": status,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Nodes status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get(f"{API_PREFIX}/signals/formats")
async def get_data_formats():
    """
    📦 GET SUPPORTED DATA FORMATS
    
    Returns info about supported formats:
    - CBOR (39% smaller than JSON)
    - JSON (human readable)
    - YAML (config files)
    - MsgPack (30% smaller than JSON)
    """
    try:
        from mega_signal_integrator import get_mega_signal_integrator
        integrator = get_mega_signal_integrator()
        signal = integrator.format_manager.get_all_formats()
        
        return {
            "type": "data_formats",
            "message": signal.message,
            "formats": signal.data,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Formats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/documents/capabilities")
@app.get(f"{API_PREFIX}/documents/capabilities")
async def documents_capabilities():
    """Industrial document pipeline capabilities and operational limits."""
    return {
        "service": "Curiosity Ocean Document Core",
        "status": "operational",
        "max_upload_bytes": DOCUMENT_MAX_BYTES,
        "supported_mime_types": sorted(list(DOCUMENT_MIME_ALLOWLIST)),
        "features": {
            "scan_read": True,
            "checksum_sha256": True,
            "parser_fallback_chain": True,
            "contract_generation": True,
            "provenance_tracking": True,
            "ocr_for_scanned_docs": False,
        },
        "endpoints": [
            f"{API_PREFIX}/documents/scan",
            f"{API_PREFIX}/documents/generate",
            f"{API_PREFIX}/documents/agents",
        ],
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.get("/api/documents/agents")
@app.get(f"{API_PREFIX}/documents/agents")
async def documents_agents():
    """List available industrial document agents."""
    try:
        from document_agents import list_agents
        return {
            "agents": list_agents(),
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        logger.error(f"Document agents listing error: {e}")
        raise HTTPException(status_code=500, detail="Failed to list document agents")


@app.post("/api/documents/scan")
@app.post(f"{API_PREFIX}/documents/scan")
async def documents_scan(file: UploadFile = File(...), max_chars: int = Query(default=120000, ge=2000, le=500000)):
    """Industrial upload + scan/read endpoint with metadata and parser provenance."""
    started = time.perf_counter()
    ingestion_id = f"DOC-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{uuid4().hex[:10]}"

    try:
        raw = await file.read()
        size_bytes = len(raw)
        content_type = (file.content_type or "application/octet-stream").lower()
        filename = file.filename or "unknown"

        if size_bytes == 0:
            raise HTTPException(status_code=400, detail="Empty file")
        if size_bytes > DOCUMENT_MAX_BYTES:
            raise HTTPException(status_code=413, detail=f"File too large. Limit is {DOCUMENT_MAX_BYTES} bytes")

        lower_name = filename.lower()
        extension_allowed = lower_name.endswith((".pdf", ".doc", ".docx", ".xls", ".xlsx", ".txt", ".csv", ".json", ".md"))
        mime_allowed = content_type in DOCUMENT_MIME_ALLOWLIST
        if not (extension_allowed or mime_allowed):
            raise HTTPException(status_code=415, detail=f"Unsupported document type: {content_type}")

        sha256 = hashlib.sha256(raw).hexdigest()
        extraction = _extract_text_from_document(filename, content_type, raw, max_chars=max_chars)
        elapsed_ms = round((time.perf_counter() - started) * 1000, 2)

        return {
            "ingestion_id": ingestion_id,
            "filename": filename,
            "content_type": content_type,
            "size_bytes": size_bytes,
            "sha256": sha256,
            "extraction": {
                "parser": extraction["parser"],
                "text_length": extraction["text_length"],
                "units": extraction["units"],
                "text_preview": extraction["text"][:2000],
                "text": extraction["text"],
            },
            "provenance": {
                "source_type": "uploaded_document",
                "retrieved_at": datetime.utcnow().isoformat(),
                "agent": "ocean_document_scan",
            },
            "processing_time_ms": elapsed_ms,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document scan error [{ingestion_id}]: {e}")
        raise HTTPException(status_code=500, detail=f"Document scanning failed: {type(e).__name__}")


@app.post("/api/documents/generate")
@app.post(f"{API_PREFIX}/documents/generate")
async def documents_generate(request: DocumentGenerateRequest):
    """Industrial contract-governed generation via specialized document agents."""
    try:
        from document_agents import get_agent
        from document_contracts import create_cpi_report_contract, create_research_report_contract

        format_map = {
            "xlsx": "excel",
            "csv": "excel",
            "pdf": "pdf",
            "report": "report",
        }

        contract_map = {
            "cpi": create_cpi_report_contract,
            "research": create_research_report_contract,
        }

        agent_name = format_map.get(request.format.lower())
        if not agent_name:
            raise HTTPException(status_code=400, detail="Unsupported format. Use xlsx/csv/pdf/report")

        contract_factory = contract_map.get(request.contract_type.lower())
        if not contract_factory:
            raise HTTPException(status_code=400, detail="Unsupported contract_type. Use cpi/research")

        agent = get_agent(agent_name)
        if not agent:
            raise HTTPException(status_code=503, detail=f"Agent unavailable: {agent_name}")

        contract = contract_factory()
        result = agent.generate_document(contract=contract, query=request.query, language=request.language)

        document_payload = result.get("document")
        if document_payload is not None and hasattr(document_payload, "to_dict"):
            document_payload = document_payload.to_dict()

        return {
            "success": bool(result.get("success")),
            "validation_status": result.get("validation_status"),
            "errors": result.get("errors", []),
            "document": document_payload,
            "provenance": result.get("provenance"),
            "meta": {
                "agent": agent_name,
                "contract_type": request.contract_type,
                "format": request.format,
                "timestamp": datetime.utcnow().isoformat(),
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Document generation failed: {type(e).__name__}")


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.environ.get("OCEAN_PORT", 8030))
    logger.info(f"🌊 Starting Curiosity Ocean on port {port}...")
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info"
    )
