# Architectural & Scientific Decisions: Terra Odyssey

## Phase 2: Scientific Trend Engine & Estimators

**Date:** 2026-09-25

### 1. Statistical Dependency & Implementation
- **Production Choice:** `statsmodels` (`sm.OLS` with `get_robustcov_results`) combined with `scipy.stats`.
- **HAC Configuration:**
  - Covariance type: `"HAC"`
  - Kernel: `"bartlett"`
  - Autoregressive lag: `maxlags=2` (explicit, no automatic bandwidth selection; statsmodels robust OLS requires explicit lags).
  - Finite-sample correction: `use_correction=True`.
  - Reference distribution: Two-sided Student-$t$ distribution (`use_t=True`) with $df = n - 2$.
  - Sensitivity checks: evaluate lag sensitivities at lags 1, 3, and 5 under `method.diagnostics`.
- **Numerical Test Oracle:** Implement an independent, transparent NumPy Newey-West HAC calculation strictly under `terra-odyssey/backend/tests/numerical/`. Use it as a test oracle to cross-verify:
  - OLS slope & intercept coefficients
  - Covariance matrix
  - Slope standard error
  - $t$-statistic & $p$-value
  - 95% confidence interval
- **Rule:** Do not maintain two production estimators in runtime application code.

### 2. Temporal Completeness & Missingness Policy
- **Annual Temperature (D1 - MERRA-2):** Enforce strict 12/12 valid months for inferential annual means.
  - Compute annual mean via day-of-month weighting:
    $$\bar{T}_{\text{annual}} = \frac{\sum_{m=1}^{12} T_m \cdot d_m}{\sum_{m=1}^{12} d_m}$$
    evaluated only when valid month count == 12.
  - Denominator computed only after verifying all 12 exist or strictly masked before division to avoid numerator-denominator contamination.
  - Partial years (10–11 months) may be exposed as an optional descriptive diagnostic, but are strictly ineligible for inferential trend series.
- **Annual Precipitation (D2 - GPM IMERG):** Strict 12/12 valid months required for annual accumulation sum ($mm/\text{year}$).
- **Interval Eligibility:** Require at least 20 consecutive complete annual summaries for default trend inference.
- **Gap Treatment:** If an annual value is missing within the requested interval, do not collapse time or pretend non-consecutive years are consecutive.

### 3. Estimator Palette & Scope
- **Primary Estimator:** OLS slope with centered year coordinate, float64 computation, Bartlett HAC covariance ($L=2$), small-sample correction, Student-$t$ ($df=n-2$), 95% CI.
- **Robustness Diagnostic:** SciPy Theil-Sen estimator (`scipy.stats.theilslopes`) computed as an outlier-resistant point-estimate comparison:
  ```json
  "theil_sen": {
    "slope_per_decade": 0.0,
    "direction_agreement_with_ols": true,
    "absolute_difference_from_ols": 0.0,
    "relative_difference_from_ols": 0.0
  }
  ```
  (Theil-Sen default asymptotic CI is not autocorrelation-aware and shall not be used as the primary inferential CI).
- **Mann-Kendall:** Exclude vanilla Mann-Kendall test from Phase 2 production inference. Defer modified autocorrelation-corrected Mann-Kendall (Hamed & Rao) until it passes complete AR(1) and false-positive simulation gates.

### 4. Interval Sensitivity Design
- **Predefined Windows:** Rather than an unrestricted grid (which drops below the 20-year sample size threshold on a ~2001–2025 record), use 5 predefined one-endpoint-at-a-time windows:
  1. Primary: `start` $\to$ `end`
  2. Later start: `start + 3` $\to$ `end`
  3. Latest start: `start + 5` $\to$ `end`
  4. Earlier end: `start` $\to$ `end - 3`
  5. Earliest end: `start` $\to$ `end - 5`
- **Filtering:** Only retain windows meeting the threshold of $\ge 20$ consecutive complete years.
- **Role:** Stored under `method.diagnostics.interval_sensitivity` as diagnostics of endpoint sensitivity/hiatus artifacts, not independent statistical confirmations.
- **Metrics:** Report slope range, sign agreement, classification changes (`supported`/`inconclusive`), interval width, and eligible year count.

### 5. Schema Serialization Standards
- `effect.estimate`: numeric primary slope per decade ($10 \times \text{slope\_per\_year}$).
- `effect.unit_per_decade`: `"degC/decade"` or `"mm/year/decade"`.
- `effect.fitted_change`: $\text{slope\_per\_year} \times (\text{last\_year} - \text{first\_year})$ (e.g., 2001–2025 span is 24 years).
- `method`:
  ```json
  {
    "estimator": "ols_linear_trend",
    "dependence_treatment": "newey_west_hac_bartlett_lag2_small_sample",
    "test_family": "single_predefined_test",
    "selection_status": "predefined",
    "diagnostics": {
      "kernel": "bartlett",
      "maxlags": 2,
      "lag_sensitivities": [1, 3, 5],
      "use_t": true,
      "degrees_of_freedom": 23,
      "theil_sen": {},
      "interval_sensitivity": []
    }
  }
  ```

---

## Phase 3: Regional Contrast & Evidence Engine

**Date:** 2026-09-25

### 1. Spatial Aggregation & Area Weighting
- **Geometry Engine:** `shapely` for polygon/multipolygon topology, holes, coordinate validation, and intersection geometry; `pyproj.Geod` for ellipsoidal geodesic area computations in $m^2$. Do not use `matplotlib.path.Path` in production.
- **Exact Cell-Bounds Area Weighting:**
  $$A_{ij} \propto \Delta\lambda [\sin(\phi_{\text{north}}) - \sin(\phi_{\text{south}})]$$
  $$w_{ij} = A_{ij} f_{ij}, \quad f_{ij} = \frac{A(\text{cell}_{ij} \cap \text{region})}{A(\text{cell}_{ij})}$$
  $$\bar{Y}_t = \frac{\sum_{i,j} Y_{i,j,t} \cdot w_{ij} \cdot M_{i,j,t}}{\sum_{i,j} w_{ij} \cdot M_{i,j,t}}$$
  where $M_{i,j,t} \in \{0, 1\}$ is valid observation mask.
- **Area-Based Coverage:**
  $$C_t = \frac{\sum_{i,j} w_{ij} \cdot M_{i,j,t}}{\sum_{i,j} w_{ij}}$$
  (Never use raw cell count percentage).
- **Threshold Policy:**
  - MERRA-2 T2M: 100% area coverage within eligible regional footprint for inferential monthly values.
  - GPM IMERG: $\ge 90\%$ area coverage as initial inferential threshold. 80% to <90% exposed only as a descriptive diagnostic. Any product with $<80\%$ area coverage is masked to `NaN`.
  - Validate sensitivity at 80%, 90%, 95%, and 100%.
- **Spatial Edge Cases:**
  - Standardize longitudes ($0\dots 360$ vs $-180\dots 180$) and antimeridian-crossing polygons.
  - Report `requested_geometry_supported_fraction` and `valid_data_area_fraction` to prevent silent boundary clipping.

### 2. Paired Regional Contrast Estimator
- **Formulation:** Synchronous direct difference time series $D_t = Y_{A,t} - Y_{B,t}$.
  - Estimated with verified Phase 2 OLS + Newey-West HAC ($L=2$, Bartlett kernel, small-sample correction, Student-$t$).
  - Evaluates $\beta_D = \beta_A - \beta_B$, directly incorporating cross-regional covariance, shared climate modes, and difference serial correlation.
  - Same dataset, variable, units, temporal aggregation, and calendar years required.
  - At least 20 consecutive common complete years required.
- **Evidence Qualification Logic:**
  - `if either region is ineligible`: `ineligible`
  - `elif signs are not opposite`: `inconclusive / signs_not_opposite`
  - `elif predefined and raw contrast p >= 0.05`: `inconclusive / contrast_not_supported`
  - `elif exploratory and adjusted contrast p >= 0.05`: `inconclusive / contrast_not_supported_after_multiplicity`
  - `else`: `supported / opposite_trend_pair`
- **Reported Statistics:** $\hat{\beta}_A$, $\hat{\beta}_B$, $\hat{\beta}_A - \hat{\beta}_B$, HAC standard error, 95% HAC CI, raw contrast p-value, adjusted contrast p-value, and fitted regional difference over the interval.

### 3. Multiple Testing & Exploratory Map Correction
- **Mandatory Disclosure:** Pairs discovered after visual or map search must be labeled `"selection_status": "exploratory_map_selected"`.
- **Primary FDR Procedure:** Benjamini-Yekutieli (`fdr_by`, $q=0.05$) to control FDR under arbitrary spatial dependency.
- **Sensitivity Diagnostic:** Benjamini-Hochberg (`fdr_bh`, $q=0.05$) reported as sensitivity diagnostic.
- **Family Definition:** The test family must freeze dataset, variable, period, grid domain, quality policies, HAC config, candidate hypotheses, and FDR level before viewing results. Multiplicity must cover actual contrast hypotheses searched ($M = \frac{N(N-1)}{2}$ for $N$ candidate regions), not just individual grid cells.

---

## Phase 4: API & Investigation Orchestration

**Date:** 2026-09-25

### 1. Job Execution Architecture & State Separation
- **Durable Authority:** SQLite database (`jobs.db`) is the sole authoritative job store. In-memory structures serve solely as caches.
- **Concurrency & Resource Protection:**
  - Bounded `asyncio.Queue` prevents unbounded job submission.
  - Dedicated scientific execution via `ProcessPoolExecutor(max_workers=1)`.
  - Scientific worker receives only file paths, job IDs, and configuration hashes over IPC (never heavy xarray or NetCDF objects).
  - Single Uvicorn application worker for the Space Apps MVP.
- **FastAPI Lifespan Management:** Lifespan context manager starts the background queue worker, scans SQLite to recover or mark interrupted jobs upon restart (`interrupted_on_restart`), and drains resources cleanly on shutdown.
- **Three-Tier Status Separation:**
  - `job_status`: `"submitted" | "running" | "succeeded" | "failed" | "cancel_requested" | "cancelled"`
  - `stage`: `"validating" | "acquiring" | "normalizing" | "aggregating" | "analyzing" | "publishing"`
  - `result_status`: `"supported" | "inconclusive" | "ineligible"`
  - An investigation yielding an inconclusive statistical contrast or insufficient scientific coverage executes successfully as an operational job:
    `{"job_status": "succeeded", "result_status": "inconclusive"}` or `{"job_status": "succeeded", "result_status": "ineligible"}`.
- **Operational Guarantees:**
  - `POST /api/investigations` returns HTTP 202 Accepted with job location and configuration hash.
  - Idempotency via `Idempotency-Key` or configuration hash to reject duplicate concurrent/historical runs.
  - Cooperative cancellation checked between pipeline stages.
  - Atomic publication: write to temporary path $\to$ compute SHA-256 $\to$ atomic rename.
  - Zero credential exposure in database state, API responses, logs, or exports.

### 2. Map Data Delivery Contract
- **Payload Format:** Reject raw/full-resolution GeoJSON for global grids. Return compressed structured-grid JSON:
  ```json
  {
    "grid": {
      "crs": "EPSG:4326",
      "width": 180,
      "height": 90,
      "longitude": [],
      "latitude": [],
      "order": "latitude_longitude"
    },
    "bands": {
      "slope_per_decade": [],
      "raw_p_value": [],
      "adjusted_p_value": [],
      "coverage_fraction": [],
      "evidence_code": []
    },
    "legend": {
      "units": "degC/decade",
      "center": 0,
      "minimum": -1.2,
      "maximum": 1.2,
      "fdr_method": "fdr_by",
      "fdr_level": 0.05
    },
    "provenance": {}
  }
  ```
- **Map Endpoint:** `GET /api/investigations/{id}/map?bbox=minLon,minLat,maxLon,maxLat&max_cells=10000` with HTTP gzip/brotli compression.
- **Grid Constraints:**
  - Enforce `max_cells` ceiling.
  - Masked values serialised as JSON `null` (never invalid `NaN`).
  - Never average $p$-values when downsampling grid cells.
  - Frozen FDR test family must never recompute during viewport pan or zoom.
  - GeoJSON reserved strictly for Region A/B boundaries, bounding boxes, and observation footprints.

### 3. Offline NASA Data & Execution Modes
- **Policy:** Verified cache first; zero silent substitution of synthetic fixtures or sample granules.
- **Explicit Modes:**
  - `"auto"`: Use complete verified cache if present; otherwise attempt live NASA Earthdata acquisition.
  - `"live"`: Enforce live acquisition from NASA DAAC; fail if credentials or network are missing.
  - `"cached_only"`: Use only checksum-verified local granules; fail if cache is incomplete.
  - `"demo_sample"`: Explicitly run the bounded demonstration dataset on its true temporal and spatial footprint.
- **Typed Error Semantics:** Missing data or network/credential absence returns RFC 9457 `application/problem+json` with HTTP 503 (`code: "earthdata_unavailable"`).
- **Provenance Separation:** Transport mode separated from scientific release:
  `{"source_release": "5.12.4", "data_mode": "cached_verified", "cache_hit": true, "granule_checksums": [...]}`.
- **Fixture Separation:** Real sample NASA granules reside in `terra-odyssey/backend/data/samples/`; synthetic testing fixtures reside strictly in `terra-odyssey/backend/tests/fixtures/`.

### 4. Investigation Export Bundling
- **Structure:** `terra-odyssey-investigation-{id}.zip`:
  - `investigation_record.json` (strictly conforming to `schemas/investigation-record.schema.json`)
  - `resolved_configuration.json`
  - `results/` (`analysis_results.json`, `region_time_series.csv`, `paired_difference.csv`, `map_grid.json.gz`)
  - `manifests/` (`dataset_manifest.json`, `source_granules.json`)
  - `methods/` (`methods.md`)
  - `report/` (`summary_report.md`)
  - `software/` (`environment.json`, `version.json`)
  - `README.md`
  - `checksums.sha256`
- **Supported Formats:** `?format=zip`, `?format=json`, `?format=timeseries_csv`.
- **Integrity Rules:** Freeze export upon `publishing` stage; generate reports deterministically from typed data; hash every included file; exclude secrets and absolute local paths.

### 5. Schema Pre-requisites
- Extend `schemas/investigation-record.schema.json` prior to implementation with typed properties:
  `schema_version`, `job`, `data_mode`, `artifact_index`, `record_hash`, `published_at`, `source_manifest_objects`, `resolved_configuration_hash`, and `map_family_id`.

---

## Phase 5: Interactive Web Workspace

**Date:** 2026-09-25

> **Scientific interpretation corrections:** Viridis must not be used for signed trend fields; use a frozen zero-centred diverging scale. HAC uncertainty is reported for fitted regression coefficients and slopes, not as an automatic year-by-year band around observations. The trend map summarizes the complete interval and does not change with annual chart hover.
>
> **Post-selection inference:** `exploratory_map_selected` records that a region was chosen after viewing a frozen screening map. The screening map’s BY adjustment does not automatically adjust a new freehand regional contrast. A BY-adjusted contrast requires a separately declared finite contrast family; otherwise the paired result remains explicitly exploratory.
>
> **Map implementation gate:** CanvasSource compatibility and scientific fidelity must be validated under both Mercator and globe projections. GeoJSON fill layers are the fallback for capped grids, with COG/raster or a projection-aware custom layer reserved for future high-density maps.
>
> **Phase 4 gate:** Phase 5 production evidence views cannot be enabled until fabricated map bands, silent synthetic fallback, simplified temporal aggregation and missing contrast-family integration are removed.

### 1. Technology Stack & Layer Responsibility Split
- **Framework:** Next.js App Router (TypeScript) with static export capability (`output: 'export'`) served by FastAPI for production/hackathon single-port deployment.
- **Styling & Components:** Tailwind CSS v4 + `shadcn/ui` (panels, drawers, dialogs, tabs, badges, forms).
- **Map System:** Mapcn component system (built on MapLibre GL JS, styled with Tailwind, following the shadcn copy-into-codebase model). Mapcn acts strictly as the presentation wrapper for controls, popups, and layout; it does not perform scientific calculations.
- **Map Engine:** MapLibre GL JS (WebGL GPU-accelerated rendering engine for projections, raster/canvas sources, and scientific layers).
- **Spatial Drawing:** `maplibre-gl-terradraw` (or Terra Draw with MapLibre adapter) for drawing Region A & Region B rectangles/polygons.
- **Scientific Visualizations:** Custom MapLibre `CanvasSource` (offscreen raster canvas) + stippled/pattern FDR discovery layer. D3 + SVG for linked time series and difference charts.
- **State & Communication:** TanStack Query (`@tanstack/react-query`) for polling FastAPI endpoints (`/api/catalog`, `/api/capabilities`, `/api/investigations`).

### 2. Map Architecture, Projection Spike & Scientific Grid Rendering
- **Zero-Centred Diverging Scale (Viridis Forbidden for Signed Slopes):**
  - Viridis is sequential and strictly prohibited for signed trend fields.
  - Use zero-centred diverging palettes: `BrBG`, `PuOr`, `RdBu` or scientific `"vik"`.
  - Symmetric domain: $[-\max|\beta|, +\max|\beta|]$ frozen across the full dataset interval. Panning and zooming must never rescale the color ramp.
- **Validation Spike & Fallback Path:**
  - *Primary Experiment*: MapLibre `CanvasSource` via an offscreen canvas rendering cells mathematically. Must be tested/validated under both 2D Mercator and 3D Globe projections.
  - *Fallback for $\le 10,000$ displayed cells*: GeoJSON cell polygons with MapLibre fill and fill-pattern layers.
  - *Future High-Density Path*: Cloud-Optimized GeoTIFF (COG) raster tiles or projection-aware custom WebGL shader layer.
- **Evidence & Missing Data Layers:**
  - Benjamini-Yekutieli (`fdr_by`) statistically significant discoveries rendered using a second stippled/pattern layer (significance is never encoded by color alone).
  - Dedicated missing-data and insufficient-coverage visual layer (diagonal hatching / muted fill).
- **Map Bands Contract:**
  - Grid payload must include:
    ```json
    {
      "bands": {
        "slope_per_decade": [],
        "slope_se_per_decade": [],
        "ci_lower_per_decade": [],
        "ci_upper_per_decade": [],
        "raw_p_value": [],
        "adjusted_p_value": [],
        "coverage_fraction": [],
        "eligibility_code": [],
        "evidence_code": []
      }
    }
    ```
    (If payload size becomes excessive, keep slope, adjusted evidence, and coverage in `/map`, retrieving full diagnostics through a `/map/cell` detail endpoint).
- **Fast Transport:** FastAPI serves `map_grid.json.gz` with HTTP `Content-Encoding: gzip`. The browser handles decompression transparently; frontend does not execute manual JS decompression.
- **Projection Modes:**
  - 2D Mercator: primary analysis and precision regional selection.
  - 3D Globe: global overview and NASA-style presentation.
  - Projection toggle preserves all scientific evidence, selected regions, and legend thresholds unchanged.

### 3. Region Selection & Post-Selection Inference (Multiplicity Disclosure)
- **Terra Draw Integration:** Explicit controls for Draw Region A, Draw Region B, Edit, Delete, Confirm.
- **Visual Accessibility:** Regions A and B must feature prominent persistent text labels ("A" and "B") rather than relying on color alone.
- **Exploratory Hypothesis Tracking:**
  - Drawing arbitrary polygons after viewing a cellwise screening map creates a new data-dependent regional hypothesis.
  - Applying BY to the original map-cell p-values does *not* automatically adjust the newly selected regional contrast.
  - Record two distinct family concepts:
    ```json
    {
      "selection_status": "exploratory_map_selected",
      "screening_family_id": "<map-family-id>",
      "contrast_family_id": null
    }
    ```
  - For freehand exploratory regions: run the paired contrast, report its raw p-value, disclose post-map selection, label it exploratory, and do not claim BY-adjusted confirmation unless the contrast belonged to a declared finite family.
  - Curated presets defined before analysis remain `predefined`.

### 4. Linked Scientific Charts & Evidence Panels
- **D3/SVG Time-Series Engine:**
  - Display observed $Y_A(t)$, $Y_B(t)$, and synchronous difference $D_t = Y_{A,t} - Y_{B,t}$ with valid coverage bars.
  - Display fitted trend lines and zero-line contrast.
  - Newey-West HAC uncertainty is reported as a scalar slope CI in the evidence card. A fitted-mean trend band is displayed only if explicitly calculated from the full HAC coefficient covariance matrix (never a raw $D_t$ band labeled as "HAC confidence band").
  - Chart hover: crosshair shows A, B, and D values for that specific year.
  - **No Annual Map-Time Linking:** The trend map represents the slope over the complete interval, not an annual field. Chart hover does *not* change the trend map.
- **Evidence Drawer & Status Badges:**
  - Clear semantic badges (`Supported: Opposite-Trend Pair`, `Inconclusive: Contrasting Slopes Not Significant`, `Inconclusive: Slopes Share Same Sign`, `Ineligible: Record Too Short`).
  - Transparent methods inspector detailing OLS + Newey-West HAC lag, BY FDR screening correction, and dataset release metadata.
  - Direct download triggers for frozen `.zip` bundle, `.json` record, and `.csv` series.

### 5. Phase 4 Scientific Integration Gate
- Phase 5 production evidence views cannot be enabled until the following Phase 4 backend items are completed:
  1. Replace prototype fabricated map slopes and p-values in stepper with verified scientific calculation or real sample pipeline.
  2. Eliminate silent `auto` fallback to synthetic cube.
  3. Align temporal aggregation with validated day-of-month and calendar-hours aggregation.
  4. Integrate actual exploratory contrast-family adjudication.
- Phase 5 frontend may use explicit developer fixtures during initial UI development, but production evidence rendering remains blocked until this gate is cleared.


