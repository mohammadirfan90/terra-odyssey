---
updated: 2026-09-25T19:05:00+06:00
milestone: v0.1.0-mvp
status: COMPLETED
---

# Project State: Terra Odyssey

## Current Position

**Milestone:** v0.1.0-mvp (Terra Odyssey MVP)
**Status:** ✅ Completed & Archived
**Milestone Summary:** [.gsd/milestones/v0.1.0-mvp-SUMMARY.md](milestones/v0.1.0-mvp-SUMMARY.md)
**Milestone Archive:** `.gsd/milestones/v0.1.0-mvp/`

## Last Action

Refactored `terra-odyssey/` into independent `backend/` and `frontend/` applications. Moved Python source, tests, schemas, manifests, SQLite state, and preserved investigation artifacts under `backend/`; moved the complete Next.js application and map documentation under `frontend/`; removed FastAPI static frontend serving; centralized backend-owned paths; updated imports, tooling, CI, documentation, and packaging.

## Recent Task

Standalone application split verification:
- Backend: 103/103 pytest tests passed on Python 3.13.3.
- Frontend: typecheck and Next.js 16.3.6 production static build passed.
- Frontend lint: 0 errors and 29 existing warnings.
- Packaging: `terra-odyssey.zip` regenerated with 124 entries; no private env, dependency, or build-cache entries.
- SQLite: `PRAGMA integrity_check` returned `ok`; both existing job rows and the preserved `inv-b7b17ea47850` artifacts remain under `backend/data`.
- Active-path search found no stale references to the retired combined application layout.
- Black check reports the existing Python baseline is not Black-formatted (34 pre-existing files); Flake8 is not installed in the current interpreter.

Processed page feedback adjustments:
1. Removed the bottom-right map legend overlay from the interactive map.
2. Removed the white/light background from `body`, `.app-shell`, `.app-header`, `.header-search`, and `.job-chip` so the header integrates seamlessly with the dark theme.
3. Removed the "NASA Earth data" chip from the header meta area.
4. Disabled and hid the MapLibre bottom-right attribution details control tag.
Regenerated the root codebase archive `terra-odyssey.zip` (123 clean files).

Added the Agentation annotation toolbar to the development layout and connected it to `http://localhost:4747`. Agentation is classified as a development dependency. The existing Codex MCP configuration already launches `agentation-mcp server`; its doctor reports the server healthy. Browser-to-agent annotation sync has not been confirmed in this session.

Updated the frontend to Next.js 16.3.6 and React 19.3.0, with the TypeScript 7 Go compiler exposed as `tsc`. TypeScript 6's API is retained under the `typescript` alias for Next ESLint tooling that does not yet support TypeScript 7's missing programmatic API; FastAPI remains the backend. Replaced the removed `next lint` command with ESLint flat config and added a standalone type-check script. Type-check and static build pass; lint completes with warnings from existing UI/API code.

Replaced the map integration with Mapcn's MIT-licensed React components on MapLibre GL JS and OpenFreeMap styles. Kept the region-selection, trend overlay, and cell-inspection behavior. Removed the CARTO SQL client, setup guide, tests, and credential variables; the map now needs no API keys, and Google GIS is not used. Added map setup and attribution guidance. Frontend type-check and production build pass, lint completes with 28 warnings and no errors, the frontend route and both selected style URLs return HTTP 200, and the Python suite passes all 101 tests. Regenerated and checked the 117-file archive; it has neither private environment files nor retired CARTO integration files. A browser surface was unavailable for screenshot inspection.

## Next Steps

1. Run `/new-milestone` to define scope and phases for `v0.2.0` (MODIS extensions, benchmarks, high-density visualization).
2. Continue executing modular PR sequence from `TODO.md` towards the 100 PR target.

---

## Active Decisions

> All Phase 1–5 decisions archived in `.gsd/milestones/v0.1.0-mvp/DECISIONS.md`.

---

## Blockers

None.
