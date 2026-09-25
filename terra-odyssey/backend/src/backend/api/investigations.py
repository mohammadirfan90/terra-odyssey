"""Investigation creation, polling, series, map grid, evidence, and export API endpoints."""

from __future__ import annotations

import gzip
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Header, Query, Request, Response, status
from fastapi.responses import JSONResponse

from backend.errors import (
    DataUnavailableError,
    InvestigationConflictError,
    InvestigationNotFoundError,
    TerraOdysseyError,
)
from backend.schemas import (
    InvestigationRequest,
    JobStatusResponse,
)
from backend.exporter import build_export_bundle
from backend.store import JobStore
from backend.worker import enqueue_job

logger = logging.getLogger("terra_odyssey.backend.api.investigations")
router = APIRouter(prefix="/investigations", tags=["Investigations"])


@router.post("", status_code=status.HTTP_202_ACCEPTED, response_model=JobStatusResponse)
async def create_investigation(
    request: InvestigationRequest,
    response: Response,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
) -> JobStatusResponse:
    """Create a new asynchronous reproducible investigation job."""
    store = JobStore()
    req_dict = request.model_dump()

    job = store.create_job(req_dict, idempotency_key=idempotency_key)
    job_id = job["job_id"]

    # If newly submitted, enqueue for worker execution
    if job["job_status"] == "submitted":
        enqueued = await enqueue_job(job_id, req_dict)
        if not enqueued:
            raise TerraOdysseyError(
                "Investigation queue is at maximum capacity; please retry shortly.",
                status_code=429,
                code="queue_full",
                retryable=True,
            )

    response.headers["Location"] = f"/api/investigations/{job_id}"
    return JobStatusResponse(
        job_id=job["job_id"],
        job_status=job["job_status"],
        stage=job["stage"],
        result_status=job.get("result_status"),
        progress_pct=job.get("progress_pct", 0),
        created_at=job["created_at"],
        started_at=job.get("started_at"),
        completed_at=job.get("completed_at"),
        updated_at=job.get("updated_at"),
        error=job.get("error"),
    )


@router.get("/{job_id}", response_model=JobStatusResponse)
async def get_investigation_status(job_id: str) -> JobStatusResponse:
    """Fetch current status and progress of an investigation job."""
    store = JobStore()
    job = store.get_job(job_id)
    if not job:
        raise InvestigationNotFoundError(f"Investigation job '{job_id}' not found.")

    return JobStatusResponse(
        job_id=job["job_id"],
        job_status=job["job_status"],
        stage=job["stage"],
        result_status=job.get("result_status"),
        progress_pct=job.get("progress_pct", 0),
        created_at=job["created_at"],
        started_at=job.get("started_at"),
        completed_at=job.get("completed_at"),
        updated_at=job.get("updated_at"),
        error=job.get("error"),
    )


@router.delete("/{job_id}", status_code=status.HTTP_202_ACCEPTED)
async def cancel_investigation(job_id: str) -> Dict[str, Any]:
    """Request cooperative cancellation of a submitted or running job."""
    store = JobStore()
    job = store.get_job(job_id)
    if not job:
        raise InvestigationNotFoundError(f"Investigation job '{job_id}' not found.")

    cancelled = store.request_cancellation(job_id)
    return {
        "job_id": job_id,
        "cancellation_requested": cancelled,
        "current_status": "cancel_requested" if cancelled else job["job_status"],
    }


@router.get("/{job_id}/series")
async def get_investigation_series(job_id: str) -> Dict[str, Any]:
    """Retrieve extracted regional time series data and coverage metrics."""
    store = JobStore()
    job = store.get_job(job_id)
    if not job:
        raise InvestigationNotFoundError(f"Investigation job '{job_id}' not found.")

    if job["job_status"] != "succeeded":
        raise InvestigationConflictError(
            f"Investigation '{job_id}' is not yet complete (status={job['job_status']}).",
        )

    art_dir = Path(job["artifacts_dir"])
    csv_file = art_dir / "region_time_series.csv"
    if not csv_file.is_file():
        raise InvestigationNotFoundError("Time series artifact not found for this investigation.")

    import pandas as pd
    df = pd.read_csv(csv_file)
    records = df.to_dict(orient="records")

    return {
        "job_id": job_id,
        "columns": list(df.columns),
        "data": records,
    }


@router.get("/{job_id}/evidence")
async def get_investigation_evidence(job_id: str) -> Dict[str, Any]:
    """Retrieve statistical evidence, effect estimates, and scientific caveats."""
    store = JobStore()
    job = store.get_job(job_id)
    if not job:
        raise InvestigationNotFoundError(f"Investigation job '{job_id}' not found.")

    if job["job_status"] != "succeeded":
        raise InvestigationConflictError(
            f"Investigation '{job_id}' is not yet complete (status={job['job_status']}).",
        )

    art_dir = Path(job["artifacts_dir"])
    res_file = art_dir / "analysis_results.json"
    if not res_file.is_file():
        raise InvestigationNotFoundError("Analysis results artifact not found for this investigation.")

    with open(res_file, "r", encoding="utf-8") as f:
        results = json.load(f)

    return {
        "job_id": job_id,
        "result_status": job.get("result_status"),
        "results": results,
    }


@router.get("/{job_id}/map")
async def get_investigation_map(
    job_id: str,
    request: Request,
    bbox: Optional[str] = Query(None, description="Optional bounding box: min_lon,min_lat,max_lon,max_lat"),
    max_cells: int = Query(10000, ge=10, le=100000, description="Maximum cells ceiling for downsampling"),
) -> Response:
    """Retrieve structured 2D gridded trend field with stride thinning and frozen FDR legend."""
    store = JobStore()
    job = store.get_job(job_id)
    if not job:
        raise InvestigationNotFoundError(f"Investigation job '{job_id}' not found.")

    if job["job_status"] != "succeeded":
        raise InvestigationConflictError(
            f"Investigation '{job_id}' is not yet complete (status={job['job_status']}).",
        )

    art_dir = Path(job["artifacts_dir"])
    map_file = art_dir / "map_grid.json.gz"
    if not map_file.is_file():
        raise InvestigationNotFoundError("Map grid artifact not found for this investigation.")

    with gzip.open(map_file, "rt", encoding="utf-8") as f:
        grid_data = json.load(f)

    lats = grid_data["grid"]["latitude"]
    lons = grid_data["grid"]["longitude"]

    # Filter bbox if requested
    if bbox:
        try:
            min_lon, min_lat, max_lon, max_lat = [float(x.strip()) for x in bbox.split(",")]
            lat_indices = [i for i, lat in enumerate(lats) if min_lat <= lat <= max_lat]
            lon_indices = [j for j, lon in enumerate(lons) if min_lon <= lon <= max_lon]
        except Exception:
            raise TerraOdysseyError(
                "Invalid bbox query parameter. Format: min_lon,min_lat,max_lon,max_lat",
                status_code=400,
                code="invalid_bbox",
            )
    else:
        lat_indices = list(range(len(lats)))
        lon_indices = list(range(len(lons)))

    total_cells = len(lat_indices) * len(lon_indices)

    # Downsampling by stride if exceeding max_cells ceiling
    if total_cells > max_cells:
        import numpy as np
        stride = int(np.ceil(np.sqrt(total_cells / max_cells)))
        lat_indices = lat_indices[::stride]
        lon_indices = lon_indices[::stride]

    filtered_lats = [lats[i] for i in lat_indices]
    filtered_lons = [lons[j] for j in lon_indices]

    # Re-slice bands
    orig_width = grid_data["grid"]["width"]
    filtered_bands = {}
    for band_name, band_vals in grid_data.get("bands", {}).items():
        new_vals = []
        for i in lat_indices:
            for j in lon_indices:
                idx = i * orig_width + j
                val = band_vals[idx] if idx < len(band_vals) else None
                # None translates to JSON null
                new_vals.append(val)
        filtered_bands[band_name] = new_vals

    result = {
        "grid": {
            "crs": grid_data["grid"].get("crs", "EPSG:4326"),
            "width": len(filtered_lons),
            "height": len(filtered_lats),
            "longitude": filtered_lons,
            "latitude": filtered_lats,
            "order": "latitude_longitude",
        },
        "bands": filtered_bands,
        "legend": grid_data["legend"],
        "provenance": grid_data["provenance"],
    }

    accept_encoding = request.headers.get("accept-encoding", "").lower()
    if "gzip" in accept_encoding:
        json_bytes = json.dumps(result).encode("utf-8")
        compressed_bytes = gzip.compress(json_bytes)
        return Response(
            content=compressed_bytes,
            media_type="application/json",
            headers={"Content-Encoding": "gzip"},
        )

    return JSONResponse(content=result)



@router.get("/{job_id}/export")
async def get_investigation_export(
    job_id: str,
    format: str = Query("zip", pattern="^(zip|json|timeseries_csv)$", description="Export bundle format"),
) -> Response:
    """Download frozen investigation record bundle as ZIP, root JSON, or CSV."""
    store = JobStore()
    job = store.get_job(job_id)
    if not job:
        raise InvestigationNotFoundError(f"Investigation job '{job_id}' not found.")

    if job["job_status"] != "succeeded":
        raise InvestigationConflictError(
            f"Investigation '{job_id}' is not yet complete (status={job['job_status']}).",
        )

    art_dir = Path(job["artifacts_dir"])

    if format == "json":
        rec_file = art_dir / "investigation_record.json"
        if not rec_file.is_file():
            raise InvestigationNotFoundError("Investigation record artifact not found.")
        with open(rec_file, "r", encoding="utf-8") as f:
            return JSONResponse(content=json.load(f))

    elif format == "timeseries_csv":
        csv_file = art_dir / "region_time_series.csv"
        if not csv_file.is_file():
            raise InvestigationNotFoundError("Time series CSV artifact not found.")
        return Response(
            content=csv_file.read_bytes(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=region_time_series_{job_id}.csv"},
        )

    else:  # zip
        zip_bytes = build_export_bundle(job_id, art_dir)
        return Response(
            content=zip_bytes,
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename=terra-odyssey-investigation-{job_id}.zip"},
        )

