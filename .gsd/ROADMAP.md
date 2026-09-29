---
milestone: v0.2.0-trends
version: 0.2.0
status: IN_PROGRESS
started: 2026-09-26T15:30:00Z
target: 2026-10-15T00:00:00Z
research_plan: .gsd/TRENDS_DATA_RESEARCH_PLAN.md
---

# Roadmap: Terra Odyssey — Earth System Trend Detective

> **Milestone Status:** 🚀 v0.2.0-trends (In Progress)
> **Active Milestone:** Earth System Trend Detective (Historical Data & Bottom Timeline)
> **Master Research & Architecture:** [.gsd/TRENDS_DATA_RESEARCH_PLAN.md](TRENDS_DATA_RESEARCH_PLAN.md)
> **Previous Milestone (v0.1.0-mvp):** [.gsd/milestones/v0.1.0-mvp-SUMMARY.md](milestones/v0.1.0-mvp-SUMMARY.md)

---

## Milestone Phases (v0.2.0-trends)

### Phase 1 — One Trustworthy Real-Data Investigation
- **Status:** ✅ **COMPLETED & VERIFIED**
- **Plan:** [.gsd/TRENDS_PHASE_1_PLAN.md](TRENDS_PHASE_1_PLAN.md)
- **Verification:** [.gsd/TRENDS_PHASE_1_VERIFICATION.md](TRENDS_PHASE_1_VERIFICATION.md)
- **Deliverables:**
  - [x] Strict dataset capabilities model and central registry (`DatasetRegistry`).
  - [x] Zero silent synthetic fallbacks; explicit `InsufficientDataError` and `UnsupportedDatasetError`.
  - [x] Real NASA MERRA-2 NetCDF acquisition via NASA POWER API with SHA-256 integrity verification.
  - [x] Bounded $9.9^\circ$ query clipping complying with NASA POWER endpoint specifications.
  - [x] Calendar-day weighted annual temperature aggregation excluding month 13 pre-computed means.
  - [x] Ordinary Least Squares with Newey-West HAC standard error diagnostics ($L=1$).
  - [x] Interactive, collapsible `TimelineDock` with headline metrics, coverage bar, and data table with CSV export.
  - [x] `LinkedTimeSeriesChart` displaying authoritative backend HAC trend lines.
  - [x] `UniversalQueryBar` automated dispatch on location search.
  - [x] Verification runner `verify_real_investigation.py` and integration test `test_real_investigation_contract.py` (132/132 tests passing).

### Phase 2 — Layer Catalog and Historical Navigation
- **Status:** ✅ **COMPLETED & VERIFIED**
- **Plan:** [.gsd/TRENDS_PHASE_2_PLAN.md](TRENDS_PHASE_2_PLAN.md)
- **Verification:** [.gsd/TRENDS_PHASE_2_VERIFICATION.md](TRENDS_PHASE_2_VERIFICATION.md)
- **Deliverables:**
  - [x] Multi-topic dataset catalog with capability badges (**Browse**, **View**, **Analyze**, **Compare**).
  - [x] Server-side archive availability endpoint (`/api/catalog/{id}/availability`) reflecting true granule coverage.
  - [x] Two-tier timeline controls in `TimelineDock`: analysis range-brushing and discrete map date scrubber.
  - [x] NASA GIBS dated WMTS tile layers for visual context.
  - [x] Responsive dock resizing with collision prevention for map controls.

### Phase 3 — Precipitation and Regional Contrasts
- **Status:** ✅ **COMPLETED & VERIFIED**
- **Plan:** [.gsd/phases/3/RESEARCH.md](phases/3/RESEARCH.md)
- **Verification:** [.gsd/phases/3/VERIFICATION.md](phases/3/VERIFICATION.md)
- **Deliverables:**
  - [x] GPM IMERG Final (`GPM_3IMERGM` v07) adapter activation with month-hour mm/month conversion.
  - [x] Complete-calendar-year validation (minimum 20 complete years; no partial years).
  - [x] Paired regional contrast estimator (Region A vs Region B on identical time bounds).
  - [x] Paired difference time-series HAC trend testing ($H_0: \beta_A - \beta_B = 0$).
  - [x] Dual-series timeline dock rendering with contrast delta metrics.


### Phase 4 — Spatial Trend Evidence and Multiplicity Control
- **Status:** ✅ **COMPLETED & VERIFIED** (164/164 tests passing)
- **Plan:** [.gsd/TRENDS_PHASE_4_PLAN.md](TRENDS_PHASE_4_PLAN.md)
- **Deliverables:**
  - [x] Grid-wide cell-by-cell OLS+HAC trend estimation (`analysis/spatial_grid.py`).
  - [x] Benjamini-Yekutieli (BY) FDR control valid under arbitrary spatial autocorrelation (`analysis/fdr_control.py`).
  - [x] Gzip-compressed spatial grid streaming (`map_grid.json.gz`) with `fdr_summary` block.
  - [x] MapLibre trend layer with blue↔white↔red ramp, significance stippling, FDR legend card, hover tooltip.
  - [x] `fdr_summary` forwarded through API endpoint and typed in `StructuredGridMapResponse`.

### Phase 5 — Land Surface Temperature and Vegetation (MODIS)
- **Status:** ✅ **COMPLETED & VERIFIED**
- **Plan:** [.gsd/TRENDS_PHASE_5_PLAN.md](TRENDS_PHASE_5_PLAN.md)
- **Deliverables:**
  - [x] MODIS LST (`MOD11A2` v061, 8-day 1km) adapter with QA bitmask decoding and scale factor (`d3_modis_lst.py`).
  - [x] Strict day (`LST_Day_1km`) and night (`LST_Night_1km`) physical separation.
  - [x] MODIS NDVI / EVI (`MOD13A3` v061, monthly 1km) adapter with pixel reliability screening (`d4_modis_ndvi.py`).
  - [x] Phenology-aware greening/browning trend detection (Northern/Southern hemisphere growing seasons).

### Phase 6 — Evidence-Grounded AI Summaries and Provenance
- **Status:** ✅ **COMPLETED & VERIFIED**
- **Plan:** [.gsd/TRENDS_PHASE_6_PLAN.md](TRENDS_PHASE_6_PLAN.md)
- **Deliverables:**
  - [x] Structured JSON evidence extractor for `InvestigationRecord`.
  - [x] NVIDIA NIM Nemotron-3 120B A12B MoE integration (`ai_narrator.py`).
  - [x] Grounded summary prompt contract with sentence-level citations (`[SLOPE]`, `[CI_95]`, `[P_VAL]`).
  - [x] Hallucination guardrail validating all numbers against the record and rejecting ungrounded causal claims.
  - [x] Frontend `AINarrativeCard.tsx` with streaming/cached narrative and scientific disclaimer.

### Phase 7 — Partner and Specialist Earth System Domains
- **Status:** ✅ **COMPLETED & VERIFIED**
- **Plan:** [.gsd/phases/7/PLAN.md](phases/7/PLAN.md)
- **Deliverables:**
  - [x] NASA GISS GISTEMP v4 (1880–present) surface temperature anomaly adapter (`d5_gistemp.py`).
  - [x] NSIDC Sea Ice Index v4 (1978–present) Arctic/Antarctic extent and minimum trend tracking (`d6_nsidc_seaice.py`).
  - [x] NOAA OISST v2.1 (1981–present) high-resolution sea surface temperature adapter (`d7_noaa_oisst.py`).
  - [x] GRACE / GRACE-FO (2002–present) terrestrial water storage mascons with explicit uninterpolated 11-month mission-gap handling (`d8_grace_tws.py`).
  - [x] CERES EBAF Ed4.2.1 (2000–present) top-of-atmosphere downward-positive radiation budget fluxes (`d9_ceres_ebaf.py`).
  - [x] All 9 canonical datasets promoted in `registry.py` with multi-domain UI integration.

### Phase 8 — Full Reproducibility, Scale, and Production Hardening
- **Status:** 📋 **PLANNED**
- **Plan:** [.gsd/TRENDS_PHASE_8_PLAN.md](TRENDS_PHASE_8_PLAN.md)
- **Deliverables:**
  - [ ] Standalone reproducibility bundle (`bundle.tar.gz`) with `reproduce.py`, NetCDF, Parquet, and hashes.
  - [ ] Permalink sharing and state hydration (`?id=inv-<hash>`).
  - [ ] Async job cancellation, resource quotas, and two-tier caching (memory + SQLite).
  - [ ] WCAG 2.1 AA accessibility audit, screen reader support, and colorblind-safe palettes.
  - [ ] End-to-end performance benchmarking and stress test suite.
