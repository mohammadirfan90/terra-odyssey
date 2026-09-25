---
phase: 2
plan: 2
wave: 2
depends_on: [1]
---

# Plan 2.2: OLS + Newey-West HAC Estimator & Numerical Test Oracle

## Objective
Implement the core statistical trend estimator using `statsmodels` OLS with explicit Newey-West HAC covariance (Bartlett kernel, `maxlags=2`, small-sample correction, Student-$t$ reference distribution), SciPy Theil-Sen point-estimate robustness diagnostics, an independent pure-NumPy numerical test oracle, and full serialization to `schemas/analysis-result.schema.json`.

## Context
- `.gsd/SPEC.md`
- `.gsd/DECISIONS.md`
- `.gsd/phases/2/RESEARCH.md`
- `docs/SCIENTIFIC_RULES.md`
- `docs/VALIDATION_PLAN.md`
- `terra-odyssey/backend/schemas/analysis-result.schema.json`
- `terra-odyssey/backend/src/analysis/aggregation.py`

## Tasks

<task type="auto">
  <name>Implement OLS Trend Estimator with HAC Covariance and Theil-Sen Diagnostics</name>
  <files>terra-odyssey/backend/src/analysis/trend_estimator.py</files>
  <action>
    Create `terra-odyssey/backend/src/analysis/trend_estimator.py` with:
    1. Function `estimate_linear_trend(years: np.ndarray, values: np.ndarray, dataset_id: str, variable: str, units: str, unit_per_decade: str, geometry: dict, confidence_level: float = 0.95) -> dict`:
       - Validates input arrays: filters NaNs, checks for monotonic consecutive years, ensures $n \ge 20$ (returns status `"ineligible"` if $n < 20$ or non-consecutive).
       - Centers year coordinates: $x = \text{years} - \text{mean}(\text{years})$ for numerical float64 stability.
       - Fits primary model using `statsmodels.api.OLS(values, sm.add_constant(x)).fit()`.
       - Applies explicit HAC robust covariance:
         ```python
         robust = model.get_robustcov_results(
             cov_type="HAC",
             maxlags=2,
             kernel="bartlett",
             use_correction=True,
             use_t=True,
         )
         ```
       - Extracts slope, intercept, standard errors, $t$-statistic, $p$-value, and confidence interval ($df = n - 2$).
       - Calculates:
         - `effect.estimate`: primary slope per decade ($10 \times \text{slope\_per\_year}$).
         - `effect.unit_per_decade`: `unit_per_decade` (e.g. `"degC/decade"` or `"mm/year/decade"`).
         - `effect.fitted_change`: $\text{slope\_per\_year} \times (\text{last\_year} - \text{first\_year})$.
         - `uncertainty`: `lower` and `upper` bounds per decade ($10 \times \text{CI\_per\_year}$), `level: confidence_level`, `method: "newey_west_hac_bartlett_lag2_small_sample"`.
       - Calculates lag sensitivities for $L \in [1, 3, 5]$:
         - Computes slope standard error and $p$-value for each lag, recording them under `diagnostics.lag_sensitivities`.
       - Computes Theil-Sen slope using `scipy.stats.theilslopes(values, x, alpha=confidence_level)`:
         - Records `slope_per_decade = 10 * theil_slope`.
         - Records `direction_agreement_with_ols = (sign(ols_slope) == sign(theil_slope))`.
         - Records `absolute_difference_from_ols = abs(ols_slope_per_decade - theil_slope_per_decade)`.
         - Records `relative_difference_from_ols = abs(ols_slope - theil_slope) / abs(ols_slope) * 100.0`.
       - Classifies `status`:
         - `"supported"`: $p < (1 - \text{confidence\_level})$ (e.g. $p < 0.05$).
         - `"inconclusive"`: $p \ge 0.05$ (clearly distinguishes "not detected" from "no change").
         - `"ineligible"`: $n < 20$ or incomplete/non-consecutive records.
       - Returns a dictionary conforming strictly to `schemas/analysis-result.schema.json`.
  </action>
  <verify>python -c "from analysis.trend_estimator import estimate_linear_trend; print('Trend estimator importable')"</verify>
  <done>Trend estimator fits OLS + HAC (lag 2), evaluates lag 1/3/5 sensitivities, computes Theil-Sen point diagnostic, and formats results compliant with analysis-result schema.</done>
</task>

<task type="auto">
  <name>Implement Independent Pure-NumPy HAC Numerical Test Oracle</name>
  <files>terra-odyssey/backend/tests/numerical/test_hac_oracle.py</files>
  <action>
    Create `terra-odyssey/backend/tests/numerical/test_hac_oracle.py` containing an independent, transparent pure-NumPy Newey-West Bartlett HAC implementation:
    1. Independent mathematical implementation of:
       $$\hat{\Gamma}_l = \frac{1}{n} \sum_{t=l+1}^n e_t e_{t-l} X_t X_{t-l}^T$$
       $$\hat{\Omega} = \hat{\Gamma}_0 + \sum_{l=1}^L \left(1 - \frac{l}{L+1}\right) (\hat{\Gamma}_l + \hat{\Gamma}_l^T)$$
       $$\hat{V}_{\text{HAC}} = (X^T X)^{-1} (n \cdot \hat{\Omega}) (X^T X)^{-1} \times \frac{n}{n-k}$$
       and Student-$t$ distribution inference with $df = n - 2$.
    2. Runs side-by-side numerical verification against `statsmodels` on:
       - Linear sequence with Gaussian noise
       - Sequence with strong AR(1) autocorrelation ($\rho = 0.6$)
       - Multiple sample sizes ($n=20, 25, 40$)
    3. Asserts that coefficients, covariance matrix entries, slope SE, $t$-statistic, $p$-value, and confidence intervals match within $10^{-10}$ relative tolerance.
  </action>
  <verify>pytest tests/numerical/test_hac_oracle.py -v</verify>
  <done>Independent NumPy HAC test oracle verifies statsmodels HAC implementation down to 10^-10 numerical precision.</done>
</task>

<task type="auto">
  <name>Create Unit & Schema Conformance Tests for Trend Estimator</name>
  <files>terra-odyssey/backend/tests/unit/test_trend_estimator.py</files>
  <action>
    Create `terra-odyssey/backend/tests/unit/test_trend_estimator.py` testing:
    1. `test_known_synthetic_slope`: Evaluates a 25-year time series with ground-truth slope 0.3°C/decade; confirms recovered slope and fitted change are within nominal sampling error.
    2. `test_ineligible_short_series`: Series with 15 years returns `status="ineligible"` with appropriate caveats.
    3. `test_ineligible_non_consecutive`: Series with gaps returns `status="ineligible"`.
    4. `test_theil_sen_outlier_robustness`: Adds single extreme outlier to time series; verifies Theil-Sen diagnostic detects deviation from OLS slope.
    5. `test_lag_sensitivities_present`: Verifies `diagnostics.lag_sensitivities` contains results for lags 1, 3, and 5.
    6. `test_schema_validation`: Validates dictionary output against `terra-odyssey/backend/schemas/analysis-result.schema.json` using `jsonschema`.
  </action>
  <verify>pytest tests/unit/test_trend_estimator.py -v</verify>
  <done>All trend estimator unit tests and JSON schema validation pass with 100% assertions.</done>
</task>

## Success Criteria
- [ ] OLS + Newey-West HAC covariance (lag 2, Bartlett, small-sample correction, Student-$t$) fully implemented.
- [ ] Independent NumPy HAC oracle cross-verifies statsmodels to $10^{-10}$ tolerance.
- [ ] Theil-Sen point-estimate diagnostic included without substituting primary inferential CI.
- [ ] 100% schema validation against `schemas/analysis-result.schema.json`.
- [ ] All tests passing cleanly in `tests/numerical/` and `tests/unit/`.
