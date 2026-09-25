---
phase: 2
plan: 3
wave: 3
depends_on: [2]
---

# Plan 2.3: Interval Sensitivity Analysis Engine

## Objective
Implement endpoint interval sensitivity analysis across 5 predefined start/end year windows (`full`, `start+3`, `start+5`, `end-3`, `end-5`), filtering out windows under the 20-year consecutive threshold, computing sign stability and slope ranges, and integrating diagnostics into the final `AnalysisResult`.

## Context
- `.gsd/SPEC.md`
- `.gsd/DECISIONS.md`
- `.gsd/phases/2/RESEARCH.md`
- `terra-odyssey/backend/schemas/analysis-result.schema.json`
- `terra-odyssey/backend/src/analysis/trend_estimator.py`

## Tasks

<task type="auto">
  <name>Implement Interval Sensitivity Analyzer</name>
  <files>terra-odyssey/backend/src/analysis/interval_sensitivity.py</files>
  <action>
    Create `terra-odyssey/backend/src/analysis/interval_sensitivity.py` with:
    1. Function `compute_interval_sensitivity(years: np.ndarray, values: np.ndarray, dataset_id: str, variable: str, units: str, unit_per_decade: str, geometry: dict, min_consecutive_years: int = 20) -> dict`:
       - Determines total interval: `start_year = int(years[0])`, `end_year = int(years[-1])`.
       - Defines the 5 predefined windows:
         - `"full"`: `(start_year, end_year)`
         - `"start_plus_3"`: `(start_year + 3, end_year)`
         - `"start_plus_5"`: `(start_year + 5, end_year)`
         - `"end_minus_3"`: `(start_year, end_year - 3)`
         - `"end_minus_5"`: `(start_year, end_year - 5)`
       - For each window:
         - Slices the time series between window start and end.
         - Checks if valid contiguous count $\ge min\_consecutive\_years$ (default 20).
         - If eligible, runs `estimate_linear_trend` to obtain slope per decade, CI, and status (`"supported"` vs `"inconclusive"`).
         - If ineligible ($< 20$ years), excludes the window from summary statistics and records reason as `"ineligible_span_too_short"`.
       - Aggregates overall sensitivity diagnostics:
         - `windows_evaluated`: total windows evaluated.
         - `windows_eligible`: count of windows meeting $\ge 20$ year threshold.
         - `slope_range_per_decade`: `[min_slope, max_slope]`.
         - `sign_agreement`: boolean indicating whether all eligible windows share the same slope sign.
         - `classification_shifts`: boolean indicating if any eligible window changed between `"supported"` and `"inconclusive"`.
         - `window_results`: list of individual window results containing window name, year range, slope per decade, SE, p-value, and status.
    2. Function `attach_interval_sensitivity_to_result(primary_result: dict, sensitivity_diagnostics: dict) -> dict`:
       - Enriches `primary_result["method"]["diagnostics"]["interval_sensitivity"]` with the sensitivity diagnostics.
       - If any classification shifts occur, appends an explicit caveat to `caveats`: `"Interval sensitivity shows status changes across alternative endpoints; findings should not be interpreted as unconditional"`.
  </action>
  <verify>python -c "from analysis.interval_sensitivity import compute_interval_sensitivity; print('Interval sensitivity module importable')"</verify>
  <done>Interval sensitivity analyzer evaluates 5 predefined windows, enforces >=20 year filter, computes stability diagnostics, and updates analysis result caveats.</done>
</task>

<task type="auto">
  <name>Create Unit Tests for Interval Sensitivity Analysis</name>
  <files>terra-odyssey/backend/tests/unit/test_interval_sensitivity.py</files>
  <action>
    Create `terra-odyssey/backend/tests/unit/test_interval_sensitivity.py` testing:
    1. `test_interval_sensitivity_25_year_record`: Evaluates 2001–2025 record (25 years). Confirms all 5 windows are eligible (25, 22, 20, 22, 20 years), slopes are calculated, and sign stability is verified.
    2. `test_interval_sensitivity_22_year_record_pruning`: Evaluates 2001–2022 record (22 years). Confirms `start+5` (17 yrs) and `end-5` (17 yrs) are pruned as ineligible, while `full` (22 yrs), `start+3` (19 yrs -> ineligible), and `end-3` (19 yrs -> ineligible) correctly apply the 20-year threshold.
    3. `test_status_classification_shift_caveat`: Simulates a time series where shortening the window flips status from supported to inconclusive; verifies the cautionary caveat is added.
    4. `test_schema_validity_with_sensitivity`: Validates full serialized analysis result including interval sensitivity against `schemas/analysis-result.schema.json`.
  </action>
  <verify>pytest tests/unit/test_interval_sensitivity.py -v</verify>
  <done>All interval sensitivity tests pass with 100% assertions and full JSON schema validity.</done>
</task>

## Success Criteria
- [ ] Predefined 5 windows evaluated without unconstrained grid combinatorial explosion.
- [ ] Threshold of $\ge 20$ consecutive complete years strictly enforced per window.
- [ ] Stability metrics (slope range, sign agreement, classification shifts) computed.
- [ ] Full integration and validation with `schemas/analysis-result.schema.json`.
- [ ] 100% passing unit tests in `tests/unit/test_interval_sensitivity.py`.
