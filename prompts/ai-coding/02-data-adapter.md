# NASA data-adapter prompt

Read `docs/DATA_CATALOG.md`, `docs/SCIENTIFIC_RULES.md`, the selected
`data/manifests/*.json`, and `schemas/dataset-manifest.schema.json`.

Implement or modify one adapter only. Begin by resolving the official collection
and version; never guess a URL or field name. Preserve raw metadata and add a
sample-granule test for dimensions, coordinates, units, scale/offset, fill
values, dates, and QA. Make `discover`, `fetch`, `decode`, `validate`,
`quality_mask`, `aggregate`, and `cite` explicit operations. Quarantine invalid
inputs and report the exact reason. Add a small real-data smoke test if access is
available and a labeled synthetic fixture for edge cases. Update the manifest
and documentation when the source contract changes.

