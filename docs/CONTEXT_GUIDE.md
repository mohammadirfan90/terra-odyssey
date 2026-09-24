# Terra Odyssey — AI coding context guide

## The central rule

Give an agent a small, task-shaped context bundle, not the entire research
archive. The project has two different information classes:

1. **Durable rules** — what must always be true. Put these in `AGENTS.md` and
   short topic documents.
2. **Task evidence** — what is needed for one change. Attach only the relevant
   schema, dataset manifest, screen spec, error, or reference notebook.

Codex automatically reads layered `AGENTS.md` files. Claude Code can use
`CLAUDE.md`; this package imports the same shared rules by keeping `CLAUDE.md`
short. Other agents can use `README.md` plus the explicit task bundle.

## Tiered attachment plan

### Tier 0 — every coding task

Attach or make available:

- `AGENTS.md` (unified mission, science non-negotiables, and GSD execution protocol)
- `.gsd/STATE.md` (active session position, current plan, and next steps)
- the exact task statement and “done when” checks

### Tier 1 — attach by workstream

| Workstream | Add these files |
|---|---|
| UI screen | `docs/UX_SPEC.md`, relevant schema, screenshot or UI export for the screen |
| Chart/map | `docs/UX_SPEC.md`, `docs/SCIENTIFIC_RULES.md`, `terra-odyssey/schemas/analysis-result.schema.json` |
| NASA adapter | `docs/DATA_CATALOG.md`, selected `terra-odyssey/data/manifests/*.json`, `terra-odyssey/schemas/dataset-manifest.schema.json`, source documentation link |
| Trend estimator | `docs/SCIENTIFIC_RULES.md`, `docs/VALIDATION_PLAN.md`, `terra-odyssey/schemas/analysis-result.schema.json`, numerical reference fixture |
| API endpoint | `docs/API_CONTRACT.md`, relevant request/result schemas, one real cached result |
| Reproducibility/export | `docs/API_CONTRACT.md`, `terra-odyssey/schemas/investigation-record.schema.json`, `docs/VALIDATION_PLAN.md` |
| Release review | `docs/VALIDATION_PLAN.md`, `docs/SCIENTIFIC_RULES.md`, changed files, test output |

### Tier 2 — optional deep research

Use only when a decision cannot be answered by Tier 0/1:

- `references/PRODUCT_SPEC_FULL.md`
- `references/Trend_Detective_Scientific_Project_Blueprint.docx`
- `references/Pasted markdown.md`
- `references/UPLOADED_SOURCE_FILES.md`
- primary NASA product documentation linked in `docs/REFERENCES.md`

Do not attach the older research paper as if it were current project authority;
it records an earlier SPHEREx-oriented decision path.

## Files to add to context versus files not to add

| Add | Why | Do not add by default | Why |
|---|---|---|---|
| Agent instructions | Stable constraints and commands | Entire `references/` folder | Long, redundant, conflicting context |
| Short product brief | Scope and user value | Raw NASA archives | Too large and not human-reviewable |
| Scientific rules | Prevent invalid analysis | `.env` or tokens | Secrets and accidental leakage |
| One dataset manifest | Exact source contract | `node_modules/`, caches | Noise and huge token cost |
| One result schema | Prevent UI/API drift | Build output | Stale generated files |
| One screen spec | Focused UX work | All screenshots | Agents infer design from pixels incorrectly |
| One real cached result | Real shape and caveats | Mock values in production demos | Scientific deception |

## Task prompt template

```text
Goal: [one observable change]
Context: @AGENTS.md @docs/PRODUCT_BRIEF.md @docs/SCIENTIFIC_RULES.md
         @[task-specific files]
Constraints: [scientific, UX, compatibility, performance constraints]
Do not: [out-of-scope or dangerous changes]
Done when:
  - [tests/checks]
  - [behavior and schema requirement]
  - [provenance/caveat requirement]
Plan first. Inspect existing code before editing. If a source field or
scientific assumption is missing, stop and identify it rather than inventing it.
```

## Context sizing

Keep `AGENTS.md` short and navigational. Put detail in linked docs. For a normal
task, target 5–8 files: the durable rules, one relevant domain document, one or
two schemas/manifests, and the task itself. If the agent asks for more context,
add the smallest file that answers its question. Never solve uncertainty by
attaching every PDF, DOCX, image, and raw data file.

## Automated Context Stringing

Use the included helper to inspect or output the exact chained context files for any task:

```powershell
# Inspect the chained context string and token budget
pwsh .\scripts\get-context.ps1 data
pwsh .\scripts\get-context.ps1 frontend
pwsh .\scripts\get-context.ps1 api

# Bash equivalent
./scripts/get-context.sh data
```


