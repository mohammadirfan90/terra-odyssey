---
phase: 3
plan: 3
wave: 3
depends_on: [2]
---

# Plan 3.3: Multiple-Testing Control & Evidence Adjudication

## Objective
Implement family-wise multiple-testing adjustments for exploratory spatial scans and pairwise contrast searches, using Benjamini–Yekutieli (BY) as the primary conservative default for spatially dependent fields and Benjamini–Hochberg (BH) as a sensitivity diagnostic, enforcing mandatory selection disclosure and schema-compliant re-adjudication.

## Context
- `.gsd/SPEC.md`
- `.gsd/DECISIONS.md`
- `.gsd/phases/3/RESEARCH.md`
- `docs/SCIENTIFIC_RULES.md`
- `docs/VALIDATION_PLAN.md`
- `terra-odyssey/schemas/analysis-result.schema.json`
- `terra-odyssey/src/analysis/paired_contrast.py`

## Tasks

<task type="auto">
  <name>Implement Multiplicity Control and Family Adjudication Module</name>
  <files>terra-odyssey/src/analysis/multiplicity.py</files>
  <action>
    Create `terra-odyssey/src/analysis/multiplicity.py` with:
    1. Function `adjust_pvalues(p_values: np.ndarray, method: str = "fdr_by", alpha: float = 0.05) -> tuple[np.ndarray, np.ndarray]`:
       - Wraps `statsmodels.stats.multitest.multipletests`.
       - Supports `method="fdr_by"` (Benjamini-Yekutieli, arbitrary dependency) and `method="fdr_bh"` (Benjamini-Hochberg).
       - Returns `(reject_mask, adjusted_p_values)`.
    2. Function `adjudicate_contrast_family(contrast_results: list[dict], family_id: str, fdr_level: float = 0.05) -> list[dict]`:
       - Freezes family definition: records `family_id`, `family_size = len(contrast_results)`.
       - Sets `selection_status = "exploratory_map_selected"` across all results (never relabels map-selected pairs as predefined).
       - Extracts raw contrast p-values.
       - Runs primary BY adjustment (`fdr_by`) and sensitivity BH adjustment (`fdr_bh`).
       - For each result:
         - Sets `raw_p_value = raw_p`.
         - Sets `adjusted_p_value = adjusted_p_by`.
         - Sets `decision_p_value = adjusted_p_by`.
         - Sets `multiplicity_method = "fdr_by"`.
         - Sets `fdr_level = fdr_level`.
         - Adds `diagnostics.multiplicity_sensitivity = {"fdr_bh_adjusted_p": float(adj_bh), "fdr_bh_rejected": bool(rej_bh)}`.
         - Re-adjudicates status: if nominally supported with raw $p < 0.05$ but $p_{\text{adj}} \ge 0.05$, status becomes `"inconclusive"` with caveat `"contrast_not_supported_after_multiplicity"`.
       - Returns updated list of schema-compliant result dictionaries.
  </action>
  <verify>python -c "from src.analysis.multiplicity import adjust_pvalues, adjudicate_contrast_family; print('Multiplicity module importable')"</verify>
  <done>Multiplicity module applies Benjamini-Yekutieli FDR control with BH sensitivity diagnostics and re-adjudicates exploratory contrast families.</done>
</task>

<task type="auto">
  <name>Create Unit Tests for Multiple-Testing and Family Adjudication</name>
  <files>terra-odyssey/tests/unit/test_multiplicity.py</files>
  <action>
    Create comprehensive unit tests in `terra-odyssey/tests/unit/test_multiplicity.py`:
    1. `test_by_controls_fdr_under_null`: Simulates 100 hypotheses under a global null ($U[0, 1]$ p-values); confirms BY rejects $\le 5\%$ of tests on average.
    2. `test_by_more_conservative_than_bh`: Verifies that for identical p-value inputs, adjusted p-values from BY are strictly $\ge$ adjusted p-values from BH ($p_{\text{BY}} = c(M) \cdot p_{\text{BH}}$).
    3. `test_family_readjudication_downgrades_marginal_significance`: Takes a candidate contrast with raw $p = 0.035$ embedded in a family of $M = 20$ tests; confirms that under BY it is appropriately re-adjudicated to `"inconclusive"` with the required multiplicity caveat.
    4. `test_supported_under_multiplicity_retains_status`: Contrast with very strong evidence ($p = 0.0001$) remains `"supported"` even after BY multiplicity correction across $M = 50$ tests.
    5. `test_schema_conformance_adjudicated_family`: Validates that every result produced by `adjudicate_contrast_family` conforms 100% to `schemas/analysis-result.schema.json`.
  </action>
  <verify>pytest tests/unit/test_multiplicity.py -v</verify>
  <done>All multiplicity unit tests pass with 100% assertions and full JSON schema validity.</done>
</task>

## Success Criteria
- [ ] Benjamini-Yekutieli (`fdr_by`) implemented as primary exploratory map correction.
- [ ] Benjamini-Hochberg (`fdr_bh`) recorded as sensitivity diagnostic.
- [ ] Family definition frozen with `family_id` and `family_size`.
- [ ] Status correctly downgraded when adjusted p-value exceeds FDR threshold.
- [ ] 100% passing tests in `tests/unit/test_multiplicity.py`.
