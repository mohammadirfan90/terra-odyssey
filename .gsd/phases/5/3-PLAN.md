---
phase: 5
plan: 3
wave: 3
depends_on:
  - 5.2
---

# Plan 5.3: D3/SVG Linked Time-Series, Paired Contrast Cards, Evidence Drawer & Scientific Gate Clearance

## Objective
Implement high-fidelity D3/SVG linked time-series charts (Region A, Region B, synchronous difference $D_t$ with fitted trends and valid coverage bars), construct the Evidence Drawer with semantic adjudication badges, methods inspector, and download triggers, clear the Phase 4 Scientific Integration Gate in the backend stepper, and mount the static frontend export in FastAPI for unified single-port deployment.

## Context
- `terra-odyssey/src/frontend/components/charts/`
- `terra-odyssey/src/frontend/components/evidence/`
- `terra-odyssey/src/backend/stepper.py`
- `terra-odyssey/src/backend/app.py`
- `docs/UX_SPEC.md`
- `.gsd/DECISIONS.md`
- `.gsd/phases/5/RESEARCH.md`

## Tasks

<task type="auto">
  <name>D3/SVG Linked Time-Series & Difference Visualizer</name>
  <files>
    terra-odyssey/src/frontend/components/charts/LinkedTimeSeriesChart.tsx
    terra-odyssey/src/frontend/components/charts/CoverageBars.tsx
    terra-odyssey/src/frontend/lib/charts/d3-time-series.ts
  </files>
  <action>
    1. Implement `d3-time-series.ts` and `LinkedTimeSeriesChart.tsx` using D3 + SVG:
       - Top panel: Dual observed regional series $Y_A(t)$ (warm slate/amber) and $Y_B(t)$ (cool cyan/teal).
       - Bottom panel: Synchronous difference series $D_t = Y_{A,t} - Y_{B,t}$ with prominent zero-contrast horizontal reference line.
       - Render fitted linear trend lines for Region A, Region B, and Difference.
       - Valid annual area coverage bars aligned under the time axis.
       - Responsive vertical crosshair scrubber: hovering over a year reveals observed values $Y_A$, $Y_B$, and $D_t$, along with coverage fraction for that specific year.
       - Scientific honesty rule: strictly do NOT link time-series hover to the trend map (the map represents complete-interval slope, not an annual field).
       - Scientific honesty rule: strictly do NOT render a shaded band around raw $D_t$ points and call it a "HAC confidence band". HAC slope CI is displayed as a scalar metric in the evidence card.
  </action>
  <verify>
    npm --prefix terra-odyssey/src/frontend run build
  </verify>
  <done>
    D3/SVG chart accurately renders dual regional series, difference series, fitted trends, coverage bars, and synchronized year inspection.
  </done>
</task>

<task type="auto">
  <name>Evidence Drawer, Adjudication Badges & Export Triggers</name>
  <files>
    terra-odyssey/src/frontend/components/evidence/EvidenceDrawer.tsx
    terra-odyssey/src/frontend/components/evidence/ContrastCard.tsx
    terra-odyssey/src/frontend/components/evidence/MethodsInspector.tsx
    terra-odyssey/src/frontend/components/evidence/ExportButton.tsx
  </files>
  <action>
    1. Build `ContrastCard.tsx` and `EvidenceDrawer.tsx`:
       - Semantic result badges with strict science copy:
         - `Supported: Opposite-Trend Pair` (green/emerald)
         - `Inconclusive: Contrasting Slopes Not Significant` (amber)
         - `Inconclusive: Slopes Share Same Sign` (amber)
         - `Ineligible: Record Too Short (<20 yrs)` (rose)
       - Displays: Region A slope $\pm$ SE, Region B slope $\pm$ SE, Difference slope $\pm$ HAC SE, and 95% HAC confidence interval $[\beta_{D,lower}, \beta_{D,upper}]$.
       - Displays raw $p$-value and BY-adjusted $p$-value (or explicit "Unadjusted: post-map exploratory selection").
    2. Build `MethodsInspector.tsx`:
       - Expandable instrument drawer detailing:
         - Exact NASA product release (`M2TMNXSLV v5.12.4` / `GPM_3IMERGM v07`) and DOIs.
         - Temporal aggregation (calendar hours vs day-of-month).
         - Spatial weighting method (`pyproj.Geod` ellipsoidal cell bounds).
         - Estimator specification: OLS with Newey-West HAC ($L=2$, Bartlett kernel, Student-$t$).
         - Multiple testing family identification and selection status.
         - Scientific limitations and caveats list.
    3. Build `ExportButton.tsx`:
       - Download triggers: Frozen ZIP archive (`?format=zip`), InvestigationRecord JSON (`?format=json`), Regional time-series CSV (`?format=timeseries_csv`).
  </action>
  <verify>
    npm --prefix terra-odyssey/src/frontend run build
  </verify>
  <done>
    Evidence drawer transparently communicates statistical findings, scientific caveats, methodology details, and facilitates 1-click artifact downloads.
  </done>
</task>

<task type="auto">
  <name>Clear Phase 4 Scientific Integration Gate & FastAPI Mount</name>
  <files>
    terra-odyssey/src/backend/stepper.py
    terra-odyssey/src/backend/app.py
    terra-odyssey/tests/unit/test_job_orchestration.py
    terra-odyssey/tests/unit/test_api_investigations.py
  </files>
  <action>
    1. Clear Phase 4 Scientific Integration Gate in `terra-odyssey/src/backend/stepper.py`:
       - Replace constant prototype map values (`0.15`, `0.01`) with real grid estimation using OLS+HAC over the decimated grid domain.
       - Populate all 9 frozen bands: `slope_per_decade`, `slope_se_per_decade`, `ci_lower_per_decade`, `ci_upper_per_decade`, `raw_p_value`, `adjusted_p_value`, `coverage_fraction`, `eligibility_code`, `evidence_code`.
       - Eliminate silent `auto` fallback to synthetic cube; enforce explicit data mode handling and transparent reporting.
       - Enforce validated temporal aggregation (day-of-month and calendar-hours) across cubes.
       - Wire exploratory hypothesis screening family tracking into contrast adjudication.
    2. Mount Next.js static build in `terra-odyssey/src/backend/app.py`:
       - Check if `src/frontend/out` exists; mount `StaticFiles(directory=..., html=True)` at `/` with fallback for `/api` routes.
    3. Run full regression test suite (both Python backend and Next.js frontend).
  </action>
  <verify>
    python -m pytest terra-odyssey/tests/unit/ -v && npm --prefix terra-odyssey/src/frontend run build
  </verify>
  <done>
    Scientific integration gate is cleared with real grid calculations, all unit tests pass, and Next.js static export is mounted directly in FastAPI.
  </done>
</task>

## Success Criteria
- [ ] D3/SVG charts render dual time-series and synchronous difference with fitted trends and coverage bars.
- [ ] Evidence drawer displays semantic badges, scalar HAC CI, methods inspector, and export buttons.
- [ ] Phase 4 scientific integration gate cleared with real grid estimation and zero silent synthetic fallbacks.
- [ ] Next.js static export builds cleanly and is served by FastAPI.
- [ ] 100% of unit and integration tests pass across backend and frontend.
