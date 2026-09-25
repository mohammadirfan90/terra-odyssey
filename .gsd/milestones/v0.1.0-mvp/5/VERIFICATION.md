# Phase 5 Verification: Interactive Web Workspace

## Must-Haves Verification

### 1. Question Builder & Catalog Integration
- [x] **NASA Catalog Presentation**: MERRA-2 (T2M) and GPM IMERG (precipitationCal) presented with collection metadata, DOIs, and measurement principles.
- [x] **Temporal Span Constraint**: $\ge 20$ years constraint strictly enforced in `PeriodSelector.tsx` and backend validation.
- [x] **Candidate Presets**: 1-click loading for Arctic vs Tropics and California vs US Southeast presets.
- [x] **Evidence**: Verified in `frontend/components/investigation/` and passed in `test_api_catalog.py`.

### 2. Diverging Trend Map & Terra Draw Selection
- [x] **MapLibre GL JS Engine**: Dynamic SSR-safe client component with `ProjectionToggle.tsx` (2D Mercator $\leftrightarrow$ 3D Globe).
- [x] **Symmetric Diverging Scale**: Zero-centred `RdBu` / `BrBG` scales with frozen domain $[-\max|\beta|, +\max|\beta|]$. Zero Viridis for signed trends.
- [x] **FDR Stippling & Coverage Mask**: Benjamini-Yekutieli discoveries stippled; invalid cells hatched.
- [x] **Cell Inspector**: Exact mathematical coordinate mapping without spatial interpolation.
- [x] **Region Selector**: Drag-box drawing with persistent high-contrast "A" and "B" centroid markers.
- [x] **Multiplicity Tracking**: Post-map selections automatically serialize `selection_status="exploratory_map_selected"` with unadjusted contrast $p$-value disclosure.
- [x] **Evidence**: Verified in `frontend/components/map/` and Next.js static export build.

### 3. D3/SVG Linked Time-Series & Paired Contrast Cards
- [x] **Linked Charts**: D3 + SVG rendering dual curves $Y_A(t)$ and $Y_B(t)$, synchronous difference $D_t = Y_A - Y_B$, zero reference line, and fitted trends.
- [x] **Scientific Honesty**: Zero pseudo "HAC confidence bands" around raw difference points; Newey-West HAC CI displayed as scalar metric.
- [x] **Decoupled Hover**: Year scrubber displays $(Y_A, Y_B, D_t)$ and valid coverage without altering the map.
- [x] **Adjudication Cards & Methods Drawer**: Semantic badges (`supported`, `inconclusive`, `ineligible`), methodology details, and 1-click downloads for ZIP, JSON, and CSV.
- [x] **Evidence**: Verified in `frontend/components/charts/` and `frontend/components/evidence/`.

### 4. Phase 4 Scientific Gate Clearance & FastAPI Mount
- [x] **Real Grid Estimation**: Decimated grid cells estimated with OLS+HAC and Benjamini-Yekutieli FDR multiple testing. All 9 diagnostic bands populated with real values.
- [x] **Temporal Aggregation**: `aggregate_annual_temperature` and `aggregate_annual_precipitation` enforced across cubes with strict 12/12 calendar completeness.
- [x] **Explicit Data Modes**: Transparent reporting and caveat disclosure for demo samples.
- [x] **FastAPI Mount**: Next.js static export mounted at `/` while fully preserving `/api` routes and RFC 9457 Problem Details handlers.
- [x] **Evidence**: All 63 backend tests passed (`pytest terra-odyssey/backend/tests/unit/ -v`). Next.js static build exported cleanly (`out/`). Root SPA served at `GET /` (HTTP 200).

---

## Verdict: PASS ✓
All Phase 5 requirements, scientific constraints, and empirical tests verified.
