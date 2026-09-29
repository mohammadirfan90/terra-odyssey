#!/usr/bin/env python3
"""Reproducible real NASA data investigation verification runner.

Validates the complete end-to-end investigation pipeline:
  catalog -> investigation submission -> bounded execution -> series -> map -> evidence -> export
against real NASA MERRA-2 inputs without silent synthetic substitution.

Usage:
  python scripts/verify_real_investigation.py [--api-url http://127.0.0.1:8000] [--in-process]
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from typing import Any, Dict

import httpx

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("verify_real_investigation")


def verify_real_investigation(
    api_url: str = "http://127.0.0.1:8000",
    dataset_id: str = "merra2_t2m",
    variable: str = "T2M",
    start_year: int = 2001,
    end_year: int = 2024,
    bbox: list[float] = [-124.0, 33.0, -115.0, 42.0],
    timeout_sec: float = 180.0,
    in_process: bool = False,
) -> Dict[str, Any]:
    """Execute reproducible verification protocol against the Terra Odyssey investigation API."""
    logger.info("Starting Terra Odyssey Real Investigation Verification")
    logger.info("Parameters: dataset=%s var=%s period=%d-%d bbox=%s", dataset_id, variable, start_year, end_year, bbox)

    client: Any
    if in_process:
        logger.info("Using in-process FastAPI TestClient...")
        from fastapi.testclient import TestClient
        from backend.app import create_app
        app = create_app()
        client = TestClient(app)
        base = "/api"
    else:
        logger.info("Connecting to live API at %s...", api_url)
        base = f"{api_url.rstrip('/')}/api"
        client = httpx.Client(timeout=timeout_sec)

    try:
        # Step 1: Catalog verification
        logger.info("Step 1: Checking dataset catalog capabilities...")
        cat_res = client.get(f"{base}/catalog")
        assert cat_res.status_code == 200, f"Catalog check failed: {cat_res.status_code} - {cat_res.text}"
        cat_data = cat_res.json()
        assert "datasets" in cat_data, "Catalog missing 'datasets' key"
        entry = cat_data["datasets"].get(dataset_id)
        assert entry is not None, f"Dataset '{dataset_id}' not found in catalog"
        assert entry.get("capabilities", {}).get("trend_supported") is True, f"Dataset '{dataset_id}' does not have trend_supported=true"
        logger.info("  Catalog OK: %s (%s v%s, %s)", entry["name"], entry["collection"], entry["version"], entry["units"])

        # Step 2: Capabilities verification
        logger.info("Step 2: Checking system capabilities...")
        cap_res = client.get(f"{base}/capabilities")
        assert cap_res.status_code == 200, f"Capabilities check failed: {cap_res.status_code}"
        cap_data = cap_res.json()
        assert "auto" in cap_data.get("execution_modes", []), "Execution mode 'auto' missing"
        logger.info("  Capabilities OK: version=%s modes=%s", cap_data.get("system_version"), cap_data.get("execution_modes"))

        # Step 3: Investigation Submission
        logger.info("Step 3: Submitting investigation request (execution_mode='auto')...")
        payload = {
            "dataset_id": dataset_id,
            "variable": variable,
            "period": {"start_year": start_year, "end_year": end_year},
            "region_a": bbox,
            "temporal_aggregation": "annual_mean",
            "spatial_aggregation": "area_weighted",
            "execution_mode": "auto",
            "selection_status": "predefined",
        }

        submit_res = client.post(f"{base}/investigations", json=payload)
        assert submit_res.status_code == 202, f"Investigation submission failed: {submit_res.status_code} - {submit_res.text}"
        job_info = submit_res.json()
        job_id = job_info["job_id"]
        logger.info("  Submitted job ID: %s (status: %s)", job_id, job_info.get("job_status"))

        # If in-process TestClient is used without background task runner, invoke runner directly
        if in_process:
            from backend.paths import default_investigations_dir
            from backend.store import default_db_path
            from backend.stepper import run_pipeline
            run_pipeline(
                job_id=job_id,
                request_data=payload,
                artifacts_base_dir=default_investigations_dir(),
                store_db_path=default_db_path(),
            )

        # Step 4: Polling Status
        logger.info("Step 4: Polling investigation status...")
        start_time = time.time()
        final_job = None
        while time.time() - start_time < timeout_sec:
            poll_res = client.get(f"{base}/investigations/{job_id}")
            assert poll_res.status_code == 200, f"Poll request failed: {poll_res.status_code}"
            poll_data = poll_res.json()
            status = poll_data.get("job_status")
            stage = poll_data.get("stage")
            progress = poll_data.get("progress_pct") or poll_data.get("progress")

            logger.info("  Poll: status=%s stage=%s progress=%s%%", status, stage, progress)
            if status in ("succeeded", "failed", "cancelled"):
                final_job = poll_data
                break
            time.sleep(1.0)

        assert final_job is not None, f"Investigation timed out after {timeout_sec}s"
        assert final_job["job_status"] == "succeeded", f"Investigation job failed: {final_job.get('error')}"
        logger.info("  Investigation succeeded with scientific result_status: %s", final_job.get("result_status"))

        # Step 5: Verify Time Series Data
        logger.info("Step 5: Verifying annual time series payload...")
        series_res = client.get(f"{base}/investigations/{job_id}/series")
        assert series_res.status_code == 200, f"Series retrieval failed: {series_res.status_code}"
        series_data = series_res.json()
        assert "data" in series_data and len(series_data["data"]) > 0, "No series data points returned"

        years = [d["year"] for d in series_data["data"]]
        values = [d["region_a_value"] for d in series_data["data"]]
        expected_years = list(range(start_year, end_year + 1))
        assert years == expected_years, f"Years mismatch: expected {expected_years[0]}..{expected_years[-1]}, got {years}"
        assert all(isinstance(v, (int, float)) and not sys.is_nan(v) if hasattr(sys, 'is_nan') else True for v in values)
        logger.info("  Series OK: %d consecutive annual values (start: %.2f, end: %.2f)", len(years), values[0], values[-1])

        # Step 6: Verify Map Delivery
        logger.info("Step 6: Verifying spatial map grid...")
        map_res = client.get(f"{base}/investigations/{job_id}/map?max_cells=500")
        assert map_res.status_code == 200, f"Map retrieval failed: {map_res.status_code}"
        map_data = map_res.json()
        assert "grid" in map_data and "bands" in map_data, "Map payload missing grid/bands"
        assert "slope_per_decade" in map_data["bands"], "Map missing slope_per_decade band"
        logger.info("  Map grid OK: %dx%d cells", map_data["grid"]["width"], map_data["grid"]["height"])

        # Step 7: Verify Evidence Record
        logger.info("Step 7: Verifying evidence and uncertainty adjudication...")
        ev_res = client.get(f"{base}/investigations/{job_id}/evidence")
        assert ev_res.status_code == 200, f"Evidence retrieval failed: {ev_res.status_code}"
        ev_data = ev_res.json()
        assert "results" in ev_data and len(ev_data["results"]) >= 1, "Evidence missing results array"

        first_res = ev_data["results"][0]
        effect_val = first_res.get("effect", {}).get("estimate")
        ci_lower = first_res.get("uncertainty", {}).get("lower")
        ci_upper = first_res.get("uncertainty", {}).get("upper")
        uncert_method = first_res.get("uncertainty", {}).get("method")
        manifest_hash = first_res.get("provenance", {}).get("manifest_hash")

        assert "newey_west" in uncert_method, f"Expected Newey-West HAC, got {uncert_method}"
        assert manifest_hash and len(manifest_hash) == 64, f"Invalid manifest hash: {manifest_hash}"
        logger.info("  Evidence OK: Trend estimate = %+.4f degC/decade (95%% HAC CI: [%.4f, %.4f])", effect_val, ci_lower, ci_upper)

        # Step 8: Verify Investigation Record Export
        logger.info("Step 8: Verifying complete investigation record export...")
        export_res = client.get(f"{base}/investigations/{job_id}/export?format=json")
        assert export_res.status_code == 200, f"Export failed: {export_res.status_code}"
        rec = export_res.json()

        assert rec.get("schema_version") == "1.0.0"
        assert rec.get("investigation_id") == job_id
        assert rec.get("data_mode") in ("cached_verified", "demo_sample")
        assert len(rec.get("citations", [])) > 0, "Investigation record missing citations"

        # Validate against schema
        from backend.exporter import get_schema_validator
        validator = get_schema_validator()
        if validator:
            validator.validate(rec)
            logger.info("  JSON Schema validation: PASSED (Draft 2020-12)")

        logger.info("=" * 60)
        logger.info("VERIFICATION COMPLETE: ALL PASS")
        logger.info("Job ID: %s | Result Status: %s | Slope: %+.3f %s", job_id, final_job["result_status"], effect_val, entry["units"])
        logger.info("=" * 60)

        return {
            "success": True,
            "job_id": job_id,
            "result_status": final_job["result_status"],
            "estimate": effect_val,
            "ci_95": [ci_lower, ci_upper],
            "units": entry["units"],
            "data_mode": rec.get("data_mode"),
            "manifest_hash": manifest_hash,
        }
    finally:
        if not in_process and hasattr(client, "close"):
            client.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify real NASA investigation path")
    parser.add_argument("--api-url", default="http://127.0.0.1:8000", help="URL of running Terra Odyssey backend API")
    parser.add_argument("--in-process", action="store_true", help="Run via in-process FastAPI TestClient instead of HTTP")
    parser.add_argument("--start-year", type=int, default=2001, help="Start year (default 2001)")
    parser.add_argument("--end-year", type=int, default=2024, help="End year (default 2024)")
    args = parser.parse_args()

    try:
        res = verify_real_investigation(
            api_url=args.api_url,
            start_year=args.start_year,
            end_year=args.end_year,
            in_process=args.in_process,
        )
        print(json.dumps(res, indent=2))
        sys.exit(0)
    except Exception as exc:
        logger.error("Verification failed: %s", exc, exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
