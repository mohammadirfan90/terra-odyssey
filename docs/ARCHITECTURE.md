# Terra Odyssey — System Architecture

Terra Odyssey is an open, reproducible Earth-system trend investigation workspace engineered for NASA Space Apps 2026's **"Be An Earth System Trend Detective!"** challenge. It empowers researchers, environmental analysts, students, and science communicators to rigorously answer:
**what changed, where, by how much, over which interval, with what uncertainty, and whether empirical observations support a statistically defensible trend**—without conflating correlation with causation or masking observational realities.

---

## 1. High-Level Architectural Topology

Terra Odyssey is decoupled into two independent, purpose-built applications: a high-performance **Python Scientific Backend** and a reactive **Next.js Interactive Workspace Frontend**.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Next.js 16 Interactive Workspace                     │
│  MapLibre GL basemap · Canvas raster grid · D3 linked time series      │
│  Question Builder · Evidence Drawer · Methods Inspector · Permalinks   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST / SSE / RFC 9457
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      FastAPI Scientific Backend                        │
│  Lifespan runner · Catalog service · Investigation pipeline worker     │
│  Bounded execution queue · Authoritative SQLite job store               │
└──────┬────────────────────────────┬─────────────────────────────┬──────┘
       │                            │                             │
       ▼                            ▼                             ▼
┌──────────────┐             ┌──────────────┐             ┌──────────────┐
│ Data Adapter │             │ Trend Engine │             │ Export Engine│
│ MERRA-2 T2M  │             │ OLS HAC      │             │ Self-contained│
│ GPM IMERG    │             │ Theil-Sen    │             │ Manifests,   │
│ MODIS LST    │             │ Mod. Mann-K. │             │ JSON Records,│
│ MODIS NDVI   │             │ Block Boot.  │             │ CSV & Reports│
└──────────────┘             └──────────────┘             └──────────────┘
```

---

## 2. Backend Architecture (`terra-odyssey/backend/`)

### 2.1 File System Boundary & Paths
All backend data, manifests, schemas, databases, and artifacts are resolved through `backend.paths`, making execution independent of the working directory or host platform:
- `backend/data/manifests/`: Versioned NASA product discovery manifests (`d1_merra2_t2m.json`, `d2_gpm_imerg.json`, `d3_modis_lst.json`, `d4_modis_vegetation.json`).
- `backend/data/jobs.db`: Authoritative SQLite store for job states, stages, and execution metadata.
- `backend/data/investigations/`: Preserved immutable investigation records, intermediate NetCDF/Zarr cubes, and CSV time-series exports.
- `backend/schemas/`: Canonical Draft 2020-12 JSON schemas (`dataset-manifest`, `analysis-result`, `investigation-record`).

### 2.2 Data Ingestion Layer (`src/data/adapters/`)
Each NASA product has a dedicated, strongly-typed adapter responsible for discovery, downloading, decoding, quality filtering, and calibration:
1. **D1: MERRA-2 2-Meter Air Temperature (`d1_merra2.py`)**
   - Collection: `M2TMNXSLV` v5.12.4 (GMAO reanalysis)
   - Spatial Grid: 0.5° × 0.625° global regular grid
   - Processing: Kelvin to Celsius conversion, area-weighting by cosine latitude.
2. **D2: GPM IMERG Final Precipitation (`d2_gpm_imerg.py`)**
   - Collection: `GPM_3IMERGM` v07B (satellite microwave-IR with gauge calibration)
   - Spatial Grid: 0.1° × 0.1° global regular grid
   - Processing: Fill value (`-9999.9`) filtering, mm/hr to mm/month calendar-month conversion.
3. **D3: MODIS Land Surface Temperature (`d3_modis_lst.py`)**
   - Collection: `MOD11A2` v061 (8-day composite, 1km)
   - Processing: Scale factor `0.02`, QC bitmask filtering (cloud contamination, emissivity quality), day/night stratification.
4. **D4: MODIS Vegetation Indices NDVI (`d4_modis_ndvi.py`)**
   - Collection: `MOD13A3` v061 (monthly composite, 1km)
   - Processing: Scale factor `0.0001`, valid range `[-0.2, 1.0]`, fill value `-3000` masking, reliability rank filtering.

### 2.3 Scientific Trend Engine (`src/analysis/`)
The analysis engine enforces strict statistical criteria to prevent spurious trend detection in autocorrelated climate data:
- **Spatial Aggregation (`spatial_aggregation.py`)**: Computes cell-area weighted regional means using spherical cosine latitude weights:
  $$w(\phi) = \cos\left(\frac{\pi \phi}{180}\right)$$
- **OLS with HAC Covariance (`trend_estimator.py`)**: Computes linear slope with Newey-West heteroskedasticity and autocorrelation consistent (HAC) standard errors, automatically selecting lag truncation $L = \lfloor 4(N/100)^{2/9} \rfloor$.
- **Theil-Sen Robust Estimator (`trend_estimator.py`)**: Median of all pairwise slopes, insensitive to outliers (breakdown point 29.3%).
- **Modified Mann-Kendall (`modified_mann_kendall.py`)**: Non-parametric rank trend test incorporating Hamed & Rao (1998) variance correction for lag-$k$ autocorrelation:
  $$\mathrm{Var}^*(S) = \mathrm{Var}(S) \cdot \left[1 + \frac{2}{n(n-1)(n-2)} \sum_{i=1}^{n-1} (n-i)(n-i-1)(n-i-2) \rho^*(i)\right]$$
- **Moving Block Bootstrap (`block_bootstrap.py`)**: Resamples contiguous temporal blocks to capture unknown dependent error structures, producing non-parametric empirical confidence intervals.
- **Paired Regional Contrast (`paired_contrast.py`)**: Computes difference slope $(\beta_A - \beta_B)$ and joint HAC covariance to avoid the fallacy of declaring regional divergence when one region is statistically significant and another is not.
- **Multiplicity Control (`multiplicity.py`)**: Controls false discovery rates (FDR) using the Benjamini-Hochberg procedure over multiple comparison families.

### 2.4 Orchestration & Worker Lifespan (`src/backend/`)
- **FastAPI API (`app.py`, `api/`)**: Provides OpenAPI-compliant REST endpoints with RFC 9457 Problem Details error schemas.
- **Job Store (`store.py`)**: SQLite-backed job status and persistence with atomic transitions (`queued` → `running` → `succeeded` / `failed`).
- **Worker (`worker.py`, `stepper.py`)**: Threadpool worker executing pipeline steps deterministically: validation, spatial subsetting, temporal harmonization, trend estimation, contrast computation, and artifact bundling.

---

## 3. Frontend Architecture (`terra-odyssey/frontend/`)

### 3.1 Technology Stack
- **Framework**: Next.js 16.3.6 (App Router, Turbopack)
- **UI Library**: React 19.3.0, TypeScript 7
- **Mapping**: MapLibre GL JS with OpenFreeMap vector basemaps (positron & dark styles, no API keys or telemetry)
- **Visualizations**: D3.js (v7) linked time-series charts with confidence bounds, uncertainty envelopes, and coverage indicators
- **Styling**: Tailwind CSS with custom Earth-system design tokens (atmospheric slate, deep oceanic indigo, cyan accents)

### 3.2 Key Components
- **Question Builder (`components/investigation/QuestionBuilder.tsx`)**: Guides users to construct scientifically defensible inquiries selecting validated NASA products, date bounds, and spatial regions.
- **Interactive Earth Map (`components/map/EarthTrendMap.tsx`, `components/ui/map.tsx`)**: Renders global trend slopes using off-screen canvas raster grids for instant rendering, supporting study-region selection boxes and cell inspection.
- **Evidence Drawer (`components/evidence/EvidenceDrawer.tsx`, `ContrastCard.tsx`)**: Dissects empirical findings, reporting effect sizes, 95% HAC confidence intervals, p-values, degrees of freedom, and explicit caveats.
- **Linked Time Series Chart (`components/charts/LinkedTimeSeriesChart.tsx`)**: Interactive D3 visualization showing regional historical values, deseasonalized anomalies, and fitted trend lines.

---

## 4. Reproducibility & Security Boundaries

1. **Self-Contained Investigation Records**:
   Every analysis produces a versioned, immutable `InvestigationRecord` containing complete provenance (DAAC source URLs, collection versions, bounding boxes, quality mask bits, estimator settings, and computation timestamps).
2. **Zero NASA Credential Leakage**:
   Authentication tokens for NASA Earthdata CMR/OPeNDAP access are handled strictly on the backend and never exposed to client-side bundles or client state.
3. **No Synthetic Value Substitution**:
   Real NASA datasets are used in production. Synthetic data fixtures are strictly segregated under `backend/tests/fixtures/` and only invoked during unit or numerical oracle testing.
