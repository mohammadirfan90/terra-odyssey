# Terra Odyssey — User Guide & Investigation Manual

Welcome to **Terra Odyssey**! This guide walks you through using the interactive workspace to investigate Earth system trends using authoritative NASA Earth observation and reanalysis data.

---

## 1. Getting Started in 3 Steps

1. **Launch the Workspace**:
   Navigate to the web interface (default: `http://localhost:3000`). The global interactive map renders historical trend baselines immediately.
2. **Formulate a Question**:
   Click **Options** in the top navigation or choose a pre-reviewed inquiry from the search bar (e.g. *Mediterranean vs. Northern Europe Warming (2000–2024)*).
3. **Inspect the Evidence**:
   Open the **Evidence Drawer** to review decadal effect sizes, 95% HAC confidence intervals, paired contrast metrics, and statistical significance without confusing correlation with causation.

---

## 2. Interactive Workspace Walkthrough

```
┌────────────────────────────────────────────────────────────────────────┐
│ [Search Bar]  Find candidate questions or presets...      [v0.1.0-mvp] │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│                       Interactive Earth Map                            │
│    - Drag bounding boxes to define Region A (cyan) and Region B (amber)│
│    - Click any cell to inspect local trend and observational count     │
│    - Toggle 2D Mercator or 3D Globe projection                         │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│ [Options Panel]         │ [Evidence Drawer]                            │
│ Dataset & Variable      │ Decadal Trend Slope & SE                     │
│ Date Range Picker       │ 95% Autocorrelation-Consistent CI            │
│ Regional Bounds A & B   │ Paired Contrast Difference (A − B)           │
│ Estimator Selection     │ Multiple Testing & Method Diagnostics        │
├─────────────────────────┴──────────────────────────────────────────────┤
│ Linked Time Series Chart (Regional Historical Series + Trend Line)     │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1 The Global Trend Map
- **Basemap Navigation**: Pan and zoom smoothly around the planet. The vector basemap operates via OpenFreeMap with zero third-party tracking or API keys required.
- **Raster Trend Overlay**: Color-coded global cells show estimated decadal rates of change. Cool blues indicate negative trends; warm reds indicate positive trends.
- **Cell Inspector**: Click any grid point to view its exact coordinates, estimated decadal slope, standard error, raw p-value, and total valid observation count.
- **Study Region Drawing**: Use the region drawing tool to draw bounding boxes directly on the map for Region A (primary study area) and optional Region B (contrast study area).

### 2.2 Question Builder
When defining a custom inquiry:
1. **Choose a NASA Dataset**:
   - `MERRA-2 2-Meter Air Temperature`: Model reanalysis of global near-surface atmospheric thermal state from 1980 to present.
   - `GPM IMERG Final Precipitation`: High-resolution satellite microwave-infrared precipitation estimates with surface gauge calibration from 2000 to present.
   - `MODIS Land Surface Temperature (MOD11A2)`: Direct satellite infrared radiometer skin temperature.
   - `MODIS Vegetation Indices (MOD13A3 NDVI)`: Terrestrial photosynthetic activity and greenness dynamics.
2. **Select Temporal Coverage**: Choose start and end years within the product's valid operational life.
3. **Select Statistical Estimator**:
   - `OLS with HAC`: Ordinary least squares linear trend paired with Newey-West standard errors to guard against autocorrelation.
   - `Theil-Sen Robust Estimator`: Median of all pairwise slopes, resistant to outliers and non-Gaussian error tails.
   - `Modified Mann-Kendall`: Non-parametric rank trend test with Hamed & Rao variance correction for lag-$k$ serial correlation.
   - `Moving Block Bootstrap`: Empirical resampling of contiguous temporal blocks for non-parametric uncertainty estimation.

---

## 3. How to Interpret the Evidence

Earth system data is complex and subject to physical and observational nuances. Terra Odyssey provides explicit scientific guardrails:

### 3.1 Autocorrelation Awareness
Environmental measurements (such as air temperature or sea surface warmth) exhibit strong serial correlation—one warm month tends to follow another.
> [!IMPORTANT]
> Standard OLS $t$-tests assume independent errors ($\rho = 0$). In autocorrelated series, standard tests drastically underestimate uncertainty and produce false-positive trend declarations. Terra Odyssey always applies HAC covariance or lag-$k$ variance corrections.

### 3.2 Paired Contrast vs. Single Region Analysis
A common analytical error is observing a statistically significant trend in Region A ($p < 0.05$) and a non-significant trend in Region B ($p > 0.05$), and concluding that the two regions are trending differently.
> [!WARNING]
> The difference between "significant" and "not significant" is not itself statistically significant! Terra Odyssey evaluates the paired contrast $(\beta_A - \beta_B)$ and its joint covariance before declaring a regional divergence.

### 3.3 Effect Sizes Over P-Values
"Not statistically significant" does **not** mean "no change". A flat trend with narrow bounds is evidence of stability; an inconclusive trend with wide bounds indicates insufficient observational precision or high noise. Look first at the estimated decadal slope and its 95% confidence interval.

---

## 4. Exporting Reproducible Records

Terra Odyssey guarantees full provenance and scientific reproducibility for every investigation.
Click **Export** in the Evidence Drawer to retrieve:
- **JSON Investigation Record**: Self-contained machine-readable file with input arguments, DAAC URLs, grid resolutions, calibration constants, and estimator parameters.
- **CSV Data Tables**: Harmonized regional monthly time series, deseasonalized anomalies, and fitted trend lines.
- **Executive Scientific Brief (Markdown)**: Complete summary text ready for reports, policy briefs, or classroom discussion.
