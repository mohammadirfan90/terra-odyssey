# Plan 1.3 Summary: D2 GPM IMERG Final Monthly Precipitation Adapter

## Objective
Implement NASA GPM IMERG Final monthly precipitation (`GPM_3IMERGM` v07) data adapter with CMR discovery, rate-to-accumulation conversion using exact calendar month hours, fill-value and negative rate masking, and synthetic test suite.

## Delivered Artifacts
- [`terra-odyssey/backend/src/data/adapters/d2_gpm_imerg.py`](file:///A:/teraaaaaa/terra-odyssey/backend/src/data/adapters/d2_gpm_imerg.py): Full adapter implementation with `discover()`, `decode()`, `validate()`, `quality_mask()`, `calculate_accumulation()`, `process()`, and `cite()`.
- [`terra-odyssey/backend/src/data/adapters/__init__.py`](file:///A:/teraaaaaa/terra-odyssey/backend/src/data/adapters/__init__.py): Exposed `GpmImergAdapter`.
- [`terra-odyssey/backend/tests/fixtures/synthetic_gpm.py`](file:///A:/teraaaaaa/terra-odyssey/backend/tests/fixtures/synthetic_gpm.py): Labeled synthetic GPM IMERG fixture generator.
- [`terra-odyssey/backend/tests/unit/test_d2_gpm_imerg.py`](file:///A:/teraaaaaa/terra-odyssey/backend/tests/unit/test_d2_gpm_imerg.py): 10 unit tests verifying leap-year handling, rate-to-accumulation multiplication, fill-value masking, coordinate validation, and manifest conformance.

## Verification Evidence
Executed: `python -m pytest tests/unit/ -v` from `terra-odyssey/`:
```text
tests/unit/test_d2_gpm_imerg.py::test_cmr_query_url_builder PASSED       [ 52%]
tests/unit/test_d2_gpm_imerg.py::test_decode_extracts_precipitation_cal PASSED [ 57%]
tests/unit/test_d2_gpm_imerg.py::test_decode_missing_variable_raises PASSED [ 63%]
tests/unit/test_d2_gpm_imerg.py::test_validate_coordinates PASSED        [ 68%]
tests/unit/test_d2_gpm_imerg.py::test_quality_mask_fill_values_and_negatives PASSED [ 73%]
tests/unit/test_d2_gpm_imerg.py::test_monthly_accumulation_calendar_hours PASSED [ 78%]
tests/unit/test_d2_gpm_imerg.py::test_monthly_accumulation_invalid_month_raises PASSED [ 84%]
tests/unit/test_d2_gpm_imerg.py::test_full_process_pipeline PASSED       [ 89%]
tests/unit/test_d2_gpm_imerg.py::test_citation_provenance PASSED         [ 94%]
tests/unit/test_d2_gpm_imerg.py::test_manifest_conformance PASSED        [100%]
============================= 19 passed in 0.32s ==============================
```

## Scientific Compliance
- Conversion: $\text{Accumulation} = \text{rate} \times (\text{days\_in\_month} \times 24)$ with exact calendar hours (accounting for leap years, e.g. Feb 2024 = 696 hrs vs Feb 2021 = 672 hrs).
- Masking: Fill values $\le -9000.0$ and unphysical negative values masked to `NaN`.
- Mission product: Formally designated as `mission_product` with full GPM citation.
