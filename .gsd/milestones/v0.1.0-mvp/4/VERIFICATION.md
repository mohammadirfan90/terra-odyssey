# Phase 4 Verification: API & Investigation Orchestration

## Must-Haves Verification

### 1. Catalog, Capabilities & Request Validation (Plan 4.1)
- [x] **Dataset Catalog Metadata**: `GET /api/catalog` returns reviewed NASA datasets (`merra2_t2m` and `gpm_imerg_precipitation`) with full collections, versions, DOIs, temporal bounds, spatial resolutions, variables, and units.
- [x] **Capabilities & Predefined Regions**: `GET /api/capabilities` returns supported estimators (`ols_hac`, `theil_sen`), multiplicity methods (`fdr_by`, `fdr_bh`), execution modes (`auto`, `cached_only`, `live`, `demo_sample`), and curated demonstration candidate pairs.
- [x] **RFC 9457 Problem Details**: Structured error handlers intercept validation errors, data unavailability, out-of-bounds geometry, and unexpected exceptions with type URIs, human-readable titles, status codes, and context details.
- [x] **Strict Pydantic v2 Models**: Enforces valid parameter values, temporal windows ($\ge 20$ years), bounding box coordinates, and GeoJSON polygon boundaries.

### 2. SQLite Job Store, Bounded Worker & Scientific Stepper (Plan 4.2)
- [x] **Authoritative SQLite Job Store**: Implements WAL mode, thread-safe connection pooling, atomic stage transitions (`submitted` -> `running` -> `succeeded` / `failed` / `cancelled`), and timestamps.
- [x] **Crash Recovery**: `recover_interrupted_jobs()` executed on FastAPI startup cleanly identifies and marks stranded in-progress jobs as `failed` with explanation.
- [x] **Bounded Queue Worker**: Bounded `asyncio.Queue(maxsize=10)` coupled with an isolated execution thread/process pool prevents server saturation.
- [x] **6-Stage Scientific Stepper**: Sequentially executes `validating` -> `acquiring` -> `normalizing` -> `aggregating` -> `analyzing` -> `publishing`.
- [x] **Orthogonal Status Separation**: Strictly decouples operational status (`job_status="succeeded"`) from scientific outcome (`result_status` in `"supported"`, `"inconclusive"`, `"ineligible"`).
- [x] **Cooperative Cancellation**: Inspects cancellation state between stages to allow responsive termination of long-running operations.

### 3. Investigation REST Endpoints, Map Delivery & Export Bundler (Plan 4.3)
- [x] **Asynchronous Investigation Lifecycle**: `POST /api/investigations` returns HTTP 202 Accepted with tracking `Location` header; `GET /api/investigations/{id}` returns real-time progress.
- [x] **Annual Time-Series Delivery**: `GET /api/investigations/{id}/series` delivers aligned regional time series, common years, differences, and area coverage percentages.
- [x] **Compressed Structured Grid Map (`/map`)**: Streams `map_grid.json.gz` with bounding-box slicing and `max_cells` capping. Decimates without spatial smoothing, never averages $p$-values, preserves nulls for missing cells, and includes frozen FDR metadata.
- [x] **Evidence Adjudication (`/evidence`)**: Returns effect sizes per decade, HAC standard errors, 95% confidence intervals, multiplicity adjustments, and typed scientific caveats.
- [x] **Immutable Frozen Export Bundler (`/export`)**: Compiles self-contained reproducible `.zip` archive containing:
  - `investigation_record.json` validated locally against `schemas/investigation-record.schema.json` using Draft 2020-12 validator without internet reliance.
  - `resolved_configuration.json`, `results/`, `manifests/`, `methods/methods.md`, `report/summary_report.md`, `software/`, `README.md`, and `checksums.sha256`.
  - Dispatches format queries (`zip`, `json`, `timeseries_csv`).
  - Completely scrubs sensitive local paths and credentials.

---

## Verdict: PASS
All 63 unit and integration tests passing cleanly (`pytest terra-odyssey/backend/tests/unit/ -v`).
Packaging verified with clean archive `terra-odyssey.zip` (55 files, 93.7 KB).
