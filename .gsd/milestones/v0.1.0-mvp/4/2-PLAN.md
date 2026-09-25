---
phase: 4
plan: 2
wave: 2
depends_on:
  - 4.1
---

# Plan 4.2: Durable SQLite Job Store, Bounded Worker & Stepper

## Objective
Implement the authoritative SQLite job database, bounded asynchronous queue worker (`ProcessPoolExecutor(max_workers=1)`), cooperative cancellation, and the end-to-end scientific pipeline stepper orchestrating Phase 1–3 analytical components.

## Context
- `terra-odyssey/backend/src/backend/schemas.py`
- `terra-odyssey/backend/src/backend/errors.py`
- `terra-odyssey/backend/src/analysis/trend_estimator.py`
- `terra-odyssey/backend/src/analysis/spatial_aggregation.py`
- `terra-odyssey/backend/src/analysis/paired_contrast.py`
- `terra-odyssey/backend/src/analysis/multiplicity.py`
- `.gsd/DECISIONS.md`
- `.gsd/phases/4/RESEARCH.md`

## Tasks

<task type="auto">
  <name>Implement Authoritative SQLite Job Store</name>
  <files>
    terra-odyssey/backend/src/backend/store.py
  </files>
  <action>
    1. In `terra-odyssey/backend/src/backend/store.py`:
       - Implement `JobStore` class managing SQLite connection to `terra-odyssey/backend/data/jobs.db` (or configurable test path).
       - Create table `investigation_jobs` with fields:
         `job_id`, `idempotency_key`, `config_hash`, `job_status`, `stage`, `result_status`, `progress_pct`, `request_json`, `resolved_config_json`, `error_json`, `artifacts_dir`, `created_at`, `started_at`, `completed_at`, `updated_at`.
       - Implement methods:
         - `create_job(request, idempotency_key=None)`: Computes configuration hash, checks idempotency; returns existing job or inserts new job with `job_status="submitted"`, `stage="validating"`, `progress_pct=0`.
         - `get_job(job_id)`: Fetches job record as typed dictionary/model.
         - `update_stage(job_id, stage, progress_pct=None)`: Atomic update with timestamp.
         - `set_result(job_id, result_status, artifacts_dir, error=None)`: Transitions job to terminal state (`succeeded`, `failed`, or `cancelled`).
         - `request_cancellation(job_id)`: Sets `job_status="cancel_requested"` if currently `submitted` or `running`.
         - `is_cancelled(job_id)`: Checks if cancellation was requested.
         - `recover_interrupted_jobs()`: On startup, updates all jobs left in `"running"` or `"cancel_requested"` to `"failed"` with error `"interrupted_on_restart"`.
       - Use SQLite `WAL` mode and explicit transaction commits for thread and process safety.
  </action>
  <verify>
    python -c "from backend.store import JobStore; import tempfile; s = JobStore(tempfile.mktemp('.db')); j = s.create_job({'test': 1}); assert j['job_status'] == 'submitted'; print('JobStore verified!')"
  </verify>
  <done>
    `JobStore` reliably manages job records in SQLite, preserves state across restarts, enforces idempotency, and records stage transitions.
  </done>
</task>

<task type="auto">
  <name>Implement Pipeline Stepper, Bounded Worker & Lifespan</name>
  <files>
    terra-odyssey/backend/src/backend/stepper.py
    terra-odyssey/backend/src/backend/worker.py
    terra-odyssey/backend/src/backend/app.py
  </files>
  <action>
    1. In `terra-odyssey/backend/src/backend/stepper.py`:
       - Implement `run_pipeline(job_id, request_dict, artifacts_base_dir, store_db_path)`:
         - Stage 1 `validating`: Validate geometry, period ($\ge 20$ years), dataset/variable parameters.
         - Stage 2 `acquiring`: Resolve execution mode (`auto`, `live`, `cached_only`, `demo_sample`). Check cache directory (`terra-odyssey/backend/data/samples/` or cache). If unavailable, raise `DataUnavailableError`.
         - Stage 3 `normalizing`: Load gridded dataset, apply quality masks, convert units (K $\to$ °C for MERRA-2; accumulation sum for IMERG).
         - Stage 4 `aggregating`: Extract area-weighted regional time series for Region A and optional Region B via `extract_regional_time_series`. Verify coverage thresholds (100% MERRA-2, 90% GPM). Check cancellation.
         - Stage 5 `analyzing`: Fit single-region trend (`estimate_ols_hac_trend`) or paired contrast (`estimate_paired_contrast`). If visual map search, apply Benjamini-Yekutieli multiplicity adjustment (`adjudicate_test_family`).
         - Stage 6 `publishing`: Write results atomically to a staging directory: `analysis_results.json`, `region_time_series.csv`, `map_grid.json.gz`, and `investigation_record.json`. Compute SHA-256 for all artifacts, update `JobStore` with `job_status="succeeded"` and determined `result_status` (`"supported"`, `"inconclusive"`, or `"ineligible"`).
         - Cooperative cancellation: After each stage, call `store.is_cancelled(job_id)`; if true, abort, remove staging files, and set `job_status="cancelled"`.
    2. In `terra-odyssey/backend/src/backend/worker.py`:
       - Manage `asyncio.Queue(maxsize=10)` and `ProcessPoolExecutor(max_workers=1)`.
       - Provide async `enqueue_job(job_id)` and worker loop consuming from queue.
    3. In `terra-odyssey/backend/src/backend/app.py`:
       - Define FastAPI `@asynccontextmanager async def lifespan(app: FastAPI)`:
         - On startup: initialize SQLite, run `store.recover_interrupted_jobs()`, launch queue consumer task.
         - On shutdown: cancel queue worker task, shutdown `ProcessPoolExecutor`.
  </action>
  <verify>
    python -c "import backend.stepper as s; import backend.worker as w; print('Worker and Stepper imported cleanly!')"
  </verify>
  <done>
    Pipeline stepper coordinates all analytical phases, checks cancellation, uses atomic file publication, and runs through the bounded queue worker.
  </done>
</task>

<task type="auto">
  <name>Unit & Integration Tests for Job Orchestration</name>
  <files>
    terra-odyssey/backend/tests/unit/test_job_orchestration.py
  </files>
  <action>
    Create tests verifying:
    1. `test_job_store_lifecycle`: Job creation, stage transitions (`validating` $\to$ `succeeded`), and status retrieval.
    2. `test_idempotency_deduplication`: Submitting identical request with same idempotency key or config hash returns existing job record without re-queueing.
    3. `test_interrupted_job_recovery`: Simulates a job in `"running"` state during crash; verifies `recover_interrupted_jobs()` transitions it to `"failed"` with `"interrupted_on_restart"`.
    4. `test_cooperative_cancellation`: Enqueues a job, requests cancellation, verifies worker catches cancellation flag and transitions job to `"cancelled"`.
    5. `test_orthogonal_status_separation`: Verifies that an inconclusive scientific result produces `job_status="succeeded"` with `result_status="inconclusive"`, and an ineligible coverage result produces `job_status="succeeded"` with `result_status="ineligible"`.
  </action>
  <verify>
    python -m pytest terra-odyssey/backend/tests/unit/test_job_orchestration.py -v
  </verify>
  <done>
    All job store, worker lifecycle, and status separation tests pass.
  </done>
</task>

## Success Criteria
- [ ] SQLite database reliably tracks jobs, stages, and orthogonal statuses.
- [ ] Bounded queue worker prevents concurrent job overload using single-process scientific execution.
- [ ] Cooperative cancellation functions between pipeline stages.
- [ ] Crash recovery cleans up interrupted jobs on restart.
- [ ] 100% of unit and integration tests pass in `test_job_orchestration.py`.
