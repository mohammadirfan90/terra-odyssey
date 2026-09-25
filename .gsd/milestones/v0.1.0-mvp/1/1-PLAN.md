---
phase: 1
plan: 2
wave: 1
gap_closure: false
---

# Plan 1.2: D1 MERRA-2 Near-Surface Air Temperature Adapter

## Objective
Implement the data ingestion and normalization adapter for NASA MERRA-2 monthly 2-meter air temperature (`M2TMNXSLV` v5.12.4). The adapter discovers granules via NASA CMR, decodes netCDF-4 datasets, masks fill values (`1.0e15`), converts units from Kelvin to Celsius, verifies coordinates, and outputs normalized `xarray` data cubes with complete provenance.

## Context
- `.gsd/SPEC.md`
- `.gsd/ARCHITECTURE.md`
- `.gsd/phases/1/RESEARCH.md`
- `docs/SCIENTIFIC_RULES.md`
- `terra-odyssey/data/manifests/d1_merra2.json`
- `terra-odyssey/schemas/dataset-manifest.schema.json`

## Tasks

<task type="auto">
  <name>Implement Merra2Adapter Ingestion Class</name>
  <files>
    terra-odyssey/src/data/adapters/d1_merra2.py
    terra-odyssey/src/data/adapters/__init__.py
  </files>
  <action>
    Create the `Merra2Adapter` class implementing the standard 7-step adapter lifecycle:
    1. `discover(start_date, end_date)`: Query NASA CMR (`https://cmr.earthdata.nasa.gov/search/granules.json`) for collection `M2TMNXSLV` version `5.12.4` and return available granule metadata.
    2. `decode(file_path_or_buffer)`: Open netCDF-4 data and extract the `T2M` variable.
    3. `validate(data_array)`: Check latitude (-90 to 90, step 0.5) and longitude (-180 to 179.375, step 0.625) dimensions.
    4. `quality_mask(data_array)`: Replace source fill values (>= 1.0e14) with NaN.
    5. `convert_units(data_array)`: Convert Kelvin to Celsius: T_C = T_K - 273.15, updating units attribute to 'degC'.
    6. `cite()`: Return structured citation metadata (DOI: 10.5067/AP1B0BA5PD2K, collection: M2TMNXSLV, version: 5.12.4, source_type: model_reanalysis).

    AVOID: Labeling MERRA-2 as direct satellite observations; it is an atmospheric reanalysis.
    AVOID: Silently converting missing values to 0.0 or filling NaNs without flags.
    USE: Type hints, dataclasses or Pydantic models for configuration, and explicit docstrings.
  </action>
  <verify>
    python -c "from terra_odyssey.src.data.adapters.d1_merra2 import Merra2Adapter; a = Merra2Adapter(); print(a.cite()['doi'])"
  </verify>
  <done>
    Merra2Adapter imports cleanly, defines all lifecycle methods, and emits official DOI and reanalysis metadata.
  </done>
</task>

<task type="auto">
  <name>Create Synthetic MERRA-2 Fixture and Comprehensive Unit Tests</name>
  <files>
    terra-odyssey/tests/fixtures/synthetic_merra2.py
    terra-odyssey/tests/unit/test_d1_merra2.py
  </files>
  <action>
    1. Create `synthetic_merra2.py` which builds a labeled synthetic xarray dataset simulating 2 years (24 months) of global 0.5° x 0.625° gridded T2M data with known Kelvin values (e.g., 273.15 to 310.15 K) and intentional fill values (1.0e15).
    2. Create `test_d1_merra2.py` testing:
       - CMR query URL formation with correct short_name and version.
       - Fill-value masking: verifies fill values become NaN and valid values are preserved.
       - Unit conversion accuracy: 273.15 K -> 0.00 °C, 373.15 K -> 100.00 °C.
       - Coordinate validation: passes valid global grid, raises ValueError on mismatched dimensions.
       - Metadata validation against `terra-odyssey/schemas/dataset-manifest.schema.json`.
  </action>
  <verify>
    pytest terra-odyssey/tests/unit/test_d1_merra2.py -v
  </verify>
  <done>
    All unit test cases pass with 100% assertions satisfied for conversion, masking, coordinate checks, and citation metadata.
  </done>
</task>

## Success Criteria
- [ ] `Merra2Adapter` can decode, mask, and normalize MERRA-2 T2M fields.
- [ ] Unit conversion accurately computes °C from Kelvin with explicit metadata.
- [ ] Source fill values are reliably masked to NaN without data contamination.
- [ ] All unit tests pass cleanly offline with zero network requirement.
