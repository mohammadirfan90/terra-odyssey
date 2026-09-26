# Terra Odyssey — Earth System Trend Detective

[![CI - Frontend](https://github.com/mohammadirfan90/terra-odyssey/actions/workflows/frontend-ci.yml/badge.svg)](https://github.com/mohammadirfan90/terra-odyssey/actions/workflows/frontend-ci.yml)
[![CI - Backend](https://github.com/mohammadirfan90/terra-odyssey/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/mohammadirfan90/terra-odyssey/actions/workflows/backend-ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A reproducible, open-science NASA Earth data investigation platform built for the Space Apps challenge **Be An Earth System Trend Detective!**.

Terra Odyssey enables users to rigorously answer:
**What changed, where, by how much, over which interval, with what uncertainty, and whether the evidence supports a statistical trend.**

---

## Key Capabilities

- **NASA Curated Datasets:**
  - **D1:** MERRA-2 Near-Surface Air Temperature (`T2M`, 1980–present, reanalysis)
  - **D2:** GPM IMERG Final Monthly Precipitation (`PRECTOTCORR`, 2000–present, gauge-calibrated satellite)
  - **D3:** MODIS Aqua/Terra Clear-Sky Land Surface Temperature (`MOD11C3.061` / `MYD11C3.061`, daytime & nighttime)
  - **D4:** MODIS Terra Vegetation Indices 16-day & Monthly NDVI (`MOD13A3.061`, spectral vegetation proxy)
- **Scientific Estimators:** OLS with HAC (Newey-West autocorrelation-adjusted) standard errors, Theil-Sen median slopes, and Mann-Kendall monotonic trend tests.
- **Opposite-Trend & Contrast Pairs:** Statistically paired regional contrast testing ($t$-test on difference of slopes) rather than isolated regional comparisons.
- **Interactive Map Visualization:** GPU-accelerated MapLibre GL raster/vector grid visualization with color palettes for temperature, precipitation, and NDVI.
- **Co-Plotting & Anomaly Analysis:** Normalized $z$-score cross-variable overlay and empirical Pearson co-variation metrics.
- **Investigation Permalinks:** Stateless, base64-encoded URL permalinks for sharing investigations across scientific teams.
- **Strict Evidence Boundaries:** Distinguishes observation, reanalysis, model inference, and physical hypotheses; zero tolerance for hallucinated p-values or causal overreach.

---

## System Architecture

```text
├── terra-odyssey/
│   ├── backend/                    # Python 3.13 + FastAPI application
│   │   ├── src/backend/            # Core API, adapters, science pipeline, estimators
│   │   ├── tests/                  # Unit, numerical reference, and integration tests
│   │   ├── schemas/                # Result, investigation, and manifest JSON schemas
│   │   └── data/                   # Manifests, sample cubes, and SQLite store
│   └── frontend/                   # Next.js 16 (App Router) + React 19 + MapLibre GL
│       ├── components/             # Map, time series charts, investigation builders
│       ├── lib/                    # API client, D3 time series, URL permalinks, co-plot
│       └── app/                    # Next.js pages and layouts
├── docs/                           # Comprehensive technical and scientific manuals
│   ├── ARCHITECTURE.md             # System topology and data flow
│   ├── SCIENTIFIC_RULES.md         # Mandatory scientific constraints and estimands
│   ├── API_CONTRACT_V2.md          # REST API specifications and RFC 9457 errors
│   ├── USER_GUIDE.md               # End-user investigation workflow guide
│   └── CONTRIBUTING_GUIDE.md       # Development setup and contribution standards
└── terra-odyssey.zip               # Self-contained standalone application archive
```

---

## Quick Start

### Prerequisites
- Python 3.12+ (tested on Python 3.13)
- Node.js 20+ (Node 22 recommended)
- `npm` or `pnpm`

### 1. Backend Setup
```bash
cd terra-odyssey/backend
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
# source .venv/bin/activate

pip install -e ".[dev]"
pytest -q
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
API documentation is accessible at `http://127.0.0.1:8000/docs`.

### 2. Frontend Setup
```bash
cd terra-odyssey/frontend
npm install
npm run typecheck
npm run dev
```
Open `http://localhost:3000` to start investigating Earth system trends.

---

## Scientific Discipline

Terra Odyssey strictly adheres to [docs/SCIENTIFIC_RULES.md](file:///A:/teraaaaaa/docs/SCIENTIFIC_RULES.md):
1. **Never call reanalysis a direct satellite measurement:** MERRA-2 is explicitly labeled as model-data assimilation.
2. **Quality and Fill Masks:** Missing months are never treated as zeros or silently interpolated.
3. **Autocorrelation-Aware Uncertainty:** Uses HAC Newey-West standard errors to prevent overconfident trend assertions.
4. **Co-variation $\neq$ Causation:** Statistical associations between variables are labeled as co-variation or candidate mechanisms, never unsupported causal assertions.

---

## Packaging

After making any changes to the codebase under `terra-odyssey/`, regenerate the distributable archive:

```powershell
pwsh .\scripts\package-codebase.ps1
```

This updates `terra-odyssey.zip` on the root, ensuring all dependencies, cache files, and private credentials are excluded.

---

## License

This project is licensed under the MIT License. Data products are subject to NASA Earth Science Data and Information System (ESDIS) open data policies.
