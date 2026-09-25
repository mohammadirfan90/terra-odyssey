# Implementation tree

```text
terra-odyssey/
├── backend/
│   ├── src/
│   │   ├── backend/                 # FastAPI routes, jobs, persistence, exports
│   │   ├── analysis/                # estimators, contrasts, diagnostics
│   │   └── data/adapters/           # D1-D4 discovery, decoding, masks, units
│   ├── tests/
│   │   ├── fixtures/                # labeled synthetic algorithm fixtures
│   │   ├── unit/                    # adapters, math, paths, and API behavior
│   │   └── numerical/               # independent statistical reference tests
│   ├── schemas/                     # machine-readable JSON contracts
│   ├── data/
│   │   ├── manifests/               # versioned NASA product manifests
│   │   ├── samples/                 # optional immutable sample granules
│   │   ├── investigations/          # published investigation artifacts
│   │   └── jobs.db                  # SQLite job state when present
│   └── pyproject.toml
├── frontend/
│   ├── app/                         # Next.js routes and global styles
│   ├── components/                  # investigation, map, chart, evidence UI
│   ├── lib/                         # typed API, chart, and map helpers
│   ├── package.json
│   └── next.config.ts
└── README.md
```

The frontend consumes typed HTTP results and does not recalculate scientific statistics from display data. The backend owns scientific eligibility, interpretation status, persistence, and export. Each application has independent setup, run, and verification commands.
