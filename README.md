# Terra Odyssey — AI Coding Context Kit

This package is the implementation context for **Terra Odyssey**, the active
project direction for NASA Space Apps 2026’s **Be An Earth System Trend
Detective!** challenge.

It is intentionally a context kit and architecture starter, not a finished
application. It gives a coding agent the smallest durable set of facts it needs
to build a scientifically defensible product without inventing NASA data,
silently changing the challenge, or turning correlation into causation.

## Start here

1. Read `AGENTS.md`.
2. Read `docs/CONTEXT_GUIDE.md` and select only the task-relevant files.
3. Read `docs/PRODUCT_BRIEF.md` for the product boundary.
4. Read `docs/SCIENTIFIC_RULES.md` before changing analysis code.
5. Read the relevant schema and task prompt before editing code.
6. Run the checks named in `AGENTS.md` before calling work complete.

## Recommended implementation tree

```text
terra-odyssey/
├── AGENTS.md                         # durable instructions for coding agents
├── CLAUDE.md                         # Claude Code bridge to AGENTS.md
├── README.md
├── docs/
│   ├── index.md
│   ├── CONTEXT_GUIDE.md              # what to attach for each task
│   ├── PRODUCT_BRIEF.md              # compact product and scope authority
│   ├── SCIENTIFIC_RULES.md            # non-negotiable inference rules
│   ├── DATA_CATALOG.md                # dataset choices and access contracts
│   ├── UX_SPEC.md                     # user journey and evidence UI
│   ├── API_CONTRACT.md                # backend jobs and result contracts
│   ├── VALIDATION_PLAN.md             # scientific and software acceptance
│   ├── IMPLEMENTATION_TREE.md         # proposed source layout
│   ├── DECISION_HISTORY.md            # resolved research/report conflict
│   └── REFERENCES.md
├── prompts/
│   ├── ai-coding/                     # reusable build/review prompts
│   └── google-stitch/                 # UI generation and handoff prompts
├── schemas/                           # machine-readable contracts
├── data/manifests/                    # versioned metadata, not raw NASA data
├── src/
│   ├── frontend/                      # map, charts, investigation workflow
│   ├── backend/                       # API, jobs, analysis orchestration
│   └── data/                          # adapters, normalization, manifests
├── tests/                             # unit, numerical, contract, e2e tests
└── references/                        # optional long source documents
```

## Scientific boundary

The first release uses D1 MERRA-2 near-surface air temperature and D2 GPM
IMERG Final monthly precipitation. D3 MODIS land-surface temperature and D4
MODIS vegetation are later regional extensions. The application reports
descriptive trends, uncertainty, and comparisons. It does not claim causal
attribution, parcel-level farm advice, crop yield, or local soil fertility.

## Context tiers

- **Always:** `AGENTS.md`, `docs/CONTEXT_GUIDE.md`, `docs/PRODUCT_BRIEF.md`,
  `docs/SCIENTIFIC_RULES.md`, and the active task prompt.
- **Frontend/UI:** `docs/UX_SPEC.md`, `prompts/google-stitch/DESIGN_SYSTEM.md`,
  the relevant schema, and the relevant feature section in the product brief.
- **Data/analysis:** `docs/DATA_CATALOG.md`, `docs/SCIENTIFIC_RULES.md`,
  `schemas/dataset-manifest.schema.json`, and the selected dataset manifest.
- **Backend/API:** `docs/API_CONTRACT.md`, the investigation/result schemas,
  and the relevant validation section.
- **Optional:** the long blueprint DOCX and the original prompt in
  `references/`; do not attach them to every small coding task.

## What is deliberately absent

Raw NASA archives, Earthdata credentials, `.env` files, `node_modules`, build
outputs, and unreviewed screenshots are not context. They are either too large,
secret, stale, or likely to make an agent infer unsupported science.

