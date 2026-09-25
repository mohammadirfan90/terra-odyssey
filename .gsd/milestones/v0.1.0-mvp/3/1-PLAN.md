---
phase: 3
plan: 1
wave: 1
depends_on: []
---

# Plan 3.1: Area-Weighted Spatial Aggregation Engine

## Objective
Implement an area-weighted spatial aggregation module using `shapely` and `pyproj.Geod` that calculates exact spherical/ellipsoidal cell-bound weights and fractional polygon overlap, computes area-weighted spatial means, evaluates area coverage metrics, and enforces product-specific coverage thresholds (100% for MERRA-2, 90% for GPM IMERG).

## Context
- `.gsd/SPEC.md`
- `.gsd/DECISIONS.md`
- `.gsd/phases/3/RESEARCH.md`
- `docs/SCIENTIFIC_RULES.md`
- `docs/VALIDATION_PLAN.md`
- `terra-odyssey/schemas/analysis-result.schema.json`

## Tasks

<task type="auto">
  <name>Implement Spatial Aggregation with Cell-Bound Geodesic Area Weighting</name>
  <files>terra-odyssey/src/analysis/spatial_aggregation.py</files>
  <action>
    Create `terra-odyssey/src/analysis/spatial_aggregation.py` with:
    1. `compute_cell_bounds_and_areas(lats: np.ndarray, lons: np.ndarray) -> tuple[np.ndarray, np.ndarray]`:
       - Calculates exact cell boundaries $[\phi_s, \phi_n]$ and $[\lambda_w, \lambda_e]$.
       - Computes cell surface areas using spherical / geodesic formulation:
         $$A_{ij} = R^2 \Delta\lambda [\sin(\phi_n) - \sin(\phi_s)]$$
         with $R \approx 6371008.8\text{ m}$ (or `pyproj.Geod(ellps="WGS84")`).
    2. `compute_polygon_weights(geometry: dict, lats: np.ndarray, lons: np.ndarray, boundary_method: str = "fractional_overlap") -> tuple[np.ndarray, dict]`:
       - Parses geometry (GeoJSON Polygon, MultiPolygon, or bbox `[min_lon, min_lat, max_lon, max_lat]`) via `shapely.geometry.shape` or `shapely.geometry.box`.
       - Validates and repairs topology with `shapely.validation.make_valid`.
       - Normalizes longitude coordinates to match grid $[-180, 180)$ or $[0, 360)$.
       - Splits antimeridian-crossing geometries.
       - For each grid cell: computes fractional intersection area $f_{ij} = \frac{\text{Area}(\text{cell}_{ij} \cap P)}{\text{Area}(\text{cell}_{ij})}$.
       - Weight $w_{ij} = A_{ij} \cdot f_{ij}$.
       - Computes coverage metadata: `requested_geometry_supported_fraction` (fraction of polygon inside dataset domain) and total target area.
    3. `aggregate_spatial_mean(da_grid: xr.DataArray, weights: np.ndarray, coverage_threshold: float = 0.90, product_id: str = "d2_gpm_imerg") -> tuple[xr.DataArray, xr.DataArray]`:
       - For each time step:
         - Computes area coverage: $C_t = \frac{\sum w_{ij} M_{ij,t}}{\sum w_{ij}}$ where $M_{ij,t} = \text{notnull}(Y_{ij,t})$.
         - Masks time step to `NaN` if $C_t < \text{coverage\_threshold}$ (e.g. 1.0 for MERRA-2, 0.90 for GPM IMERG).
         - Computes area-weighted mean:
           $$\bar{Y}_t = \frac{\sum Y_{ij,t} w_{ij} M_{ij,t}}{\sum w_{ij} M_{ij,t}}$$
       - Returns `(da_regional_mean, da_coverage_series)`.
  </action>
  <verify>python -c "from src.analysis.spatial_aggregation import compute_cell_bounds_and_areas, compute_polygon_weights, aggregate_spatial_mean; print('Spatial aggregation importable')"</verify>
  <done>Spatial aggregation computes exact cell-bound weights, fractional polygon overlaps, area coverage ratios, and masks insufficient coverage months.</done>
</task>

<task type="auto">
  <name>Create Unit Tests for Spatial Aggregation</name>
  <files>terra-odyssey/tests/unit/test_spatial_aggregation.py</files>
  <action>
    Create comprehensive unit tests in `terra-odyssey/tests/unit/test_spatial_aggregation.py`:
    1. `test_cell_bound_areas_decrease_poleward`: Confirms polar cell areas are smaller than equatorial cell areas by exact $\cos(\phi)$ ratio.
    2. `test_hand_computed_polygon_weights`: Compares fractional overlap weights against an analytical 4-cell test fixture where a polygon covers 50% of two cells and 100% of two cells.
    3. `test_merra2_strict_100_percent_coverage`: Verifies a MERRA-2 regional month with 95% area coverage is masked to `NaN`.
    4. `test_gpm_imerg_90_percent_coverage`: Verifies GPM IMERG is valid at 92% coverage, but masked to `NaN` at 78% coverage.
    5. `test_antimeridian_crossing_geometry`: Verifies polygon crossing $180^\circ$ longitude is correctly segmented and weighted without Cartesian distortion.
    6. `test_out_of_bounds_geometry_reported`: Polygon extending beyond dataset domain returns `requested_geometry_supported_fraction < 1.0`.
  </action>
  <verify>pytest tests/unit/test_spatial_aggregation.py -v</verify>
  <done>All spatial aggregation unit tests pass with 100% assertions validating scientific requirements.</done>
</task>

## Success Criteria
- [ ] Exact cell-bound area calculation ($A_{ij} \propto \Delta\lambda [\sin(\phi_n) - \sin(\phi_s)]$) verified.
- [ ] Fractional polygon overlap weights implemented via `shapely`.
- [ ] Area-weighted coverage metric ($C_t = \frac{\sum w_{ij} M_{ij,t}}{\sum w_{ij}}$) enforced.
- [ ] 100% coverage threshold for MERRA-2 and 90% threshold for GPM IMERG enforced.
- [ ] 100% passing tests in `tests/unit/test_spatial_aggregation.py`.
