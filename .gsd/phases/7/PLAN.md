# Phase 7 Plan: Partner and Specialist Earth System Domains
# (GISTEMP v4, NSIDC Sea Ice, NOAA OISST, GRACE TWS, CERES EBAF)

**Milestone:** `v0.2.0-trends`
**Phase:** 7
**Status:** ✅ COMPLETED
**Dependencies:** Phase 1 (Core Pipeline), Phase 2 (Catalog/GIBS), Phase 3 (Precipitation & Contrasts), Phase 4 (Spatial FDR), Phase 5 (MODIS), Phase 6 (AI Narrator)

---

## 1. Executive Objective

Expand **Terra Odyssey** beyond the core atmospheric reanalysis and optical land surface products to span **all 6 fundamental Earth system domains** with authoritative, versioned NASA and partner observation records:

1. **Atmosphere / Global Temperature:** NASA GISS GISTEMP v4 (1880–2024, 145-year continuous centenary anomaly record).
2. **Cryosphere / Polar Sea Ice:** NOAA/NSIDC Sea Ice Index v4 (1978–2024, Arctic & Antarctic extent/area and September minimum).
3. **Oceans / Marine Surface:** NOAA Daily Optimum Interpolation SST v2.1 (1981–2024, 0.25° blended satellite + in-situ SST and anomalies).
4. **Terrestrial Hydrology / Gravimetry:** NASA JPL GRACE/GRACE-FO RL06M Mascons (2002–2024, terrestrial water storage anomalies with explicit 11-month mission transition gap preservation).
5. **Earth Radiation Budget / Energy Imbalance:** NASA Langley CERES EBAF Ed4.2.1 (2000–2024, top-of-atmosphere net energy imbalance $W/m^2$, incoming solar, outgoing longwave).

All 5 datasets must adhere strictly to [SCIENTIFIC_RULES.md](file:///A:/teraaaaaa/docs/SCIENTIFIC_RULES.md):
- Real data only; zero synthetic mock values in runtime.
- Quality masks and source fill values applied before spatial or temporal averaging.
- Clear separation of physical layers (in-situ blended anomalies vs. microwave satellite retrievals vs. gravimetric mascons vs. broadband radiometry).
- GRACE 11-month observation gap (2017-07 to 2018-05) must **never** be silently interpolated.
- Full provenance, DOIs, CMR concept IDs, physical units, and collection versions preserved end-to-end.

---

## 2. Technical Specification & Architecture

### 2.1 Dataset Specifications

| ID | Dataset Key | Formal Name | Provider | Variables | Units | Temporal Span | Native Resolution | Key Scientific Constraints |
|---|---|---|---|---|---|---|---|---|
| **D5** | `gistemp_v4` | GISS Surface Temperature Analysis v4 | NASA GISS | `temperature_anomaly` | `°C anomaly` | 1880–2024 (145 yrs) | Global 2.0° | 1951–1980 climatological baseline; 250 km smoothing |
| **D6** | `nsidc_sea_ice` | NOAA/NSIDC Sea Ice Index v4 | NSIDC / NOAA | `extent`, `area` | `10^6 km^2` | 1978–2024 (46 yrs) | 25 km Polar Stereo | Separate North (Arctic) and South (Antarctic); September minimum |
| **D7** | `noaa_oisst` | NOAA 1/4° Daily Optimum Interpolation SST v2.1 | NOAA NCEI | `sst`, `anom` | `°C`, `°C anomaly` | 1981–2024 (43 yrs) | Global 0.25° | Marine-only; land cells masked to NaN; 1971–2000 baseline |
| **D8** | `grace_tws` | GRACE/GRACE-FO Mascons (JPL RL06M) | NASA JPL / PO.DAAC | `lwe_thickness` | `cm water equiv` | 2002–2024 (22 yrs) | 0.5° equal-area | **11-month mission gap (2017-07 to 2018-05) MUST NOT be interpolated** |
| **D9** | `ceres_ebaf` | CERES EBAF Top-of-Atmosphere Ed4.2.1 | NASA Langley ASDC | `toa_net_all_mon`, `solar_mon`, `toa_lw_all_mon` | `W/m^2` | 2000–2024 (25 yrs) | Global 1.0° | Net flux sign: positive downward = Earth heating |

---

## 3. Plan Breakdown & Execution Waves

### Wave 1: Global Temperature & Marine SST (GISTEMP v4 & NOAA OISST v2.1)
- [x] **Task 7.1.1: GISTEMP v4 Adapter & Manifest**
  - Implemented `backend/src/data/adapters/d5_gistemp.py` with `GistempAdapter`.
  - Normalization: extracted `temperature_anomaly`, validated time axis, applied area weighting.
  - Manifest: created `backend/data/manifests/d5_gistemp.json` with DOI `10.2767/92882`.
- [x] **Task 7.1.2: NOAA OISST v2.1 Adapter & Manifest**
  - Implemented `backend/src/data/adapters/d7_noaa_oisst.py` with `NoaaOisstAdapter`.
  - Normalization: decoded `sst` and `anom`, applied marine-only land mask, extracted marine regional means.
  - Manifest: created `backend/data/manifests/d7_noaa_oisst.json` with DOI `10.25921/RE9P-PT57`.
- [x] **Task 7.1.3: Pipeline Routing & Unit Tests**
  - Connected D5 and D7 in `backend/src/data/registry.py` (`series_supported=True`, `trend_supported=True`, `contrast_supported=True`).
  - Added physical conversion and aggregation blocks in `backend/src/backend/stepper.py`.
  - Unit tests in `tests/unit/test_d5_gistemp.py` (7/7 passed) and `tests/unit/test_d7_noaa_oisst.py` (7/7 passed).

### Wave 2: Cryosphere & Polar Sea Ice (NOAA/NSIDC Sea Ice Index v4)
- [x] **Task 7.2.1: NSIDC Sea Ice Adapter & Manifest**
  - Implemented `backend/src/data/adapters/d6_nsidc_seaice.py` with `NsidcSeaIceAdapter`.
  - Normalization: handled Northern vs Southern hemisphere polar domains; extracted `extent` ($\ge 15\%$ concentration) and `area`; extracted key annual indicators (September Arctic Minimum, March Arctic Maximum).
  - Manifest: created `backend/data/manifests/d6_nsidc_seaice.json` with DOI `10.7265/N5K072F8`.
- [x] **Task 7.2.2: Pipeline Routing & Nonparametric Trend Testing**
  - Routed in `registry.py` and `stepper.py` with annual mean and September minimum aggregation modes.
  - Unit tests in `tests/unit/test_d6_nsidc_seaice.py` (8/8 passed).

### Wave 3: Hydrology Gravimetry & Energy Budget (GRACE TWS & CERES EBAF)
- [x] **Task 7.3.1: GRACE/GRACE-FO Mascon Adapter with Gap Preservation**
  - Implemented `backend/src/data/adapters/d8_grace_tws.py` with `GraceTwsAdapter`.
  - **Non-negotiable scientific constraint:** Detected and isolated the 11-month observation gap between GRACE and GRACE-FO (2017-07 to 2018-05); verified that any non-NaN value in the gap raises `ValueError`.
  - Manifest: created `backend/data/manifests/d8_grace_tws.json` with DOI `10.5067/TEMSC-3JC64`.
- [x] **Task 7.3.2: CERES EBAF Top-of-Atmosphere Radiative Budget Adapter**
  - Implemented `backend/src/data/adapters/d9_ceres_ebaf.py` with `CeresEbafAdapter`.
  - Variables: `toa_net`, `toa_sw`, `toa_lw`, `solar`. Verified sign convention (positive downward).
  - Manifest: created `backend/data/manifests/d9_ceres_ebaf.json` with DOI `10.5067/TERRA+AQUA/CERES/EBAF-TOA_L3B004.2`.
- [x] **Task 7.3.3: Pipeline Routing & Unit Tests**
  - Connected D8 and D9 in `registry.py` and `stepper.py`.
  - Unit tests in `tests/unit/test_d8_grace_tws.py` (8/8 passed) and `tests/unit/test_d9_ceres_ebaf.py` (7/7 passed).

### Wave 4: Frontend Catalog Activation & Multi-Domain UI
- [x] **Task 7.4.1: Dataset Catalog & Metadata Unification**
  - Updated `frontend/lib/api/client.ts` (`FALLBACK_DATASETS`) with all 5 new datasets, proper variable definitions, and physical units.
  - Ensured `DatasetCatalog.tsx`, `DatasetSection.tsx`, and `DockDatasetPicker.tsx` support and display all 9 canonical datasets across the 6 scientific topics.
- [x] **Task 7.4.2: NASA GIBS Map Layer Integration for New Domains**
  - Configured WMTS layer mappings for GISTEMP, OISST, NSIDC sea ice, and CERES in `frontend/lib/map/gibs-layers.ts`.
- [x] **Task 7.4.3: Agency Logos & Full Verification**
  - Verified official agency SVG insignias in `AgencyLogos.tsx` (NASA, NOAA, NSIDC, ESA, JAXA, Copernicus, USGS).
  - Full suite verification:
    - Backend: 238/238 pytest tests passed in 56.95s.
    - Frontend: `npm run typecheck` passed (0 errors).
    - Frontend: `npx eslint . --quiet` passed (0 errors).
    - Frontend: `npm run build` compiled successfully (static export in 1.4s).
    - Packaging: `terra-odyssey.zip` packaged with 743 clean files.

---

## 4. Definition of Done & Verification Checklist

- [x] All 5 new data adapters implemented with typed inputs/outputs, QC screening, and unit conversions.
- [x] 5 official JSON manifests created in `backend/data/manifests/`.
- [x] Central `registry.py` updated with `capabilities` promoted to `["Browse", "View", "Analyze", "Compare"]`.
- [x] GRACE 11-month mission gap (2017-07 to 2018-05) verified intact with zero interpolation.
- [x] Comprehensive unit tests for all 5 adapters with 100% green pytest suite (238/238 passed).
- [x] Frontend catalog updated with all 9 datasets categorized across 6 topics.
- [x] `npm run typecheck`, `npm run lint`, and `npm run build` pass with 0 errors.
- [x] Codebase packaged into `terra-odyssey.zip` (743 files, 4335.2 KB).
