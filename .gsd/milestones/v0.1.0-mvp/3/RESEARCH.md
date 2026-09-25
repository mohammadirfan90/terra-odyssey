# Phase 3 Research: Regional Contrast & Evidence Engine

## Overview
Phase 3 establishes the spatial aggregation, paired regional contrast, and multiplicity control framework for Terra Odyssey. It allows users to extract area-weighted regional time series from gridded products (MERRA-2 and GPM IMERG), test whether two regions exhibit statistically distinct trends via synchronous difference estimation, and control false discovery rates when exploring candidate pairs across geographic space.

---

## 1. Spatial Aggregation & Geodesic Geometry
### Mathematical Formulation
- **Exact Cell-Bound Geodesic Area Weighting**:
  For an equirectangular grid with cell latitude bounds $[\phi_{s}, \phi_{n}]$ and longitude bounds $[\lambda_{w}, \lambda_{e}]$:
  $$A_{ij} = R^2 (\lambda_e - \lambda_w) [\sin(\phi_n) - \sin(\phi_s)]$$
  where $R \approx 6371008.8\text{ m}$ (or ellipsoidal area via `pyproj.Geod(ellps="WGS84")`).
- **Fractional Polygon Overlap**:
  For each grid cell intersecting a user-defined region polygon $P$:
  $$f_{ij} = \frac{\text{Area}(\text{cell}_{ij} \cap P)}{\text{Area}(\text{cell}_{ij})}, \quad w_{ij} = A_{ij} f_{ij}$$
  The area-weighted regional spatial mean at time $t$ is:
  $$\bar{Y}_t = \frac{\sum_{i,j} Y_{i,j,t} \cdot w_{ij} \cdot M_{i,j,t}}{\sum_{i,j} w_{ij} \cdot M_{i,j,t}}$$
  where $M_{i,j,t} \in \{0, 1\}$ indicates a valid (non-fill, non-masked) observation.
- **Area-Based Coverage Metric**:
  $$C_t = \frac{\sum_{i,j} w_{ij} \cdot M_{i,j,t}}{\sum_{i,j} w_{ij}}$$
  (Never use raw unweighted cell counts, which over-weight polar cells and under-weight equatorial cells).
- **Threshold Policies**:
  - **MERRA-2 T2M**: 100% area coverage within eligible regional footprint for inferential monthly values.
  - **GPM IMERG**: $\ge 90\%$ area coverage for inferential monthly values. Months with $80\% \le C_t < 90\%$ are exposed only as descriptive diagnostics. Any month with $C_t < 80\%$ is masked to `NaN`.
  - Validate sensitivity across thresholds: 80%, 90%, 95%, 100%.
- **Spatial Edge Cases**:
  - Longitude normalization: convert coordinates between $[-180, 180)$ and $[0, 360)$ to match dataset grid conventions.
  - Antimeridian crossing: split polygons crossing $\pm 180^\circ$ into multipolygons.
  - Topological validity: ensure `shapely.validation.make_valid` repairs self-intersecting geometries.
  - Boundary clipping disclosure: report `requested_geometry_supported_fraction` and `valid_data_area_fraction`.

---

## 2. Paired Regional Contrast Estimator
### Formulation
- Given two regions $A$ and $B$ evaluated over the identical temporal period:
  1. Align annual time series by calendar year.
  2. Compute synchronous direct difference series:
     $$D_t = Y_{A,t} - Y_{B,t}$$
  3. Require at least 20 consecutive common complete annual observations ($n \ge 20$).
  4. Fit linear trend with Phase 2 verified OLS + Newey-West HAC covariance ($L=2$, Bartlett kernel, small-sample correction, Student-$t$ reference distribution with $df = n - 2$):
     $$D_t = \alpha_D + \beta_D (t - \bar{t}) + \epsilon_{D,t}$$
  5. By linearity of OLS on identical regressors:
     $$\hat{\beta}_D = \hat{\beta}_A - \hat{\beta}_B$$
     $$\text{Var}(\hat{\beta}_D) = \text{Var}(\hat{\beta}_A) + \text{Var}(\hat{\beta}_B) - 2 \text{Cov}(\hat{\beta}_A, \hat{\beta}_B)$$
     Estimating $D_t$ directly captures cross-regional spatial covariance, shared climate modes (e.g. ENSO), and difference autocorrelation in a single transparent model.
- **Evidence Hierarchy for Opposite-Trend Pairs**:
  ```python
  if either_region_is_ineligible:
      status = "ineligible"
  elif np.sign(beta_A) == np.sign(beta_B):
      status = "inconclusive"
      sub_status = "signs_not_opposite"
  elif selection_status == "predefined" and raw_contrast_p >= 0.05:
      status = "inconclusive"
      sub_status = "contrast_not_supported"
  elif selection_status == "exploratory_map_selected" and adjusted_contrast_p >= 0.05:
      status = "inconclusive"
      sub_status = "contrast_not_supported_after_multiplicity"
  else:
      status = "supported"
      sub_status = "opposite_trend_pair"
  ```
- **Serialization**: Reports $\hat{\beta}_A$, $\hat{\beta}_B$, $\hat{\beta}_D$, HAC SE, 95% HAC CI, raw p-value, decision p-value, and fitted difference over the interval.

---

## 3. Multiple Testing & Multiplicity Control
### Benjamini-Yekutieli (BY) as Primary Default
- Climate fields exhibit complex spatial autocorrelation. The standard Benjamini-Hochberg (BH) procedure assumes independence or positive regression dependency (PRDS), which does not hold generally across arbitrary spatial contrasts.
- Primary correction: **Benjamini-Yekutieli (BY 2001)**:
  $$p_{(i)} \le \frac{i}{M \cdot c(M)} q, \quad c(M) = \sum_{j=1}^M \frac{1}{j}$$
  guaranteeing conservative control under arbitrary spatial dependency.
- Sensitivity diagnostic: **Benjamini-Hochberg (BH 1995)**:
  $$p_{(i)} \le \frac{i}{M} q$$
- Family definition:
  - For $N$ candidate regions explored pairwise: $M = \frac{N(N-1)}{2}$ contrast hypotheses.
  - Freezes dataset, period, grid domain, quality policies, and FDR level ($q = 0.05$).
  - Never relabel a map-selected pair as predefined.
