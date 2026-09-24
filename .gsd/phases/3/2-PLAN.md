---
phase: 3
plan: 2
wave: 2
depends_on: [1]
---

# Plan 3.2: Paired Regional Difference Contrast Estimator

## Objective
Implement the paired regional difference contrast estimator using the synchronous difference series $D_t = Y_{A,t} - Y_{B,t}$ fitted with the verified Phase 2 OLS + Newey-West HAC engine, evaluating cross-regional covariance, enforcing common consecutive years ($\ge 20$), and applying the strict opposite-trend evidence qualification hierarchy.

## Context
- `.gsd/SPEC.md`
- `.gsd/DECISIONS.md`
- `.gsd/phases/3/RESEARCH.md`
- `docs/SCIENTIFIC_RULES.md`
- `docs/VALIDATION_PLAN.md`
- `terra-odyssey/schemas/analysis-result.schema.json`
- `terra-odyssey/src/analysis/trend_estimator.py`

## Tasks

<task type="auto">
  <name>Implement Paired Regional Contrast Estimator</name>
  <files>terra-odyssey/src/analysis/paired_contrast.py</files>
  <action>
    Create `terra-odyssey/src/analysis/paired_contrast.py` with:
    1. Function `estimate_paired_contrast(years_a: np.ndarray, values_a: np.ndarray, years_b: np.ndarray, values_b: np.ndarray, dataset_id: str, variable: str, units: str, unit_per_decade: str, geometry_a: dict, geometry_b: dict, selection_status: str = "predefined", test_family: str = "single_predefined_test", confidence_level: float = 0.95, adjusted_p_value: Optional[float] = None, multiplicity_method: Optional[str] = None, fdr_level: Optional[float] = None, family_id: Optional[str] = None, family_size: Optional[int] = None, hypothesis_id: Optional[str] = None) -> dict`:
       - Calendar alignment: joins `(years_a, values_a)` and `(years_b, values_b)` on common calendar years.
       - Continuity validation: checks that common valid years form an unbroken sequence $\ge 20$ years (refuses to collapse time).
       - Individual fits: fits OLS+HAC for Region A and Region B over the common period to obtain $\hat{\beta}_A$ and $\hat{\beta}_B$.
       - Synchronous difference series: $D_t = Y_{A,t} - Y_{B,t}$.
       - Difference trend estimation: fits OLS+HAC on $D_t$ using centered year coordinates, $L=2$ Bartlett kernel, small-sample correction, and Student-$t$ reference distribution ($df = n - 2$).
       - Verifies $\hat{\beta}_D = \hat{\beta}_A - \hat{\beta}_B$.
       - Evidence logic hierarchy:
         - `if either region is ineligible`: `status = "ineligible"`
         - `elif np.sign(beta_a) == np.sign(beta_b)`: `status = "inconclusive"`, caveat/diagnostic specifies `"signs_not_opposite"` (even if contrast is significant)
         - `elif selection_status == "predefined" and raw_p >= (1 - confidence_level)`: `status = "inconclusive"`, caveat specifies `"contrast_not_supported"`
         - `elif selection_status == "exploratory_map_selected" and (adjusted_p or raw_p) >= (fdr_level or 0.05)`: `status = "inconclusive"`, caveat specifies `"contrast_not_supported_after_multiplicity"`
         - `else`: `status = "supported"`, caveat specifies `"opposite_trend_pair"`
       - Constructs compound geometry GeoJSON FeatureCollection containing Region A and Region B geometries with hashes.
       - Returns a result dictionary fully conforming to `schemas/analysis-result.schema.json` with:
         - `effect.estimate`: $\hat{\beta}_D \times 10$ (difference per decade)
         - `effect.contrast_orientation`: `"region_a_minus_region_b"`
         - `effect.region_a_estimate`: $\hat{\beta}_A \times 10$
         - `effect.region_b_estimate`: $\hat{\beta}_B \times 10$
         - `interpretation.level`: `"spatial_contrast"`
  </action>
  <verify>python -c "from src.analysis.paired_contrast import estimate_paired_contrast; print('Paired contrast estimator importable')"</verify>
  <done>Paired contrast estimator aligns series by calendar year, fits difference OLS+HAC, enforces opposite-trend hierarchy, and serializes to analysis-result schema.</done>
</task>

<task type="auto">
  <name>Create Unit Tests for Paired Regional Contrast</name>
  <files>terra-odyssey/tests/unit/test_paired_contrast.py</files>
  <action>
    Create comprehensive unit tests in `terra-odyssey/tests/unit/test_paired_contrast.py`:
    1. `test_opposite_trend_pair_supported`: Synthesizes Region A ($+0.4$ °C/decade) and Region B ($-0.3$ °C/decade); verifies $\hat{\beta}_D \approx +0.7$ °C/decade, $p_D < 0.05$, and status is `"supported"`.
    2. `test_same_sign_slopes_inconclusive`: Synthesizes Region A ($+0.5$ °C/decade) and Region B ($+0.1$ °C/decade) where difference is significant but signs are both positive; verifies status is `"inconclusive"` with `"signs_not_opposite"` diagnostic.
    3. `test_opposite_signs_nonsignificant_contrast`: Synthesizes opposite signs with high noise ($p_D \ge 0.05$); verifies status is `"inconclusive"` with `"contrast_not_supported"`.
    4. `test_insufficient_common_years_ineligible`: Synthesizes non-overlapping records or fewer than 20 common years; verifies status is `"ineligible"`.
    5. `test_linearity_equivalence`: Verifies $\hat{\beta}_D == \hat{\beta}_A - \hat{\beta}_B$ down to numerical precision ($10^{-12}$).
    6. `test_schema_conformance`: Validates paired contrast result dictionary against `schemas/analysis-result.schema.json`.
  </action>
  <verify>pytest tests/unit/test_paired_contrast.py -v</verify>
  <done>All paired contrast unit tests pass with 100% assertions and full JSON schema validity.</done>
</task>

## Success Criteria
- [ ] Direct difference time series $D_t = Y_{A,t} - Y_{B,t}$ fitted with OLS + HAC.
- [ ] Linearity property $\hat{\beta}_D = \hat{\beta}_A - \hat{\beta}_B$ verified.
- [ ] Strict evidence hierarchy (opposite signs required for opposite pair qualification).
- [ ] 100% schema validation against `schemas/analysis-result.schema.json`.
- [ ] 100% passing tests in `tests/unit/test_paired_contrast.py`.
