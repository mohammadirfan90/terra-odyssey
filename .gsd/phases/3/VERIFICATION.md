# Phase 3 Verification: Regional Contrast & Evidence Engine

## Must-Haves Verification

### 1. Area-Weighted Spatial Aggregation
- [x] **Geodesic Cell Boundaries & Areas**: Exact spherical/geodesic cell bound integration ($A_{ij} \propto \Delta\lambda |\sin(\phi_n) - \sin(\phi_s)|$) via `shapely` and `pyproj.Geod(ellps="WGS84")`.
- [x] **Fractional Polygon Overlap**: Exact intersection area weights $w_{ij} = A_{ij} f_{ij}$ computed via `shapely`.
- [x] **Area-Based Coverage Metric**: $C_t = \frac{\sum w_{ij} M_{ij,t}}{\sum w_{ij}}$ implemented and verified.
- [x] **Product-Specific Thresholds**: Strict 100% area coverage enforced for MERRA-2; 90% inferential threshold enforced for GPM IMERG; hard floor masking $<80\%$ to `NaN`.
- [x] **Spatial Edge Cases**: Bounding boxes, antimeridian crossing, coordinate normalization, and `requested_geometry_supported_fraction` reporting verified.

### 2. Paired Regional Contrast Estimator
- [x] **Calendar Alignment**: Regional series aligned on calendar years; requires at least 20 consecutive common complete years.
- [x] **Synchronous Difference Series**: Direct difference $D_t = Y_{A,t} - Y_{B,t}$ fitted with verified Phase 2 OLS + Newey-West HAC ($L=2$, Bartlett kernel, small-sample correction, Student-$t$).
- [x] **Linear Equivalence**: Linearity $\hat{\beta}_D = \hat{\beta}_A - \hat{\beta}_B$ verified to machine precision ($< 10^{-12}$).
- [x] **Evidence Qualification Hierarchy**:
  - `ineligible`: if $<20$ common complete consecutive years.
  - `inconclusive / signs_not_opposite`: if empirical slopes share the same sign (even if difference is statistically significant).
  - `inconclusive / contrast_not_supported`: if raw $p \ge 0.05$.
  - `inconclusive / contrast_not_supported_after_multiplicity`: if adjusted $p \ge \text{FDR level}$.
  - `supported / opposite_trend_pair`: if empirical slopes have opposite signs AND difference is statistically significant.

### 3. Multiple Testing & Multiplicity Control
- [x] **Benjamini-Yekutieli (BY)**: Implemented as conservative primary default for spatially dependent test families; simulation confirms false discovery rate $\le 0.05$ under a global null.
- [x] **Benjamini-Hochberg (BH)**: Implemented and reported as sensitivity diagnostic.
- [x] **Family Freezing**: Freezes `family_id` and `family_size = len(candidate_contrasts)`.
- [x] **Mandatory Selection Disclosure**: Flags exploratory candidates with `selection_status="exploratory_map_selected"` and adds explicit caveats.
- [x] **Schema Conformance**: 100% schema validation against `schemas/analysis-result.schema.json`.

---

## Verdict: PASS
63/63 tests passing cleanly in 2.57s (`pytest tests/ -v`).
