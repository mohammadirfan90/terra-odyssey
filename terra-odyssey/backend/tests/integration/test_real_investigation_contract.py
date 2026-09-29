from scripts.verify_real_investigation import verify_real_investigation


def test_real_merra2_investigation_end_to_end():
    """Verify that a real MERRA-2 T2M investigation runs without synthetic data,

    producing valid annual series, decimated map grids, HAC uncertainty,
    and schema-valid investigation record export.
    """
    res = verify_real_investigation(
        dataset_id="merra2_t2m",
        variable="T2M",
        start_year=2001,
        end_year=2024,
        bbox=[-124.0, 33.0, -115.0, 42.0],
        in_process=True,
    )

    assert res["success"] is True
    assert res["result_status"] in ("supported", "inconclusive")
    assert res["data_mode"] == "cached_verified"
    assert res["units"] == "degC"
    assert len(res["ci_95"]) == 2
    assert res["ci_95"][0] < res["ci_95"][1]
    assert len(res["manifest_hash"]) == 64


def test_paired_regional_investigation_contract():
    """Verify that a paired dual-region investigation produces valid contrast evidence,

    dual-series time series, and Newey-West HAC difference testing metrics.
    """
    from fastapi.testclient import TestClient
    from backend.app import create_app
    from backend.stepper import run_pipeline

    app = create_app()
    client = TestClient(app)

    payload = {
        "dataset_id": "merra2_t2m",
        "variable": "T2M",
        "period": {"start_year": 2001, "end_year": 2024},
        "region_a": [-124.0, 33.0, -120.0, 38.0],
        "region_b": [-119.0, 35.0, -115.0, 40.0],
        "temporal_aggregation": "annual_mean",
        "spatial_aggregation": "area_weighted",
        "execution_mode": "auto",
        "selection_status": "predefined",
    }

    submit_res = client.post("/api/investigations", json=payload)
    assert submit_res.status_code == 202
    job_id = submit_res.json()["job_id"]

    # Run pipeline in-process
    pipe_res = run_pipeline(job_id=job_id, request_data=payload)
    assert pipe_res["job_status"] == "succeeded"

    # 1. Verify Evidence endpoint with contrast summary
    ev_res = client.get(f"/api/investigations/{job_id}/evidence")
    assert ev_res.status_code == 200
    evidence = ev_res.json()
    assert evidence["job_id"] == job_id
    assert "contrast" in evidence
    contrast = evidence["contrast"]
    assert contrast is not None
    assert "contrast_slope" in contrast
    assert "contrast_ci_95" in contrast
    assert len(contrast["contrast_ci_95"]) == 2
    assert contrast["contrast_ci_95"][0] <= contrast["contrast_ci_95"][1]
    assert "contrast_status" in contrast
    assert contrast["contrast_status"] in (
        "opposite_trend_pair",
        "signs_not_opposite",
        "contrast_not_supported",
        "inconclusive",
    )
    assert len(contrast["evidence_text"]) > 0

    # 2. Verify Series endpoint with dual-region values
    series_res = client.get(f"/api/investigations/{job_id}/series")
    assert series_res.status_code == 200
    series_data = series_res.json()
    assert "columns" in series_data
    assert "region_a_value" in series_data["columns"]
    assert "region_b_value" in series_data["columns"]
    assert "difference_value" in series_data["columns"]
    assert len(series_data["data"]) == 24  # 2001-2024 is 24 complete years

