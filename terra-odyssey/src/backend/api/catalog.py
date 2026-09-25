"""Catalog and Capabilities API endpoints for Terra Odyssey."""

from __future__ import annotations

import json
import os
import platform
import sys
from pathlib import Path
from typing import Dict, Optional
from fastapi import APIRouter

from src.backend.schemas import (
    CapabilitiesResponse,
    CatalogResponse,
    DatasetCatalogItem,
)

router = APIRouter(tags=["Catalog"])


def find_manifests_dir() -> Path:
    """Locate the data/manifests directory across various runtime working directories."""
    candidates = [
        Path(__file__).resolve().parents[3] / "data" / "manifests",
        Path.cwd() / "terra-odyssey" / "data" / "manifests",
        Path.cwd() / "data" / "manifests",
    ]
    for path in candidates:
        if path.is_dir():
            return path
    # Fallback to the first candidate even if missing
    return candidates[0]


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


@router.get("/catalog", response_model=CatalogResponse)
async def get_catalog() -> CatalogResponse:
    """Return reviewed NASA Earth observation datasets, quality policies, and limits."""
    datasets: Dict[str, DatasetCatalogItem] = {}

    d1_data = load_manifest("d1_merra2.json") or {}
    datasets["merra2_t2m"] = DatasetCatalogItem(
        dataset_id="merra2_t2m",
        name="MERRA-2 2-Meter Air Temperature (T2M)",
        collection=d1_data.get("collection", "M2TMNXSLV"),
        version=d1_data.get("version", "5.12.4"),
        source_type=d1_data.get("source_type", "model_reanalysis"),
        variable=d1_data.get("variable", "T2M"),
        units="degC",
        spatial_support=d1_data.get("spatial_support", "global 0.5° latitude × 0.625° longitude grid"),
        temporal_support=d1_data.get("temporal_support", "monthly mean"),
        coverage_start=d1_data.get("coverage_start", "1980-01-01"),
        coverage_end=d1_data.get("coverage_end"),
        quality_policy=d1_data.get("quality_policy", {
            "fill_values": ["preserve source fill value"],
            "mask_description": "Validate source fill and coordinate metadata; model reanalysis without retrieval QA.",
            "qa_fields": []
        }),
        provenance=d1_data.get("provenance", {
            "documentation_urls": ["https://doi.org/10.5067/AP1B0BA5PD2K"],
            "doi": "10.5067/AP1B0BA5PD2K",
            "provider": "NASA GMAO / GES DISC"
        }),
        supported_aggregations=["annual_mean", "seasonal"],
        supported_spatial_aggregations=["area_weighted"],
    )

    d2_data = load_manifest("d2_gpm_imerg.json") or {}
    datasets["gpm_imerg_precipitation"] = DatasetCatalogItem(
        dataset_id="gpm_imerg_precipitation",
        name="GPM IMERG Final Precipitation Rate",
        collection=d2_data.get("collection", "GPM_3IMERGM"),
        version=d2_data.get("version", "07"),
        source_type=d2_data.get("source_type", "mission_product"),
        variable=d2_data.get("variable", "precipitationCal"),
        units="mm/year",
        spatial_support=d2_data.get("spatial_support", "global 0.1° geographic grid"),
        temporal_support=d2_data.get("temporal_support", "monthly mean rate; convert with exact calendar-month hours"),
        coverage_start=d2_data.get("coverage_start", "2000-06-01"),
        coverage_end=d2_data.get("coverage_end"),
        quality_policy=d2_data.get("quality_policy", {
            "fill_values": ["preserve source fill value"],
            "mask_description": "Use valid source values and preserve release-specific uncertainty fields.",
            "qa_fields": ["release-specific quality/uncertainty fields"]
        }),
        provenance=d2_data.get("provenance", {
            "documentation_urls": ["https://doi.org/10.5067/GPM/IMERG/3B-MONTH/07"],
            "doi": "10.5067/GPM/IMERG/3B-MONTH/07",
            "provider": "NASA GPM / GES DISC"
        }),
        supported_aggregations=["annual_total", "seasonal"],
        supported_spatial_aggregations=["area_weighted"],
    )

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
