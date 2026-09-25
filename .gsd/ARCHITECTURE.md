# Architecture: Terra Odyssey

> Updated for the standalone frontend/backend split on 2026-09-25

## Overview

Terra Odyssey consists of two independently operated applications. The Next.js frontend communicates with the FastAPI backend over HTTP/JSON. FastAPI serves API routes only and has no dependency on frontend build output.

```text
┌─────────────────────────────────────────────────────────────────┐
│          FRONTEND — terra-odyssey/frontend                     │
│  Next.js 16 App Router · React 19 · TypeScript                 │
│  MapLibre/Mapcn maps · D3 charts · TanStack Query              │
│  NEXT_PUBLIC_API_URL → backend /api                            │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTP / JSON
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│          BACKEND — terra-odyssey/backend                       │
│  FastAPI API · Pydantic contracts · SQLite WAL job state       │
│  pipeline worker · reproducible investigation exports          │
└───────────────────────────────┬─────────────────────────────────┘
                                │ typed execution
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  ANALYSIS + DATA ADAPTERS — backend/src                        │
│  OLS/HAC · sensitivity methods · paired contrasts · FDR        │
│  geodesic aggregation · MERRA-2/GPM/MODIS adapters             │
└───────────────────────────────┬─────────────────────────────────┘
                                │ backend-owned files
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  backend/data + backend/schemas                                │
│  manifests · samples · jobs.db · investigations · JSON schemas │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### Frontend

- **Location:** `terra-odyssey/frontend/`
- **Purpose:** Question building, map and chart rendering, evidence inspection, and exports.
- **Integration:** Uses the typed client in `lib/api/` and the public `NEXT_PUBLIC_API_URL` setting.
- **Output:** Static build artifacts remain in `frontend/out/` and are not served by FastAPI.

### Backend API and orchestration

- **Location:** `terra-odyssey/backend/src/backend/`
- **Purpose:** API routing, validation, job lifecycle, persistence, artifact publication, and export bundles.
- **Entrypoint:** `backend.app:app` with `--app-dir src`.
- **Filesystem boundary:** `backend.paths` resolves all owned paths from the backend installation, independent of process working directory.

### Statistical engine

- **Location:** `terra-odyssey/backend/src/analysis/`
- **Purpose:** Temporal/spatial aggregation, OLS with Newey-West HAC uncertainty, sensitivity checks, paired regional contrasts, and multiplicity control.
- **Boundary:** Statistical semantics and scientific labels are unchanged by the application split.

### Data adapters

- **Location:** `terra-odyssey/backend/src/data/adapters/`
- **Purpose:** Product-specific discovery, decoding, quality masks, units, and metadata for MERRA-2, GPM IMERG, and MODIS products.

### Persistent data and schemas

- **Location:** `terra-odyssey/backend/data/` and `terra-odyssey/backend/schemas/`
- **Purpose:** Versioned manifests, optional samples, SQLite state, preserved investigation artifacts, and Draft 2020-12 contracts.

## Data flow

1. The frontend submits a typed investigation request to the configured `/api` base.
2. FastAPI validates and records the job in `backend/data/jobs.db`.
3. The worker loads backend-owned manifests or samples and runs the analysis pipeline.
4. Results are published under `backend/data/investigations/<job-id>/`.
5. The frontend polls status and requests series, map, evidence, or export resources.

## Integration points

| External service | Type | Purpose |
|---|---|---|
| NASA CMR / Earthdata | API and data download | Versioned product discovery and optional live acquisition |
| OpenFreeMap | Vector map service | Token-free basemap styles and tiles |
| Frontend ↔ backend | HTTP/JSON | Typed investigation and catalog API |

## Conventions and debt

- Python uses a conventional `backend/src` package layout and backend-local tests/configuration.
- Frontend and backend dependencies are installed independently.
- Private environment files, dependency directories, and generated caches are excluded from the distributable archive.
- Live NASA acquisition still depends on locally supplied Earthdata credentials and upstream service availability.
