# Terra Odyssey — AI Coding Context Kit

This package is the implementation context for **Terra Odyssey**, the active
project direction for NASA Space Apps 2026’s **Be An Earth System Trend
Detective!** challenge.

It is intentionally a context kit and architecture starter, not a finished
application. It gives a coding agent the smallest durable set of facts it needs
to build a scientifically defensible product without inventing NASA data,
silently changing the challenge, or turning correlation into causation.

## Start here

1. Read `AGENTS.md` for mission rules, non-negotiable science constraints, and the GSD protocol.
2. Read `.gsd/STATE.md` to see the current milestone, active phase, and immediate next steps.
3. Select only task-relevant files using `context-manifest.json`.
4. Run validation checks before marking any task complete.

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
│   └── ai-coding/                     # reusable build/review prompts
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

- **Default (Always):** `AGENTS.md` and `.gsd/STATE.md`.
- **Frontend/UI:** `docs/UX_SPEC.md` and `schemas/analysis-result.schema.json`.
- **Data/analysis:** `docs/DATA_CATALOG.md`, `docs/SCIENTIFIC_RULES.md`, and `schemas/dataset-manifest.schema.json`.
- **Backend/API:** `docs/API_CONTRACT.md` and `schemas/investigation-record.schema.json`.
- **Never attach by default:** `references/`, raw data archives, `.env` files, or large documents.

## What is deliberately absent

Raw NASA archives, Earthdata credentials, `.env` files, `node_modules`, build
outputs, and unreviewed screenshots are not context. They are either too large,
secret, stale, or likely to make an agent infer unsupported science.

