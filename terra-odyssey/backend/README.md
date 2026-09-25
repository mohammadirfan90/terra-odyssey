# Terra Odyssey Backend

This is the standalone FastAPI, analysis, and NASA-data application. It owns request validation, scientific eligibility, analysis orchestration, SQLite job state, investigation artifacts, schemas, provenance, and export bundles. It serves API routes only; the Next.js frontend runs separately.

## Layout

```text
backend/
├── src/
│   ├── backend/          # FastAPI routes, job orchestration, persistence, and exports
│   ├── analysis/         # Aggregation, estimators, contrasts, and multiplicity control
│   └── data/adapters/    # NASA product adapters
├── tests/
├── schemas/
├── data/
│   ├── manifests/
│   ├── samples/          # Optional local NASA granules
│   ├── investigations/   # Reproducible investigation artifacts
│   └── jobs.db           # SQLite job state when present
├── pyproject.toml
└── README.md
```

All default filesystem locations are derived from the backend directory, so starting Uvicorn from another working directory does not redirect the database or investigation output.

## Setup

Python 3.10 or newer is required.

```powershell
cd terra-odyssey/backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -e ".[dev]"
```

For live NASA Earthdata acquisition, copy `.env.example` to `.env` and add local credentials. Demo and cached modes do not require credentials. Never commit `.env`.

## Run

```powershell
cd terra-odyssey/backend
python -m uvicorn backend.app:app --app-dir src --reload --host 127.0.0.1 --port 8000
```

Useful endpoints:

- API health: `http://127.0.0.1:8000/api/health`
- OpenAPI UI: `http://127.0.0.1:8000/docs`
- Dataset catalog: `http://127.0.0.1:8000/api/catalog`

The development CORS configuration allows the independently running frontend to call the API. The frontend should use `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api`.

## Checks

```powershell
cd terra-odyssey/backend
python -m pytest
python -m black --check src tests
python -m flake8 src tests
```

Run a focused suite with, for example, `python -m pytest tests/unit/test_api_investigations.py -v`.
