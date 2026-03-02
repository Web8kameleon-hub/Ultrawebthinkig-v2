#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import asyncio
import json
import logging
import os
import sqlite3
import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(name)s - %(message)s")
logger = logging.getLogger("OceanMissionService")

PORT = int(os.getenv("PORT", "9500"))
DB_PATH = Path(os.getenv("MISSION_DB_PATH", "./data/ocean_missions.db"))


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class MissionStepSpec(BaseModel):
    name: str
    tool: str
    params: Dict[str, Any] = Field(default_factory=dict)


class MissionRequest(BaseModel):
    user_id: str = "anonymous"
    query: str
    context: Dict[str, Any] = Field(default_factory=dict)
    steps: List[MissionStepSpec] = Field(default_factory=list)
    priority: str = "normal"
    max_retries: int = 2
    tags: List[str] = Field(default_factory=list)


class MissionStepState(BaseModel):
    index: int
    name: str
    tool: str
    params: Dict[str, Any] = Field(default_factory=dict)
    status: str = "pending"
    retries: int = 0
    started_at: Optional[str] = None
    ended_at: Optional[str] = None
    output: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class MissionState(BaseModel):
    mission_id: str
    status: str
    created_at: str
    updated_at: str
    request: MissionRequest
    steps: List[MissionStepState]
    result: Dict[str, Any] = Field(default_factory=dict)


class ToolRegistry:
    def __init__(self) -> None:
        self._tools = {
            "http_health_check": self.http_health_check,
            "python_script": self.python_script,
            "file_exists": self.file_exists,
            "sleep": self.sleep_tool,
        }

    def list_tools(self) -> List[str]:
        return sorted(self._tools.keys())

    async def execute(self, tool: str, params: Dict[str, Any]) -> Dict[str, Any]:
        if tool not in self._tools:
            raise ValueError(f"Unknown tool: {tool}")
        return await self._tools[tool](params)

    async def http_health_check(self, params: Dict[str, Any]) -> Dict[str, Any]:
        url = params.get("url")
        if not url:
            raise ValueError("http_health_check requires 'url'")
        timeout = float(params.get("timeout", 4.0))
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.get(url)
            return {"ok": response.status_code < 400, "status_code": response.status_code, "url": url}
        except Exception as exc:
            return {"ok": False, "status_code": 0, "url": url, "error": str(exc)}

    async def python_script(self, params: Dict[str, Any]) -> Dict[str, Any]:
        script = params.get("script")
        if not script:
            raise ValueError("python_script requires 'script'")
        python_bin = params.get("python", os.getenv("PYTHON_BIN", "python"))
        args = params.get("args", [])
        command = [python_bin, script] + args
        timeout = int(params.get("timeout", 180))
        process = await asyncio.to_thread(
            subprocess.run,
            command,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return {
            "ok": process.returncode == 0,
            "returncode": process.returncode,
            "stdout": process.stdout[-4000:],
            "stderr": process.stderr[-4000:],
            "command": command,
        }

    async def file_exists(self, params: Dict[str, Any]) -> Dict[str, Any]:
        path = params.get("path")
        if not path:
            raise ValueError("file_exists requires 'path'")
        exists = Path(path).exists()
        return {"ok": exists, "path": path, "exists": exists}

    async def sleep_tool(self, params: Dict[str, Any]) -> Dict[str, Any]:
        seconds = float(params.get("seconds", 1))
        await asyncio.sleep(seconds)
        return {"ok": True, "slept_seconds": seconds}


class MissionStore:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _init_db(self) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS missions (
                    mission_id TEXT PRIMARY KEY,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    payload_json TEXT NOT NULL
                )
                """
            )
            conn.commit()

    def save(self, state: MissionState) -> None:
        payload = json.dumps(state.model_dump(), ensure_ascii=False)
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO missions(mission_id, status, created_at, updated_at, payload_json)
                VALUES(?,?,?,?,?)
                ON CONFLICT(mission_id) DO UPDATE SET
                    status=excluded.status,
                    updated_at=excluded.updated_at,
                    payload_json=excluded.payload_json
                """,
                (state.mission_id, state.status, state.created_at, state.updated_at, payload),
            )
            conn.commit()

    def get(self, mission_id: str) -> Optional[MissionState]:
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute(
                "SELECT payload_json FROM missions WHERE mission_id = ?",
                (mission_id,),
            ).fetchone()
        if not row:
            return None
        return MissionState(**json.loads(row[0]))

    def list_recent(self, limit: int = 20) -> List[MissionState]:
        with sqlite3.connect(self.db_path) as conn:
            rows = conn.execute(
                "SELECT payload_json FROM missions ORDER BY updated_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [MissionState(**json.loads(row[0])) for row in rows]


class MissionEngine:
    def __init__(self, store: MissionStore, tools: ToolRegistry) -> None:
        self.store = store
        self.tools = tools
        self.queue: asyncio.Queue[str] = asyncio.Queue()
        self._worker: Optional[asyncio.Task] = None

    def default_steps(self, request: MissionRequest) -> List[MissionStepState]:
        query_lower = request.query.lower()
        steps: List[MissionStepState] = [
            MissionStepState(index=1, name="Health check mission service", tool="sleep", params={"seconds": 0.1}),
        ]

        if "excel" in query_lower:
            steps.append(
                MissionStepState(
                    index=len(steps) + 1,
                    name="Generate Excel artifact",
                    tool="python_script",
                    params={"script": "investor-pack/build_investor_excel.py"},
                )
            )
        if "publish" in query_lower or "blog" in query_lower:
            steps.append(
                MissionStepState(
                    index=len(steps) + 1,
                    name="Publish artifact workflow",
                    tool="python_script",
                    params={"script": "investor-pack/publish_investor_boardgrade.py"},
                )
            )

        if not request.steps and len(steps) == 1:
            steps.append(
                MissionStepState(
                    index=2,
                    name="Route and verify request context",
                    tool="sleep",
                    params={"seconds": 0.2},
                )
            )

        return steps

    def build_steps(self, request: MissionRequest) -> List[MissionStepState]:
        if request.steps:
            return [
                MissionStepState(index=i + 1, name=s.name, tool=s.tool, params=s.params)
                for i, s in enumerate(request.steps)
            ]
        return self.default_steps(request)

    async def submit(self, request: MissionRequest) -> MissionState:
        mission_id = f"msn_{uuid.uuid4().hex[:12]}"
        created = utc_now()
        state = MissionState(
            mission_id=mission_id,
            status="queued",
            created_at=created,
            updated_at=created,
            request=request,
            steps=self.build_steps(request),
            result={"message": "Mission queued"},
        )
        self.store.save(state)
        await self.queue.put(mission_id)
        logger.info(f"Queued mission {mission_id}")
        return state

    async def resume(self, mission_id: str) -> MissionState:
        state = self.store.get(mission_id)
        if not state:
            raise HTTPException(status_code=404, detail="Mission not found")
        if state.status not in ["failed", "paused", "queued"]:
            return state
        state.status = "queued"
        state.updated_at = utc_now()
        self.store.save(state)
        await self.queue.put(mission_id)
        return state

    async def run_worker(self) -> None:
        logger.info("Mission worker started")
        while True:
            mission_id = await self.queue.get()
            try:
                await self.execute_mission(mission_id)
            except Exception as exc:
                logger.exception(f"Mission worker error for {mission_id}: {exc}")
            finally:
                self.queue.task_done()

    async def execute_mission(self, mission_id: str) -> None:
        state = self.store.get(mission_id)
        if not state:
            return

        state.status = "running"
        state.updated_at = utc_now()
        self.store.save(state)

        max_retries = max(0, state.request.max_retries)
        for step in state.steps:
            if step.status == "completed":
                continue

            step.status = "running"
            step.started_at = utc_now()
            state.updated_at = utc_now()
            self.store.save(state)

            success = False
            last_error = None
            for attempt in range(max_retries + 1):
                step.retries = attempt
                try:
                    output = await self.tools.execute(step.tool, step.params)
                    step.output = output
                    if output.get("ok", True):
                        success = True
                        break
                    last_error = output.get("error", "Tool returned not ok")
                except Exception as exc:
                    last_error = str(exc)

            step.ended_at = utc_now()
            if success:
                step.status = "completed"
                step.error = None
            else:
                step.status = "failed"
                step.error = last_error or "Unknown error"
                state.status = "failed"
                state.updated_at = utc_now()
                state.result = {"message": "Mission failed", "failed_step": step.index, "error": step.error}
                self.store.save(state)
                return

            state.updated_at = utc_now()
            self.store.save(state)

        state.status = "completed"
        state.updated_at = utc_now()
        state.result = {
            "message": "Mission completed",
            "completed_steps": len([s for s in state.steps if s.status == "completed"]),
            "total_steps": len(state.steps),
        }
        self.store.save(state)


app = FastAPI(title="Ocean Mission Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

store = MissionStore(DB_PATH)
tools = ToolRegistry()
engine = MissionEngine(store, tools)


@app.on_event("startup")
async def startup_event() -> None:
    if engine._worker is None:
        engine._worker = asyncio.create_task(engine.run_worker())
    logger.info(f"Ocean Mission Service started on port {PORT}")


@app.get("/")
async def root() -> Dict[str, Any]:
    return {
        "service": "ocean-mission-service",
        "status": "online",
        "version": "1.0.0",
        "endpoints": ["/health", "/missions/submit", "/missions/{mission_id}", "/missions/tools"],
    }


@app.get("/health")
async def health() -> Dict[str, Any]:
    return {
        "status": "healthy",
        "service": "ocean-mission-service",
        "queue_size": engine.queue.qsize(),
        "db_path": str(DB_PATH),
        "timestamp": utc_now(),
    }


@app.get("/missions/tools")
async def mission_tools() -> Dict[str, Any]:
    return {"tools": tools.list_tools()}


@app.post("/missions/submit")
async def submit_mission(request: MissionRequest) -> Dict[str, Any]:
    mission = await engine.submit(request)
    return {"mission_id": mission.mission_id, "status": mission.status, "created_at": mission.created_at}


@app.get("/missions/{mission_id}")
async def get_mission(mission_id: str) -> Dict[str, Any]:
    mission = store.get(mission_id)
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    return mission.model_dump()


@app.post("/missions/{mission_id}/resume")
async def resume_mission(mission_id: str) -> Dict[str, Any]:
    mission = await engine.resume(mission_id)
    return {"mission_id": mission.mission_id, "status": mission.status, "updated_at": mission.updated_at}


@app.get("/missions")
async def list_missions(limit: int = 20) -> Dict[str, Any]:
    missions = store.list_recent(limit=max(1, min(limit, 200)))
    return {"missions": [m.model_dump() for m in missions], "count": len(missions)}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=PORT)
