"""Catalog and Capabilities API endpoints for Terra Odyssey."""

from __future__ import annotations

import json
import os
import platform
import sys
from pathlib import Path
from typing import Dict, Optional
from fastapi import APIRouter

from backend.paths import DATA_DIR
from backend.schemas import (
    CapabilitiesResponse,
    CatalogResponse,
    DatasetCatalogItem,
)

router = APIRouter(tags=["Catalog"])


def find_manifests_dir() -> Path:
    """Return the backend-owned manifest directory independent of the process CWD."""
    return DATA_DIR / "manifests"


def load_manifest(filename: str) -> Optional[dict]:
    manifests_dir = find_manifests_dir()
    target = manifests_dir / filename
    if target.is_file():
        try:
            with open(target, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None
    return None


from data.registry import build_catalog_items, get_dataset_availability
from backend.schemas import DatasetAvailabilityResponse


@router.get("/catalog", response_model=CatalogResponse)
async def get_catalog() -> CatalogResponse:
    """Return reviewed NASA Earth observation datasets, quality policies, capabilities, and limits."""
    datasets = build_catalog_items()

    defaults = {
        "dataset_id": "merra2_t2m",
        "variable": "T2M",
        "temporal_aggregation": "annual_mean",
        "spatial_aggregation": "area_weighted",
        "estimator_family": "ols_hac",
        "hac_lag": 2,
        "fdr_method": "fdr_by",
        "fdr_level": 0.05,
        "execution_mode": "auto",
        "selection_status": "predefined",
    }

    return CatalogResponse(
        datasets=datasets,
        defaults=defaults,
        supported_estimators=["ols_hac"],
        supported_aggregations=["annual_mean", "annual_total", "seasonal"],
    )


@router.get("/catalog/{dataset_id}/availability", response_model=DatasetAvailabilityResponse)
async def get_availability(dataset_id: str) -> DatasetAvailabilityResponse:
    """Return archive availability timeline, completeness metrics, and statistical eligibility spans."""
    return get_dataset_availability(dataset_id)


@router.get("/capabilities", response_model=CapabilitiesResponse)
async def get_capabilities() -> CapabilitiesResponse:
    """Return runtime execution modes, environment information, and cached assets."""
    has_creds = bool(
        os.environ.get("EARTHDATA_TOKEN")
        or os.environ.get("EARTHDATA_USERNAME")
        or (Path.home() / ".netrc").is_file()
    )

    # Check sample data availability
    manifests_dir = find_manifests_dir()
    samples_dir = manifests_dir.parent / "samples"
    sample_files = []
    if samples_dir.is_dir():
        sample_files = [f.name for f in samples_dir.glob("*.nc4")] + [f.name for f in samples_dir.glob("*.HDF5")]

    return CapabilitiesResponse(
        execution_modes=["auto", "live", "cached_only", "demo_sample"],
        system_version="0.1.0",
        environment={
            "python_version": sys.version.split()[0],
            "platform": platform.platform(),
            "has_earthdata_creds": has_creds,
        },
        cached_granules={
            "sample_granules_count": len(sample_files),
            "sample_files": sample_files,
        },
    )
