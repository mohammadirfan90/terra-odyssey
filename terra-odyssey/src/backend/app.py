"""FastAPI application factory and main application entrypoint for Terra Odyssey."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.backend.api.catalog import router as catalog_router
from src.backend.errors import register_error_handlers


def create_app() -> FastAPI:
    """Create and configure the Terra Odyssey FastAPI application."""
    app = FastAPI(
        title="Terra Odyssey Scientific API",
        version="0.1.0",
        description="NASA Earth System Trend Detective API and Reproducible Investigation Orchestrator",
        docs_url="/docs",
        redoc_url="/redoc",
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

    @app.get("/api/health", tags=["Health"])
    async def health_check() -> dict:
        return {"status": "ok", "version": "0.1.0"}

    return app


app = create_app()
