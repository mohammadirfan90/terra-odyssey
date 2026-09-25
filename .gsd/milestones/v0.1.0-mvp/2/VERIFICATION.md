# Phase 2 Verification: Scientific Trend Engine & Estimators

## Must-Haves Verification

### 1. Temporal Aggregation & Missingness Policy
- [x] **Strict 12/12 calendar-month completeness**: Enforced for both D1 annual mean temperature (day-weighted) and D2 precipitation accumulation sum. Incomplete years masked to `NaN`.
- [x] **Leap-Year Awareness**: Exact calendar days calculated via `time.dt.days_in_month` (e.g. Feb 2024 = 29 days vs Feb 2023 = 28 days) with numerator and denominator alignment.
- [x] **Consecutive Series Requirement**: `validate_consecutive_series` enforces unbroken annual continuity with $\ge 20$ years and refuses to collapse temporal gaps.

### 2. OLS + Newey-West HAC Trend Estimator
- [x] **Centered Coordinate System**: $x = \text{years} - \text{mean}(\text{years})$ in float64 precision.
- [x] **statsmodels Production Estimator**: Fitted with `cov_type="HAC"`, `maxlags=2`, `kernel="bartlett"`, `use_correction=True`, `use_t=True` ($df = n - 2$).
- [x] **Lag Sensitivities**: Explicitly evaluated for $L \in \{1, 3, 5\}$ and reported under `diagnostics.lag_sensitivities`.
- [x] **Outlier-Resistant Point Diagnostic**: SciPy `theilslopes` computed and reported under `diagnostics.theil_sen`.
- [x] **Honest Null Language**: Inconclusive results explicitly state that lack of detection does not prove zero physical change.

### 3. Numerical Reference Oracle
- [x] **Pure-NumPy HAC Oracle**: Independent matrix formulation under `tests/numerical/test_hac_oracle.py`.
- [x] **Machine-Precision Agreement**: 14 tests verifying statsmodels parameters, covariance matrix, SE, $t$-statistic, $p$-value, and CIs to within $< 10^{-10}$ relative tolerance across Gaussian, AR(1), and heteroskedastic error processes.

### 4. Interval Sensitivity Engine
- [x] **5 Predefined Windows**: `full`, `start_plus_3`, `start_plus_5`, `end_minus_3`, `end_minus_5`.
- [x] **20-Year Minimum Threshold**: Windows $< 20$ years pruned as ineligible.
- [x] **Scientific Guardrails**: Reports slope range, sign stability, and appends explicit caveats if status shifts between endpoints.

### 5. Schema Serialization
- [x] **AnalysisResult Conformance**: Output validates 100% against `schemas/analysis-result.schema.json`.

---

## Verdict: PASS
48/48 tests passing cleanly in 1.95s (`pytest tests/ -v`).
