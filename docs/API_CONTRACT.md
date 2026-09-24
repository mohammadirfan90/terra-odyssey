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
| POST | `/api/investigations` | Validate and create a reproducible investigation job |
| GET | `/api/investigations/{id}` | Job state, result summary, errors, provenance |
| GET | `/api/investigations/{id}/series` | Regional time series and coverage |
| GET | `/api/investigations/{id}/map` | Cached tiles or coarse fields with legend metadata |
| GET | `/api/investigations/{id}/evidence` | Effect, interval, test status, diagnostics, caveats |
| GET | `/api/investigations/{id}/export` | JSON/CSV/report bundle for the frozen result |

## Request requirements

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
- `503`: upstream NASA service unavailable; use cached data when safe.

