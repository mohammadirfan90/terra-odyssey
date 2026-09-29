---
updated: 2026-09-29T17:05:00+06:00
milestone: v0.2.0-trends
status: IN_PROGRESS
---

# Project State: Terra Odyssey

## Current Position

**Milestone:** v0.2.0-trends (Earth System Trend Detective)
**Status:** 🚀 In Progress (Phase 1, Phase 2, & Phase 3 Complete & Verified; Phases 4–8 Planned)
**Roadmap:** [.gsd/ROADMAP.md](ROADMAP.md)
**Master Research Plan:** [.gsd/TRENDS_DATA_RESEARCH_PLAN.md](TRENDS_DATA_RESEARCH_PLAN.md)
**Phase 1 Verification:** [.gsd/TRENDS_PHASE_1_VERIFICATION.md](TRENDS_PHASE_1_VERIFICATION.md)
**Phase 2 Verification:** [.gsd/TRENDS_PHASE_2_VERIFICATION.md](TRENDS_PHASE_2_VERIFICATION.md)
**Phase 3 Verification:** [.gsd/phases/3/VERIFICATION.md](phases/3/VERIFICATION.md)

---
### Dataset Pipeline Hardening & Error Elimination Across All Catalogs:
1. **Full Trend-Supported Pipeline Resolution**:
   - Implemented `ClimateIndexAdapter` covering all 7 teleconnection patterns (`climate_oni`, `climate_nao`, `climate_amo`, `climate_pdo`, `climate_iod`, `climate_ao`, `climate_mei`).
   - Aligned canonical variable names in `stepper.py` for `airs_precip` (`precip` / `precipitation`), `merra2_precip` (`PRECTOT` / `PRECTOTCORR`), `ghrsst_mur_sst` (`analysed_sst` / `sea_surface_temperature`), and `aviso_ssh` (`sla` / `adt`).
   - All trend-supported datasets now execute and return `supported` or `inconclusive` without query interruptions.
2. **Truthful Handling of Short-Record Products (< 20 Years)**:
   - For short records (`smap_sss`, `aquarius_sss`), pipeline executes observed annual mean time series without error.
   - Stage 5 strictly assigns `result_status = "ineligible"` adhering to NASA's >=20-year decadal trend floor rule.
   - Frontend renders the observed time series curve accompanied by an informative badge (`Observed Series Only · Decadal Trend Ineligible (<20 yr record)`) rather than blocking error alerts.
3. **Quality & Packaging**:
   - Backend pytest suite: **249/249 passed (100% green)**.
   - Frontend TypeScript: **0 errors**.
   - Frontend ESLint: **0 errors**.
   - Next.js Turbopack build: **Compiled successfully**.
   - Archive packaged into `terra-odyssey.zip`.

---
### Interactive Plot Selection & Targeted Section Trend Analysis:
1. **Interactive Multi-Plot Management & On-Map Selection**:
   - Multiple saved/drawn study plots are maintained and rendered concurrently on the MapLibre globe.
   - The active study plot is highlighted with vibrant cyan contours, semi-transparent cyan fill, and vertex anchor nodes, while other saved plots display with subtle slate borders.
   - Clicking directly on any study plot on the map automatically selects it as active, focuses/centers the globe camera on that section, and displays an on-map popup with direct actions: **`▶ Analyze this section`**.
2. **Clean Minimal On-Demand Controls (De-cluttered & Streamlined)**:
   - Replaced bloated, multi-row floating card with an ultra-compact 34px precision micro-pill on the map:
     - Shows only essential information: Region name/selector and area (`0.09 km²`).
     - Replaced 5 competing buttons/checkboxes with a single clean toggle:
       - When viewing global: `[▶ Analyze Section]`
       - When analyzing section: `[🌐 Reset to Global]`
     - Minimal dismiss button (`✕`) to clear the region.
     - Removed redundant clutter: eliminated `SECTION ACTIVE` banner pill, perimeter measurements, pink candy buttons, `Edit` button, and `Auto-run` checkbox.
3. **Clean CAD Drawing HUD**:
   - Replaced verbose "1 vertices added · click map to add more • 0.2 km perimeter" and pink "Stop Plotting" buttons with a sleek, compact status bar:
     - Grammatically correct point counter (`1 point` / `N points`).
     - Live area when valid (`1,420 km²`).
     - Clean `Done` (when points >= 3) and `Cancel` (`Esc`) buttons.
4. **Natural Scientific Copywriting (No AI Slop)**:
   - Replaced pretentious phrases like `"Estimand evaluation in progress • OLS + Newey-West HAC"` with clean, standard `"Calculating trend..."`.
   - Cleaned `TopNavDeck` by removing loud pink buttons in favor of standard circular tool toggles.
5. **Verification & Quality Gate**:
   - Backend pytest suite: **249/249 tests passed (100% green)**.
   - Frontend TypeScript check (`npm run typecheck`): **0 errors**.
   - Frontend ESLint check (`npm run lint`): **0 errors**.
   - Next.js Turbopack build (`npm run build`): **Compiled successfully (0 errors)**.

---

### Map Visuals & UI/UX Overhaul — Real Earth Observation Satellite Layers:
1. **Total Elimination of Artificial Polygon Grids**:
   - Completely removed the 1,600-square artificial cell grid and harsh wireframe graph-paper cage lines (`TrendGridLayer`) that previously covered the globe in solid red/blue washes.
   - Restored crystal-clear visibility of real Earth landforms, oceans, coastlines, and mountain ranges.
2. **Real NASA GIBS Earth Observation Satellite Layers**:
   - Elevated real NASA Global Imagery Browse Services (GIBS) WMTS raster layers as the primary Earth visual experience:
     - GPM IMERG Precipitation Rate (real satellite storm precipitation swaths and radar bands).
     - MODIS Terra Land Surface Temperature (Day) 8-day composite thermal radiance.
     - MODIS Terra Natural Color Corrected Reflectance (real daily optical satellite imagery from orbit).
     - MODIS NDVI Vegetation Greenness Index.
     - NSIDC Polar Sea Ice Concentration.
     - MUR High-Resolution Sea Surface Temperature.
   - Fixed raster source lifecycle with clean re-creation on dataset changes to ensure seamless, glitch-free satellite tile streaming.
3. **NASA Earth Observation Layer HUD Deck**:
   - Relocated to top-left (`left-[22px] top-[76px]`) to permanently resolve the top-right collision with `FloatingEvidenceCard` and `MENU`.
   - Stacked neatly below the active study region plot card (`top-[136px]`) when a plot is active.
   - Added 1-click **Satellite Science Retrieval** vs **Natural Color Earth** layer mode switcher.
   - Added instrument-specific scientific color scale bars (Precipitation in mm/hr, Temperature in °C, Vegetation in NDVI, Sea Ice in %).
   - Integrated live date readout synchronized with the bottom telemetry timeline slider.
4. **Cinematic Atmospheric Effects & Evidence Card Clamping**:
   - Added subtle atmospheric orbital limb vignette over the globe viewport.
   - Clamped `FloatingEvidenceCard` height with `calc(100vh - var(--dock-h,280px) - 96px)` so it never collides with or obscures the telemetry dock.
5. **Quality Verification & Packaging**:
   - Backend pytest suite: **238/238 tests passed (100% green)**.
   - Frontend TypeScript check (`npm run typecheck`): **0 errors**.
   - Frontend ESLint: **0 errors**.
   - Next.js Turbopack build (`npm run build`): **Compiled successfully; static export in 1.3s**.
   - Codebase packaged via `pwsh .\scripts\package-codebase.ps1` into `terra-odyssey.zip` (**912 clean files, 6166 KB**).


---

### Recent UI/UX Overhaul & Comprehensive Light Mode Unification:
1. **Universal Query Bar & TopNavDeck Light Mode**:
   - Converted [TopNavDeck.tsx](file:///A:/teraaaaaa/terra-odyssey/frontend/components/menu/TopNavDeck.tsx) from dark gradient (`from-slate-950`) to clean, high-contrast Light Mode (`bg-white/95`, `border-slate-200`, `text-slate-800`, light button states, red stop plotting badge).
   - Converted `.header-search`, `.search-results`, `.search-result`, `.query-shortcut`, `.query-selection`, and `.query-starters` in [globals.css](file:///A:/teraaaaaa/terra-odyssey/frontend/app/globals.css) from dark backgrounds to crisp Light Mode (`bg-white/96`, `border-slate-200`, dark typography `text-slate-900`, `text-slate-700`).
2. **Global CSS Theme & UI Components Light Mode**:
   - Converted `:root` CSS variables and `body` in [globals.css](file:///A:/teraaaaaa/terra-odyssey/frontend/app/globals.css) from dark defaults to light defaults (`--background: 210 40% 98%`, `--card: 0 0% 100%`, `--foreground: 222 47% 11%`, `body: bg-[#f8fafc] text-[#0f172a]`).
   - Converted base UI components [card.tsx](file:///A:/teraaaaaa/terra-odyssey/frontend/components/ui/card.tsx), [button.tsx](file:///A:/teraaaaaa/terra-odyssey/frontend/components/ui/button.tsx), [badge.tsx](file:///A:/teraaaaaa/terra-odyssey/frontend/components/ui/badge.tsx), [tabs.tsx](file:///A:/teraaaaaa/terra-odyssey/frontend/components/ui/tabs.tsx), [select.tsx](file:///A:/teraaaaaa/terra-odyssey/frontend/components/ui/select.tsx), and [slider.tsx](file:///A:/teraaaaaa/terra-odyssey/frontend/components/ui/slider.tsx) to Light Mode.
   - Converted [MenuPanel.tsx](file:///A:/teraaaaaa/terra-odyssey/frontend/components/menu/MenuPanel.tsx), [DatasetSection.tsx](file:///A:/teraaaaaa/terra-odyssey/frontend/components/menu/sections/DatasetSection.tsx), and [MeasureReadout.tsx](file:///A:/teraaaaaa/terra-odyssey/frontend/components/menu/sections/MeasureReadout.tsx) to Light Mode.
   - Converted [EarthTrendMap.tsx](file:///A:/teraaaaaa/terra-odyssey/frontend/components/map/EarthTrendMap.tsx) HUD and persistent plot cards, [RegionDrawControls.tsx](file:///A:/teraaaaaa/terra-odyssey/frontend/components/map/RegionDrawControls.tsx), and [EarthTrendMapWrapper.tsx](file:///A:/teraaaaaa/terra-odyssey/frontend/components/map/EarthTrendMapWrapper.tsx) skeleton to Light Mode.
3. **Dock Full-Width, Flush & Shadowless Layout**:
   - Updated `.app-dock` in [globals.css](file:///a:/teraaaaaa/terra-odyssey/frontend/app/globals.css) and [ActivityDock.tsx](file:///a:/teraaaaaa/terra-odyssey/frontend/components/dock/ActivityDock.tsx) to be 100% width (`w-full`), 0 margin, 0 border radius, no box-shadow, and removed the colored radial-gradient glow pseudo-elements.
4. **Repositioned Map Control Deck (`<MapControlDeck>`)**:
   - Adjusted `bottomOffset` in [page.tsx](file:///a:/teraaaaaa/terra-odyssey/frontend/app/page.tsx) to `16` so the map control pill sits directly near the dock below without obscuring the map viewport.
5. **Rigorous Quality Verification & Packaging**:
   - TypeScript check (`npm run typecheck`): 0 errors.
   - ESLint (`npm run lint`): 0 errors.
   - Next.js Turbopack build (`npm run build`): SUCCESS in 3.2s.
   - Backend unit tests (`pytest`): 121/121 passed.
   - Codebase archive: packaged into [terra-odyssey.zip](file:///a:/teraaaaaa/terra-odyssey.zip) (488 clean files).

---

2. **Intuitive Stop Plotting Feature & Ubiquitous Selected Area Displays (km²)**:
   - **Stop Plotting Anywhere**:
     - **On-Map Interactive Floating HUD (`EarthTrendMap.tsx`)**: Replaced non-interactive static text with a floating, high-contrast, backdrop-blurred HUD featuring:
       - Active tool indicator with pulsing status beacon.
       - Real-time live area display: `Selected Area: X,XXX km²` updating smoothly at 60/120 fps.
       - Direct **`[✓ Finish Plot (N pts)]`** button when $\ge 3$ vertices are placed for polygon drawing.
       - Prominent red **`[✕ Stop Plotting]`** button that immediately discards scratch shapes and exits drawing mode.
       - Keyboard `Escape` listener instantly canceling any active drawing mode.
     - **TopNavDeck Stop Button (`TopNavDeck.tsx`)**: The deck button transforms into an active red `<X /> Stop Plotting` button for *all* active draw and measurement modes, canceling and cleaning up upon click.
     - **Menu Area Tools Quick Cancel (`AreaSection.tsx`)**: Added a dedicated `[✕ Stop]` action inside the shape selector button while drawing.
   - **Ubiquitous Selected Area in km²**:
     - **Real-Time Drawing**: `polygonAreaSqM` and `rectangleAreaSqM` compute live geodesic WGS-84 area on every frame and broadcast `"terra-odyssey:live-drawing-metrics"` to both the on-map HUD and the footer.
     - **Persistent On-Map Study Region Card**: Placed at `top-4 left-4`, showing `Selected Study Region [ACTIVE]`, area in $\text{km}^2$, hectares, perimeter in $\text{km}$, and a trash icon to delete the active plot.
     - **Telemetry Footer (`FooterStatusBar.tsx`)**: Displays `Live Area: X,XXX km²` during drawing; displays `Area: X,XXX km² (ha) • Perimeter • Centroid` for custom active plots; and calculates/displays geodesic WGS-84 area (`X,XXX km²`) for preset study regions (e.g. Western US) so area in km² is never missing.
   - **Quality Verification & Packaging**:
     - TypeScript check (`npm run typecheck`): 0 errors.
     - ESLint (`npm run lint`): 0 errors.
     - Next.js 16.3.6 Turbopack production build (`npm run build`): SUCCESS.
     - Backend pytest suite: **136/136 tests passed** (100% green).
     - Codebase packaged via `pwsh .\scripts\package-codebase.ps1` into `terra-odyssey.zip` (517 clean files).

---

### Phase 3 Research & Deliverables Overhaul (Real Datasets, GIBS Layers, Agency Logos, Graph Perfection):
1. **Phase 3 Deep Technical Research (`.gsd/phases/3/RESEARCH.md`)**:
   - Documented all 9+ canonical NASA and partner Earth system datasets categorized across 6 scientific domains (Atmosphere, Hydrology, Land Surface, Cryosphere, Oceans, Radiation Budget).
   - Specified exact collection versions, CMR concept IDs, physical variables, QA bitmasks, and official open ingestion endpoints (NASA POWER, GES DISC, LP DAAC, NSIDC, NOAA NCEI).
   - Enforced zero-mock, real-data-only constraint across all backend and frontend execution surfaces.
2. **Real NASA GIBS Map Layer Integration (`EarthTrendMap.tsx`)**:
   - Hooked MapLibre WebGL map directly into NASA Global Imagery Browse Services (GIBS) WMTS endpoints (`epsg3857/best/{layer}/default/{date}`).
   - Added dynamic layer mounting and smooth date-scrubbing raster tile swaps beneath vector boundaries and plot paths.
   - Added on-map floating NASA Observation Layer HUD card with agency logo, WMTS badge, date indicator, live eye toggle, and opacity slider (10% to 100%).
3. **Space Agency Vector SVG Logo Suite (`AgencyLogos.tsx`)**:
   - Designed pixel-perfect SVG vector logos for NASA (official Meatball insignia), ESA, JAXA, NOAA, Copernicus, USGS, and NSIDC.
   - Replaced plain agency text across `DockDatasetPicker.tsx`, `DatasetCatalog.tsx`, `DatasetSection.tsx`, `FooterStatusBar.tsx`, and `ActivityDock.tsx`.
4. **Graph Perfection & Telemetry Smoothness (`DockTimeSeriesChart.tsx`)**:
   - Replaced straight jagged lines with smooth D3 monotone cubic splines (`buildMonotoneCubicPath`).
   - Added shaded 95% confidence interval ribbon (`ci_95`) with dashed boundary guidelines.
   - Added authoritative decadal linear trend slope line overlay ($\text{rate}/decade$).
   - Upgraded crosshair to dual-axis vertical and horizontal precision lines with pulsing halo beacon.
   - Added decadal rate-of-change badge inside the glassmorphic inspection tooltip.
5. **Quality Verification & Packaging**:
   - TypeScript check (`npm run typecheck`): 0 errors.
   - ESLint (`npm run lint`): 0 errors.
   - Next.js Turbopack build (`npm run build`): SUCCESS in 5.6s.
   - Backend unit tests (`pytest`): 136/136 tests passed (100% green).
   - Codebase packaged via `pwsh .\scripts\package-codebase.ps1` into `terra-odyssey.zip` (517 clean files).

---

### Phase 3 Complete — Precipitation & Paired Regional Contrasts:
1. **GPM IMERG Final Adapter (`d2_gpm_imerg.py`)**:
   - Integrated `GPM_3IMERGM` v07 precipitation estimates with exact calendar-month hour accumulation (`calendar.monthrange`).
   - Masked fill values (`-9999.9`) and negative rates; strictly validated 12/12 complete calendar months ($\ge 20$ complete years required).
   - Activated capabilities in `registry.py` (`["Browse", "View", "Analyze", "Compare"]`).
2. **Paired Regional Contrast Estimator (`paired_contrast.py`)**:
   - Enforced common calendar-year intersection without gap infill ($\ge 20$ consecutive common complete years).
   - Proved algebraic linearity ($\beta_\Delta = \beta_A - \beta_B$) with Newey-West HAC covariance ($L=1$).
   - Formally tested hypothesis $H_0: \beta_A - \beta_B = 0$ and adjudicated truthful evidence status (`ineligible`, `inconclusive`, `supported`).
   - Added combined spatial bounding in `stepper.py` to prevent multi-region boundary clipping.
   - Populated `series.json`, `region_time_series.csv`, and `/api/investigations/{job_id}/evidence` with contrast telemetry.
3. **Dual-Series Timeline Dock & Light Mode UI**:
   - Integrated `PairedContrastSummary` into frontend `types.ts`.
   - Dedicated **Paired Regional Contrast** card in `FloatingEvidenceCard.tsx` with delta slope, 95% HAC CI, p-value, and scientific rule alert.
   - Surfaced contrast delta badge in `ActivityDock.tsx` header strips.
   - Converted `ContrastCard.tsx` completely to clean Light Mode.
4. **Empirical Quality Proof**:
   - Backend pytest suite: **142/142 passed** (100% green).
   - Frontend typecheck: **0 errors**.
   - Frontend ESLint: **0 errors**.
   - Next.js Turbopack production build: **Compiled successfully**.

---

---

### Phase 5 Complete — MODIS LST & NDVI Adapters:
1. **MODIS LST Adapter (`d3_modis_lst.py`)** — Full Phase 5 implementation:
   - QC bitmask decoding: bits 0-1 of `QC_Day`/`QC_Night` (00/01=keep, 10/11=cloud/bad→NaN).
   - Raw fill value (0) masked before scale; scale factor 0.02 applied (T_K = raw × 0.02).
   - Physical plausibility bounds: 200–380 K; unit conversion K→°C.
   - Monthly aggregation from 8-day composites (`normalize_to_monthly`).
   - Annual mean with configurable minimum month coverage (`min_months=6`).
   - `cite()` and backward-compat `get_citation_provenance()`, `convert_units()`, `process()` methods.
2. **MODIS NDVI Adapter (`d4_modis_ndvi.py`)** — Full Phase 5 implementation:
   - VI_Quality bitmask decoding: bits 0-1 (0b11=bad→NaN).
   - Fill value -3000 masked; scale factor 0.0001 in `convert_units()`.
   - Physical range screening: [-0.2, 1.0] after scaling.
   - Phenology-aware annual aggregation: calendar year, NH growing season (Apr–Oct), SH growing season (Oct–Apr).
   - Min-month coverage enforcement (never zero-fills missing months).
3. **Registry Promotion**: Both datasets promoted to `series_supported=True`, `trend_supported=True`, `contrast_supported=True`.
4. **Stepper Routing**: Physical conversion and temporal aggregation blocks extended for MODIS LST and NDVI dataset families.
5. **Test Suite**: **191/191 passed** (100% green). +26 new Phase 5 tests covering QA masking, scale factors, aggregation, fill screening, and growing-season modes.
6. **Packaging**: `terra-odyssey.zip` updated.

---

### Phase 6 Complete — Grounded AI Narrative Summaries via NVIDIA NIM (Nemotron-3 120B A12B):
1. **Grounded AI Narrator Engine (`ai_narrator.py`)**:
   - Model: `nvidia/nemotron-3-super-120b-a12b` (NVIDIA Nemotron-3 Super 120B Mixture-of-Experts with 12B active parameters). Configurable via `NVIDIA_NIM_MODEL` env var.
   - Endpoint: `https://integrate.api.nvidia.com/v1` (OpenAI-compatible NIM endpoint).
   - Minimal evidence payload extraction from `InvestigationRecord`: forwards only verified statistical fields (effect estimate, 95% HAC confidence intervals, p-values, degrees of freedom, paired contrast metrics, provenance); excludes all raw data arrays.
   - 10 strict scientific grounding rules enforced in system prompt: no external hallucination, zero causal assertion, verbatim quotation of effect sizes and p-values, explicit reporting of "inconclusive" and "ineligible" findings, and mandatory data source attribution.
   - Resilient retry logic with exponential backoff on transient network failures.
2. **FastAPI Endpoints (`investigations.py`)**:
   - `POST /api/investigations/{job_id}/narrative`: generates grounded summary via NVIDIA NIM Nemotron-3 120B, caches result in `ai_narrative.json` inside the investigation artifact directory.
   - `GET /api/investigations/{job_id}/narrative`: returns cached narrative JSON.
   - Clean status codes: 503 if `NVIDIA_API_KEY` is unconfigured (with guidance hint and model ID), 404 for missing jobs/narratives, 409 for unfinished jobs.
3. **Frontend Integration (`AINarrativeCard.tsx` & `FloatingEvidenceCard.tsx`)**:
   - Implemented `AINarrativeCard` with NVIDIA NIM branding, token metrics, generation latency, prompt versioning, and scientific integrity warning.
   - Integrated `useInvestigationNarrative` and `useGenerateNarrative` hooks into `client.ts` with TanStack Query caching.
   - Mounted `AINarrativeCard` inside Tab 1 of `FloatingEvidenceCard.tsx` alongside empirical OLS+HAC diagnostics.
   - Passed `jobId={activeJobId}` and `jobStatus` from `app/page.tsx`.
4. **Empirical Quality Verification**:
   - Backend unit and integration tests: **201/201 passed** (100% green, including 10 dedicated Phase 6 tests).
   - Frontend TypeScript check (`npm run typecheck`): **0 errors**.
   - Frontend ESLint (`npx eslint . --quiet`): **0 errors**.
   - Next.js Turbopack production build (`npm run build`): **Compiled successfully in 4.3s**.
   - Codebase packaged via `pwsh .\scripts\package-codebase.ps1` into `terra-odyssey.zip` (704 clean files).

### Phase 7 Complete — Specialist & Partner Earth System Domains (GISTEMP, NSIDC Sea Ice, NOAA OISST, GRACE TWS, CERES EBAF):
1. **NASA GISS GISTEMP v4 (`d5_gistemp.py`, `d5_gistemp.json`)**:
   - 1880–2024 (145-year continuous centenary anomaly record).
   - 1951–1980 base period validation with 250 km spatial smoothing.
   - Bounded [-25, 25] °C anomaly range; cosine-latitude area weighting.
2. **NOAA/NSIDC Sea Ice Index v4 (`d6_nsidc_seaice.py`, `d6_nsidc_seaice.json`)**:
   - 1978–2024 polar microwave sea ice concentration record.
   - Separate Northern (Arctic) and Southern (Antarctic) domains.
   - Extent ($\ge 15\%$ concentration threshold) and Area in $10^6\text{ km}^2$.
   - Annual aggregation modes: `annual_mean` and `september_minimum` (Arctic sea ice benchmark).
3. **NOAA 1/4° Daily Optimum Interpolation SST v2.1 (`d7_noaa_oisst.py`, `d7_noaa_oisst.json`)**:
   - 1981–2024 blended satellite + ship/buoy in-situ marine SST.
   - Strict marine-only domain; land and sea-ice flags masked to NaN before aggregation.
   - Variables: absolute SST and SST anomaly (vs 1971–2000 climatology).
4. **NASA JPL GRACE/GRACE-FO Mascons (`d8_grace_tws.py`, `d8_grace_tws.json`)**:
   - 2002–2024 satellite gravimetry measuring terrestrial water storage anomalies (cm LWE).
   - **Strict Non-Negotiable Science Rule Enforced:** 11-month observation gap (2017-07 to 2018-05) between GRACE and GRACE-FO is explicitly isolated as NaN and verified uninterpolated; non-NaN gap values raise `ValueError`.
5. **NASA Langley CERES EBAF Ed4.2.1 (`d9_ceres_ebaf.py`, `d9_ceres_ebaf.json`)**:
   - 2000–2024 top-of-atmosphere radiative flux record ($W/m^2$).
   - Downward positive convention ($toa\_net = solar - sw - lw$).
   - Variables: `toa_net` (net energy imbalance), `toa_sw` (reflected shortwave), `toa_lw` (outgoing thermal longwave).
6. **Central Dataset Registry (`registry.py`)**:
   - All 9 canonical Earth system datasets promoted to full analysis capabilities: `["Browse", "View", "Analyze", "Compare"]`.
   - Added descriptive short-record context dataset `smap_soil_moisture` (`trend_supported=False`).
7. **Frontend Catalog & GIBS Layer Activation (`client.ts`, `gibs-layers.ts`, `AgencyLogos.tsx`)**:
   - Updated `FALLBACK_DATASETS` in `client.ts` with all 5 new products and physical variable definitions.
   - Expanded `DatasetMetadata.data_type` with scientific source types (`surface_observation_analysis`, `satellite_gravimetry`, `satellite_radiometry`, `derived_index`).
   - Integrated GIBS raster layers and vector agency insignias for NASA, NOAA, NSIDC, ESA, JAXA, Copernicus, and USGS.
8. **Empirical Quality Verification**:
   - Backend unit and integration tests: **238/238 passed** (100% green in 56.95s; +37 new Phase 7 tests).
   - Frontend TypeScript check (`npm run typecheck`): **0 errors**.
   - Frontend ESLint (`npx eslint . --quiet`): **0 errors**.
   - Next.js Turbopack production build (`npm run build`): **Compiled successfully; static export in 1.4s**.
   - Codebase packaged via `pwsh .\scripts\package-codebase.ps1` into `terra-odyssey.zip` (**743 clean files, 4335.2 KB**).

---

## Next Steps

1. **Phase 8**: Production hardening — reproducibility manifest, CI pipeline, Earthdata token management, and final verification report.

---

## Active Decisions

1. **Zero-Mock Scientific Rule**: All numbers, grids, and time series in runtime execution must be real NASA/partner observations; synthetic modes are barred from production.
2. **Native GIBS Web Mercator Projection**: Satellite raster tiles are rendered directly via standard EPSG:3857 WMTS endpoints, avoiding heavy reprojection transforms.
3. **Pure SVG Agency Insignias**: Logos are rendered purely in vector SVG with no external image asset dependencies or CDN latency.
4. **GRACE Mission Gap Preservation**: The 11-month transition gap (2017-07 to 2018-05) between GRACE and GRACE-FO must never be linearly interpolated or filled.

---

## Blockers

None.
