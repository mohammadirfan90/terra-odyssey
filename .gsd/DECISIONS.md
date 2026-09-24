# Architectural & Scientific Decisions: Terra Odyssey

## Phase 2: Scientific Trend Engine & Estimators

**Date:** 2026-09-25

### 1. Statistical Dependency & Implementation
- **Production Choice:** `statsmodels` (`sm.OLS` with `get_robustcov_results`) combined with `scipy.stats`.
- **HAC Configuration:**
  - Covariance type: `"HAC"`
  - Kernel: `"bartlett"`
  - Autoregressive lag: `maxlags=2` (explicit, no automatic bandwidth selection; statsmodels robust OLS requires explicit lags).
  - Finite-sample correction: `use_correction=True`.
  - Reference distribution: Two-sided Student-$t$ distribution (`use_t=True`) with $df = n - 2$.
  - Sensitivity checks: evaluate lag sensitivities at lags 1, 3, and 5 under `method.diagnostics`.
- **Numerical Test Oracle:** Implement an independent, transparent NumPy Newey-West HAC calculation strictly under `terra-odyssey/tests/numerical/`. Use it as a test oracle to cross-verify:
  - OLS slope & intercept coefficients
  - Covariance matrix
  - Slope standard error
  - $t$-statistic & $p$-value
  - 95% confidence interval
- **Rule:** Do not maintain two production estimators in runtime application code.

### 2. Temporal Completeness & Missingness Policy
- **Annual Temperature (D1 - MERRA-2):** Enforce strict 12/12 valid months for inferential annual means.
  - Compute annual mean via day-of-month weighting:
    $$\bar{T}_{\text{annual}} = \frac{\sum_{m=1}^{12} T_m \cdot d_m}{\sum_{m=1}^{12} d_m}$$
    evaluated only when valid month count == 12.
  - Denominator computed only after verifying all 12 exist or strictly masked before division to avoid numerator-denominator contamination.
  - Partial years (10–11 months) may be exposed as an optional descriptive diagnostic, but are strictly ineligible for inferential trend series.
- **Annual Precipitation (D2 - GPM IMERG):** Strict 12/12 valid months required for annual accumulation sum ($mm/\text{year}$).
- **Interval Eligibility:** Require at least 20 consecutive complete annual summaries for default trend inference.
- **Gap Treatment:** If an annual value is missing within the requested interval, do not collapse time or pretend non-consecutive years are consecutive.

### 3. Estimator Palette & Scope
- **Primary Estimator:** OLS slope with centered year coordinate, float64 computation, Bartlett HAC covariance ($L=2$), small-sample correction, Student-$t$ ($df=n-2$), 95% CI.
- **Robustness Diagnostic:** SciPy Theil-Sen estimator (`scipy.stats.theilslopes`) computed as an outlier-resistant point-estimate comparison:
  ```json
  "theil_sen": {
    "slope_per_decade": 0.0,
    "direction_agreement_with_ols": true,
    "absolute_difference_from_ols": 0.0,
    "relative_difference_from_ols": 0.0
  }
  ```
  (Theil-Sen default asymptotic CI is not autocorrelation-aware and shall not be used as the primary inferential CI).
- **Mann-Kendall:** Exclude vanilla Mann-Kendall test from Phase 2 production inference. Defer modified autocorrelation-corrected Mann-Kendall (Hamed & Rao) until it passes complete AR(1) and false-positive simulation gates.

### 4. Interval Sensitivity Design
- **Predefined Windows:** Rather than an unrestricted grid (which drops below the 20-year sample size threshold on a ~2001–2025 record), use 5 predefined one-endpoint-at-a-time windows:
  1. Primary: `start` $\to$ `end`
  2. Later start: `start + 3` $\to$ `end`
  3. Latest start: `start + 5` $\to$ `end`
  4. Earlier end: `start` $\to$ `end - 3`
  5. Earliest end: `start` $\to$ `end - 5`
- **Filtering:** Only retain windows meeting the threshold of $\ge 20$ consecutive complete years.
- **Role:** Stored under `method.diagnostics.interval_sensitivity` as diagnostics of endpoint sensitivity/hiatus artifacts, not independent statistical confirmations.
- **Metrics:** Report slope range, sign agreement, classification changes (`supported`/`inconclusive`), interval width, and eligible year count.

### 5. Schema Serialization Standards
- `effect.estimate`: numeric primary slope per decade ($10 \times \text{slope\_per\_year}$).
- `effect.unit_per_decade`: `"degC/decade"` or `"mm/year/decade"`.
- `effect.fitted_change`: $\text{slope\_per\_year} \times (\text{last\_year} - \text{first\_year})$ (e.g., 2001–2025 span is 24 years).
- `method`:
  ```json
  {
    "estimator": "ols_linear_trend",
    "dependence_treatment": "newey_west_hac_bartlett_lag2_small_sample",
    "test_family": "single_predefined_test",
    "selection_status": "predefined",
    "diagnostics": {
      "kernel": "bartlett",
      "maxlags": 2,
      "lag_sensitivities": [1, 3, 5],
      "use_t": true,
      "degrees_of_freedom": 23,
      "theil_sen": {},
      "interval_sensitivity": []
    }
  }
  ```
