---
phase: 4
plan: 3
wave: 3
status: completed
completed_at: 2026-09-25T03:04:00Z
---

# Plan 4.3 Summary: Map Grid Delivery, Evidence Endpoints & Frozen Export Bundler

## Objectives Achieved
1. **Investigation REST Endpoints**:
   - Implemented `terra-odyssey/src/backend/api/investigations.py` with full RESTful lifecycle:
     - `POST /api/investigations`: Accepts `InvestigationRequest`, performs parameter & geometry validation, creates job record in SQLite `JobStore`, enqueues job into bounded worker queue, and returns HTTP 202 Accepted with `Location: /api/investigations/{id}` header.
     - `GET /api/investigations/{id}`: Returns authoritative `JobStatusResponse` containing operational status, pipeline stage, progress percentage, and top-level result summary.
     - `DELETE /api/investigations/{id}`: Sets cooperative cancellation flag in store, returning HTTP 202 Accepted.
     - `GET /api/investigations/{id}/series`: Delivers typed annual time series data (years, Region A, Region B, difference, valid area coverage).
     - `GET /api/investigations/{id}/evidence`: Delivers statistical effect sizes, HAC standard errors, 95% confidence intervals, and typed scientific caveats.

2. **Compressed Structured Grid Delivery (`GET /api/investigations/{id}/map`)**:
   - Streams compressed `map_grid.json.gz` with optional `bbox` filtering and `max_cells` capping (default 10,000 cells).
   - Enforces cell thinning via dynamic integer decimation factor without spatial interpolation.
   - Preserves nulls for unmasked cells, never averages p-values across cells, and embeds frozen FDR critical values and discovery thresholds.

3. **Immutable Frozen Export Bundler**:
   - Implemented `terra-odyssey/src/backend/exporter.py` generating complete, self-contained, reproducible investigation `.zip` archives.
   - Dispatches format queries via `GET /api/investigations/{id}/export?format={zip|json|timeseries_csv}`.
   - ZIP bundle contents:
     - `investigation_record.json`: Conforming strictly to `schemas/investigation-record.schema.json` and validated locally via Draft 2020-12 validator without internet reliance.
     - `resolved_configuration.json`: Exact frozen parameters and runtime options.
     - `results/`: `analysis_results.json`, `region_time_series.csv`, `paired_difference.csv`, `map_grid.json.gz`.
     - `manifests/`: `dataset_manifest.json`, `source_granules.json`.
     - `methods/methods.md`: Full scientific methodology detailing OLS+HAC, Benjamini-Yekutieli multiplicity control, and area weighting.
     - `report/summary_report.md`: Deterministically synthesized scientific findings narrative with effect sizes, confidence intervals, and caveats.
     - `software/`: `environment.json`, `version.json`.
     - `README.md`: Verification instructions and replay guidelines.
     - `checksums.sha256`: SHA-256 integrity hashes for every artifact file in the bundle.
   - Strips absolute local file paths, personal tokens, and secrets from export manifests.

4. **Empirical Verification**:
   - Implemented comprehensive integration suite in `terra-odyssey/tests/unit/test_api_investigations.py`.
   - Verified schema local `$ref` offline resolution via referencing Registry.
   - Tested full lifecycle: submission, execution, polling, time series retrieval, downsampled map retrieval, evidence inspection, and ZIP export unpacking.
   - Tested cache-only 503 Problem Details response and orthogonal status separation (inconclusive scientific result with succeeded operational job status).
   - Full test suite: 63/63 tests passing (100%).
   - Clean codebase archive packaged to `terra-odyssey.zip` (55 clean files, 93.7 KB).

## Key Files Created/Modified
- `terra-odyssey/src/backend/api/investigations.py`
- `terra-odyssey/src/backend/exporter.py`
- `terra-odyssey/src/backend/worker.py`
- `terra-odyssey/src/backend/app.py`
- `terra-odyssey/schemas/investigation-record.schema.json`
- `terra-odyssey/tests/unit/test_api_investigations.py`
- `terra-odyssey/tests/unit/test_job_orchestration.py`
- `terra-odyssey.zip`

## Verification Evidence
- `pytest terra-odyssey/tests/unit/test_api_investigations.py`: 4/4 passed (100%)
- `pytest terra-odyssey/tests/unit/`: 63/63 passed (100%)
- `pwsh .\scripts\package-codebase.ps1`: 55 clean files, 93.7 KB
