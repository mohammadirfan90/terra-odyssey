# Plan 3.1 Summary: Area-Weighted Spatial Aggregation Engine

## Implementation Summary
- **Module**: `terra-odyssey/src/analysis/spatial_aggregation.py`
  - `compute_cell_bounds_and_areas`: Exact cell boundaries $[\phi_s, \phi_n]$ and spherical/ellipsoidal area integration $A_{ij} = R^2 \Delta\lambda |\sin(\phi_n) - \sin(\phi_s)|$ in $m^2$.
  - `compute_polygon_weights`: Fractional polygon intersection overlap $f_{ij} = \frac{\text{Area}(\text{cell}_{ij} \cap P)}{\text{Area}(\text{cell}_{ij})}$ via `shapely` with topology validation, antimeridian split handling, and bounding-box spatial acceleration. Computes `requested_geometry_supported_fraction`.
  - `aggregate_spatial_mean`: Evaluates area-based coverage $C_t = \frac{\sum w_{ij} M_{ij,t}}{\sum w_{ij}}$ and computes area-weighted regional mean $\bar{Y}_t = \frac{\sum Y_{ij,t} w_{ij} M_{ij,t}}{\sum w_{ij} M_{ij,t}}$.
  - Coverage threshold enforcement: strict 100% area coverage for MERRA-2; 90% inferential threshold for GPM IMERG; hard floor masking $<80\%$ to `NaN`.

## Verification Evidence
- 6/6 unit tests passing cleanly in `tests/unit/test_spatial_aggregation.py` (1.63s).
- Verified analytical polar vs equatorial area ratio scaling with $\cos(\phi)$.
- Verified exact hand-computed fractional overlap weights against a 2x2 grid fixture.
- Verified 100% threshold masking for MERRA-2 and 90%/80% threshold logic for GPM IMERG.
- Verified clean antimeridian splitting across $180^\circ$ longitude.
- Verified out-of-bounds geometry supported fraction reporting.
