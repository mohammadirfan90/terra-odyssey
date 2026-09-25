# Architecture: Terra Odyssey

> Updated after Milestone `v0.1.0-mvp` completion on 2026-09-25

## Overview

Terra Odyssey is structured as a decoupled, reproducible scientific investigation application.
The application operates as a unified single-port deployment where FastAPI serves both the static Next.js Single Page Application at `GET /` and the RESTful API endpoints at `/api/*`.

```
┌─────────────────────────────────────────────────────────────────┐
│            FRONTEND (Next.js 15 App Router + TypeScript)        │
│  - Presentation: Tailwind CSS v4 + shadcn/ui Component System   │
│  - Map System: MapLibre GL JS (WebGL) + Mapcn UI Presentation   │
│  - Spatial Selection: Terra Draw for Region A & Region B Boxes   │
│  - Trend Visuals: Zero-Centred Diverging Scale (RdBu/BrBG)      │
│  - Scientific Charts: D3 + SVG Linked Time Series (Y_A, Y_B, D_t)│
│  - State Management: TanStack Query (@tanstack/react-query)     │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTP / JSON API
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│               BACKEND (Python FastAPI Web Service)              │
│  - Single-Port Static Mount: Serves Next.js export at GET /     │
│  - /api/catalog & /api/capabilities: NASA dataset metadata      │
│  - /api/investigations: Async lifecycle, SQLite WAL JobStore    │
│  - Error Handling: RFC 9457 Problem Details structured errors   │
│  - Pipeline Stepper: 6-stage scientific execution worker        │
│  - Export Bundler: Reproducible ZIP with draft-2020-12 records  │
└───────────────────────────────┬─────────────────────────────────┘
                                │ Typed Execution
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                 STATISTICAL & SPATIAL ENGINE                    │
│  - OLS + Newey-West HAC (Bartlett lag 2, Student-t df=n-2)      │
│  - Hamed & Rao (1998) Autocorrelation-Corrected Mann-Kendall    │
│  - Stationary Moving Block Bootstrap (Künsch 1989)              │
│  - Paired Direct Contrast: D_t = Y_{A,t} - Y_{B,t}              │
│  - Spatial Aggregation: Exact Geodesic Integration (Shapely)    │
│  - Multiplicity: Benjamini-Yekutieli (BY) & Benjamini-Hochberg  │
└───────────────────────────────┬─────────────────────────────────┘
                                │ Normalized Data Adapters
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   DATA ADAPTERS & INGESTION                     │
│  - D1: MERRA-2 T2M (M2TMNXSLV v5.12.4, Kelvin -> Celsius)       │
│  - D2: GPM IMERG Final (GPM_3IMERGM v07, Rate -> Accumulation)  │
│  - D3: MODIS Land Surface Temperature (MOD11A2.061 8-Day)       │
│  - Quality Masks, Calendar Completeness (12/12), Coordinate QA  │
└─────────────────────────────────────────────────────────────────┘
```

## Core Modules

### 1. Data Ingestion & Normalization (`src/data/`)
- Adapters for MERRA-2, GPM IMERG, and MODIS LST.
- Temporal aggregation enforcing strict 12/12 calendar-month completeness and leap-year weighting.
- Spatial aggregation with exact spherical cell-bounds area weighting via Shapely and `pyproj.Geod`.

### 2. Analytical & Statistical Engine (`src/analysis/`)
- Centered coordinate OLS with Newey-West HAC covariance.
- Hamed & Rao modified Mann-Kendall with detrended rank autocorrelation variance correction.
- Moving block bootstrap for non-parametric empirical confidence intervals.
- Synchronous direct difference paired regional contrast estimator.
- Benjamini-Yekutieli FDR multiple testing correction for spatial grid maps.

### 3. Backend Service & Orchestration (`src/backend/`)
- SQLite database (`jobs.db`) with WAL mode and startup recovery.
- Bounded async queue worker with cooperative cancellation.
- Structured RFC 9457 error handlers.
- Deterministic export bundler compiling signed ZIP archives.

### 4. Interactive Web Workspace (`src/frontend/`)
- Next.js App Router statically compiled to `out/` and mounted in FastAPI.
- MapLibre GL JS engine rendering zero-centred diverging scales without Viridis for signed trends.
- Terra Draw polygon and rectangle selection for Regions A and B with persistent centroid labels.
- D3 + SVG linked regional series, synchronous differences, and valid annual coverage bars.
