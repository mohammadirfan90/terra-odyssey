# Technology Stack: Terra Odyssey

> Updated for the standalone frontend/backend split on 2026-09-25

## Runtime

| Technology | Version | Purpose |
|---|---|---|
| Python | 3.10–3.13 | Backend API, data pipeline, and statistical analysis |
| Node.js | 20+ | Frontend development and static export |
| PowerShell 7 / Bash | Modern | Packaging and repository validation |

## Backend and scientific analysis

| Package | Location | Purpose |
|---|---|---|
| FastAPI | `terra-odyssey/backend/src/backend` | API-only ASGI service |
| Pydantic v2 | `backend/src/backend/schemas.py` | Request and response validation |
| SQLite (WAL) | `backend/data/jobs.db` | Durable job state and restart recovery |
| Statsmodels | `backend/src/analysis/trend_estimator.py` | OLS with Newey-West HAC covariance |
| NumPy and SciPy | `backend/src/analysis/` | Numerical estimation and diagnostics |
| Shapely and pyproj | `backend/src/analysis/spatial_aggregation.py` | Geodesic weights and polygon intersection |
| xarray, netCDF4, h5py | `backend/src/data/` | Gridded NASA product handling |
| httpx | `backend/src/data/adapters/` | NASA discovery and acquisition clients |
| jsonschema | `backend/src/backend/exporter.py` | Draft 2020-12 result validation |

## Frontend and visualization

| Package | Version | Location and purpose |
|---|---|---|
| Next.js | 16.3.6 | `terra-odyssey/frontend`; App Router and static export |
| React | 19.3.0 | Interactive investigation workspace |
| TypeScript native compiler | 7.x | Standalone frontend type checking |
| TypeScript compatibility API | 6.x | Next ESLint integration |
| Tailwind CSS | 4.x | UI styling |
| MapLibre GL JS | 6.x | WebGL map rendering |
| Mapcn components | source integration | Reusable React map controls |
| D3 | 7.x | Linked scientific charts |
| TanStack Query | 5.x | API polling and client cache |

## Quality and CI/CD

| Tool | Purpose |
|---|---|
| pytest / pytest-asyncio | Backend unit, numerical, and API integration tests |
| Black / Flake8 | Python formatting and lint checks |
| ESLint / TypeScript | Frontend lint and type checks |
| GitHub Actions | Independent backend and frontend CI jobs |
| Pyright / Pylance | Python module and type resolution for `backend/src` |

## Configuration

| Variable | Application | Purpose | Required |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | Frontend | Base URL ending in `/api` | No; local fallback is provided |
| `EARTHDATA_USERNAME` | Backend | NASA Earthdata authentication | Only for live acquisition |
| `EARTHDATA_PASSWORD` | Backend | NASA Earthdata authentication | Only for live acquisition |
| `APP_ENV` | Backend | Runtime environment label | No |
| `LOG_LEVEL` | Backend | Logging verbosity | No |
