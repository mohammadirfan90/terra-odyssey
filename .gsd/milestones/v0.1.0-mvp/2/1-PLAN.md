---
phase: 2
plan: 1
wave: 1
depends_on: []
---

# Plan 2.1: Temporal Aggregation & Missingness Validator

## Objective
Build the temporal aggregation engine that converts monthly 1D/gridded data into defensible annual and seasonal time series for MERRA-2 T2M and GPM IMERG Final, enforcing strict 12/12 calendar-month completeness, day-weighted temperature means, precipitation sums, and consecutive-year eligibility checking.

## Context
- `.gsd/SPEC.md`
- `.gsd/DECISIONS.md`
- `.gsd/phases/2/RESEARCH.md`
- `docs/SCIENTIFIC_RULES.md`
- `terra-odyssey/src/data/adapters/d1_merra2.py`
- `terra-odyssey/src/data/adapters/d2_gpm_imerg.py`

## Tasks

<task type="auto">
  <name>Implement Temporal Aggregation and Completeness Module</name>
  <files>terra-odyssey/src/analysis/aggregation.py</files>
  <action>
    Create `terra-odyssey/src/analysis/aggregation.py` with:
    1. `aggregate_annual_temperature(da_monthly: xr.DataArray) -> xr.DataArray`:
       - Validates monthly input array with time dimension.
       - Computes days in each calendar month ($d_m$) with exact leap-year awareness.
       - Computes valid month count per year: $N_{\text{valid}} = \sum \mathbf{1}_{\text{notnull}}$.
       - Enforces strict 12/12 completeness: years with $N_{\text{valid}} < 12$ MUST be masked to `NaN`.
       - Computes day-weighted mean only when $N_{\text{valid}} == 12$:
         $$\bar{T}_{\text{annual}} = \frac{\sum_{m=1}^{12} T_m \cdot d_m}{\sum_{m=1}^{12} d_m}$$
         ensuring the denominator is computed from valid months after confirming all 12 exist (or strictly masked before division) to prevent denominator contamination.
       - Provides optional helper `get_partial_year_diagnostic(da_monthly)` for 10-11 month records clearly marked as non-inferential diagnostic.
    2. `aggregate_annual_precipitation(da_monthly_accum: xr.DataArray) -> xr.DataArray`:
       - Enforces strict 12/12 completeness.
       - Sums monthly accumulation ($mm/\text{month}$) to annual total ($mm/\text{year}$). Any missing month sets annual sum to `NaN`.
    3. `aggregate_seasonal(da_monthly: xr.DataArray, season: str) -> xr.DataArray`:
       - Supports seasons `"DJF"`, `"MAM"`, `"JJA"`, `"SON"`.
       - For `"DJF"`, December of year $y-1$ is grouped into season of year $y$.
       - All 3 constituent months must be present and valid; otherwise returns `NaN`.
    4. `validate_consecutive_series(years: np.ndarray, values: np.ndarray, min_years: int = 20) -> dict`:
       - Identifies valid (non-NaN) years.
       - Checks for contiguous consecutive annual sequences.
       - Raises or returns eligibility status (`is_eligible: bool`, `valid_count: int`, `missing_years: list[int]`).
       - Never collapses non-consecutive years into consecutive indices.
  </action>
  <verify>python -c "from src.analysis.aggregation import aggregate_annual_temperature, aggregate_annual_precipitation; print('Aggregation module importable')"</verify>
  <done>Aggregation functions compute exact day-weighted annual means, sum precipitation, enforce strict 12/12 monthly completeness, and validate consecutive spans.</done>
</task>

<task type="auto">
  <name>Create Unit Tests for Aggregation & Completeness</name>
  <files>terra-odyssey/tests/unit/test_aggregation.py</files>
  <action>
    Create comprehensive unit tests in `terra-odyssey/tests/unit/test_aggregation.py`:
    1. `test_annual_temperature_complete_year`: Full 12 months with varying days per month (including leap-year Feb with 29 days vs non-leap 28 days) produces exact mathematical day-weighted mean.
    2. `test_annual_temperature_missing_month_masked`: A year with 11 valid months returns `NaN` in inferential series.
    3. `test_annual_precipitation_complete_and_incomplete`: 12 valid months sum accurately; missing month yields `NaN`.
    4. `test_seasonal_djf_year_boundary`: Verifies December 2020 groups into 2021 DJF with January and February 2021.
    5. `test_consecutive_series_validation`: Verifies sequence with gaps (e.g. missing 2010 in 2001-2025) fails consecutive requirement and reports missing years rather than collapsing time.
    6. `test_min_years_threshold`: Sequence with 18 consecutive years fails 20-year threshold (`is_eligible == False`).
  </action>
  <verify>pytest tests/unit/test_aggregation.py -v</verify>
  <done>All aggregation and missingness unit tests pass with 100% assertions verifying scientific requirements.</done>
</task>

## Success Criteria
- [ ] Day-weighted temperature aggregation mathematically exact and leap-year verified.
- [ ] Strict 12/12 completeness enforced for both temperature and precipitation.
- [ ] Minimum 20 consecutive complete years validated without time collapsing.
- [ ] 100% passing unit tests in `tests/unit/test_aggregation.py`.
