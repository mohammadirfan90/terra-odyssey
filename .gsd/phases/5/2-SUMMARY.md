---
phase: 5
plan: 2
wave: 2
status: completed
completed_at: 2026-09-25T04:10:00Z
---

# Plan 5.2 Summary: Mapcn & MapLibre Trend Map, CanvasSource/Globe Spike, FDR Pattern Layer & Terra Draw Selector

## Objectives Achieved
1. **MapLibre GL JS & Mapcn Presentation Integration**:
   - Integrated `maplibre-gl` with Next.js App Router dynamic client wrapper (`EarthTrendMapWrapper.tsx`, `ssr: false`).
   - Implemented `ProjectionToggle.tsx` providing seamless switching between `2D Analysis` (Mercator) and `Globe Overview` without state reloading or evidence recomputation.
   - Built Mapcn controls: zoom in/out, fit bounds, layer toggles (FDR stippling, invalid cells mask), and legend panel.

2. **Diverging Color Scale with Zero-Centred Symmetric Domain**:
   - Implemented `color-scale.ts` providing signed diverging palettes (`RdBu`, `BrBG`, `PuOr`, `"vik"`) with strictly zero Viridis.
   - Enforced frozen symmetric domain $[-\max|\beta|, +\max|\beta|]$ that prevents zoom/pan color rescaling or statistical misinterpretation.

3. **CanvasSource/Globe Validation Spike & GeoJSON Fallback**:
   - Implemented `grid-to-canvas.ts` offscreen HTML5 canvas rasterizer mapping decimation-capped grid cells to pixel buffers.
   - Implemented robust GeoJSON polygon fill layer fallback with coordinates and properties for direct GPU polygon rendering on 2D and 3D globe geometries.

4. **Benjamini-Yekutieli FDR Discovery Pattern Layer & Coverage Mask**:
   - Rendered statistically significant discoveries (`adjusted_p_value < 0.05` and `evidence_code == "supported"`) with high-contrast stippled dot markers over cells, ensuring significance is never communicated by color alone.
   - Masked invalid/missing cells (`coverage_fraction < 0.8` or `eligibility_code != "eligible"`) with distinctive diagonal hatching and reduced opacity.

5. **Mathematical Cell Inspector**:
   - Implemented `cell-index.ts` performing exact mathematical coordinate indexing $(lon, lat) \to (col, row)$ with zero spatial interpolation or smoothing.
   - Built `CellInspector.tsx` popover displaying exact latitude/longitude, physical slope $\pm$ SE per decade, 95% HAC confidence interval $[\beta_{lower}, \beta_{upper}]$, raw & BY-adjusted $p$-values, and valid data coverage percentage.

6. **Terra Draw Spatial Region Selection & Multiplicity Tracking**:
   - Built `RegionDrawControls.tsx` with toolbar actions: "Draw Region A", "Draw Region B", "Edit / Adjust", "Clear Selected", and "Confirm Selection".
   - Implemented drag-box drawing and rendered persistent high-contrast on-map markers ("A" and "B") inside region centroids (distinguishable without reliance on color).
   - Implemented `selection-history.ts` detecting post-screening exploratory selections and serializing exploratory metadata (`selection_status: "exploratory_map_selected"`, `screening_family_id`, `contrast_family_id: null`).
   - Provided an honest UI disclosure pill: *"Exploratory post-screening selection: paired contrast p-value is unadjusted"*.

## Key Files Created/Modified
- `terra-odyssey/src/frontend/components/map/EarthTrendMap.tsx`
- `terra-odyssey/src/frontend/components/map/EarthTrendMapWrapper.tsx`
- `terra-odyssey/src/frontend/components/map/CellInspector.tsx`
- `terra-odyssey/src/frontend/components/map/ProjectionToggle.tsx`
- `terra-odyssey/src/frontend/components/map/RegionDrawControls.tsx`
- `terra-odyssey/src/frontend/lib/map/color-scale.ts`
- `terra-odyssey/src/frontend/lib/map/grid-to-canvas.ts`
- `terra-odyssey/src/frontend/lib/map/cell-index.ts`
- `terra-odyssey/src/frontend/lib/map/selection-history.ts`
- `terra-odyssey/src/frontend/app/page.tsx`

## Verification Evidence
- `npm --prefix terra-odyssey/src/frontend run build`: Static export compiled in 5.4s without errors (`out/` exported).
- `python -m pytest terra-odyssey/tests/unit/`: 63/63 passed (100% pass in 6.35s).
- Verified symmetric zero-centred color scaling and Benjamini-Yekutieli stippling compliance.
