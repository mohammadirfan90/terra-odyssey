# Product brief — Terra Odyssey

## Active decision

Build a scientific web workspace for **Be An Earth System Trend Detective!**
The project name is **Terra Odyssey** and the short promise is:

> Investigate environmental change with NASA data, quantify the effect, expose
> uncertainty, compare regions, and export a reproducible finding.

## Core user problem

Maps and short time-series can make a pattern look convincing even when it is
seasonality, missingness, changing observation support, serial dependence,
spatial aggregation, a product revision, or selective date choice. The product
turns a visual question into a reproducible investigation record.

## Core workflow

1. Select a reviewed variable, version, period, and spatial support.
2. Inspect original values, valid coverage, masks, and units.
3. View a trend field and select or define comparable regions.
4. Estimate effect size and uncertainty with a declared method.
5. Test a regional contrast, not merely two separate p-values.
6. Inspect sensitivity, seasonal support, and selection history.
7. State a qualified finding with source, method, limitations, and export.

## Core scope

- **D1:** MERRA-2 monthly 2 m air temperature, model/data-assimilation output.
- **D2:** GPM IMERG Final monthly precipitation, mission-derived product.
- **D3:** MODIS MOD11A2.061 land-surface temperature, regional extension.
- **D4:** MODIS MOD13A3.061 NDVI/EVI, regional extension.
- **D9:** GISTEMP context, not interchangeable ground truth.

D5–D8 are research-tier extensions: GRACE storage, SMAP moisture, CERES
energy flux, and MODIS snow. They must not displace validation of the core.

## Release tiers

### Core scientific product

D1/D2; annual trend engine; global coarse maps; fixed and bounded regions;
paired contrast; uncertainty and evidence layers; provenance; CSV/JSON/chart
export; three reviewed real-data investigations.

### Full product

Add sensitivity views, opposite-trend candidate navigation, selected D3/D4
regional investigations, anomaly/season views, immutable job snapshots, and a
readable report export.

### Research extensions

Add at most one specialist domain after the core passes. Do not promise global
high-resolution Earth-system attribution in a two-month build.

## Explicit non-goals

No causal attribution, future forecasting, parcel-level farm advice, soil
fertility estimation, crop-yield prediction, flood warnings, health-risk
prediction, or claim that a NASA product is an independent ground truth.

## Primary persona

An environmental analyst or advanced student who can read charts and maps but
needs help preserving quality flags, temporal support, dependence, and honest
uncertainty. Expert mode exposes diagnostics; guided mode uses the same engine
with fewer controls.

## Product differentiation

NASA tools already support discovery, extraction, mapping, and basic comparison.
Terra Odyssey contributes a single auditable chain from product version and
quality mask to effect size, uncertainty, paired regional contrast, selection
history, and a qualified export.

For full scientific details, use `references/Trend_Detective_Scientific_Project_Blueprint.docx`.

