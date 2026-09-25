---
phase: 4
plan: 3
wave: 3
depends_on:
  - 4.2
---

# Plan 4.3: Map Grid Delivery, Evidence Endpoints & Frozen Export Bundler

## Objective
Implement the REST endpoints for investigation creation, status polling, time-series retrieval, compressed structured-grid map delivery, and immutable frozen `.zip` export bundle generation conforming to `schemas/investigation-record.schema.json`.

## Context
- `terra-odyssey/src/backend/schemas.py`
- `terra-odyssey/src/backend/store.py`
- `terra-odyssey/src/backend/stepper.py`
- `terra-odyssey/src/backend/worker.py`
- `schemas/investigation-record.schema.json`
- `schemas/analysis-result.schema.json`
- `.gsd/DECISIONS.md`
- `.gsd/phases/4/RESEARCH.md`

## Tasks

<task type="auto">
  <name>Implement Investigation API Endpoints & Structured Grid Delivery</name>
  <files>
    terra-odyssey/src/backend/api/investigations.py
    terra-odyssey/src/backend/app.py
  </files>
  <action>
    1. In `terra-odyssey/src/backend/api/investigations.py`:
       - `POST /api/investigations`: Accepts `InvestigationRequest`. Validates parameters. Calls `store.create_job()`, enqueues via `worker.enqueue_job()`. Returns HTTP 202 Accepted with header `Location: /api/investigations/{id}` and job record body.
       - `GET /api/investigations/{id}`: Returns `JobStatusResponse` with operational status, stage, progress, and result summary.
       - `DELETE /api/investigations/{id}`: Calls `store.request_cancellation(id)`. Returns HTTP 202 Accepted.
       - `GET /api/investigations/{id}/series`: Reads `region_time_series.csv` and returns typed time-series data (years, Region A, Region B, difference, valid area coverage).
       - `GET /api/investigations/{id}/map`: Query params `bbox: Optional[str] = None`, `max_cells: int = 10000`. Reads cached `map_grid.json.gz`, applies bounding-box slice and downsampling stride to enforce `max_cells` ceiling. Outputs JSON `null` for missing cells, never averages $p$-values, and preserves frozen FDR legend metadata. Returns compressed `application/json` (with gzip Content-Encoding support).
       - `GET /api/investigations/{id}/evidence`: Reads `analysis_results.json` and returns effect sizes, HAC confidence intervals, multiplicity adjustments, and caveats.
    2. In `terra-odyssey/src/backend/app.py`:
       - Mount the investigations router at `/api`.
  </action>
  <verify>
    python -c "from terra_odyssey.src.backend.app import create_app; from fastapi.testclient import TestClient; c = TestClient(create_app()); print('Router mounted successfully!')"
  </verify>
  <done>
    All investigation endpoints respond correctly, return HTTP 202 on submission, enforce structured map grid limits, and deliver time-series and evidence payloads.
  </done>
</task>

<task type="auto">
  <name>Implement Frozen Export Bundler</name>
  <files>
    terra-odyssey/src/backend/exporter.py
    terra-odyssey/src/backend/api/investigations.py
  </files>
  <action>
    1. In `terra-odyssey/src/backend/exporter.py`:
       - Implement `build_export_bundle(job_id, artifacts_dir, export_path)`:
         - Creates in-memory or temporary `.zip` archive containing:
           1. `investigation_record.json`: Formatted strictly according to `schemas/investigation-record.schema.json`. Validates against Draft 2020-12 validator before writing.
           2. `resolved_configuration.json`: Frozen parameters and execution mode.
           3. `results/analysis_results.json`, `region_time_series.csv`, `paired_difference.csv`, `map_grid.json.gz`.
           4. `manifests/dataset_manifest.json`, `source_granules.json`.
           5. `methods/methods.md`: Markdown explanation of OLS+HAC, spatial area weighting, and Benjamini-Yekutieli multiplicity control.
           6. `report/summary_report.md`: Deterministically synthesized findings report listing slopes, uncertainty intervals, test p-values, citations, and caveats.
           7. `software/environment.json`, `version.json`.
           8. `README.md`: Verification and replay guide.
           9. `checksums.sha256`: SHA-256 hash of each file in the archive.
         - Strictly strips any secrets, tokens, or absolute local paths from all files.
    2. In `terra-odyssey/src/backend/api/investigations.py`:
       - Implement `GET /api/investigations/{id}/export`:
         - Parameter `format: str = Query("zip", regex="^(zip|json|timeseries_csv)$")`.
         - If `format == "zip"`: Returns `StreamingResponse` with `application/zip` and `Content-Disposition: attachment; filename=terra-odyssey-investigation-{id}.zip`.
         - If `format == "json"`: Returns `investigation_record.json`.
         - If `format == "timeseries_csv"`: Returns `region_time_series.csv`.
  </action>
  <verify>
    python -c "import terra_odyssey.src.backend.exporter as exp; print('Exporter imported cleanly!')"
  </verify>
  <done>
    `build_export_bundle` compiles complete frozen ZIP archives, validates `investigation_record.json` against the official JSON schema, and supports format query selection.
  </done>
</task>

<task type="auto">
  <name>End-to-End API Integration Tests</name>
  <files>
    terra-odyssey/tests/unit/test_api_investigations.py
  </files>
  <action>
    Create end-to-end integration tests using `fastapi.testclient.TestClient`:
    1. `test_investigation_lifecycle_demo_sample`:
       - Submits `POST /api/investigations` with `execution_mode="demo_sample"`. Asserts HTTP 202 Accepted.
       - Polls `GET /api/investigations/{id}` until `job_status == "succeeded"`.
       - Calls `GET /api/investigations/{id}/series`; verifies series arrays and coverage fractions.
       - Calls `GET /api/investigations/{id}/map?max_cells=500`; verifies structured grid dimensions, `null`s for unmasked cells, and cell count $\le 500$.
       - Calls `GET /api/investigations/{id}/evidence`; verifies slope per decade, HAC confidence interval, and typed caveats.
       - Calls `GET /api/investigations/{id}/export?format=zip`; extracts archive and validates `investigation_record.json` against `schemas/investigation-record.schema.json`.
    2. `test_data_unavailable_returns_rfc9457_503`:
       - Submits request for dates/areas outside cache with `execution_mode="cached_only"`; asserts pipeline reports RFC 9457 HTTP 503 Problem Details with `code="earthdata_unavailable"`.
    3. `test_inconclusive_result_has_succeeded_job_status`:
       - Runs investigation where slopes are same sign or nonsignificant; verifies `job_status == "succeeded"` and `result_status == "inconclusive"`.
  </action>
  <verify>
    python -m pytest terra-odyssey/tests/unit/test_api_investigations.py -v
  </verify>
  <done>
    All end-to-end API lifecycle, error handling, map delivery, and export validation tests pass.
  </done>
</task>

## Success Criteria
- [ ] `POST /api/investigations` accepts requests and returns HTTP 202 with job tracking.
- [ ] `GET /api/investigations/{id}/map` streams compressed structured-grid JSON with `max_cells` capping.
- [ ] `GET /api/investigations/{id}/export` delivers validated `.zip` archive matching all requirements.
- [ ] 100% of integration tests pass in `test_api_investigations.py`.
