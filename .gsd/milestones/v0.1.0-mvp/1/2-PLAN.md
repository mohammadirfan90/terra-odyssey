---
phase: 1
plan: 3
wave: 1
gap_closure: false
---

# Plan 1.3: D2 GPM IMERG Final Monthly Precipitation Adapter

## Objective
Implement the data ingestion, quality filtering, and accumulation adapter for NASA GPM IMERG Final monthly precipitation (`GPM_3IMERGM` v07). The adapter queries NASA CMR for monthly granules, decodes HDF5/netCDF-4 products, masks missing/fill values (`-9999.9`), converts rainfall rates ($mm/\text{hr}$) into exact calendar month accumulations ($mm/\text{month}$), and verifies 0.1° x 0.1° spatial grids.

## Context
- `.gsd/SPEC.md`
- `.gsd/ARCHITECTURE.md`
- `.gsd/phases/1/RESEARCH.md`
- `docs/SCIENTIFIC_RULES.md`
- `terra-odyssey/backend/data/manifests/d2_gpm_imerg.json`
- `terra-odyssey/backend/schemas/dataset-manifest.schema.json`

## Tasks

<task type="auto">
  <name>Implement GpmImergAdapter Ingestion Class</name>
  <files>
    terra-odyssey/backend/src/data/adapters/d2_gpm_imerg.py
  </files>
  <action>
    Create the `GpmImergAdapter` class implementing the standard 7-step adapter lifecycle:
    1. `discover(start_date, end_date)`: Query NASA CMR for collection `GPM_3IMERGM` version `07` and return available granule records.
    2. `decode(file_path_or_buffer)`: Open HDF5/netCDF-4 file and extract `precipitationCal` (calibrated precipitation rate) along with quality/uncertainty fields if present.
    3. `validate(data_array)`: Check latitude (-90 to 90, step 0.1) and longitude (-180 to 180, step 0.1) coordinates.
    4. `quality_mask(data_array)`: Replace source fill values (<= -9000.0) and negative physical values with NaN.
    5. `calculate_accumulation(data_array, year, month)`: Convert rate ($mm/\text{hr}$) to total monthly accumulation ($mm/\text{month}$) using exact calendar month hours:
       - Hours in month = `days_in_month(year, month) * 24`
       - Handles leap years explicitly (February: 28 days = 672 hrs vs 29 days = 696 hrs).
    6. `cite()`: Return structured citation metadata (DOI: 10.5067/GPM/IMERG/3B-MONTH/07, collection: GPM_3IMERGM, version: 07, source_type: mission_product).

    AVOID: Using fixed 30-day or 720-hour approximations for monthly accumulation.
    AVOID: Treating missing months as 0.0 mm of rainfall.
    USE: Calendar-aware calculation via Python's standard `calendar` module.
  </action>
  <verify>
    python -c "from data.adapters.d2_gpm_imerg import GpmImergAdapter; a = GpmImergAdapter(); print(a.cite()['doi'])"
  </verify>
  <done>
    GpmImergAdapter imports cleanly, handles calendar-hour calculations, and emits complete mission metadata.
  </done>
</task>

<task type="auto">
  <name>Create Synthetic GPM Fixture and Unit Tests</name>
  <files>
    terra-odyssey/backend/tests/fixtures/synthetic_gpm.py
    terra-odyssey/backend/tests/unit/test_d2_gpm_imerg.py
  </files>
  <action>
    1. Create `synthetic_gpm.py` building a labeled synthetic xarray dataset simulating 0.1° gridded monthly precipitation rates (e.g. 0.05 mm/hr to 5.0 mm/hr) and intentional missing/fill values (-9999.9).
    2. Create `test_d2_gpm_imerg.py` testing:
       - CMR search query URL parameters (`short_name=GPM_3IMERGM`, `version=07`).
       - Monthly accumulation conversion:
         - January (31 days = 744 hrs): 1.0 mm/hr -> 744.0 mm
         - February non-leap (28 days = 672 hrs): 1.0 mm/hr -> 672.0 mm
         - February leap year (29 days = 696 hrs): 1.0 mm/hr -> 696.0 mm
       - Fill-value masking: asserts -9999.9 is masked to NaN.
       - Coordinate validation and metadata conformance to `terra-odyssey/backend/schemas/dataset-manifest.schema.json`.
  </action>
  <verify>
    pytest terra-odyssey/backend/tests/unit/test_d2_gpm_imerg.py -v
  </verify>
  <done>
    All unit test cases pass, verifying leap-year handling, rate-to-accumulation multiplication, and fill-value elimination.
  </done>
</task>

## Success Criteria
- [ ] `GpmImergAdapter` decodes and quality-masks GPM IMERG Final data.
- [ ] Rate-to-accumulation accurately uses calendar-month hours with leap-year awareness.
- [ ] Negative and fill values are properly masked to NaN.
- [ ] All unit tests pass offline with zero network dependence.
