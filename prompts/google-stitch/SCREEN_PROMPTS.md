# Screen-by-screen Stitch prompts

Use one prompt at a time. After each output, refine one component or state,
then preserve the approved layout as the visual reference for the next screen.

## 1. Landing / question builder

```text
Create the landing screen for Terra Odyssey. The user is an environmental
analyst or advanced student who wants to investigate a NASA variable without
overstating the evidence. Use a concise headline, a three-step explanation
(choose data, inspect evidence, export finding), reviewed-variable cards for air
temperature and precipitation, a primary “Start investigation” action, and a
secondary “How the evidence works” action. Include a compact challenge statement
and a visible promise that the app reports uncertainty and limitations. Keep the
screen calm and scientific; avoid stock space imagery.
```

## 2. Investigation workspace

```text
Create the main investigation workspace for Terra Odyssey. Use a persistent
top bar with investigation name, source/version, date range, save, and export.
Place a left configuration rail for variable, period, temporal aggregation,
spatial support, and quality policy. Place a large map panel beside a linked
time-series panel. Under them place an evidence summary with effect size, units,
interval, valid count, coverage, and status. Add a methods drawer trigger and a
job-state stepper. Include realistic empty, loading, and inconclusive states
without inventing scientific numbers.
```

## 3. Trend map and region comparison

```text
Create a focused region-comparison screen. Show a signed slope map with a
separate evidence/coverage layer and a clear legend. Let the user select two
comparable regions; show two linked time-series charts, a paired difference chart,
and an evidence card that explains whether the regional slopes differ. Use
outline, hatch, or opacity for missing/weak support rather than relying on color.
Include a text table alternative and a visible note that map-selected regions
are exploratory and not independent confirmation.
```

## 4. Methods inspector

```text
Create a methods and provenance drawer for a selected investigation. Organize
the content into dataset identity and version, variable and units, temporal and
spatial support, QA/fill policy, aggregation, estimator, uncertainty method,
autocorrelation treatment, multiple-testing family, selection history, and
limitations. Use a readable scientific-report layout with copyable citation and
downloadable configuration actions. Make this feel inspectable, not like a
legal disclaimer.
```

## 5. Findings and export

```text
Create the findings/export screen for a completed Terra Odyssey investigation.
Lead with a qualified one-sentence finding generated from typed result fields,
then show effect size, units, interval, status, coverage, and the paired regional
contrast. Include tabs or sections for chart, data table, methods, sources, and
caveats. Provide export actions for JSON, CSV, image, and a concise report. Add
a clear “No supported opposite-trend pair found” state that is treated as a
valid scientific outcome.
```

