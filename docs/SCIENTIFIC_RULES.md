# Scientific rules — must not be weakened by generated code

## Estimand first

Every result must declare variable, units, source release, geometry, temporal
interval, temporal aggregation, spatial aggregation, estimator, and intended
interpretation. A slope is a summary of the selected interval, not a forecast.

## Data layers

Keep these layers separate:

1. source observation or model output;
2. normalized and quality-filtered value;
3. temporal/spatial summary;
4. statistical estimate and uncertainty;
5. scientific interpretation;
6. optional mechanism hypothesis.

Never let a generated narrative hide which layer supports a sentence.

## Time and missingness

- Use one declared calendar and common time support for comparisons.
- Require complete annual totals when the estimand is annual accumulation.
- Weight monthly means by days; convert precipitation rates using exact month
  hours before annual summation.
- Do not treat a missing month as zero.
- Do not silently interpolate a production trend series.
- Show coverage and valid counts next to every result.

## Quality and products

- Apply each product’s documented fill and quality mask before aggregation.
- Preserve raw metadata, scale factors, QA policy, release, and retrieval time.
- Label MERRA-2 as reanalysis/model-data-assimilation output.
- Label MODIS LST as clear-sky land-surface temperature, not air temperature.
- Label NDVI/EVI as spectral vegetation indices, not yield or carbon uptake.
- Keep day/night LST separate and do not hide orbit or compositing limitations.

## Trend inference

- Report slope in physical units per decade plus the fitted change over the
  interval and an uncertainty interval.
- Inspect residuals and serial dependence. Use HAC or a defensible block method
  when the record and estimator support it.
- Use robust or nonparametric sensitivity checks where outliers or non-normality
  make a single OLS result fragile.
- Define the test family before searching a global map or many regions.
- Control false discovery rate or use another declared family-wise policy.
- Distinguish practical magnitude, statistical evidence, and detection power.
- “Not detected” means evidence was insufficient under the declared design; it
  does not prove that the physical change is zero.

## Spatial comparison

- Keep a native footprint and a declared common analysis grid.
- Use area weights that match the grid and valid support.
- Neighboring cells are spatially dependent; do not count them as independent
  replications without a spatial method.
- A positive slope in one region and a negative slope in another is a candidate
  contrast, not proof. Estimate the paired regional difference.
- If a region pair was selected after map search, preserve and disclose the
  selection history; the follow-up is not independent confirmation.

## Interpretation language

Allowed labels: observed trend, statistical association, spatial contrast,
co-variation, plausible mechanism, or published causal evidence. Do not write
“caused by” unless a separate causal design and source support it. Generated
text may summarize typed result fields but may not invent a mechanism, p-value,
dataset, or certainty level.

