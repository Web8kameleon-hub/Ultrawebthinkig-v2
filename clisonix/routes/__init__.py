"""Route registration utilities for the clisonix standalone services."""

import logging
from typing import Any

from fastapi import FastAPI

from .status import router as status_router

logger = logging.getLogger(__name__)

ingest_router: Any = None
super_router: Any = None

try:  # Prefer ingest routes when they are available
    from .ingest import router as ingest_router  # type: ignore
except ImportError as exc:  # pragma: no cover - optional module
    ingest_router = None
    logger.warning("Skipping ingest routes: %s", exc)

try:
    from .super import router as super_router
except ImportError as exc:  # pragma: no cover - optional module
    super_router = None
    logger.warning("Skipping super routes: %s", exc)


def register_routes(app: FastAPI) -> None:
    """Attach all routers to the provided FastAPI app."""

    app.include_router(status_router)
    if ingest_router is not None:
        app.include_router(ingest_router)
    if super_router is not None:
        app.include_router(super_router)

