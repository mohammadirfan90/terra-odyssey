# Phase 4 Plan — Spatial Trend Evidence & Multiplicity Control

## Tasks

### T4.1 — Backend: spatial_grid.py
- Subdivide bbox into 0.5° cells (max 40x40=1600), run OLS+HAC per cell.
- Output: slope, se, p_raw, n_years per cell. Null if < 10 valid years.

### T4.2 — Backend: fdr_control.py
- Benjamini-Yekutieli FDR correction on all valid p_raw values.
- Attach p_adj + significant (bool, alpha=0.05) to each cell.

### T4.3 — Backend: map-grid endpoint
- GET /api/investigations/{job_id}/map-grid → gzip JSON.
- Computed in stepper.py after series step.

### T4.4 — Frontend: Types + Hook
- SpatialGridCell, SpatialGridPayload in types.ts.
- useInvestigationMapGrid() SWR hook in client.ts.

### T4.5 — Frontend: TrendGridLayer.tsx
- MapLibre GeoJSON heatmap: blue=cooling, white=zero, red=warming.
- Stipple/dim non-significant cells.
- Floating legend with color scale, FDR badge.

### T4.6 — Frontend: Wire EarthTrendMap
- Render TrendGridLayer conditionally when mapGridData available.

### T4.7 — Tests
- BY correction unit test.
- Spatial grid unit test with mock NetCDF.
- Integration test for map-grid endpoint.
