---
phase: 5
plan: 1
wave: 1
depends_on:
  - 4.3
---

# Plan 5.1: Next.js Workspace Scaffold, Design System, Question Builder & Map Contract Extension

## Objective
Scaffold the Next.js App Router application in `terra-odyssey/src/frontend`, configure Tailwind CSS v4 and shadcn/ui components, extend the backend `/api/investigations/{id}/map` contract to freeze the 9 required diagnostic bands with gzip transport, and implement the Question Builder with NASA dataset catalog integration, temporal constraints ($\ge 20$ years), candidate pair presets, and TanStack Query client.

## Context
- `terra-odyssey/src/backend/app.py`
- `terra-odyssey/src/backend/schemas.py`
- `terra-odyssey/src/backend/stepper.py`
- `terra-odyssey/src/backend/api/investigations.py`
- `docs/UX_SPEC.md`
- `.gsd/DECISIONS.md`
- `.gsd/phases/5/RESEARCH.md`

## Tasks

<task type="auto">
  <name>Scaffold Next.js App Router & Design System</name>
  <files>
    terra-odyssey/src/frontend/package.json
    terra-odyssey/src/frontend/tsconfig.json
    terra-odyssey/src/frontend/next.config.ts
    terra-odyssey/src/frontend/app/globals.css
    terra-odyssey/src/frontend/app/layout.tsx
    terra-odyssey/src/frontend/app/page.tsx
    terra-odyssey/src/frontend/components/ui/
  </files>
  <action>
    1. Initialize Next.js App Router project in `terra-odyssey/src/frontend`:
       - Install dependencies: `next`, `react`, `react-dom`, `@tanstack/react-query`, `lucide-react`, `clsx`, `tailwind-merge`, `class-variance-authority`.
       - Dev dependencies: `typescript`, `@types/node`, `@types/react`, `@types/react-dom`, `tailwindcss`, `@tailwindcss/postcss`, `postcss`.
       - Configure `next.config.ts` with `output: 'export'` for static export serving.
    2. Configure Tailwind CSS v4 and instrument-panel design system:
       - Google Fonts (Inter / Outfit / JetBrains Mono for coordinates/values).
       - Calm scientific color tokens: slate/charcoal backgrounds, high-contrast text, restrained status colors (supported emerald/cyan, inconclusive amber, ineligible rose).
       - Copy/scaffold essential shadcn/ui primitives (`Button`, `Card`, `Badge`, `Tabs`, `Drawer`, `Slider`, `Dialog`, `Select`).
    3. Setup root layout with TanStack Query provider, instrument panel header, mode toggle (Guided vs Expert), and status indicator.
  </action>
  <verify>
    npm --prefix terra-odyssey/src/frontend run build
  </verify>
  <done>
    Next.js application builds cleanly to static export with responsive instrument-panel shell and typography.
  </done>
</task>

<task type="auto">
  <name>Extend Backend Map Bands Contract & Gzip Transport</name>
  <files>
    terra-odyssey/src/backend/schemas.py
    terra-odyssey/src/backend/stepper.py
    terra-odyssey/src/backend/api/investigations.py
    terra-odyssey/tests/unit/test_api_investigations.py
  </files>
  <action>
    1. In `terra-odyssey/src/backend/schemas.py`:
       - Update `MapGridResponse` schema to freeze the 9 required bands:
         `slope_per_decade`, `slope_se_per_decade`, `ci_lower_per_decade`, `ci_upper_per_decade`, `raw_p_value`, `adjusted_p_value`, `coverage_fraction`, `eligibility_code`, `evidence_code`.
    2. In `terra-odyssey/src/backend/stepper.py`:
       - Update map publication to serialize all 9 frozen bands.
    3. In `terra-odyssey/src/backend/api/investigations.py`:
       - Ensure `GET /api/investigations/{id}/map` returns compressed payload with `Content-Encoding: gzip` when client sends `Accept-Encoding: gzip`, or decompressed JSON when requested plain.
    4. Update tests in `test_api_investigations.py` to assert all 9 bands are present in map responses.
  </action>
  <verify>
    python -m pytest terra-odyssey/tests/unit/test_api_investigations.py -v
  </verify>
  <done>
    Backend map endpoint serves all 9 frozen bands and supports transparent HTTP gzip transport.
  </done>
</task>

<task type="auto">
  <name>Implement Question Builder & Catalog Integration</name>
  <files>
    terra-odyssey/src/frontend/lib/api/types.ts
    terra-odyssey/src/frontend/lib/api/client.ts
    terra-odyssey/src/frontend/components/investigation/QuestionBuilder.tsx
    terra-odyssey/src/frontend/components/investigation/DatasetCatalog.tsx
    terra-odyssey/src/frontend/components/investigation/PeriodSelector.tsx
    terra-odyssey/src/frontend/components/investigation/PresetSelector.tsx
  </files>
  <action>
    1. Define TypeScript types in `lib/api/types.ts` mirroring backend Pydantic models:
       - `DatasetMetadata`, `CapabilitiesResponse`, `InvestigationRequest`, `JobStatusResponse`, `MapGridPayload`, `TimeSeriesPayload`, `EvidencePayload`.
    2. Implement TanStack Query hooks in `lib/api/client.ts`:
       - `useCatalog()`, `useCapabilities()`, `useCreateInvestigation()`, `useInvestigationStatus(id)`.
       - Include fallback offline developer fixtures for local testing without running backend.
    3. Build `QuestionBuilder.tsx`:
       - Guided question flow: "What changed? Where? Over what time? Does the evidence support an opposite trend?"
       - Dataset selection cards with NASA release badges, DOI links, and variable properties.
       - Period range slider enforcing $\ge 20$ years span constraint.
       - Curated candidate pair presets (e.g., California drought, Mediterranean warming vs Sahel, Arctic amplification).
       - Expert controls accordion: estimator family (`ols_hac`, `theil_sen`), multiplicity procedure (`fdr_by`, `fdr_bh`), execution mode (`auto`, `cached_only`, `demo_sample`).
  </action>
  <verify>
    npm --prefix terra-odyssey/src/frontend run build
  </verify>
  <done>
    Question Builder allows intuitive, fully validated parameter configuration, integrates with catalog endpoints, and submits jobs to the backend.
  </done>
</task>

## Success Criteria
- [ ] Next.js App Router scaffolds and builds to static export (`npm run build`).
- [ ] Backend `/api/investigations/{id}/map` contract delivers all 9 frozen diagnostic bands.
- [ ] Question builder enforces $\ge 20$ years constraint, provides candidate pair presets, and exposes expert mode toggles.
- [ ] All Python and TypeScript unit tests pass.
