# Perfection Plan: Scientific Telemetry, Two-Tier Timeline, Real Map Sync, Evidence AI Breakdown & Resizable UI

## Objectives
1. **Eliminate the "Disk" Artifact**:
   - Replace the anisotropically stretched SVG `<circle>` in `DockTimeSeriesChart.tsx` with responsive, isotropic HTML/CSS overlay markers (`w-4 h-4 rounded-full`) with concentric pulsing beacon animations.
   - Ensure the cursor dot is always a mathematically perfect circle regardless of viewport width-to-height aspect ratio.
2. **Complete Data & Axis Labeling ("DATAS AR NOT LEBEL")**:
   - Explicit scientific Y-axis title with physical variable name and canonical units (e.g. `Surface Temperature (T2M) [°C]` or `Precipitation Rate [mm/year]`).
   - Multi-tick Y-axis gridlines with formatted numbers and unit suffixes.
   - Multi-tick X-axis with periodic year markers (every 2–5 years) and `Calendar Year (Annual Support)` title.
   - Distinct legend chips for Region A, Region B, OLS Fitted Trend Line, and 95% HAC Uncertainty Envelope.
3. **Resizable UI Console ("MAKE EVERYTHING RESIZABLEEE")**:
   - **Resizable Dock**: Add a vertical drag resize handle to `ActivityDock.tsx` allowing the user to smoothly adjust the dock height from 180px to 600px, persisting the height in local state.
   - **Resizable Floating Evidence Card**: Add a corner/edge resize handle to `FloatingEvidenceCard.tsx` allowing width adjustment from 340px to 680px and height from 300px to 700px.
   - **Resizable Dock Columns**: Optional drag divider between the time-series chart and mission controls.
4. **Two-Tier Scientific Timeline & Real NASA GIBS Map Synchronization**:
   - **Tier 1 (Temporal Interval Selection)**: Add Start Year and End Year interval controls with quick presets (`2001–2024 Full Record`, `2001–2020 Baseline`), dynamically dispatching the investigation for that interval.
   - **Tier 2 (Synchronous Temporal Scrubber)**: Connect timeline scrubbing directly to `setMapDate(`${year}-07-01`)`, dynamically swapping NASA GIBS satellite raster tiles on the map in real time for that exact year.
5. **Trend Evidence Overhaul (AI Synthesis + Full Data Breakdown Table)**:
   - Fix confidence interval and p-value backend mapping so 95% CI and p-values are never displayed as dashes (`—`).
   - **Tab 1: AI Scientific Synthesis**: Natural-language evidence summary covering decadal rate, statistical significance, cumulative change, physical context, and scientific caveats.
   - **Tab 2: Annual Data Breakdown Table**: Full tabular view of every single year with Year, Observed Value, Fitted Trend $\hat{y}_t$, Anomaly from Period Mean, and Coverage Fraction with CSV export.
   - **Tab 3: Statistical Diagnostics & Records**: Warmest/coolest (wettest/driest) years, baseline vs recent decade comparisons, OLS vs Theil-Sen slope agreement, and Newey-West HAC Bartlett lag sensitivities.
6. **Empirical Quality Verification & Codebase Packaging**:
   - 100% real NASA data (zero synthetic or mock fallbacks).
   - Verify frontend (`npm run typecheck`, `npm run lint`, `npm run build`) and backend (`python -m pytest`).
   - Package into `terra-odyssey.zip` via `pwsh .\scripts\package-codebase.ps1`.
