# Plan 3.2 Summary: Paired Regional Difference Contrast Estimator

## Implementation Summary
- **Module**: `terra-odyssey/src/analysis/paired_contrast.py`
  - Aligns Region A and Region B time series on identical calendar years.
  - Requires at least 20 consecutive common complete annual observations ($n \ge 20$).
  - Fits synchronous difference series $D_t = Y_{A,t} - Y_{B,t}$ with verified Phase 2 OLS + Newey-West HAC covariance ($L=2$, Bartlett kernel, small-sample correction, Student-$t$).
  - Evaluates individual trends for Region A and Region B over the common interval, mathematically verifying $\hat{\beta}_D = \hat{\beta}_A - \hat{\beta}_B$.
  - Implements strict evidence qualification hierarchy:
    - `ineligible`: insufficient common consecutive years ($<20$).
    - `inconclusive / signs_not_opposite`: empirical slopes share the same sign (even if contrast is significant).
    - `inconclusive / contrast_not_supported`: raw contrast $p \ge 0.05$.
    - `inconclusive / contrast_not_supported_after_multiplicity`: adjusted contrast $p \ge \text{FDR level}$.
    - `supported / opposite_trend_pair`: opposite empirical signs AND statistically significant difference.
  - Serialization conforming 100% to `schemas/analysis-result.schema.json` with compound geometry FeatureCollection, `contrast_orientation="region_a_minus_region_b"`, `region_a_estimate`, and `region_b_estimate`.

## Verification Evidence
- 5/5 unit tests passing in `tests/unit/test_paired_contrast.py`:
  - `test_opposite_trend_pair_supported`: confirms supported status for $+0.40$ vs $-0.30$ °C/decade.
  - `test_same_sign_slopes_inconclusive`: confirms same signs (+0.50 vs +0.10) are classified as inconclusive despite significant difference.
  - `test_opposite_signs_nonsignificant_contrast`: confirms opposite signs with large noise are classified as inconclusive / contrast_not_supported ($p \ge 0.05$).
  - `test_insufficient_common_years_ineligible`: confirms $<20$ years returns ineligible.
  - `test_linearity_equivalence`: confirms $\hat{\beta}_D == \hat{\beta}_A - \hat{\beta}_B$ down to $10^{-12}$ machine precision.
