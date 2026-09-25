"""Unit and integration tests for SQLite JobStore, bounded worker, and pipeline stepper."""

import json
from pathlib import Path
import pytest

from src.backend.errors import InvalidGeometryError
from src.backend.stepper import run_pipeline
from src.backend.store import JobStore
from src.backend.worker import enqueue_job, get_queue, reset_queue


def test_job_store_lifecycle(tmp_path):
    """Test job creation, stage progression, timestamps, and status retrieval."""
    db_file = tmp_path / "test_jobs.db"
    store = JobStore(db_file)

    req = {
        "dataset_id": "merra2_t2m",
        "variable": "T2M",
        "period": {"start_year": 2000, "end_year": 2024},
        "region_a": [-120.0, 35.0, -115.0, 40.0],
    }

    job = store.create_job(req)
    assert job is not None
    assert job["job_status"] == "submitted"
    assert job["stage"] == "validating"
    assert job["progress_pct"] == 0
    assert job["created_at"] is not None
    assert job["started_at"] is None
    assert job["completed_at"] is None

    # Transition to acquiring (marks running)
    store.update_stage(job["job_id"], "acquiring", progress_pct=25)
    updated = store.get_job(job["job_id"])
    assert updated["job_status"] == "running"
    assert updated["stage"] == "acquiring"
    assert updated["progress_pct"] == 25
    assert updated["started_at"] is not None

    # Advance through normalizing, aggregating, analyzing
    store.update_stage(job["job_id"], "normalizing", progress_pct=45)
    store.update_stage(job["job_id"], "aggregating", progress_pct=65)
    store.update_stage(job["job_id"], "analyzing", progress_pct=80)
    store.update_stage(job["job_id"], "publishing", progress_pct=90)

    # Set terminal succeeded state
    store.set_result(
        job_id=job["job_id"],
        job_status="succeeded",
        result_status="supported",
        artifacts_dir=str(tmp_path / "artifacts" / job["job_id"]),
    )

    final = store.get_job(job["job_id"])
    assert final["job_status"] == "succeeded"
    assert final["result_status"] == "supported"
    assert final["progress_pct"] == 100
    assert final["completed_at"] is not None


def test_idempotency_deduplication(tmp_path):
    """Submitting request with same idempotency key or in-flight config hash returns existing job."""
    db_file = tmp_path / "test_idempotency.db"
    store = JobStore(db_file)

    req = {
        "dataset_id": "merra2_t2m",
        "variable": "T2M",
        "period": {"start_year": 2000, "end_year": 2024},
        "region_a": [-120.0, 35.0, -115.0, 40.0],
    }

    # 1. Idempotency key deduplication
    j1 = store.create_job(req, idempotency_key="user-key-001")
    j2 = store.create_job(req, idempotency_key="user-key-001")
    assert j1["job_id"] == j2["job_id"]

    # 2. In-flight config hash deduplication
    j3 = store.create_job(req)
    assert j3["job_id"] == j1["job_id"]

    # Complete j1
    store.set_result(j1["job_id"], job_status="succeeded", result_status="supported")

    # Now with j1 succeeded, submitting a new request without idempotency key creates a new job
    j4 = store.create_job(req)
    assert j4["job_id"] != j1["job_id"]


def test_interrupted_job_recovery(tmp_path):
    """Crash recovery marks running or cancel_requested jobs as failed on restart."""
    db_file = tmp_path / "test_recovery.db"
    store = JobStore(db_file)

    # Job A: left in running
    j_a = store.create_job({"id": "A"})
    store.update_stage(j_a["job_id"], "normalizing")

    # Job B: left in cancel_requested
    j_b = store.create_job({"id": "B"})
    store.request_cancellation(j_b["job_id"])

    # Job C: still submitted (not interrupted during execution)
    j_c = store.create_job({"id": "C"})

    recovered_count = store.recover_interrupted_jobs()
    assert recovered_count == 2

    res_a = store.get_job(j_a["job_id"])
    assert res_a["job_status"] == "failed"
    assert res_a["error"]["code"] == "interrupted_on_restart"

    res_b = store.get_job(j_b["job_id"])
    assert res_b["job_status"] == "failed"
    assert res_b["error"]["code"] == "interrupted_on_restart"

    res_c = store.get_job(j_c["job_id"])
    assert res_c["job_status"] == "submitted"


def test_cooperative_cancellation(tmp_path):
    """Pre-requesting cancellation causes pipeline to abort cleanly before completion."""
    db_file = tmp_path / "test_cancel.db"
    store = JobStore(db_file)

    req = {
        "dataset_id": "merra2_t2m",
        "variable": "T2M",
        "period": {"start_year": 2000, "end_year": 2024},
        "region_a": [-120.0, 35.0, -115.0, 40.0],
        "execution_mode": "demo_sample",
    }
    job = store.create_job(req)

    # Cancel immediately
    assert store.request_cancellation(job["job_id"]) is True

    result = run_pipeline(
        job_id=job["job_id"],
        request_data=req,
        artifacts_base_dir=tmp_path / "artifacts",
        store_db_path=db_file,
    )

    assert result["job_status"] == "cancelled"
    job_record = store.get_job(job["job_id"])
    assert job_record["job_status"] == "cancelled"


def test_orthogonal_status_separation(tmp_path):
    """Assert operational job success is separate from scientific evidence status."""
    db_file = tmp_path / "test_status.db"
    artifacts_dir = tmp_path / "artifacts"
    store = JobStore(db_file)

    # 1. Scientific Ineligible (< 20 years span: 2018-2024 is 7 years)
    req_short = {
        "dataset_id": "merra2_t2m",
        "variable": "T2M",
        "period": {"start_year": 2018, "end_year": 2024},
        "region_a": [-120.0, 35.0, -115.0, 40.0],
        "execution_mode": "demo_sample",
    }
    j_ineligible = store.create_job(req_short)

    res_ineligible = run_pipeline(
        job_id=j_ineligible["job_id"],
        request_data=req_short,
        artifacts_base_dir=artifacts_dir,
        store_db_path=db_file,
    )

    # Operational status is SUCCEEDED, while scientific result is INELIGIBLE
    assert res_ineligible["job_status"] == "succeeded"
    assert res_ineligible["result_status"] == "ineligible"

    record_path = Path(res_ineligible["artifacts_dir"]) / "investigation_record.json"
    assert record_path.is_file()
    with open(record_path, "r", encoding="utf-8") as f:
        record_data = json.load(f)
    assert record_data["job"]["job_status"] == "succeeded"
    assert record_data["job"]["result_status"] == "ineligible"
    assert record_data["results"][0]["status"] == "ineligible"

    # 2. Paired analysis (either inconclusive or supported) is an operational success
    req_paired = {
        "dataset_id": "merra2_t2m",
        "variable": "T2M",
        "period": {"start_year": 2000, "end_year": 2024},
        "region_a": [-120.0, 35.0, -115.0, 40.0],
        "region_b": [-110.0, 35.0, -105.0, 40.0],
        "execution_mode": "demo_sample",
    }
    j_paired = store.create_job(req_paired)

    res_paired = run_pipeline(
        job_id=j_paired["job_id"],
        request_data=req_paired,
        artifacts_base_dir=artifacts_dir,
        store_db_path=db_file,
    )

    assert res_paired["job_status"] == "succeeded"
    assert res_paired["result_status"] in ("supported", "inconclusive")

    # Verify generated artifacts
    art_dir = Path(res_paired["artifacts_dir"])
    assert (art_dir / "investigation_record.json").is_file()
    assert (art_dir / "analysis_results.json").is_file()
    assert (art_dir / "region_time_series.csv").is_file()
    assert (art_dir / "map_grid.json.gz").is_file()


@pytest.mark.asyncio
async def test_bounded_queue_worker(tmp_path):
    """Test enqueuing into the bounded worker queue."""
    reset_queue()
    db_file = tmp_path / "test_queue.db"
    store = JobStore(db_file)
    req = {
        "dataset_id": "merra2_t2m",
        "variable": "T2M",
        "period": {"start_year": 2000, "end_year": 2024},
        "region_a": [-120.0, 35.0, -115.0, 40.0],
        "execution_mode": "demo_sample",
    }
    job = store.create_job(req)

    # Enqueue should succeed
    success = await enqueue_job(
        job_id=job["job_id"],
        request_data=req,
        artifacts_dir=tmp_path / "artifacts",
        store_db_path=db_file,
    )
    assert success is True
    queue = get_queue()
    assert not queue.empty()
    item = await queue.get()
    assert item[0] == job["job_id"]
    queue.task_done()
