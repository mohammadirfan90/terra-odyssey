# Phase 4 Research: API & Investigation Orchestration

## Overview
Phase 4 implements the backend orchestration layer of Terra Odyssey: a FastAPI application that serves the dataset catalog, manages asynchronous scientific investigation jobs backed by a durable SQLite state store and bounded execution queue, streams compressed structured-grid trend maps, enforces RFC 9457 error semantics, and generates frozen, cryptographically verified `InvestigationRecord` export bundles conforming to `schemas/investigation-record.schema.json`.

---

## 1. Job State Architecture & Orthogonal Status Separation

### Architectural Separation
As established in `.gsd/DECISIONS.md`, Phase 4 completely decouples operational infrastructure state from scientific evidence status:
1. **`job_status` (Operational)**:
   - `"submitted"`: Job record persisted in SQLite; queued for execution.
   - `"running"`: Scientific worker actively executing pipeline stages.
   - `"cancel_requested"`: Cooperative cancellation requested by user; stage check will abort.
   - `"cancelled"`: Job cleanly terminated before completion.
   - `"failed"`: Operational crash, unexpected exception, or hardware failure.
   - `"succeeded"`: Pipeline completed full execution lifecycle and published immutable artifacts.
2. **`stage` (Pipeline Phase)**:
   - `"validating"` $\to$ `"acquiring"` $\to$ `"normalizing"` $\to$ `"aggregating"` $\to$ `"analyzing"` $\to$ `"publishing"`
3. **`result_status` (Scientific)**:
   - `"supported"`: Empirically verified trend or qualified opposite-trend pair.
   - `"inconclusive"`: Same-sign slopes, non-significant contrast ($p \ge 0.05$), or multiplicity failure.
   - `"ineligible"`: Insufficient temporal length ($<20$ years) or failing area coverage thresholds (<100% MERRA-2, <90% GPM).

> [!IMPORTANT]
> An investigation that completes and discovers that regional slopes share the same sign or lack statistical significance is an operational success:
> `{"job_status": "succeeded", "result_status": "inconclusive"}`.

### Authoritative SQLite Store (`jobs.db`)
- SQLite provides zero-dependency, serverless, file-backed atomic persistence.
- Table `investigation_jobs`:
  - `job_id` (TEXT PRIMARY KEY)
  - `idempotency_key` (TEXT UNIQUE)
  - `config_hash` (TEXT INDEX)
  - `job_status` (TEXT)
  - `stage` (TEXT)
  - `progress_pct` (INTEGER)
  - `result_status` (TEXT)
  - `request_json` (TEXT)
  - `resolved_config_json` (TEXT)
  - `error_json` (TEXT)
  - `artifacts_dir` (TEXT)
  - `created_at` (TEXT ISO8601)
  - `started_at` (TEXT ISO8601)
  - `completed_at` (TEXT ISO8601)
  - `updated_at` (TEXT ISO8601)
- Transitions use immediate atomic commits and track state change timestamps.

### Bounded Local Queue & Single Scientific Worker
- `asyncio.Queue(maxsize=10)` queues incoming job IDs.
- A single background consumer task drains the queue and executes scientific computation via `concurrent.futures.ProcessPoolExecutor(max_workers=1)`.
- IPC payload is strictly lightweight: `(job_id, config_dict, target_dir)`. No large `xarray.Dataset` or NetCDF arrays cross process boundaries.
- **FastAPI Lifespan Management**:
  - `lifespan` context manager handles startup and shutdown.
  - Startup: ensures SQLite schema is initialized; queries SQLite for jobs stranded in `running` or `cancel_requested` status and marks them `failed` with error reason `interrupted_on_restart`; spawns background queue worker task.
  - Shutdown: signals worker task cancellation and cleanly terminates `ProcessPoolExecutor`.

---

## 2. Structured Map Data Delivery Contract

### Rejection of Unrestricted GeoJSON
Global 2D grids (MERRA-2 at $0.5^\circ \times 0.625^\circ \approx 208,000$ cells; GPM IMERG at $0.1^\circ \times 0.1^\circ \approx 6.48\text{M}$ cells) produce massive JSON payloads if formatted as FeatureCollections (15MB to 500MB+).

### Compressed Structured-Grid JSON
Endpoint `GET /api/investigations/{id}/map?bbox=minLon,minLat,maxLon,maxLat&max_cells=10000` returns:
```json
{
  "grid": {
    "crs": "EPSG:4326",
    "width": 180,
    "height": 90,
    "longitude": [-179.5, -177.5, "..."],
    "latitude": [-89.5, -87.5, "..."],
    "order": "latitude_longitude"
  },
  "bands": {
    "slope_per_decade": [0.12, null, -0.05],
    "raw_p_value": [0.002, null, 0.45],
    "adjusted_p_value": [0.015, null, 0.88],
    "coverage_fraction": [1.0, null, 0.95],
    "evidence_code": ["supported", "masked", "not_significant"]
  },
  "legend": {
    "variable": "T2M",
    "units": "degC/decade",
    "center": 0.0,
    "minimum": -1.2,
    "maximum": 1.2,
    "fdr_method": "fdr_by",
    "fdr_level": 0.05
  },
  "provenance": {
    "map_family_id": "global_t2m_2001_2025_ols_hac",
    "family_size": 16200
  }
}
```

### Statistical Integrity Rules
- Masked or missing cells are explicitly encoded as `null` (never invalid JSON `NaN`).
- When downsampling or coarsening to respect `max_cells`, cells are thinned by stride (nearest-grid sampling), **never by averaging $p$-values**.
- Viewport changes, panning, and zooming never recompute or rescale the Benjamini–Yekutieli test family; the family size $m$ remains frozen.
- Region A/B boundaries and custom polygons are provided as separate GeoJSON overlays (`/api/investigations/{id}/regions`).

---

## 3. NASA Data Access, Offline Fallback & RFC 9457 Errors

### Execution Modes
Clients pass explicit `execution_mode`:
- `"auto"`: Check local checksum-verified cache; if missing, attempt live CMR/OPeNDAP query with back-pressure handling.
- `"live"`: Demand live DAAC acquisition; fail if credentials or connection are absent.
- `"cached_only"`: Rely strictly on verified local cache; fail if any required granule is missing.
- `"demo_sample"`: Execute against verified sample granules (`terra-odyssey/backend/data/samples/`) on their real footprint and time range.

### RFC 9457 Problem Details (`application/problem+json`)
When data is missing or live DAAC is unreachable:
```json
{
  "type": "https://terra-odyssey.local/errors/earthdata-unavailable",
  "title": "Required NASA data unavailable",
  "status": 503,
  "code": "earthdata_unavailable",
  "detail": "No verified cache covers requested period 2001-2025 and live Earthdata acquisition is unconfigured or unreachable.",
  "instance": "/api/investigations/inv-8f4b1",
  "retryable": true
}
```

### Provenance Separation
Transport conditions are strictly separated from scientific releases:
```json
{
  "source_release": "5.12.4",
  "data_mode": "cached_verified",
  "cache_hit": true,
  "granule_ids": ["MERRA2_300.tavgM_2d_slv_Nx.200101.nc4"],
  "granule_checksums": ["a1b2c3d4..."],
  "retrieved_at": "2026-09-25T00:00:00Z",
  "cache_verified_at": "2026-09-25T01:30:00Z"
}
```

---

## 4. Frozen Investigation Export Bundle

### Immutable ZIP Layout
`GET /api/investigations/{id}/export?format=zip` produces:
```
terra-odyssey-investigation-{id}.zip
├── investigation_record.json          # Root schema: schemas/investigation-record.schema.json
├── resolved_configuration.json        # Frozen execution parameters
├── results/
│   ├── analysis_results.json          # Array of objects conforming to analysis-result.schema.json
│   ├── region_time_series.csv         # Yearly/seasonal series for Region A, Region B, and Difference
│   ├── paired_difference.csv          # Paired difference statistics and CI
│   └── map_grid.json.gz               # Compressed gridded field
├── manifests/
│   ├── dataset_manifest.json          # Dataset release and variable specification
│   └── source_granules.json           # Exact granules, checksums, and fetch URLs
├── methods/
│   └── methods.md                     # Method description, estimator math, and HAC parameters
├── report/
│   └── summary_report.md              # Markdown findings report with citations and caveats
├── software/
│   ├── environment.json               # Python version, dependency locks, OS info
│   └── version.json                   # Terra Odyssey git commit, build version
├── README.md                          # Bundle manifest and replay instructions
└── checksums.sha256                   # SHA-256 for every single file in the zip
```

### Deterministic Report Generation
- The Markdown report `report/summary_report.md` is generated deterministically from typed data fields.
- It quotes exact slopes, $p$-values, uncertainty bounds, and caveats.
- It contains no speculative mechanism language and never states causality.
- All secrets, cookies, bearer tokens, and local filesystem absolute paths are strictly scrubbed.

---

## 5. Schema Updates: `schemas/investigation-record.schema.json`

Before implementing the API or export bundler, the schema must be updated to formally define:
- `schema_version`: e.g. `"1.0.0"`.
- `job`: Object containing `job_id`, `job_status`, `stage`, `result_status`, timestamps, and progress.
- `data_mode`: `"live" | "cached_verified" | "demo_sample"`.
- `artifact_index`: Map of artifact relative filenames to their SHA-256 checksums and MIME types.
- `record_hash`: Canonical SHA-256 hash of the frozen investigation record.
- `published_at`: ISO8601 timestamp.
- `resolved_configuration_hash`: SHA-256 hash of `resolved_configuration`.
- `map_family_id`: Optional string identifying the frozen multiple-testing family.
