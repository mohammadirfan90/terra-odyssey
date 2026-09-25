---
milestone: v0.1.0-mvp
version: 0.1.0
updated: 2026-09-24T23:20:00Z
---

# Roadmap: Terra Odyssey

> **Current Phase:** 4 - API & Investigation Orchestration
> **Status:** ready for planning

## Must-Haves (from SPEC)

- [x] MERRA-2 T2M (D1) and GPM IMERG Final (D2) ingestion adapters with quality masks
- [x] Gridded temporal cube normalization and spatial aggregation engine
- [x] OLS trend estimator with Newey-West HAC standard error diagnostics
- [x] Paired regional contrast estimator with multiple-testing control
- [ ] InvestigationRecord schema serialization and JSON/CSV export
- [ ] Accessible web investigation workspace with map and linked time series

---

## Phases

### Phase 1: Foundation & Data Ingestion
**Status:** ✅ Complete
**Objective:** Ingestion adapters, sample granule validation, fill-masking, and manifest generation for D1 (MERRA-2 T2M) and D2 (GPM IMERG Final).
**Requirements:** REQ-DATA-01, REQ-DATA-02

**Plans:**
- [x] Plan 1.1: Dataset manifest schemas and source contracts definition
- [x] Plan 1.2: D1 MERRA-2 adapter with time-weighting and unit conversion (K to °C)
- [x] Plan 1.3: D2 GPM IMERG adapter with monthly accumulation and QA filtering

---

### Phase 2: Scientific Trend Engine & Estimators
**Status:** ✅ Complete
**Objective:** Core analytical engine computing slopes, Newey-West HAC standard errors, block bootstrapping, and calendar completeness.
**Depends on:** Phase 1

**Plans:**
- [x] Plan 2.1: Annual and seasonal aggregation with missingness thresholds
- [x] Plan 2.2: OLS trend estimator with Newey-West HAC lag selection and numerical reference test
- [x] Plan 2.3: Interval sensitivity analysis across starting/ending years

---

### Phase 3: Regional Contrast & Evidence Engine
**Status:** ✅ Complete
**Objective:** Paired regional contrast estimator, false discovery rate (FDR) control across spatial fields, and qualified evidence status determination.
**Depends on:** Phase 2

**Plans:**
- [x] Plan 3.1: Area-weighted regional time-series extraction for polygons and bounding boxes
- [x] Plan 3.2: Paired difference slope estimation and contrast hypothesis testing
- [x] Plan 3.3: Multiple-testing adjustment (Benjamini-Yekutieli & Benjamini-Hochberg) for gridded trend maps

---

### Phase 4: API & Investigation Orchestration
**Status:** ✅ Complete
**Objective:** FastAPI backend serving catalog metadata, asynchronous investigation jobs, cached gridded fields, and InvestigationRecord exports.
**Depends on:** Phase 3

**Plans:**
- [x] Plan 4.1: Catalog and investigation creation API endpoints
- [x] Plan 4.2: Investigation execution worker and job state stepper
- [x] Plan 4.3: JSON, CSV, and summary report export bundling

---

### Phase 5: Interactive Web Workspace
**Status:** ✅ Complete
**Objective:** Responsive frontend with linked trend map, dual regional time-series charts, evidence panels, and accessible diagnostics drawer.
**Depends on:** Phase 4

**Plans:**
- [x] Plan 5.1: Question builder and variable selection catalog
- [x] Plan 5.2: Diverging trend map with uncertainty hatching and polygon selector
- [x] Plan 5.3: Linked time-series panel, paired contrast cards, and methods drawer

---

## Progress Summary

| Phase | Status | Plans | Complete |
|-------|--------|-------|----------|
| 1 | ✅ | 3/3 | 100% |
| 2 | ✅ | 3/3 | 100% |
| 3 | ✅ | 3/3 | 100% |
| 4 | ✅ | 3/3 | 100% |
| 5 | ✅ | 3/3 | 100% |


---

*Last updated: 2026-09-25T04:30:00Z*

