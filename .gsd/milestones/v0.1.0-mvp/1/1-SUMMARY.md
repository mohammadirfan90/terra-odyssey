# Plan 1.2 Summary: D1 MERRA-2 Near-Surface Air Temperature Adapter

## Objective
Implement NASA MERRA-2 monthly 2-meter air temperature (`M2TMNXSLV` v5.12.4) data adapter with CMR discovery, NetCDF-4 parsing, fill-value masking, Kelvin-to-Celsius conversion, and synthetic test suite.

## Delivered Artifacts
- [`terra-odyssey/backend/src/data/adapters/d1_merra2.py`](file:///A:/teraaaaaa/terra-odyssey/backend/src/data/adapters/d1_merra2.py): Full adapter implementation with `discover()`, `decode()`, `validate()`, `quality_mask()`, `convert_units()`, `process()`, and `cite()`.
- [`terra-odyssey/backend/src/data/adapters/__init__.py`](file:///A:/teraaaaaa/terra-odyssey/backend/src/data/adapters/__init__.py): Exposed `Merra2Adapter`.
- [`terra-odyssey/backend/tests/fixtures/synthetic_merra2.py`](file:///A:/teraaaaaa/terra-odyssey/backend/tests/fixtures/synthetic_merra2.py): Labeled synthetic NetCDF fixture generator.
- [`terra-odyssey/backend/tests/unit/test_d1_merra2.py`](file:///A:/teraaaaaa/terra-odyssey/backend/tests/unit/test_d1_merra2.py): 9 unit tests verifying all behavior.
- [`terra-odyssey/conftest.py`](file:///A:/teraaaaaa/terra-odyssey/conftest.py): Pytest configuration ensuring path resolution.

## Verification Evidence
Executed: `python -m pytest tests/unit/test_d1_merra2.py -v` from `terra-odyssey/`:
```text
tests/unit/test_d1_merra2.py::test_cmr_query_url_builder PASSED          [ 11%]
tests/unit/test_d1_merra2.py::test_decode_extracts_t2m PASSED            [ 22%]
tests/unit/test_d1_merra2.py::test_decode_missing_variable_raises PASSED [ 33%]
tests/unit/test_d1_merra2.py::test_validate_coordinates PASSED           [ 44%]
tests/unit/test_d1_merra2.py::test_quality_mask_fill_values PASSED       [ 55%]
tests/unit/test_d1_merra2.py::test_unit_conversion_kelvin_to_celsius PASSED [ 66%]
tests/unit/test_d1_merra2.py::test_full_process_pipeline PASSED          [ 77%]
tests/unit/test_d1_merra2.py::test_citation_provenance PASSED            [ 88%]
tests/unit/test_d1_merra2.py::test_manifest_conformance PASSED           [100%]
============================== 9 passed in 0.32s ==============================
```

## Scientific Compliance
- Conversion: $T_{°C} = T_K - 273.15$ with explicit `degC` units metadata.
- Masking: Values $\ge 1.0 \times 10^{14}$ converted to `NaN`.
- Reanalysis label: Designated strictly as `model_reanalysis` (never called direct satellite measurement).
