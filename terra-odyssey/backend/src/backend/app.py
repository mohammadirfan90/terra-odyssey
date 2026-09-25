"""FastAPI application factory and main application entrypoint for Terra Odyssey."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.catalog import router as catalog_router
from backend.api.investigations import router as investigations_router
from backend.errors import register_error_handlers
from backend.paths import ENV_FILE
from backend.store import JobStore
from backend.worker import start_worker_task, stop_worker_task

load_dotenv(ENV_FILE, override=False)

logger = logging.getLogger("terra_odyssey.backend.app")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage application startup and shutdown lifecycles."""
    logger.info("Initializing Terra Odyssey application lifespan")
    # Initialize SQLite store and recover any interrupted jobs from previous run
    store = JobStore()
    recovered = store.recover_interrupted_jobs()
    if recovered > 0:
        logger.warning("Recovered %d interrupted job(s) from previous server execution", recovered)

    # Launch bounded queue worker task
    worker_task = start_worker_task()
    logger.info("Job queue worker task started: %s", worker_task)

    try:
        yield
    finally:
        logger.info("Shutting down Terra Odyssey application lifespan")
        await stop_worker_task()
        logger.info("Job queue worker shut down cleanly")


def create_app() -> FastAPI:
    """Create and configure the Terra Odyssey FastAPI application."""
    app = FastAPI(
        title="Terra Odyssey Scientific API",
        version="0.1.0",
        description="NASA Earth System Trend Detective API and Reproducible Investigation Orchestrator",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # Enable CORS for local web dev and dashboard
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register RFC 9457 Problem Details handlers
    register_error_handlers(app)

    # Mount API routes
    app.include_router(catalog_router, prefix="/api")
    app.include_router(investigations_router, prefix="/api")

    @app.get("/api/health", tags=["Health"])
    async def health_check() -> dict:
        return {"status": "ok", "version": "0.1.0"}

    return app


app = create_app()
