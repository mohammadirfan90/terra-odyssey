---
phase: 5
plan: 1
wave: 1
status: completed
completed_at: 2026-09-25T03:57:00Z
---

# Plan 5.1 Summary: Next.js Workspace Scaffold, Design System, Question Builder & Map Contract

## Objectives Achieved
1. **Next.js App Router & Design System**:
   - Initialized `terra-odyssey/src/frontend` with Next.js 15, React 19, TypeScript, Tailwind CSS v4, and Lucide icons.
   - Configured `output: 'export'` in `next.config.ts` for static export compilation.
   - Established scientific instrument-panel aesthetic in `globals.css` with dark slate tokens, high-contrast borders, and restrained evidence status colors.
   - Built shadcn/ui primitives (`Button`, `Card`, `Badge`, `Tabs`, `Drawer`, `RangeSlider`, `Select`, `cn` utility).

2. **Backend Map Contract Extension & Gzip Transport**:
   - Extended `StructuredGridMapResponse` and added `MapBands` in `terra-odyssey/src/backend/schemas.py` freezing all 9 required bands:
     `slope_per_decade`, `slope_se_per_decade`, `ci_lower_per_decade`, `ci_upper_per_decade`, `raw_p_value`, `adjusted_p_value`, `coverage_fraction`, `eligibility_code`, `evidence_code`.
   - Updated `stepper.py` to populate all 9 bands.
   - Enabled transparent `Content-Encoding: gzip` transport on `GET /api/investigations/{id}/map`.
   - Verified 63/63 unit and integration tests passing in `terra-odyssey/tests/unit/`.

3. **Question Builder & Catalog Integration**:
   - Created typed API contracts in `lib/api/types.ts`.
   - Implemented TanStack Query hooks in `lib/api/client.ts` with offline developer fallback fixtures.
   - Built `DatasetCatalog.tsx` presenting reviewed NASA products (MERRA-2 T2M and GPM IMERG Precipitation) with collection versions, DOIs, and measurement principles.
   - Built `PeriodSelector.tsx` enforcing the $\ge 20$ years span constraint.
   - Built `PresetSelector.tsx` enabling 1-click loading of candidate contrast pairs.
   - Built `QuestionBuilder.tsx` and main `page.tsx` with real-time job status polling, stage progression, and tabbed instrument layout.
   - Next.js static export compilation verified (`npm run build` $\to$ `out/` in 2.4s).

4. **Codebase Packaging**:
   - Updated `scripts/package-codebase.ps1` to exclude `node_modules`, `.next`, and `out`.
   - Clean archive packaged to `terra-odyssey.zip` (79 clean files, 137.9 KB).

## Key Files Created/Modified
- `terra-odyssey/src/frontend/package.json`
- `terra-odyssey/src/frontend/next.config.ts`
- `terra-odyssey/src/frontend/tsconfig.json`
- `terra-odyssey/src/frontend/postcss.config.mjs`
- `terra-odyssey/src/frontend/app/globals.css`
- `terra-odyssey/src/frontend/app/layout.tsx`
- `terra-odyssey/src/frontend/app/page.tsx`
- `terra-odyssey/src/frontend/lib/utils.ts`
- `terra-odyssey/src/frontend/lib/api/types.ts`
- `terra-odyssey/src/frontend/lib/api/client.ts`
- `terra-odyssey/src/frontend/components/ui/` (`button.tsx`, `card.tsx`, `badge.tsx`, `tabs.tsx`, `drawer.tsx`, `slider.tsx`, `select.tsx`)
- `terra-odyssey/src/frontend/components/investigation/` (`DatasetCatalog.tsx`, `PeriodSelector.tsx`, `PresetSelector.tsx`, `QuestionBuilder.tsx`)
- `terra-odyssey/src/backend/schemas.py`
- `terra-odyssey/src/backend/stepper.py`
- `terra-odyssey/src/backend/api/investigations.py`
- `terra-odyssey/tests/unit/test_api_investigations.py`
- `scripts/package-codebase.ps1`
- `terra-odyssey.zip`

## Verification Evidence
- `npm --prefix terra-odyssey/src/frontend run build`: Static export compiled in 2.4s (100% pass)
- `python -m pytest terra-odyssey/tests/unit/`: 63/63 passed (100% pass)
- `pwsh .\scripts\package-codebase.ps1`: 79 clean files packaged, 137.9 KB
