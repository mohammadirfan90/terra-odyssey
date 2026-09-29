"""Structured-search endpoints (currently: place geocoding)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from backend.places import PhotonGeocoder
from backend.schemas import PlaceSearchResponse

router = APIRouter(prefix="/search", tags=["Search"])


def get_geocoder() -> PhotonGeocoder:
    """Return a request-scoped geocoder built from server-only settings."""
    return PhotonGeocoder.from_settings()


@router.get("/places", response_model=PlaceSearchResponse)
async def search_places(
    q: str = Query(
        ...,
        min_length=2,
        max_length=120,
        description="Free-text place name query (e.g. 'Tokyo', 'Sahara Desert').",
    ),
    limit: int = Query(
        default=8,
        ge=1,
        le=20,
        description="Maximum number of results to return.",
    ),
    geocoder: PhotonGeocoder = Depends(get_geocoder),
) -> PlaceSearchResponse:
    """Forward a place-name query to the configured geocoder.

    Returns a normalized response. On upstream failures the ``results``
    list will be empty so the frontend can degrade gracefully while the
    rest of the app (local catalog search, NIM AI) keeps working.
    """
    clean = q.strip()
    if len(clean) < 2:
        # Reachable only if a future caller bypasses the Query() validator
        # (e.g. internal calls). FastAPI's Query(min_length=2) already
        # rejects this at the request boundary with 422 problem+json.
        return PlaceSearchResponse(query=clean or " ", results=[])

    results = await geocoder.search(clean)
    # Honor the caller's ``limit`` even if the upstream returned more.
    if len(results) > limit:
        results = results[:limit]

    return PlaceSearchResponse(query=clean, results=results)
