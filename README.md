# Terra Odyssey — AI Coding Context Kit

This workspace contains **Terra Odyssey**, a reproducible NASA-data investigation application for the Space Apps challenge **Be An Earth System Trend Detective!**, plus the scientific and agent context used to maintain it.

## Start here

1. Read `AGENTS.md` for mission rules and scientific constraints.
2. Read `.gsd/STATE.md` for the current project position.
3. Select task-relevant context through `context-manifest.json`.
4. Run the affected application's checks before reporting completion.

## Workspace layout

```text
/
├── terra-odyssey/
│   ├── backend/
│   │   ├── src/                    # FastAPI, analysis, and NASA adapters
│   │   ├── tests/                  # Python unit/integration/numerical tests
│   │   ├── schemas/                # machine-readable result contracts
│   │   ├── data/                   # manifests, samples, DB, investigations
│   │   ├── pyproject.toml
│   │   └── README.md
│   ├── frontend/                   # independent Next.js application
│   └── README.md                   # setup and run guide for both applications
├── terra-odyssey.zip               # refreshed standalone application archive
├── AGENTS.md
├── docs/                            # scientific rules, catalog, API, and UX specs
├── .gsd/                            # GSD state, roadmap, architecture, and history
├── scripts/                         # packaging and validation utilities
└── references/                      # offline source material; never auto-loaded
```

The backend and frontend are separate applications. FastAPI serves only `/api` and its API documentation. Next.js runs on its own port and reaches FastAPI through `NEXT_PUBLIC_API_URL`.

## Scientific boundary

The first release uses D1 MERRA-2 near-surface air temperature and D2 GPM IMERG Final monthly precipitation. D3 MODIS land-surface temperature and D4 MODIS vegetation are regional extensions. The application reports descriptive trends, uncertainty, and paired comparisons; it does not claim causal attribution or provide forecasting or agricultural advice.

## Context tiers

- **Default:** `AGENTS.md` and `.gsd/STATE.md`.
- **Frontend/UI:** `docs/UX_SPEC.md` and `terra-odyssey/backend/schemas/analysis-result.schema.json`.
- **Data/analysis:** `docs/DATA_CATALOG.md`, `docs/SCIENTIFIC_RULES.md`, and `terra-odyssey/backend/schemas/dataset-manifest.schema.json`.
- **Backend/API:** `docs/API_CONTRACT.md` and `terra-odyssey/backend/schemas/investigation-record.schema.json`.
- **Never attach by default:** `references/`, raw NASA archives, private `.env` files, dependencies, or build output.

## Packaging

After changing files under `terra-odyssey/`, run:

```powershell
pwsh .\scripts\package-codebase.ps1
```

The script regenerates `terra-odyssey.zip` without private environment files, dependency directories, Python caches, or frontend build caches.
