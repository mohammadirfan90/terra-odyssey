# Phase 5 Research: Interactive Web Workspace

## Architectural Overview

Phase 5 builds the user-facing scientific research instrument for Terra Odyssey. The architecture strictly adheres to the layer responsibility split defined in `.gsd/DECISIONS.md`:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Next.js App Router (TypeScript)                      │
│                                                                        │
│  ┌───────────────────────┐  ┌───────────────────────────────────────┐  │
│  │   Question Builder    │  │       Interactive Map Workspace       │  │
│  │  & Dataset Catalog    │  │                                       │  │
│  │ (TanStack Query API)  │  │  ┌─────────────────────────────────┐  │  │
│  └───────────────────────┘  │  │       Mapcn Presentation        │  │  │
│                             │  │   (Controls, Popups, Theming)   │  │  │
│  ┌───────────────────────┐  │  ├─────────────────────────────────┤  │  │
│  │    D3 / SVG Charts    │  │  │       MapLibre GL JS Engine     │  │  │
│  │  (Linked Region A/B   │  │  │    (2D Mercator & 3D Globe)     │  │  │
│  │  & Difference Series) │  │  ├─────────────────────────────────┤  │  │
│  └───────────────────────┘  │  │   Offscreen CanvasSource / SVG  │  │  │
│                             │  │   (Diverging Slopes & BY Dots)  │  │  │
│  ┌───────────────────────┐  │  ├─────────────────────────────────┤  │  │
│  │    Evidence Drawer    │  │  │     Terra Draw (A & B Polys)    │  │  │
│  │  (Adjudication Badges │  │  │   (Multiplicity Tracking)       │  │  │
│  │   & Methods Inspector)│  │  └─────────────────────────────────┘  │  │
│  └───────────────────────┘  └───────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
                                     │
                 HTTP REST / RFC 9457 Problem Details
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       FastAPI Backend Service                          │
│   (SQLite JobStore · Stepper · OLS+HAC · BY Multiplicity · Exporter)   │
└────────────────────────────────────────────────────────────────────────┘
```

## Key Technical Requirements & Constraints

### 1. Diverging Palette & Symmetric Domain
- Viridis is sequential and strictly prohibited for signed trend fields.
- Permitted palettes: `RdBu`, `BrBG`, `PuOr`, or scientific `"vik"`.
- Scale must be zero-centred and symmetric: $[-\max|\beta|, +\max|\beta|]$. Panning or zooming the map must never rescale the domain.

### 2. MapLibre CanvasSource & Projection Spike
- MapLibre GL JS natively supports `CanvasSource` where an offscreen HTML5 canvas renders raster pixels.
- The projection spike must validate rendering under both 2D Mercator (`projection: 'mercator'`) and 3D Globe (`projection: 'globe'`).
- Fallback for $\le 10,000$ cells: GeoJSON cell polygons with MapLibre `fill` and `fill-pattern` layers.
- Second stippled/pattern layer renders Benjamini-Yekutieli discoveries so significance is never communicated by color alone.
- Transport: FastAPI serves `map_grid.json.gz` with `Content-Encoding: gzip`; browser handles decompression natively.

### 3. Spatial Selection & Multiplicity Disclosure
- Uses `maplibre-gl-terradraw` / Terra Draw for polygon and rectangle drawing.
- Region A and Region B must have persistent text labels "A" and "B" (never color alone).
- Any region drawn after viewing the gridded trend map automatically marks:
  ```json
  {
    "selection_status": "exploratory_map_selected",
    "screening_family_id": "<map-family-id>",
    "contrast_family_id": null
  }
  ```
  The UI reports raw contrast $p$-values and makes full exploratory disclosure. It does not claim BY adjustment for freehand post-map selections.

### 4. D3/SVG Linked Time-Series
- Displays observed $Y_A(t)$, $Y_B(t)$, and synchronous difference $D_t = Y_{A,t} - Y_{B,t}$.
- Fitted linear trend lines and zero-line contrast.
- Scalar HAC slope CI in the evidence card. No raw $D_t$ band labeled as a "HAC confidence band".
- Hover inspection shows $Y_A$, $Y_B$, and $D_t$ for that year. No annual map-time linking (trend map represents the complete interval slope).

### 5. Phase 4 Scientific Integration Gate
- Replace constant fabricated map bands (`0.15`, `0.01`) in backend stepper with actual grid estimation.
- Freeze required 9 map bands: `slope_per_decade`, `slope_se_per_decade`, `ci_lower_per_decade`, `ci_upper_per_decade`, `raw_p_value`, `adjusted_p_value`, `coverage_fraction`, `eligibility_code`, `evidence_code`.
- Remove silent `auto` fallback to synthetic cube.
- Align temporal aggregation with validated calendar hours and day-of-month weighting.
