# Terra Odyssey

> A reproducible Earth-system trend investigation workspace for NASA Space Apps Challenge 2026 — **Be An Earth System Trend Detective!**

Terra Odyssey turns an environmental question into an auditable statistical investigation. It combines NASA Earth-observation data handling, quality-aware temporal and spatial aggregation, autocorrelation-aware trend estimation, paired regional comparison, interactive mapping, linked time-series analysis, and reproducible evidence export.

The core design principle is simple: **a visually convincing trend is not automatically a scientifically defensible finding**. Terra Odyssey keeps missingness, temporal support, spatial coverage, serial dependence, multiple testing, provenance, and uncertainty visible instead of hiding them behind a polished chart.

> **MVP status:** `v0.1.0-mvp` — completed and archived on September 25, 2026.

---

## What Terra Odyssey Does

A typical investigation follows this chain:

```text
Question
   ↓
Reviewed dataset + variable
   ↓
Time interval + spatial regions
   ↓
NASA data / verified cache / demo sample
   ↓
Quality masking + normalization
   ↓
Calendar-aware temporal aggregation
   ↓
Geodesic spatial aggregation
   ↓
Trend estimation + uncertainty
   ↓
Paired regional contrast (when applicable)
   ↓
Evidence + diagnostics + caveats
   ↓
Reproducible investigation export
```

The application provides four main workspace stages:

1. **Formulate Question** — choose the dataset, variable, period, aggregation, execution mode, and comparison regions.
2. **Spatial Trend Map** — inspect a zero-centered signed trend field, coverage, significance diagnostics, and map-selected regions.
3. **Linked Time Series** — compare Region A, Region B, and the synchronous difference series.
4. **Evidence & Export** — inspect effect sizes, uncertainty, statistical diagnostics, provenance, caveats, and downloadable artifacts.

---

## Why It Exists

Earth-system data is full of traps that can make weak evidence look strong:

* seasonal structure can masquerade as a long-term trend;
* missing months can alter annual estimates;
* spatial averages can change meaning depending on the aggregation method;
* serial correlation can make naive standard errors too optimistic;
* comparing “significant” versus “not significant” results does **not** test whether two trends differ;
* exploratory map selection creates a multiple-testing problem;
* a NASA product is not interchangeable with independent ground truth.

Terra Odyssey is designed around those failure modes. It does not attempt to manufacture certainty where the data does not support it.

---

## Scientific Scope

### Core MVP datasets

| Dataset | Product                                | Variable           | Temporal support  | Spatial support           | Role                                 |
| ------- | -------------------------------------- | ------------------ | ----------------- | ------------------------- | ------------------------------------ |
| **D1**  | NASA MERRA-2 `M2TMNXSLV` v5.12.4       | `T2M`              | Monthly mean      | Global 0.5° × 0.625° grid | Core                                 |
| **D2**  | NASA GPM IMERG Final `GPM_3IMERGM` v07 | `precipitationCal` | Monthly mean rate | Global 0.1° grid          | Core                                 |
| **D3**  | NASA MODIS `MOD11A2.061`               | Day/Night LST      | 8-day composite   | Nominal 1 km MODIS grid   | Extension / adapter present          |
| **D4**  | NASA MODIS `MOD13A3.061`               | NDVI / EVI         | Monthly composite | Nominal 1 km MODIS grid   | Catalog manifest / planned extension |

The MVP investigation workflow is centered on **D1 and D2**. D3 and D4 are retained as extension paths rather than being presented as fully equivalent core workflows.

### Supported analysis concepts

Terra Odyssey currently includes:

* OLS trend estimation with **Newey–West HAC** standard errors;
* synchronous paired regional contrast using `D_t = Y_A,t - Y_B,t`;
* Benjamini–Yekutieli false-discovery-rate control as the conservative primary map-family correction;
* Benjamini–Hochberg as a diagnostic comparison;
* moving-block bootstrap utilities;
* Hamed & Rao-style modified Mann–Kendall implementation as an extended estimator module;
* interval-sensitivity diagnostics;
* exact WGS84 geodesic area-weighted spatial aggregation;
* strict temporal completeness and coverage gates;
* machine-readable investigation, dataset, and analysis schemas.

The primary production inferential path in the MVP is **OLS + HAC**. The additional statistical modules are available for diagnostics and future expansion and should not be interpreted as independent evidence unless explicitly wired into an investigation configuration.

---

## Scientific Guardrails

Terra Odyssey deliberately enforces a conservative interpretation policy.

### No causal attribution

Observed co-trending is not presented as proof that one environmental driver caused another. The system is a trend-investigation workspace, not a causal attribution model.

### No “significant vs. non-significant” fallacy

For regional comparison, the system evaluates the **paired difference series** rather than treating one region’s p-value and another region’s p-value as a direct test of trend inequality.

### No silent temporal infill

Missing months are not silently replaced with zeros or interpolated just to create a complete-looking series.

### Explicit coverage rules

Annual estimates are subject to coverage eligibility checks. MERRA-2 and GPM use product-specific spatial coverage thresholds during aggregation.

### Honest null results

The application distinguishes an operationally successful computation from a scientifically inconclusive or ineligible finding. A completed job can therefore legitimately produce an `inconclusive` or `ineligible` result.

### Exploratory selection is disclosed

When regions are selected after exploratory screening, the investigation records `selection_status = exploratory_map_selected` so the resulting evidence is not mistaken for a pre-registered comparison.

---

## Statistical Methods

### Trend estimation

For the core trend workflow, Terra Odyssey fits an ordinary least-squares trend with a centered time coordinate and **Newey–West HAC covariance**. The MVP uses Bartlett lag `L = 2` with Student-t inference and `df = n - 2`.

The interface reports slope, standard error, confidence interval, p-value, and diagnostic metadata rather than a bare “trend detected” label.

### Paired regional contrast

For regions A and B, the primary contrast is constructed synchronously:

```text
D_t = Y_A,t − Y_B,t
```

The difference series captures shared temporal variation and cross-region covariance. The corresponding slope contrast is consistent with the identity:

```text
β_D = β_A − β_B
```

### Multiple testing

Spatial screening can create a family of hypotheses. Terra Odyssey records the family context and applies conservative false-discovery control when the workflow requires it.

### Spatial aggregation

Region statistics use area-aware geospatial weighting based on exact WGS84 cell-bound integration and polygon intersection rather than simple unweighted cell counts.

---

## Architecture

Terra Odyssey uses a decoupled scientific backend and interactive frontend, while supporting a **single-port deployment** for demonstration and self-hosting.

```text
┌──────────────────────────────────────────────────────────────┐
│ Frontend — Next.js 15 + TypeScript                           │
│                                                              │
│  Question Builder                                            │
│  MapLibre trend map + Terra Draw region selection            │
│  D3 linked time-series charts                                │
│  Evidence / methods / export UI                              │
└─────────────────────────────┬────────────────────────────────┘
                              │ HTTP / JSON
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ Backend — FastAPI                                            │
│                                                              │
│  Dataset catalog + capabilities                              │
│  Investigation API                                            │
│  Async job queue + worker                                     │
│  SQLite WAL job state                                         │
│  RFC 9457 Problem Details errors                              │
│  Reproducible export bundler                                  │
└─────────────────────────────┬────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ Scientific engine                                             │
│                                                              │
│  NASA data adapters                                           │
│  Temporal normalization                                       │
│  Spatial aggregation                                          │
│  OLS + Newey–West HAC                                         │
│  Paired contrast                                              │
│  FDR correction                                               │
│  Bootstrap / sensitivity / diagnostics                        │
└──────────────────────────────────────────────────────────────┘
```

### Backend execution lifecycle

Each investigation moves through six stages:

```text
validating → acquiring → normalizing → aggregating → analyzing → publishing
```

The worker uses a bounded queue and a single executor process/thread slot by default, preventing uncontrolled concurrent scientific jobs in the MVP.

SQLite is used in WAL mode for durable job state and restart recovery.

---

## Technology Stack

### Backend

* **Python 3.10–3.13**
* FastAPI + Uvicorn
* Pydantic v2
* NumPy, SciPy, pandas
* statsmodels
* xarray, netCDF4, h5py, cftime
* Shapely + pyproj
* jsonschema
* httpx
* SQLite WAL

### Frontend

* **Next.js 15** with App Router
* **React 19**
* **TypeScript 5**
* Tailwind CSS v4
* shadcn/ui-style component primitives
* MapLibre GL JS
* Terra Draw
* D3
* TanStack Query v5

### Quality / CI

* pytest
* pytest-asyncio
* numerical reference/oracle tests
* Pyright / Pylance-compatible typing configuration
* GitHub Actions on Linux and Windows

---

## Repository Structure

```text
/
├── terra-odyssey/                  # executable application code
│   ├── src/
│   │   ├── analysis/               # statistical estimators and diagnostics
│   │   ├── backend/                # FastAPI, jobs, API, persistence, exports
│   │   ├── data/                   # NASA adapters and normalization helpers
│   │   └── frontend/               # Next.js application
│   │       ├── app/                # application entrypoints
│   │       ├── components/         # maps, charts, evidence, UI
│   │       └── lib/                # API client and visualization helpers
│   ├── tests/
│   │   ├── fixtures/               # synthetic NASA-like data
│   │   ├── unit/                   # scientific, adapter, API, orchestration tests
│   │   └── numerical/              # independent numerical oracle tests
│   ├── schemas/                    # machine-readable JSON contracts
│   ├── data/manifests/             # reviewed dataset metadata
│   ├── pyproject.toml
│   └── README.md
├── docs/                           # product, UX, API and scientific documentation
├── references/                     # source material and research references
├── scripts/                        # validation, packaging and repository utilities
├── .gsd/                           # project state, roadmap and execution records
├── .github/                        # CI and contribution workflows
├── AGENTS.md
├── CONTRIBUTING.md
├── SECURITY.md
└── README.md
```

---

## Prerequisites

Install:

* Python **3.10 or newer**
* Node.js **20 or newer**
* npm
* Git

For live NASA Earthdata acquisition, provide valid NASA Earthdata credentials. The repository intentionally does **not** include credentials or raw NASA archives.

---

## Installation

Enter the executable application directory:

```bash
cd terra-odyssey
```

Create a Python environment:

```bash
python -m venv .venv
```

Linux / macOS:

```bash
source .venv/bin/activate
```

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install Python dependencies:

```bash
pip install -e ".[dev]"
```

Install frontend dependencies:

```bash
cd src/frontend
npm ci
cd ../..
```

---

## Running the Application

### Option 1 — Frontend development + backend development

Run the FastAPI server from the `terra-odyssey` directory:

```bash
uvicorn src.backend.app:app --reload --port 8000
```

In a second terminal:

```bash
cd terra-odyssey/src/frontend
npm run dev
```

Useful URLs:

```text
Frontend:      http://localhost:3000
Backend:       http://localhost:8000
Swagger UI:    http://localhost:8000/docs
ReDoc:         http://localhost:8000/redoc
Health check:  http://localhost:8000/api/health
```

### Option 2 — Single-port production-style deployment

Build the static Next.js application:

```bash
cd terra-odyssey/src/frontend
npm ci
npm run build
cd ../..
```

The static export is written to:

```text
src/frontend/out/
```

Then start FastAPI:

```bash
uvicorn src.backend.app:app --host 0.0.0.0 --port 8000
```

FastAPI serves:

```text
GET /          → Next.js static application
/api/*         → Terra Odyssey REST API
/docs          → Swagger UI
/redoc         → ReDoc
```

This is the intended compact deployment model for the MVP: one application server, one port, and a SQLite state store.

---

## Execution Modes

The investigation API supports four execution modes:

| Mode          | Purpose                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------- |
| `auto`        | Prefer available local/cached data, otherwise fall back to demonstration behavior where supported |
| `live`        | Request live NASA Earthdata acquisition; credentials are required                                 |
| `cached_only` | Restrict execution to locally available cached granules                                           |
| `demo_sample` | Run the pipeline against synthetic demonstration data                                             |

Demo output is explicitly marked as demonstration data and should not be presented as a NASA-derived scientific finding.

---

## Earthdata Credentials

Live acquisition checks for NASA credentials in the runtime environment.

For example:

```bash
export EARTHDATA_TOKEN="..."
```

The backend also recognizes compatible Earthdata username configuration and `.netrc` credentials.

Do not commit secrets to Git. See `SECURITY.md` for repository security guidance.

---

## API Overview

Base path:

```text
/api
```

### Catalog

```http
GET /api/catalog
```

Returns reviewed dataset metadata, supported aggregations, defaults, and provenance metadata.

### Runtime capabilities

```http
GET /api/capabilities
```

Returns supported execution modes, runtime information, credential availability, and cached sample information.

### Health

```http
GET /api/health
```

Returns a lightweight service health response.

### Create investigation

```http
POST /api/investigations
```

Creates an asynchronous investigation job and returns its job identifier.

### Investigation status

```http
GET /api/investigations/{job_id}
```

Poll job status, stage, progress, result status, timestamps, and structured error information.

### Cancel investigation

```http
DELETE /api/investigations/{job_id}
```

Requests cooperative cancellation of a queued or running job.

### Investigation series

```http
GET /api/investigations/{job_id}/series
```

Returns the regional time series generated by the completed investigation.

### Evidence

```http
GET /api/investigations/{job_id}/evidence
```

Returns structured evidence, effect sizes, uncertainty, diagnostics, caveats, and interpretation metadata.

### Trend map

```http
GET /api/investigations/{job_id}/map
```

Returns the structured trend grid, diagnostic bands, frozen legend metadata, provenance, and optional bounding-box / downsampling parameters.

### Export

```http
GET /api/investigations/{job_id}/export?format=zip
```

Supported formats include:

```text
zip
json
timeseries_csv
```

The ZIP export is the primary reproducibility artifact.

---

## Reproducible Investigation Records

A completed investigation produces a durable evidence bundle that can include:

```text
investigation_record.json
resolved_configuration.json
analysis_results.json
region_time_series.csv
paired_difference.csv
map_grid.json.gz
manifests/dataset_manifest.json
manifests/source_granules.json
methods/methods.md
software/environment.json
software/version.json
checksums.sha256
```

The bundle is designed so someone can inspect:

* what dataset and product version were used;
* what parameters were resolved;
* what regions and time interval were analyzed;
* what estimator and dependence treatment were applied;
* what coverage and quality rules affected eligibility;
* what caveats were attached to the result;
* how the exported files can be checksum-verified.

The investigation and analysis contracts are validated against **JSON Schema Draft 2020-12**.

---

## Testing

Run the full Python test suite:

```bash
pytest -q
```

The current MVP package passes:

```text
101 passed
```

The suite covers adapter behavior, aggregation, numerical estimators, API contracts, job orchestration, spatial weighting, and numerical reference checks.

The numerical oracle tests independently verify the HAC implementation against a pure NumPy formulation with a relative tolerance below `1e-10` for the tested scenarios.

Build the frontend with:

```bash
cd src/frontend
npm run build
```

The MVP milestone verification recorded a clean Next.js static export.

---

## Data & Provenance Policy

Terra Odyssey stores **dataset manifests and scientific metadata**, not a permanent copy of large NASA archives.

The repository intentionally excludes:

* NASA raw granules;
* Earthdata credentials;
* `.env` files containing secrets;
* `node_modules`;
* generated frontend build output when not needed;
* large offline reference documents from the normal coding context.

Dataset metadata includes product identifiers, versions, variable names, units, temporal and spatial support, retrieval information, provenance links, and quality-policy fields.

---

## Development Principles

The project follows a spec-first workflow recorded in the `.gsd/` directory:

```text
SPEC → PLAN → EXECUTE → VERIFY → COMMIT
```

Scientific behavior is documented alongside implementation decisions so changes to statistical assumptions, coverage policies, or dataset semantics can be reviewed rather than silently introduced.

---

## Limitations of the MVP

This release is deliberately narrower than a full Earth-system analysis platform.

It does **not** provide causal attribution, predictive forecasting, parcel-level agricultural advice, crop-yield prediction, soil-fertility estimation, flood warnings, or health-risk prediction.

Live Earthdata acquisition remains environment-dependent because credentials and network access are deployment concerns.

The current map renderer uses a decimated structured grid for dense fields. Very high-resolution global products will eventually benefit from raster tiles, Cloud-Optimized GeoTIFFs, or custom WebGL shader rendering.

Extremely complex multipolygons can require additional geospatial optimization, especially when very large vertex counts or challenging antimeridian geometries are involved.

---

## Roadmap

Planned directions for subsequent milestones include:

* completing and benchmarking broader MODIS-based regional workflows;
* adding richer sensitivity and seasonal diagnostics to the primary workspace;
* expanding high-density global visualization;
* adding shareable investigation links and collaboration-oriented state;
* expanding report export beyond the current machine-readable evidence bundle;
* benchmarking alternative trend estimators under controlled dependence and missingness scenarios.

Roadmap items should be treated as planned work, not current MVP guarantees.

---

## Contributing

Contributions are welcome, especially where they improve scientific correctness, reproducibility, test coverage, data provenance, accessibility, or performance without weakening the project's scientific guardrails.

Before opening a pull request:

```bash
pytest -q
```

For frontend changes:

```bash
cd src/frontend
npm ci
npm run build
```

Please read `CONTRIBUTING.md`, `AGENTS.md`, and `docs/SCIENTIFIC_RULES.md` before making changes that affect analytical behavior or scientific interpretation.

---

## License

Terra Odyssey is released under the **MIT License**.

---

## Acknowledgements & Data Sources

Terra Odyssey is built for NASA Space Apps Challenge 2026 and relies on public NASA Earth-science products and their associated documentation.

Primary data-source families in the project include:

* NASA GMAO / GES DISC — MERRA-2;
* NASA GPM / GES DISC — IMERG Final;
* NASA LP DAAC — MODIS products.

Dataset-specific provenance and DOI information are stored in `data/manifests/` and in exported investigation records.

---

## Project Status

**Version:** `0.1.0`
**Milestone:** `v0.1.0-mvp`
**MVP verification:** 101 Python tests passing
**Deployment model:** FastAPI + static Next.js SPA on a single port
**Primary scientific estimator:** OLS + Newey–West HAC
**Primary regional comparison:** Paired direct contrast

Terra Odyssey is intentionally built to answer a more useful question than “does the graph look convincing?”:

> **What changed, where, by how much, over what interval, with what uncertainty, under what data-quality assumptions — and can someone reproduce the result?**
