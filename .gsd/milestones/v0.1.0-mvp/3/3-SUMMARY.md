# Plan 3.3 Summary: Multiple-Testing Control & Evidence Adjudication

## Implementation Summary
- **Module**: `terra-odyssey/src/analysis/multiplicity.py`
  - `adjust_pvalues`: Implements multiple-testing corrections using `statsmodels.stats.multitest.multipletests`. Supports Benjamini-Yekutieli (`fdr_by`) as conservative primary default for spatially correlated tests, and Benjamini-Hochberg (`fdr_bh`) as sensitivity diagnostic.
  - `adjudicate_contrast_family`: Freezes declared hypothesis search family (`family_id`, `family_size`), sets `selection_status="exploratory_map_selected"`, applies `fdr_by` multiplicity adjustment, records sensitivity diagnostics under `method.diagnostics.multiplicity_sensitivity`, and re-adjudicates evidence status.
  - Transparent downgrading: any candidate contrast where raw $p < 0.05$ but BY-adjusted $p \ge 0.05$ is downgraded to `"inconclusive"` with sub-status `"contrast_not_supported_after_multiplicity"` and explicit caveats.
  - Full schema validation conforming 100% to `schemas/analysis-result.schema.json`.

## Verification Evidence
- 4/4 unit tests passing in `tests/unit/test_multiplicity.py`:
  - `test_by_controls_fdr_under_null`: confirms BY controls false discovery rate $\le 0.05$ under a global null of 100 uniform hypotheses.
  - `test_by_more_conservative_than_bh`: verifies BY adjusted p-values are strictly greater than or equal to BH adjusted p-values.
  - `test_family_readjudication_downgrades_marginal_significance`: confirms marginal significance ($p = 0.035$) in a family of 20 tests is downgraded to inconclusive with explicit caveats.
  - `test_supported_under_multiplicity_retains_status`: confirms strong evidence ($p = 10^{-5}$) survives multiplicity adjustment across 30 tests.
- Full test suite: 63/63 tests passing cleanly in 2.57s across all units and numerical tests.
