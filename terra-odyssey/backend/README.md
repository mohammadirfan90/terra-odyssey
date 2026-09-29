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

For live NASA Earthdata acquisition, copy `.env.example` to `.env` and add local credentials. Demo and cached modes do not require credentials. To enable the universal natural-language query, add a server-side `NVIDIA_API_KEY` from NVIDIA Build. The default model is `nvidia/nemotron-3-super-120b-a12b`; `NVIDIA_NIM_MODEL`, `NVIDIA_NIM_BASE_URL`, and `NVIDIA_NIM_TIMEOUT_SECONDS` are optional overrides. Never commit `.env`, and never expose the NVIDIA key through a `NEXT_PUBLIC_` variable.

## Run

```powershell
cd terra-odyssey/backend
python -m uvicorn backend.app:app --app-dir src --reload --host 127.0.0.1 --port 8000
```

Useful endpoints:

- API health: `http://127.0.0.1:8000/api/health`
- OpenAPI UI: `http://127.0.0.1:8000/docs`
- Dataset catalog: `http://127.0.0.1:8000/api/catalog`
- Universal query: `POST http://127.0.0.1:8000/api/query`

Example request:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:8000/api/query `
  -ContentType application/json `
  -Body '{"query":"How is MERRA-2 different from a satellite retrieval?"}'
```

The response includes the answer, resolved model, provider, request latency, and
an explicit AI-assistance caveat. Without `NVIDIA_API_KEY`, this endpoint returns
an RFC 9457 `503` problem while the frontend's local catalog search remains usable.

The development CORS configuration allows the independently running frontend to call the API. The frontend should use `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api`.

## Real NASA Investigation Verification

To verify the end-to-end real NASA data pipeline (CMR discovery, NetCDF acquisition, quality masking, HAC trend estimation, and immutable export without synthetic data):

```powershell
cd terra-odyssey/backend
python scripts/verify_real_investigation.py --in-process
```

Or against a running Uvicorn server:

```powershell
python scripts/verify_real_investigation.py --api-url http://127.0.0.1:8000
```

## Checks

```powershell
cd terra-odyssey/backend
python -m pytest
python -m black --check src tests
python -m flake8 src tests
```

Run a focused suite with, for example, `python -m pytest tests/unit/test_api_investigations.py -v`.

