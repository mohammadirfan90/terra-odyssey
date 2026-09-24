# Phase 2 Research: Scientific Trend Engine & Estimators

## Overview
Phase 2 builds the core analytical trend engine for Terra Odyssey, transforming monthly gridded or regional time series into defensible, uncertainty-bounded annual trend results compliant with NASA Space Apps 2026 scientific constraints and `schemas/analysis-result.schema.json`.

---

## 1. Temporal Aggregation & Missingness Architecture
### Mathematical Specification
- **Annual Mean Temperature (D1 - MERRA-2 T2M)**:
  $$\bar{T}_{\text{annual}} = \frac{\sum_{m=1}^{12} T_m \cdot d_m}{\sum_{m=1}^{12} d_m}$$
  where $d_m$ is the exact number of calendar days in month $m$.
  - *Completeness rule*: Valid month count must equal 12. If $< 12$, the annual value is masked to `NaN`.
  - *Denominator safety*: Denominator is computed only over valid months after verifying all 12 exist (or strictly masked before division) to prevent missing values from biasing the weighted average while retaining full-year day counts.
  - *Partial-year diagnostic*: 10–11 months may be exposed as an explicitly labeled partial-year diagnostic, but is strictly excluded from the inferential trend series.
- **Annual Precipitation Total (D2 - GPM IMERG)**:
  $$P_{\text{annual}} = \sum_{m=1}^{12} P_{m,\text{accum}}$$
  - *Completeness rule*: Requires 100% (12/12) complete months. Missing months are never imputed as zero.
- **Seasonal Aggregation (DJF, MAM, JJA, SON)**:
  - DJF definition: December of calendar year $y-1$ is assigned to winter of year $y$.
  - All 3 constituent months must be present and valid; otherwise, the seasonal anomaly is `NaN`.
- **Eligibility Threshold**:
  - Inferential trend estimation requires at least 20 consecutive complete annual summaries ($n \ge 20$).
  - Missing years within the interval break continuity; non-consecutive years must never be collapsed or treated as consecutive.

---

## 2. Trend Estimation & Covariance Architecture
### Core Estimator: OLS + Newey-West HAC
- **Coordinate Centering**:
  Centering the independent variable $x_i = \text{year}_i - \bar{\text{year}}$ stabilizes numerical precision in float64 matrix operations and eliminates covariance between slope and intercept.
- **statsmodels Configuration**:
  ```python
  import statsmodels.api as sm
  X = sm.add_constant(centered_years)
  model = sm.OLS(y, X).fit()
  robust = model.get_robustcov_results(
      cov_type="HAC",
      maxlags=2,
      kernel="bartlett",
      use_correction=True,
      use_t=True,
  )
  ```
  - *Lag Selection*: Fixed `maxlags=2` (Bartlett kernel). Statsmodels robust OLS requires explicit lags; no automatic bandwidth selection is used.
  - *Finite-Sample Correction*: `use_correction=True` multiplies the covariance matrix by $\frac{n}{n-k}$ where $k=2$.
  - *Reference Distribution*: Two-sided Student-$t$ distribution with $df = n - 2$.
  - *Sensitivity*: Report lag sensitivities for $L \in \{1, 3, 5\}$ in `method.diagnostics.lag_sensitivities`.
- **Output Units & Metrics**:
  - `effect.estimate`: slope in physical units per decade ($10 \times \text{slope\_per\_year}$).
  - `effect.unit_per_decade`: `"degC/decade"` or `"mm/year/decade"`.
  - `effect.fitted_change`: $\text{slope\_per\_year} \times (\text{last\_year} - \text{first\_year})$ (e.g., 2001 to 2025 span is 24 years).

---

## 3. Robustness & Diagnostics
### SciPy Theil-Sen Robustness
- Call `scipy.stats.theilslopes(y, centered_years, alpha=0.95)` with `nan_policy="raise"`.
- Used purely as a point-estimate outlier-resistance comparison under `method.diagnostics.theil_sen`:
  - `slope_per_decade`: $10 \times \text{theil\_slope}$
  - `direction_agreement_with_ols`: $\text{sign}(\beta_{\text{OLS}}) == \text{sign}(\beta_{\text{Theil-Sen}})$
  - `absolute_difference_from_ols`: $|\beta_{\text{OLS}} - \beta_{\text{Theil-Sen}}| \times 10$
  - `relative_difference_from_ols`: $\frac{|\beta_{\text{OLS}} - \beta_{\text{Theil-Sen}}|}{|\beta_{\text{OLS}}|} \times 100\%$
- *Policy*: The asymptotic Theil-Sen CI is not autocorrelation-aware and is never used as the primary inferential CI.
### Deferral of Mann-Kendall
- Unmodified Mann-Kendall test inflates false-positive rates under positive AR(1) serial correlation. Defer until modified variance (Hamed & Rao) passes full simulation gates.

---

## 4. Interval Sensitivity Design
- Avoid unconstrained $\pm 5$-year grids which reduce sample size below 20 years on 2001–2025 records.
- 5 Predefined Windows:
  1. `full`: $\text{start} \to \text{end}$
  2. `start_plus_3`: $\text{start} + 3 \to \text{end}$
  3. `start_plus_5`: $\text{start} + 5 \to \text{end}$
  4. `end_minus_3`: $\text{start} \to \text{end} - 3$
  5. `end_minus_5`: $\text{start} \to \text{end} - 5$
- Filter: Discard windows with $< 20$ consecutive complete years.
- Record diagnostics under `method.diagnostics.interval_sensitivity`: slope range, sign stability, classification shifts, and eligible period counts.

---

## 5. Numerical Test Oracle
- Independent NumPy implementation in `terra-odyssey/tests/numerical/test_hac_oracle.py`:
  - Explicitly computes residual vector $e = y - X\beta$.
  - Autocovariance matrices $\hat{\Gamma}_l = \frac{1}{n} \sum_{t=l+1}^n e_t e_{t-l} x_t x_{t-l}^T$.
  - Bartlett weights $w_l = 1 - \frac{l}{L+1}$.
  - Sandwich formula $\hat{V} = (X^T X)^{-1} (n \cdot \hat{\Omega}) (X^T X)^{-1} \cdot \frac{n}{n-k}$.
  - Validates `statsmodels` output to within $10^{-12}$ relative tolerance.
