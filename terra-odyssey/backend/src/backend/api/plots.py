"""Study region plot persistence API endpoints backed by SQLite."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, status

from backend.schemas import StudyPlotCreate, StudyPlotResponse
from backend.store import JobStore

logger = logging.getLogger("terra_odyssey.backend.api.plots")
router = APIRouter(prefix="/plots", tags=["Plots"])


@router.get("", response_model=List[StudyPlotResponse])
async def list_plots(
    limit: int = Query(50, ge=1, le=200, description="Max plots to return"),
) -> List[StudyPlotResponse]:
    """List saved study region plots from SQLite, newest first."""
    store = JobStore()
    plots = store.list_study_plots(limit=limit)
    return [StudyPlotResponse(**p) for p in plots]


@router.get("/active", response_model=Optional[StudyPlotResponse])
async def get_active_plot() -> Optional[StudyPlotResponse]:
    """Retrieve the currently active study region plot from SQLite."""
    store = JobStore()
    plot = store.get_active_study_plot()
    if not plot:
        return None
    return StudyPlotResponse(**plot)


@router.get("/{plot_id}", response_model=StudyPlotResponse)
async def get_plot(plot_id: str) -> StudyPlotResponse:
    """Retrieve a specific study region plot from SQLite by ID."""
    store = JobStore()
    plot = store.get_study_plot(plot_id)
    if not plot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Study plot '{plot_id}' not found",
        )
    return StudyPlotResponse(**plot)


@router.post("", response_model=StudyPlotResponse, status_code=status.HTTP_201_CREATED)
async def upsert_plot(plot_in: StudyPlotCreate) -> StudyPlotResponse:
    """Create or update a study region plot in SQLite."""
    store = JobStore()
    plot_dict = plot_in.model_dump()
    saved = store.upsert_study_plot(plot_dict)
    return StudyPlotResponse(**saved)


@router.delete("/{plot_id}")
async def delete_plot(plot_id: str) -> Dict[str, Any]:
    """Delete a study region plot from SQLite."""
    store = JobStore()
    deleted = store.delete_study_plot(plot_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Study plot '{plot_id}' not found",
        )
    return {"status": "deleted", "plot_id": plot_id}


@router.delete("")
async def clear_plots() -> Dict[str, Any]:
    """Clear all study region plots from SQLite."""
    store = JobStore()
    count = store.clear_study_plots()
    return {"status": "cleared", "count": count}
