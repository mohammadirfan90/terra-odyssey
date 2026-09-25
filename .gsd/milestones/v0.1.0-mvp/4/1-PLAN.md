---
phase: 4
plan: 1
wave: 1
---

# Plan 4.1: Schemas, Catalog, and Request Validation

## Objective
Extend `schemas/investigation-record.schema.json` to formally type all metadata fields and build the FastAPI backend catalog service with RFC 9457 Problem Details error handling, Pydantic request/response models, and metadata endpoints.

## Context
- `schemas/investigation-record.schema.json`
- `schemas/analysis-result.schema.json`
- `docs/API_CONTRACT.md`
- `docs/SCIENTIFIC_RULES.md`
- `.gsd/DECISIONS.md`
- `.gsd/phases/4/RESEARCH.md`

## Tasks

<task type="auto">
  <name>Extend InvestigationRecord JSON Schema & Pydantic Contracts</name>
  <files>
    terra-odyssey/schemas/investigation-record.schema.json
    terra-odyssey/src/backend/schemas.py
  </files>
  <action>
    1. Update `terra-odyssey/schemas/investigation-record.schema.json`:
       - Add required properties: `schema_version`, `job`, `data_mode`, `artifact_index`, `record_hash`, `published_at`, `source_manifest_objects`, `resolved_configuration_hash`, and optional `map_family_id`.
       - Strongly type `job`: object with `job_id`, `job_status` (enum: `submitted`, `running`, `succeeded`, `failed`, `cancel_requested`, `cancelled`), `stage` (enum: `validating`, `acquiring`, `normalizing`, `aggregating`, `analyzing`, `publishing`), `result_status` (enum: `supported`, `inconclusive`, `ineligible`), `progress_pct` (0..100), `created_at`, `started_at`, `completed_at`.
       - Strongly type `request`, `resolved_configuration`, `selection_history`, `artifact_index`, and `software`.
       - Ensure `results` references `analysis-result.schema.json`.
    2. In `terra-odyssey/src/backend/schemas.py`:
       - Define Pydantic v2 models mirroring the JSON schemas:
         - `InvestigationRequest`: `dataset_id`, `variable`, `period` (`start_year`, `end_year`), `region_a` (GeoJSON geometry or bbox), `region_b` (optional GeoJSON geometry or bbox), `temporal_aggregation` (`"annual_mean"` | `"annual_total"` | `"seasonal"`), `spatial_aggregation` (`"area_weighted"`), `execution_mode` (`"auto"` | `"live"` | `"cached_only"` | `"demo_sample"`), `estimator_family` (`"ols_hac"`), `selection_status` (`"predefined"` | `"exploratory_map_selected"`).
         - `JobStatusResponse`: operational `job_id`, `job_status`, `stage`, `result_status`, `progress_pct`, `created_at`, `updated_at`, `error`.
         - `ProblemDetails`: RFC 9457 compliant error structure (`type`, `title`, `status`, `code`, `detail`, `instance`, `retryable`).
         - `CatalogResponse`: metadata of reviewed datasets, variables, valid date ranges, supported geometries, and quality policies.
         - `StructuredGridMapResponse`: `grid`, `bands`, `legend`, `provenance`.
       - Avoid any implicit type coercion that masks validation errors.
  </action>
  <verify>
    python -c "import jsonschema, json; s = json.load(open('terra-odyssey/schemas/investigation-record.schema.json')); jsonschema.Draft202012Validator.check_schema(s); print('Schema valid!')"
  </verify>
  <done>
    `investigation-record.schema.json` compiles cleanly under JSON Schema Draft 2020-12, and Pydantic models in `schemas.py` instantiate and validate test payloads without error.
  </done>
</task>

<task type="auto">
  <name>Build Catalog Service and RFC 9457 Error Handlers</name>
  <files>
    terra-odyssey/src/backend/api/catalog.py
    terra-odyssey/src/backend/errors.py
    terra-odyssey/src/backend/app.py
  </files>
  <action>
    1. In `terra-odyssey/src/backend/errors.py`:
       - Define custom exceptions: `TerraOdysseyError`, `DataUnavailableError` (HTTP 503), `ScientificallyIneligibleError` (HTTP 422), `InvalidGeometryError` (HTTP 400), `InvestigationNotFoundError` (HTTP 404).
       - Implement RFC 9457 Problem Details serialization for FastAPI exception handlers returning `application/problem+json`.
    2. In `terra-odyssey/src/backend/api/catalog.py`:
       - Implement `GET /api/catalog`: Returns reviewed datasets (`merra2_t2m`, `gpm_imerg_precipitation`), native spatial resolutions, temporal coverage, variables, units, valid aggregation choices, and quality policies directly from Phase 1 dataset manifests.
       - Implement `GET /api/capabilities`: Returns available execution modes (`auto`, `live`, `cached_only`, `demo_sample`), cached granule availability, and system software versions.
    3. In `terra-odyssey/src/backend/app.py`:
       - Initialize FastAPI application with title `"Terra Odyssey Scientific API"`, version `"0.1.0"`.
       - Register RFC 9457 error handlers.
       - Mount the catalog router at `/api`.
  </action>
  <verify>
    python -c "from terra-odyssey.src.backend.app import create_app; from fastapi.testclient import TestClient; client = TestClient(create_app()); res = client.get('/api/catalog'); assert res.status_code == 200; print(res.json()['datasets'].keys())"
  </verify>
  <done>
    FastAPI app initializes cleanly, `/api/catalog` returns reviewed dataset metadata, and custom exceptions render RFC 9457 `application/problem+json`.
  </done>
</task>

<task type="auto">
  <name>Unit Tests for Catalog and Schema Validation</name>
  <files>
    terra-odyssey/tests/unit/test_api_catalog.py
  </files>
  <action>
    Create comprehensive unit tests covering:
    1. `test_catalog_returns_reviewed_datasets`: asserts MERRA-2 and GPM IMERG are present with correct units and coverage.
    2. `test_capabilities_endpoint`: asserts execution modes and system metadata are exposed.
    3. `test_request_schema_validation`: verifies that invalid years (e.g. start > end, invalid strings) or malformed geometries trigger Pydantic validation errors.
    4. `test_rfc9457_error_formatting`: triggers a custom scientific or data unavailable error and verifies RFC 9457 response structure, status code, and Content-Type `application/problem+json`.
  </action>
  <verify>
    python -m pytest terra-odyssey/tests/unit/test_api_catalog.py -v
  </verify>
  <done>
    All unit tests in `test_api_catalog.py` pass cleanly.
  </done>
</task>

## Success Criteria
- [ ] `investigation-record.schema.json` extended and verified against Draft 2020-12.
- [ ] Catalog endpoints deliver reviewed NASA datasets and capabilities.
- [ ] RFC 9457 Problem Details errors returned for operational and scientific exceptions.
- [ ] 100% of new unit tests pass in `test_api_catalog.py`.
