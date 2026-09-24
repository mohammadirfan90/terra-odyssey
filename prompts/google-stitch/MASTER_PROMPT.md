# Google Stitch master prompt

Copy this into Stitch as the starting product brief. Then generate screens one
at a time using `SCREEN_PROMPTS.md`.

```text
Design a responsive web application called “Terra Odyssey” for an Earth-system
scientist, environmental analyst, advanced student, educator, or science
communicator. The application investigates NASA Earth-observation and NASA
model products to answer: what is changing, where, by how much, over what
interval, with what uncertainty, and whether the evidence supports a statistical
trend.

The product is a scientific investigation workspace, not a generic climate
dashboard. The core interaction is:
choose a reviewed variable and data release → choose a time range and spatial
support → inspect the map and temporal coverage → select comparable regions →
view linked time series → read effect size and uncertainty → inspect methods and
caveats → export a reproducible finding.

Generate a desktop-first web layout that also works on tablet and mobile. Use a
calm, precise scientific-instrument atmosphere with a clear reading hierarchy.
Make the map, time series, evidence card, methods drawer, and job status feel
like one connected workflow. Use professional components: sticky navigation,
question builder, split-pane investigation workspace, map panel, chart panel,
evidence cards, segmented controls, filter chips, drawer, modal, data table,
empty state, loading state, error state, and export action.

Show realistic labels and units but do not invent numerical NASA measurements.
Use neutral placeholders such as “Awaiting selected result” or a clearly marked
“illustrative fixture.” The UI must visibly distinguish slope direction from
statistical evidence, and must show valid observation count, coverage, source
release, quality policy, analysis interval, uncertainty interval, and a qualified
status such as “supported,” “inconclusive,” or “ineligible.”

The primary screen should let a user compare two regions for the same variable
and period. A map selection updates two linked time-series charts and a paired
contrast evidence card. Include a methods drawer with the dataset, version,
units, QA policy, aggregation, estimator, autocorrelation treatment,
multiple-testing family, and selection history. Include an accessible text table
alternative for every chart and map.

Avoid decorative space imagery, dense neon dashboards, fake precision, causal
claims, and color-only status. Make the evidence and limitations more prominent
than promotional copy.
```

