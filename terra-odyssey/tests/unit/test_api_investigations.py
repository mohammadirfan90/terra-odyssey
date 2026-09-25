"""End-to-end API integration tests for investigation lifecycle, map delivery, and export bundling."""

import io
import json
import zipfile
from pathlib import Path
import jsonschema
import pytest
from fastapi.testclient import TestClient

from src.backend.app import create_app
from src.backend.errors import DataUnavailableError
from src.backend.stepper import run_pipeline
from src.backend.store import JobStore


@pytest.fixture
def client(tmp_path, monkeypatch):
    """Create test client backed by temporary SQLite store."""
    db_file = tmp_path / "api_test_jobs.db"
    art_dir = tmp_path / "api_test_artifacts"
    monkeypatch.setattr("src.backend.store.default_db_path", lambda: db_file)
    app = create_app()
    return TestClient(app), db_file, art_dir


def test_investigation_lifecycle_demo_sample(client):
    """Full lifecycle: create -> execute -> poll -> series -> map -> evidence -> export."""
    c, db_file, art_dir = client

    payload = {
        "dataset_id": "merra2_t2m",
        "variable": "T2M",
        "period": {"start_year": 2000, "end_year": 2024},
        "region_a": [-120.0, 35.0, -115.0, 40.0],
        "temporal_aggregation": "annual_mean",
        "spatial_aggregation": "area_weighted",
        "execution_mode": "demo_sample",
        "estimator_family": "ols_hac",
        "selection_status": "predefined",
    }

    # 1. POST /api/investigations (HTTP 202 Accepted)
    res = c.post("/api/investigations", json=payload)
    assert res.status_code == 202
    data = res.json()
    job_id = data["job_id"]
    assert data["job_status"] == "submitted"
    assert res.headers["location"] == f"/api/investigations/{job_id}"

    # Execute pipeline synchronously for test
    run_pipeline(
        job_id=job_id,
        request_data=payload,
        artifacts_base_dir=art_dir,
        store_db_path=db_file,
    )

    # 2. GET /api/investigations/{job_id} (Poll status)
    poll_res = c.get(f"/api/investigations/{job_id}")
    assert poll_res.status_code == 200
    poll_data = poll_res.json()
    assert poll_data["job_status"] == "succeeded"
    assert poll_data["progress_pct"] == 100
    assert poll_data["result_status"] in ("supported", "inconclusive", "ineligible")

    # 3. GET /api/investigations/{job_id}/series
    series_res = c.get(f"/api/investigations/{job_id}/series")
    assert series_res.status_code == 200
    series_data = series_res.json()
    assert "data" in series_data
    assert len(series_data["data"]) == 25  # 2000..2024
    assert "year" in series_data["columns"]
    assert "region_a_value" in series_data["columns"]

    # 4. GET /api/investigations/{job_id}/map?max_cells=500
    map_res = c.get(f"/api/investigations/{job_id}/map?max_cells=500")
    assert map_res.status_code == 200
    map_data = map_res.json()
    assert "grid" in map_data
    assert "bands" in map_data
    assert "legend" in map_data
    total_cells = map_data["grid"]["width"] * map_data["grid"]["height"]
    assert total_cells <= 500
    for expected_band in (
        "slope_per_decade",
        "slope_se_per_decade",
        "ci_lower_per_decade",
        "ci_upper_per_decade",
        "raw_p_value",
        "adjusted_p_value",
        "coverage_fraction",
        "eligibility_code",
        "evidence_code",
    ):
        assert expected_band in map_data["bands"], f"Missing required diagnostic band {expected_band}"

    # Test gzip Content-Encoding when requested
    gzip_map_res = c.get(f"/api/investigations/{job_id}/map?max_cells=500", headers={"Accept-Encoding": "gzip"})
    assert gzip_map_res.status_code == 200
    assert gzip_map_res.headers.get("content-encoding") == "gzip"


    # 5. GET /api/investigations/{job_id}/evidence
    ev_res = c.get(f"/api/investigations/{job_id}/evidence")
    assert ev_res.status_code == 200
    ev_data = ev_res.json()
    assert "results" in ev_data
    assert len(ev_data["results"]) >= 1
    first_res = ev_data["results"][0]
    assert "effect" in first_res
    assert "uncertainty" in first_res
    assert "newey_west" in first_res["uncertainty"]["method"]

    # 6. GET /api/investigations/{job_id}/export?format=json
    json_export = c.get(f"/api/investigations/{job_id}/export?format=json")
    assert json_export.status_code == 200
    record_json = json_export.json()
    assert record_json["schema_version"] == "1.0.0"
    assert record_json["investigation_id"] == job_id

    # 7. GET /api/investigations/{job_id}/export?format=timeseries_csv
    csv_export = c.get(f"/api/investigations/{job_id}/export?format=timeseries_csv")
    assert csv_export.status_code == 200
    assert "year,region_a_value" in csv_export.text

    # 8. GET /api/investigations/{job_id}/export?format=zip
    zip_export = c.get(f"/api/investigations/{job_id}/export?format=zip")
    assert zip_export.status_code == 200
    assert zip_export.headers["content-type"] == "application/zip"

    # Verify ZIP integrity and schema validation
    zf = zipfile.ZipFile(io.BytesIO(zip_export.content))
    namelist = zf.namelist()
    assert "investigation_record.json" in namelist
    assert "resolved_configuration.json" in namelist
    assert "results/analysis_results.json" in namelist
    assert "results/region_time_series.csv" in namelist
    assert "results/map_grid.json.gz" in namelist
    assert "methods/methods.md" in namelist
    assert "report/summary_report.md" in namelist
    assert "software/environment.json" in namelist
    assert "software/version.json" in namelist
    assert "README.md" in namelist
    assert "checksums.sha256" in namelist

    # Validate extracted investigation_record.json against Draft 2020-12
    rec_bytes = zf.read("investigation_record.json")
    rec_obj = json.loads(rec_bytes.decode("utf-8"))
    from src.backend.exporter import get_schema_validator
    validator = get_schema_validator()
    assert validator is not None
    validator.validate(rec_obj)  # Must not raise ValidationError


def test_data_unavailable_cached_only(client):
    """Assert cached_only mode fails with DataUnavailableError when granules are missing."""
    c, db_file, art_dir = client

    payload = {
        "dataset_id": "merra2_t2m",
        "variable": "T2M",
        "period": {"start_year": 1985, "end_year": 2010},
        "region_a": [-120.0, 35.0, -115.0, 40.0],
        "execution_mode": "cached_only",
    }

    # Pipeline raises DataUnavailableError when no cache exists
    with pytest.raises(DataUnavailableError):
        run_pipeline(
            job_id="inv-cache-fail",
            request_data=payload,
            artifacts_base_dir=art_dir,
            store_db_path=db_file,
        )


def test_inconclusive_result_has_succeeded_job_status(client):
    """Assert inconclusive scientific result retains job_status='succeeded'."""
    c, db_file, art_dir = client

    store = JobStore(db_file)
    job = store.create_job({"test": "inconclusive"})

    # Set inconclusive result
    store.set_result(
        job_id=job["job_id"],
        job_status="succeeded",
        result_status="inconclusive",
    )

    res = c.get(f"/api/investigations/{job['job_id']}")
    assert res.status_code == 200
    data = res.json()
    assert data["job_status"] == "succeeded"
    assert data["result_status"] == "inconclusive"


def test_cancellation_endpoint(client):
    """Assert DELETE /api/investigations/{id} requests cancellation."""
    c, db_file, art_dir = client

    store = JobStore(db_file)
    job = store.create_job({"test": "cancel"})

    del_res = c.delete(f"/api/investigations/{job['job_id']}")
    assert del_res.status_code == 202
    del_data = del_res.json()
    assert del_data["cancellation_requested"] is True

    # Polling confirms cancel_requested
    status_res = c.get(f"/api/investigations/{job['job_id']}")
    assert status_res.json()["job_status"] == "cancel_requested"
