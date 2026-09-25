# Technology Stack: Terra Odyssey

> Updated after Milestone `v0.1.0-mvp` completion on 2026-09-25

## Runtime

| Technology | Version | Purpose |
|------------|---------|---------|
| Python | 3.10, 3.11, 3.12, 3.13 | Backend API, data pipeline, and statistical analysis engine |
| Node.js | 20+ | Frontend development, TypeScript compiler, Next.js static build |
| PowerShell 7 / Bash | Modern | Codebase packaging, automation, and test orchestration |

---

## Core Technologies

### Backend & Scientific Analysis
| Package | System | Purpose |
|---------|--------|---------|
| FastAPI | `src/backend` | Single-port ASGI web framework serving REST endpoints and root SPA |
| Pydantic v2 | `src/backend/schemas.py` | Strict validation and schema serialization against JSON schemas |
| SQLite (WAL Mode) | `src/backend/store.py` | Authoritative durable job state store with restart recovery |
| Statsmodels | `src/analysis/trend_estimator.py` | OLS regression with Newey-West HAC covariance ($L=2$, Student-$t$) |
| NumPy & SciPy | `src/analysis/` | Matrix calculations, Theil-Sen diagnostic, Hamed & Rao modified MK |
| Shapely & pyproj.Geod | `src/analysis/spatial_aggregation.py` | Exact WGS84 geodesic cell-bound integration and polygon intersection |
| xarray, netCDF4, h5py | `src/data/` | Multi-dimensional gridded NASA Earth observation cubes |
| httpx | `src/data/adapters` | Async NASA CMR queries and metadata discovery |

### Frontend & Visualization
| Package | System | Purpose |
|---------|--------|---------|
| Next.js 15 (App Router) | `src/frontend` | Statically exported Single Page Application (`output: 'export'`) |
| TypeScript 5 | `src/frontend` | Full end-to-end typed contract with backend schemas |
| Tailwind CSS v4 & shadcn/ui | `src/frontend/components/ui` | Modern dark-mode styling, accessible drawers, dialogs, badges |
| MapLibre GL JS | `src/frontend/components/map` | WebGL GPU engine rendering diverging trend maps and 2D/3D projections |
| Terra Draw | `src/frontend/components/map` | Interactive bounding-box and polygon drawing for Regions A and B |
| D3 + SVG | `src/frontend/components/charts` | Linked regional time series ($Y_A, Y_B$), difference ($D_t$), zero line |
| TanStack Query v5 | `src/frontend/lib/api` | Declarative polling, error retry, and cache management for FastAPI jobs |

---

## Quality & CI/CD Tooling

| Tool | Purpose |
|------|---------|
| pytest & pytest-asyncio | Python unit, numerical oracle ($<10^{-10}$ rel tol), and API integration tests |
| GitHub Actions | Automated multi-platform CI on Ubuntu & Windows (Python 3.11–3.13, Node 20) |
| Pyright / Pylance | Static type analysis and module path resolution |
| jsonschema (Draft 2020-12) | Local offline validation of generated InvestigationRecords |
