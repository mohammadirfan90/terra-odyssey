# Terra Odyssey — API and job contract

## Design principles

- External NASA services are ingestion dependencies, not the critical path for
  every map interaction.
- Historical products are cached behind immutable manifests and reproducible
  analysis jobs.
- Long-running acquisition and analysis return a job ID; the UI polls or uses a
  stream to show state without blocking.
- Every result references a frozen configuration and source manifest.

## Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/catalog` | Reviewed datasets, variables, versions, units, limits |
| POST | `/api/query` | Natural-language guidance through a protected NVIDIA NIM gateway |
| POST | `/api/investigations` | Validate and create a reproducible investigation job |
| GET | `/api/investigations/{id}` | Job state, result summary, errors, provenance |
| GET | `/api/investigations/{id}/series` | Regional time series and coverage |
| GET | `/api/investigations/{id}/map` | Cached tiles or coarse fields with legend metadata |
| GET | `/api/investigations/{id}/evidence` | Effect, interval, test status, diagnostics, caveats |
| GET | `/api/investigations/{id}/export` | JSON/CSV/report bundle for the frozen result |

## Query request requirements

`POST /api/query` accepts `{ "query": string }` (2–500 characters) and returns
`answer`, `model`, `provider`, `latency_ms`, and `caveat`. The NVIDIA API key is
server-only. This endpoint provides AI-generated navigation and explanation; it
does not create an investigation or constitute scientific evidence. Numeric
claims still require a frozen investigation record and reviewed provenance.

Environment variables are `NVIDIA_API_KEY` plus optional
`NVIDIA_NIM_BASE_URL`, `NVIDIA_NIM_MODEL`, and `NVIDIA_NIM_TIMEOUT_SECONDS`.
The default hosted model is `nvidia/nemotron-3-super-120b-a12b`.

## Investigation request requirements

An investigation request must specify dataset/version, variable, source period,
calendar, geometry or region IDs, spatial aggregation, temporal aggregation,
quality policy, estimator family, and whether the analysis is exploratory or
confirmatory. Server defaults must be returned in the resolved configuration;
they must not remain hidden.

## Job states

`submitted → validating → acquiring → normalizing → aggregating → analyzing →
publishing → succeeded` with terminal `failed`, `cancelled`, or `inconclusive`.
`inconclusive` is a valid scientific result, not an HTTP error.

## Error semantics

- `400`: invalid geometry, unsupported combination, or missing required field.
- `404`: unknown investigation or catalog item.
- `409`: source version or manifest changed; rerun with an explicit snapshot.
- `422`: scientifically ineligible record, such as incomplete annual totals.
- `429`: quota/back-pressure; client should retry with server guidance.
- `502`: an upstream AI response was malformed or could not be safely used.
- `503`: upstream NASA/NVIDIA service unavailable or AI service not configured;
  use cached data or local catalog search when safe.

