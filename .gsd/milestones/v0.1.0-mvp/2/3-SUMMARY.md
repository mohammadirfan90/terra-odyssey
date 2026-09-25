# Plan 2.3 Summary: Interval Sensitivity Analysis Engine

## Implementation Summary
- **Module**: `terra-odyssey/backend/src/analysis/interval_sensitivity.py`
  - Evaluates trend stability across 5 predefined start/end windows: `full`, `start_plus_3`, `start_plus_5`, `end_minus_3`, `end_minus_5`.
  - Filters out any window with $< 20$ consecutive complete annual observations, preventing underpowered or hiatus-distorted spans from corrupting analysis.
  - Computes summary diagnostics: `slope_range_per_decade`, `sign_agreement`, and `classification_shifts` between supported and inconclusive.
  - Helper `attach_interval_sensitivity_to_result` enriches `AnalysisResult` and appends an explicit scientific caveat when classification shifts occur.
  - Fully integrated into `terra-odyssey/backend/src/analysis/__init__.py`.

## Verification Evidence
- 3/3 tests passing in `tests/unit/test_interval_sensitivity.py`:
  - `test_interval_sensitivity_25_year_record`: all 5 windows eligible on 2001–2025 series.
  - `test_interval_sensitivity_22_year_record_pruning`: correctly prunes start+3, start+5, end-3, end-5 when span falls below 20 years.
  - `test_classification_shift_adds_caveat`: detects status shift and appends caveat.
- Full test suite: 48/48 unit and numerical tests passing cleanly in 1.95s.
- 100% schema validation against `schemas/analysis-result.schema.json`.
