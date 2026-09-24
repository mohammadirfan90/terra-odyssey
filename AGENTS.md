# Terra Odyssey — Agent Instructions

## Mission

Build a reproducible NASA-data investigation workspace for the challenge
**Be An Earth System Trend Detective!**. The product must help a user answer:
what changed, where, by how much, over which interval, with what uncertainty,
and whether the evidence supports a statistical trend.

## Before coding

- Read `.gsd/STATE.md` to restore current project position and active plan.
- Use the **search-first discipline**: grep/ripgrep before loading files; never read whole archives.
- Read only the specific task-bundle files required for your work (see Task Routing below).
- Never read `references/` during ordinary coding tasks (it is reserved for deep manual research).
- Read `docs/SCIENTIFIC_RULES.md` before changing any data adapter, estimator, mask, or statistic.
- If a requirement is ambiguous, state the assumption in the plan and keep it reversible. Never invent NASA data or endpoints.

## Non-negotiable science rules

- Use real, versioned NASA products and preserve collection/version metadata.
- Keep measured, retrieved, model-produced, derived, inferential, and hypothesis
  layers separate in the data model.
- Never call MERRA-2 a direct satellite measurement.
- Apply product-specific fill and quality masks before averaging.
- Never treat missing months as zeros or silently interpolate production trends.
- Make temporal support, spatial support, units, coverage, and aggregation visible.
- Use autocorrelation-aware uncertainty and a fixed multiple-testing family when
  searching maps or many regions.
- “Not significant” is not “no change”; report effect size and interval.
- One significant region and one nonsignificant region do not prove their slopes
  differ; use a paired contrast.
- Correlation or co-trending is not causal attribution.
- If the evidence does not support an opposite-trend pair, return that result
  honestly instead of changing dates or thresholds to manufacture one.

## Engineering rules

- Prefer small typed modules with explicit inputs and outputs.
- Keep raw files immutable; write normalized cubes and manifests separately.
- Every analysis job receives a versioned configuration and returns an
  `InvestigationRecord`-compatible result.
- Add unit tests for conversion, time aggregation, masks, geometry weights,
  estimator edge cases, and result-schema validation.
- Add a numerical reference test before optimizing an estimator.
- Do not put NASA credentials in source, tests, prompts, or screenshots.
- Do not add production dependencies without explaining why they are needed.
- Do not use mock scientific values in the real-data demo. Synthetic fixtures
  are allowed only when clearly labeled and used for algorithm tests.

## Development workflow (Get Shit Done)

- Follow the GSD methodology in `PROJECT_RULES.md`: `SPEC → PLAN → EXECUTE → VERIFY → COMMIT`.
- Check `.gsd/STATE.md` at session start; keep it updated after each completed task.
- Enforce the search-first discipline and capture empirical proof (test outputs, command logs) before completion.

## Definition of done

Before reporting completion, run the relevant tests, type checks, lint/format
checks, and one reproducible end-to-end investigation. Inspect the generated
result for units, dates, valid counts, uncertainty, provenance, and caveats.
Summarize changed files, commands run, evidence of success, and unresolved
limitations.

## Task routing

- UI work: read `docs/UX_SPEC.md` and the relevant result schema.
  Preserve evidence hierarchy and accessibility.
- Data work: read `docs/DATA_CATALOG.md`, the selected manifest, and the
  adapter contract in `docs/PRODUCT_BRIEF.md`.
- Statistics work: read `docs/SCIENTIFIC_RULES.md` and
  `docs/VALIDATION_PLAN.md`; do not change labels without updating tests.
- API work: read `docs/API_CONTRACT.md` and all schemas touched by the endpoint.

