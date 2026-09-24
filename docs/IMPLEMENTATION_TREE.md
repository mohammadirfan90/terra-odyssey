# Implementation tree

```text
src/
├── frontend/
│   ├── app/                    # routes, providers, global error/loading
│   ├── components/             # accessible map, chart, evidence primitives
│   ├── features/
│   │   ├── catalog/            # reviewed variables and source metadata
│   │   ├── investigations/     # question builder and job lifecycle
│   │   ├── map/                # tiles, legends, geometry selection
│   │   ├── evidence/            # effect, interval, diagnostics, caveats
│   │   └── exports/             # report/CSV/JSON downloads
│   ├── lib/                    # API client, formatting, accessibility
│   └── styles/                 # tokens and layout; no science logic
├── backend/
│   ├── api/                    # request validation and route handlers
│   ├── jobs/                   # queued acquisition/analysis state machine
│   ├── domain/                 # typed domain objects and policy routing
│   ├── analysis/               # estimators, contrasts, diagnostics
│   └── storage/                # manifests, normalized cubes, caches
└── data/
    ├── adapters/               # D1–D4 discover/fetch/decode/mask/aggregate
    ├── manifests/              # immutable source and processing manifests
    ├── schemas/                # data validation models
    └── fixtures/               # small real and synthetic test inputs
tests/
├── unit/
├── numerical/
├── contract/
├── integration/
└── e2e/
```

The frontend must consume typed result contracts; it must not recalculate
scientific statistics from display data. The data layer must not know about
React components. The backend owns scientific eligibility and interpretation
status.

