---
updated: 2026-09-25T01:23:00Z
---

# Project State: Terra Odyssey

## Current Position

**Milestone:** v0.1.0-mvp
**Phase:** 4 - API & Investigation Orchestration
**Task:** Discussion complete (`.gsd/DECISIONS.md` updated)
**Status:** Ready for planning (`/plan 4`)

## Last Action

Completed Phase 4 discussion and documented architectural decisions in `.gsd/DECISIONS.md`:
- Authoritative durable SQLite job store + bounded local queue + single scientific worker (`ProcessPoolExecutor(max_workers=1)`).
- Clear separation of operational `job_status`, execution `stage`, and scientific `result_status`.
- Compressed structured-grid map JSON contract (`EPSG:4326`, explicit dimensions/bands, nulls for missing values, frozen FDR family).
- Explicit execution modes (`auto`, `live`, `cached_only`, `demo_sample`) with RFC 9457 HTTP 503 Problem Details when data is unavailable.
- Frozen `.zip` export bundle containing typed `investigation_record.json`, derived series CSVs, map grid, manifests, methods, reports, and SHA-256 checksums.
- Pre-requisite schema extensions planned for `schemas/investigation-record.schema.json`.

## Next Steps

1. `/plan 4` — Generate Phase 4 research and execution plans (API schemas, SQLite job engine & worker, endpoints, export bundler).

## Active Decisions

Decisions made that affect current work:

| Decision | Choice | Made | Affects |
|----------|--------|------|---------|
| Core Scope | D1 MERRA-2 + D2 GPM IMERG | 2026-09-24 | Phase 1, 2, 3 |
| Production Estimator | statsmodels OLS + Newey-West HAC (Bartlett lag 2, Student-t) | 2026-09-25 | Phase 2 & 3 |
| Numerical Test Oracle | Independent NumPy HAC in `tests/numerical/` | 2026-09-25 | Phase 2 |
| Geometry Engine | Shapely + pyproj.Geod with exact cell-bound areas | 2026-09-25 | Phase 3 |
| Spatial Coverage Policy | 100% MERRA-2, 90% GPM IMERG (area-weighted) | 2026-09-25 | Phase 3 |
| Contrast Method | Synchronous direct difference $D_t = Y_{A,t} - Y_{B,t}$ | 2026-09-25 | Phase 3 |
| Multiple Testing | Benjamini-Yekutieli (`fdr_by`) primary; BH sensitivity | 2026-09-25 | Phase 3 |
| Methodology | GSD (SPEC -> PLAN -> EXECUTE -> VERIFY -> COMMIT) | 2026-09-24 | All phases |

## Blockers

None.

## Concerns

- Ensure point-in-polygon cell intersection handles multipolygons and antimeridian-crossing geometries seamlessly without memory bloat.

---

*Last updated: 2026-09-25T01:23:00Z*
