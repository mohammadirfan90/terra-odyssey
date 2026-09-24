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
/
├── terra-odyssey/                    # Core application codebase
│   ├── src/
│   │   ├── frontend/                 # map, charts, investigation workflow
│   │   ├── backend/                  # API, jobs, analysis orchestration
│   │   └── data/                     # adapters, normalization, manifests
│   ├── tests/                        # unit, numerical, contract, e2e tests
│   ├── schemas/                      # machine-readable JSON contracts
│   ├── data/manifests/               # versioned metadata, not raw NASA data
│   └── README.md                     # codebase architecture guide
├── terra-odyssey.zip                 # Root codebase archive (auto-updated on every change)
├── AGENTS.md                         # durable instructions for coding agents
├── CLAUDE.md                         # Claude Code bridge to AGENTS.md
├── README.md                         # workspace entrypoint
├── docs/                             # scientific rules, catalog, specs
├── .gsd/                             # Get Shit Done (GSD) engine & operational state
│   ├── STATE.md                      # current position, active phase, next steps
│   ├── ROADMAP.md                    # phased implementation milestones
│   ├── SPEC.md                       # master architectural specification
│   ├── STACK.md                      # pinned technical choices
│   ├── docs/                         # GSD runbook, token optimization, model guide
│   └── adapters/                     # AI assistant persona adapters
├── scripts/                          # packaging, validation, search, context tools
└── references/                       # offline long source documents (never auto-loaded)
```

## Scientific boundary

The first release uses D1 MERRA-2 near-surface air temperature and D2 GPM
IMERG Final monthly precipitation. D3 MODIS land-surface temperature and D4
MODIS vegetation are later regional extensions. The application reports
descriptive trends, uncertainty, and comparisons. It does not claim causal
attribution, parcel-level farm advice, crop yield, or local soil fertility.

## Packaging & Codebase Distribution

The actual application codebase in `/terra-odyssey` is packaged as a standalone root zip file:
- `pwsh .\scripts\package-codebase.ps1` (or `./scripts/package-codebase.sh`)
- Generates `terra-odyssey.zip` on the repository root.
- Re-run automatically on every codebase update so the zip is always fresh and ready to use.

## Context tiers

- **Default (Always):** `AGENTS.md` and `.gsd/STATE.md`.
- **Frontend/UI:** `docs/UX_SPEC.md` and `terra-odyssey/schemas/analysis-result.schema.json`.
- **Data/analysis:** `docs/DATA_CATALOG.md`, `docs/SCIENTIFIC_RULES.md`, and `terra-odyssey/schemas/dataset-manifest.schema.json`.
- **Backend/API:** `docs/API_CONTRACT.md` and `terra-odyssey/schemas/investigation-record.schema.json`.
- **Never attach by default:** `references/`, raw data archives, `.env` files, or large documents.
- **Never attach by default:** `references/`, raw data archives, `.env` files, or large documents.

## What is deliberately absent

Raw NASA archives, Earthdata credentials, `.env` files, `node_modules`, build
outputs, and unreviewed screenshots are not context. They are either too large,
secret, stale, or likely to make an agent infer unsupported science.

