---
status: FINALIZED
created: 2026-09-24T22:00:00Z
finalized: 2026-09-24T23:20:00Z
---

# SPEC.md — Project Specification: Terra Odyssey

## Vision

Terra Odyssey is an open, reproducible Earth-system trend investigation workspace built for NASA Space Apps 2026's **Be An Earth System Trend Detective!** challenge. It empowers environmental analysts, researchers, students, and educators to determine what is changing, where, by how much, over what interval, with what uncertainty, and whether empirical observations support a statistically defensible trend—without conflating correlation with causation or masking observational realities.

---

## Goals

1. **Defensible Trend Detection & Uncertainty Engine**
   Implement transparent estimation (ordinary least squares with Newey-West HAC standard errors and block-bootstrapped confidence intervals) on validated, quality-masked NASA gridded time series (MERRA-2 T2M and GPM IMERG Final).

2. **Empirical Paired Regional Contrasts**
   Enable users to test whether two geographic areas exhibit genuinely different trends using a rigorous paired contrast estimator, correcting for spatial autocorrelation and multiple hypothesis testing rather than comparing unadjusted isolated p-values.

3. **Auditable Provenance & Reproducible Investigation Records**
   Every analysis produces a versioned, self-contained `InvestigationRecord` detailing source product versions, quality policies, calendar weights, estimator parameters, diagnostic flags, and explicit caveats with JSON/CSV/report exports.

---

## Non-Goals (Out of Scope)

Explicitly NOT part of Terra Odyssey:

- **No Causal Attribution:** Correlation and co-trending are not causal attribution; the system does not claim greenhouse gas, deforestation, or policy causality without independent mechanistic models.
- **No Predictive Forecasting or Agricultural Advice:** No parcel-level farm management advice, crop yield prediction, or local soil fertility assessments.
- **No Silent Smoothing or Infill:** Missing temporal intervals are never silently interpolated as zeros or smoothed away.
- **No Manufactured Opposites:** If data does not support opposite regional trends, the system truthfully returns an inconclusive finding.

---

## Users

**Primary User:** Environmental analysts, policy researchers, and science communicators
- Need to evaluate regional environmental change using authoritative NASA data without overstating confidence.
- Require exportable citations, methodology disclosures, and uncertainty intervals.

**Secondary User:** Students and citizen scientists
- Guided exploration mode that visualizes trends and seasonal anomalies without hiding caveats.

---

## Constraints

### Scientific & Technical
- Adhere strictly to [AGENTS.md](../AGENTS.md) and [docs/SCIENTIFIC_RULES.md](../docs/SCIENTIFIC_RULES.md).
- Initial release core: D1 (MERRA-2 `M2TMNXSLV` v5.12.4, `T2M`) and D2 (GPM IMERG Final `GPM_3IMERGM` v07).
- Supporting extensions: D3 (MODIS `MOD11A2.061`) and D4 (MODIS `MOD13A3.061`).
- Must handle leap years, month-length weighting, missingness flags, and product-specific fill masks.

### Execution Protocol
- Strict adherence to GSD: `SPEC -> PLAN -> EXECUTE -> VERIFY -> COMMIT`.
- Search-first context discipline to preserve agent reasoning efficiency.

---

## Success Criteria

- [x] Machine-readable schemas validated for `InvestigationRecord`, `DatasetManifest`, and `AnalysisResult`.
- [x] Initial dataset manifests created for D1, D2, D3, and D4 NASA products.
- [ ] Core data adapters ingest sample granules and verify dimensions, units, and fill values.
- [ ] Numerical reference tests pass for HAC standard errors and paired contrast estimators.
- [ ] End-to-end reproducible investigation runs locally and exports valid JSON and CSV bundles.

---

## Key Decisions

| Decision | Choice | Rationale | Date |
|----------|--------|-----------|------|
| Active Challenge | Be An Earth System Trend Detective! | Supplied project brief and completed 46-page scientific blueprint | 2026-09-24 |
| Core Datasets | MERRA-2 T2M + GPM IMERG Final | Balanced model-assimilation history and high-quality satellite precipitation with lower ingestion risk | 2026-09-24 |
| Regional Contrasts | Paired Difference Estimator | Scientifically invalid to infer slope differences from separate p-values | 2026-09-24 |
| Execution Framework | Get Shit Done (GSD) for Antigravity | Disciplined spec-first execution with automated state tracking and empirical proof | 2026-09-24 |

---

*Status: FINALIZED*
