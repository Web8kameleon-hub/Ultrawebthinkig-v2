import os
import time
from pathlib import Path
from typing import Any, Dict, List

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="OpenMind Gateway", version="1.0.0")

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama:11434")
SERVICE_PORT = int(os.getenv("OPENMIND_PORT", "9999"))
DEFAULT_MODEL = os.getenv("OPENMIND_MODEL", "llama3.1:8b")
SUPPORTED_PROVIDERS = ["openmind", "ollama"]
SYSTEM_PROMPT_PATH = os.getenv("CLISONIX_SYSTEM_PROMPT_PATH", "/app/CLISONIX_SYSTEM_PROMPT.md")
MODULE_MAP_PATH = os.getenv("CLISONIX_MODULE_MAP_PATH", "/app/CLISONIX_MODULE_MAP.md")

_TEXT_CACHE: Dict[str, Dict[str, Any]] = {}


def _read_text_cached(path: str, default_value: str = "") -> str:
    file_path = Path(path)
    if not file_path.exists() or not file_path.is_file():
        return default_value

    try:
        stat = file_path.stat()
        cache_entry = _TEXT_CACHE.get(path)
        if cache_entry and cache_entry.get("mtime") == stat.st_mtime:
            return cache_entry.get("text", default_value)

        text = file_path.read_text(encoding="utf-8")
        _TEXT_CACHE[path] = {"mtime": stat.st_mtime, "text": text}
        return text
    except Exception:
        return default_value


def _build_shared_system_context() -> str:
    system_prompt = _read_text_cached(
        SYSTEM_PROMPT_PATH,
        default_value=(
            "You are OpenMind, the Clisonix platform intelligence gateway. "
            "Always be accurate, multilingual, and project-aware."
        ),
    ).strip()
    module_map = _read_text_cached(MODULE_MAP_PATH, default_value="").strip()

    if module_map:
        return f"{system_prompt}\n\nProject Module Mapping:\n{module_map}"
    return system_prompt


async def _get_ollama_models(timeout_seconds: float = 8.0) -> List[str]:
    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        response = await client.get(f"{OLLAMA_URL}/api/tags")
        response.raise_for_status()
        data = response.json()
        models = data.get("models", [])
        return [item.get("name", "") for item in models if item.get("name")]


class OpenMindRequest(BaseModel):
    message: str
    provider: str = "openmind"
    model: str = DEFAULT_MODEL
    options: Dict[str, Any] = Field(default_factory=dict)


@app.get("/")
async def root() -> Dict[str, Any]:
    return {
        "service": "openmind",
        "status": "ready",
        "port": SERVICE_PORT,
        "providers": SUPPORTED_PROVIDERS,
    }


@app.get("/health")
async def health() -> Dict[str, Any]:
    ollama_reachable = False
    model_count = 0
    try:
        models = await _get_ollama_models(timeout_seconds=4.0)
        ollama_reachable = True
        model_count = len(models)
    except Exception:
        ollama_reachable = False

    return {
        "status": "healthy" if ollama_reachable else "degraded",
        "service": "openmind",
        "provider_count": len(SUPPORTED_PROVIDERS),
        "ollama_reachable": ollama_reachable,
        "ollama_model_count": model_count,
        "timestamp": time.time(),
    }


@app.get("/status")
async def status() -> Dict[str, Any]:
    ollama_reachable = False
    models: List[str] = []
    error: str | None = None
    try:
        models = await _get_ollama_models(timeout_seconds=6.0)
        ollama_reachable = True
    except Exception as exc:
        ollama_reachable = False
        error = str(exc)

    return {
        "service": "openmind",
        "ready": True,
        "providers": SUPPORTED_PROVIDERS,
        "ollama_url": OLLAMA_URL,
        "default_model": DEFAULT_MODEL,
        "system_prompt_path": SYSTEM_PROMPT_PATH,
        "module_map_path": MODULE_MAP_PATH,
        "system_prompt_loaded": bool(_read_text_cached(SYSTEM_PROMPT_PATH)),
        "module_map_loaded": bool(_read_text_cached(MODULE_MAP_PATH)),
        "ollama_reachable": ollama_reachable,
        "ollama_models": models,
        "provider_error": error,
    }


@app.get("/api/openmind/providers")
async def providers() -> Dict[str, List[str]]:
    return {"providers": SUPPORTED_PROVIDERS}


@app.get("/api/openmind/models")
async def models() -> Dict[str, Any]:
    try:
        names = await _get_ollama_models()
        return {
            "provider": "ollama",
            "default_model": DEFAULT_MODEL,
            "models": names,
            "count": len(names),
        }
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Unable to load models from Ollama: {exc}") from exc


@app.post("/api/openmind")
async def openmind_chat(payload: OpenMindRequest) -> Dict[str, Any]:
    if payload.provider not in SUPPORTED_PROVIDERS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported provider '{payload.provider}'. Supported providers: {SUPPORTED_PROVIDERS}",
        )

    selected_model = payload.model or DEFAULT_MODEL
    shared_system_context = _build_shared_system_context()

    if payload.provider == "ollama":
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{OLLAMA_URL}/api/generate",
                    json={
                        "model": selected_model,
                        "system": shared_system_context,
                        "prompt": payload.message,
                        "stream": False,
                        **payload.options,
                    },
                )
                response.raise_for_status()
                data = response.json()
                return {
                    "service": "openmind",
                    "provider": "ollama",
                    "model": selected_model,
                    "response": data.get("response", ""),
                }
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Ollama provider error: {exc}") from exc

    return {
        "service": "openmind",
        "provider": payload.provider,
        "model": selected_model,
        "response": f"OpenMind gateway accepted message: {payload.message[:200]}",
        "system_context_loaded": bool(shared_system_context),
    }