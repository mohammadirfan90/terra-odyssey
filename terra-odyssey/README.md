# Terra Odyssey

Terra Odyssey is a reproducible NASA-data investigation workspace for the NASA Space Apps challenge **Be An Earth System Trend Detective!**. The web client and scientific API are independent applications that are installed, run, and checked separately.

## Layout

```text
terra-odyssey/
├── backend/
│   ├── src/              # FastAPI API, analysis modules, and NASA data adapters
│   ├── tests/            # Unit, integration, and numerical reference tests
│   ├── schemas/          # JSON contracts for manifests and investigation results
│   ├── data/             # Manifests, samples, SQLite state, and investigations
│   ├── pyproject.toml
│   └── README.md
├── frontend/             # Next.js application, components, client libraries, and package files
└── README.md
```

The backend owns scientific eligibility, calculations, persistence, schemas, provenance, and exports. The frontend owns presentation and interaction and consumes the backend only through its HTTP API. FastAPI does not serve the Next.js export.

## Run locally

Use two terminals from the repository root.

Terminal 1 — backend:

```powershell
cd terra-odyssey/backend
python -m pip install -e ".[dev]"
Copy-Item .env.example .env  # optional; add Earthdata credentials for live acquisition
python -m uvicorn backend.app:app --app-dir src --reload --port 8000
```

Terminal 2 — frontend:

```powershell
cd terra-odyssey/frontend
Copy-Item .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. The frontend reads `NEXT_PUBLIC_API_URL`; the example value is `http://127.0.0.1:8000/api`. Because this is a public Next.js variable, set it before `npm run build` for a deployed static export.

## Checks

Backend:

```powershell
cd terra-odyssey/backend
python -m pytest
python -m black --check src tests
python -m flake8 src tests
```

Frontend:

```powershell
cd terra-odyssey/frontend
npm run typecheck
npm run lint
npm run build
```

The frontend static export and build cache stay under `frontend/out/` and are excluded from the packaged codebase. See [backend/README.md](backend/README.md), [frontend/README.md](frontend/README.md), and [frontend/MAP_SETUP.md](frontend/MAP_SETUP.md) for application-specific details.

## Scientific scope

The core products are MERRA-2 near-surface air temperature and GPM IMERG Final precipitation. Results report effect size, uncertainty, coverage, provenance, and paired regional contrasts without turning co-trending into causal attribution.

## Packaging

From the repository root, refresh the standalone archive after codebase changes:

```powershell
pwsh .\scripts\package-codebase.ps1
```

The command writes `terra-odyssey.zip` at the repository root and excludes dependencies, private environment files, test/build caches, and generated frontend output.
