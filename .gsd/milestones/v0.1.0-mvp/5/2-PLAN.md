---
phase: 5
plan: 2
wave: 2
depends_on:
  - 5.1
---

# Plan 5.2: Mapcn & MapLibre Trend Map, CanvasSource/Globe Spike, FDR Pattern Layer & Terra Draw Selector

## Objective
Implement the GPU-accelerated Earth Trend Map using MapLibre GL JS wrapped in the Mapcn component architecture. Execute the validation spike testing `CanvasSource` under 2D Mercator and 3D Globe projections (with GeoJSON fallback for $\le 10,000$ cells). Render signed slopes with a frozen zero-centred diverging palette (`RdBu`/`BrBG`), overlay Benjamini-Yekutieli FDR discoveries with a stippled pattern layer, provide mathematical cell inspection, and integrate Terra Draw for drawing Region A and Region B polygons with persistent labels and exploratory search tracking.

## Context
- `terra-odyssey/src/frontend/components/map/`
- `terra-odyssey/src/frontend/lib/map/`
- `docs/UX_SPEC.md`
- `.gsd/DECISIONS.md`
- `.gsd/phases/5/RESEARCH.md`

## Tasks

<task type="auto">
  <name>Mapcn & MapLibre Integration with CanvasSource/Globe Validation Spike</name>
  <files>
    terra-odyssey/src/frontend/components/ui/map.tsx
    terra-odyssey/src/frontend/components/map/EarthTrendMap.tsx
    terra-odyssey/src/frontend/components/map/TrendCanvasSource.ts
    terra-odyssey/src/frontend/components/map/ProjectionToggle.tsx
    terra-odyssey/src/frontend/lib/map/color-scale.ts
    terra-odyssey/src/frontend/lib/map/grid-to-canvas.ts
  </files>
  <action>
    1. Install MapLibre GL JS and map utilities:
       - `maplibre-gl`, `d3-scale`, `d3-color`, `@types/d3-scale`, `@types/d3-color`.
    2. Implement `color-scale.ts`:
       - Zero-centred diverging scale: `RdBu`, `BrBG`, `PuOr`, or scientific `"vik"` (strictly no Viridis).
       - Frozen symmetric domain: $[-\max|\beta|, +\max|\beta|]$. Panning or zooming does not rescale.
    3. Execute Validation Spike in `TrendCanvasSource.ts`:
       - Implement offscreen HTML5 canvas rasterizer (`grid-to-canvas.ts`) mapping decimation-capped grid cells to pixel buffers.
       - Register as MapLibre `CanvasSource` / image source.
       - Test and validate across both 2D Mercator and 3D Globe projections.
       - Implement fallback branch: If canvas projection distorts on globe, render cells as GeoJSON polygon features with MapLibre `fill` layer (guaranteed for $\le 10,000$ cells).
    4. Build `EarthTrendMap.tsx` client component:
       - Dynamic import with `ssr: false` and accessible loading skeleton.
       - Integrated Mapcn controls: navigation, zoom, reset, layer toggles, legend display.
       - `ProjectionToggle.tsx`: switches between `2D Analysis` (Mercator) and `Globe Overview` without reloading state or recalculating evidence.
  </action>
  <verify>
    npm --prefix terra-odyssey/src/frontend run build
  </verify>
  <done>
    Trend map renders signed slopes on a symmetric diverging color scale and smoothly toggles between Mercator and Globe views without evidence corruption.
  </done>
</task>

<task type="auto">
  <name>FDR Discovery Pattern Layer, Coverage Masks & Mathematical Cell Inspector</name>
  <files>
    terra-odyssey/src/frontend/components/map/EvidencePatternLayer.tsx
    terra-odyssey/src/frontend/components/map/CellInspector.tsx
    terra-odyssey/src/frontend/lib/map/cell-index.ts
  </files>
  <action>
    1. Implement `EvidencePatternLayer.tsx`:
       - Statistically significant discoveries under Benjamini-Yekutieli (`adjusted_p_value < 0.05` and `evidence_code == "supported"`) are encoded using an SVG/Canvas stippled dot pattern layer over the cell. Never rely on color alone to communicate significance.
       - Cells with `eligibility_code == "missing"` or `coverage_fraction < 0.8` are rendered with diagonal hatching or semi-transparent mask.
    2. Implement `cell-index.ts` and `CellInspector.tsx`:
       - Exact mathematical coordinate mapping: $(lon, lat) \to (col, row)$ indices.
       - Mousemove / click inspection popover displaying:
         - Exact grid coordinates (lon, lat)
         - Physical slope ($\text{value} \pm \text{SE}$ per decade)
         - 95% HAC confidence interval $[\beta_{lower}, \beta_{upper}]$
         - Raw and BY-adjusted $p$-values
         - Valid data coverage percentage
       - Pure nearest-cell calculation: zero spatial interpolation or smoothing.
  </action>
  <verify>
    npm --prefix terra-odyssey/src/frontend run build
  </verify>
  <done>
    FDR discoveries are clearly highlighted via stippling, invalid cells are visually masked, and cell inspection reveals exact un-interpolated statistics.
  </done>
</task>

<task type="auto">
  <name>Terra Draw Region Selection & Multiplicity Tracking</name>
  <files>
    terra-odyssey/src/frontend/components/map/RegionDrawControls.tsx
    terra-odyssey/src/frontend/lib/map/selection-history.ts
  </files>
  <action>
    1. Install and integrate Terra Draw (`terra-draw` / `maplibre-gl-terradraw` or MapLibre drawing mode adapter).
    2. Build `RegionDrawControls.tsx`:
       - Toolbar buttons: "Draw Region A", "Draw Region B", "Edit", "Clear", "Confirm Regions".
       - Render drawn polygons with high-contrast outlines and persistent on-map text markers: prominent "A" and "B" labels inside bounding centers (never distinguished by color alone).
       - Restrict drawing to valid geographic domains (latitude bounds, polygon sanity).
    3. Implement Exploratory Search Tracking in `selection-history.ts`:
       - Detect if regions were selected after the gridded trend map was displayed.
       - If post-map selected, automatically serialize:
         ```json
         {
           "selection_status": "exploratory_map_selected",
           "screening_family_id": "<map_family_id>",
           "contrast_family_id": null,
           "selection_method": "map_draw",
           "selected_at": "<iso_timestamp>"
         }
         ```
       - Display honest UI disclosure pill: "Exploratory post-screening selection: paired contrast p-value is unadjusted".
  </action>
  <verify>
    npm --prefix terra-odyssey/src/frontend run build
  </verify>
  <done>
    Users can draw Region A and Region B polygons with clear labels, and post-map selections automatically disclose exploratory screening status.
  </done>
</task>

## Success Criteria
- [ ] MapLibre GL JS renders trend raster under both 2D Mercator and 3D Globe with zero-centred diverging palette.
- [ ] Benjamini-Yekutieli FDR discoveries are marked with stippling (not color alone).
- [ ] Mathematical cell inspector reveals exact coordinates, slopes, SE, and p-values without interpolation.
- [ ] Terra Draw enables drawing Region A and B with text labels and exploratory status serialization.
- [ ] Frontend builds cleanly with zero errors.
