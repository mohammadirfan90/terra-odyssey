# Plan 2.2 Summary: OLS + Newey-West HAC Estimator & Numerical Test Oracle

## Implementation Summary
- **Trend Estimator**: `terra-odyssey/src/analysis/trend_estimator.py`
  - Coordinate centering: $x = \text{years} - \text{mean}(\text{years})$ for float64 numerical conditioning.
  - Production model: `statsmodels.api.OLS` with explicit `get_robustcov_results(cov_type="HAC", maxlags=2, kernel="bartlett", use_correction=True, use_t=True)` ($df = n - 2$).
  - Primary slope: reported in physical units per decade ($10 \times \text{slope\_per\_year}$).
  - Fitted change: $\text{slope\_per\_year} \times (\text{last\_year} - \text{first\_year})$ (e.g. 2001-2025 span is 24 years).
  - Autoregressive lag sensitivities: evaluated at $L \in \{1, 3, 5\}$ and recorded under `diagnostics.lag_sensitivities`.
  - Outlier robustness: SciPy `theilslopes` computed as point-estimate comparison under `diagnostics.theil_sen`.
  - Strict schema serialization: conforms 100% to `schemas/analysis-result.schema.json`.
- **Numerical Test Oracle**: `terra-odyssey/tests/numerical/test_hac_oracle.py`
  - Pure-NumPy independent implementation of Newey-West (1987) Bartlett HAC covariance matrix and Student-$t$ inference.
  - Verified across multiple sample sizes ($n=20, 25, 40$), lag orders ($L=1, 2, 3, 5$), Gaussian noise, AR(1) autocorrelated errors ($\rho = 0.6$), and heteroskedastic error distributions.
  - Cross-verifies statsmodels parameter estimates, covariance matrix, standard errors, $t$-values, $p$-values, and confidence intervals to within $< 10^{-10}$ relative tolerance.

## Verification Evidence
- 19/19 tests passing:
  - 14 numerical oracle tests (`tests/numerical/test_hac_oracle.py`).
  - 5 unit & schema validation tests (`tests/unit/test_trend_estimator.py`).
