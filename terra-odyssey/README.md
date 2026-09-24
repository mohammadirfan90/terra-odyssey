# Terra Odyssey — Core Application Codebase

This directory (`/terra-odyssey`) contains the executable application code, test suites, contracts, and dataset manifests for **Terra Odyssey** (NASA Space Apps 2026: *Be An Earth System Trend Detective!*).

## Architecture & Layout

```text
terra-odyssey/
├── src/
│   ├── frontend/         # React/TypeScript investigation workspace UI & components
│   ├── backend/          # FastAPI API, analysis engine, job state machine, exports
│   └── data/             # NASA data adapters (MERRA-2, GPM IMERG) & cube normalizers
├── tests/
│   ├── unit/             # Adapter, math, and estimator unit tests
│   ├── numerical/        # Reference statistical tests (Newey-West, paired contrast)
│   ├── contract/         # Schema and API contract verification
│   └── e2e/              # End-to-end investigation verification
├── schemas/              # Machine-readable JSON contracts (analysis, request, manifest)
├── data/
│   └── manifests/        # Versioned NASA dataset collection definitions
└── README.md
```

## Scientific Scope & Constraints

- **Primary Products**: D1 MERRA-2 Near-Surface Air Temperature (`M2TMNXSLV`) and D2 GPM IMERG Final Monthly Precipitation (`GPM_3IMERGM`).
- **Statistical Estimators**: Ordinary Least Squares (OLS) with Newey-West HAC standard errors (autocorrelation-aware).
- **Inference Policy**: Paired contrasts for spatial comparisons; no causal claims from observational correlation.

## Packaging

The root directory maintains an up-to-date archive:
- `terra-odyssey.zip` (standalone archive of this codebase)
