---
phase: 3
researched_at: 2026-09-27
discovery_level: 3
milestone: v0.2.0-trends
topic: Earth System Dataset Research, GIBS Map Layers, Agency Logos, and Chart Perfection
---

# Phase 3 Technical Research: Real Earth System Data Ingestion, Dynamic Map Layers, Agency Vector Logos, and Visual Telemetry Perfection

## Executive Objective

Fulfill the non-negotiable mission constraints for **Terra Odyssey**:
1. **Strict 100% Real Data Guarantee**: Strictly eliminate all synthetic, simulated, mock, or placeholder data from application runtime. Every number, coordinate, time step, and trend statistic must be read and computed from authoritative, versioned NASA and partner space agency records.
2. **Real NASA GIBS Map Layer Rendering**: When any dataset is opened or selected, its real satellite observation or reanalysis raster tile layer must dynamically mount and display on the MapLibre globe, synchronized with the date scrubber and spatial region.
3. **Space Agency Vector Logos**: Replace all plain agency text with crisp, official vector SVG insignias (NASA Meatball, ESA, JAXA, NOAA, Copernicus, USGS, NSIDC).
4. **Graph Perfection in Design**: Elevate the interactive D3 time-series telemetry chart to state-of-the-art visual standards (monotone cubic splines, HAC 95% confidence interval envelope, decadal trend slope overlay, silky-smooth mouse crosshair, and light-mode glassmorphic HUD).

---

## 1. Categorized NASA & Partner Earth System Dataset Registry

All datasets are categorized into six core scientific Earth system domains. Every entry specifies the exact space agency, mission instrument, DAAC collection, CMR concept ID, physical variables, native resolution, QA bitmasks, and real ingestion endpoint.

### Domain 1: Atmosphere & Atmospheric Dynamics (Temperature, Humidity, Winds, Radiation)

#### 1. MERRA-2 2-Meter Air Temperature (T2M)
- **Agency & Provider**: NASA Goddard Space Flight Center (GSFC) / GMAO / GES DISC
- **Collection / Version**: `M2TMNXSLV` v5.12.4
- **CMR Concept ID**: `C1276812859-GES_DISC`
- **DOI**: [10.5067/0J5VGD2HNNOO](https://doi.org/10.5067/0J5VGD2HNNOO)
- **Source Classification**: Atmospheric Reanalysis / Data Assimilation (Goddard Earth Observing System GEOS-5 with 3D-Var assimilation of satellite radiance and radiosondes).
- **Physical Variables**:
  - `T2M`: 2-meter air temperature ($K \rightarrow$ convert to °C: $T_{\text{°C}} = T_K - 273.15$)
  - `T2MDEW`: 2-meter dew point temperature (°C)
  - `TS`: Surface skin temperature (°C)
  - `U10M`, `V10M`: 10-meter eastward and northward wind speed ($m/s$)
  - `SLP`: Sea-level atmospheric pressure ($hPa$)
- **Coverage**: 1980-01-01 to present (~45+ years continuous record)
- **Native Resolution**: Global $0.5^\circ \times 0.625^\circ$ regular lat-lon grid (361 latitude $\times$ 576 longitude bins). Monthly means.
- **Fill / Mask Policy**: Fill value `1.0e15` masked to `NaN`. Calendar-day weighted annual means excluding pre-computed month 13 values.
- **Real Ingestion Method**:
  - Primary API: NASA POWER REST API (`https://power.larc.nasa.gov/api/temporal/monthly/regional`) returning verified NetCDF-4 granules.
  - Granule Archive: NASA GES DISC OPeNDAP server (`https://goldsmr4.gesdisc.eosdis.nasa.gov/opendap/MERRA2_MONTHLY/M2TMNXSLV.5.12.4/`).
- **GIBS WMTS Layer**: `MERRA2_2m_Air_Temperature_Assimilated_Monthly`
- **Statistical Estimator**: Ordinary Least Squares (OLS) with Newey-West HAC covariance ($L=1$), reporting slope in physical units/decade and 95% confidence intervals.

#### 2. GISS Surface Temperature Analysis (GISTEMP v4)
- **Agency & Provider**: NASA Goddard Institute for Space Studies (GISS)
- **Collection / Version**: `GISTEMP_V4` v4.0
- **CMR Concept ID**: `GISTEMP_V4_ANOMALY`
- **DOI**: [10.2767/92882](https://doi.org/10.2767/92882)
- **Source Classification**: Surface In-Situ + Satellite Blended Anomaly Analysis (GHCN-v4 + ERSSTv5)
- **Physical Variables**:
  - `temperature_anomaly`: Surface air temperature anomaly relative to the 1951–1980 base period (°C).
- **Coverage**: 1880-01-01 to present (145 continuous years)
- **Native Resolution**: Global $2.0^\circ \times 2.0^\circ$ grid (250 km radius spatial smoothing)
- **Real Ingestion Method**: NASA GISS direct NetCDF archive (`https://data.giss.nasa.gov/gistemp/grids/`).

---

### Domain 2: Hydrology & Precipitation (Rainfall, Snowfall, Water Storage)

#### 3. GPM IMERG Final Precipitation (Integrated Multi-satellitE Retrievals for GPM)
- **Agency & Provider**: NASA GSFC / JAXA (GPM Mission Partner) / GES DISC
- **Collection / Version**: `GPM_3IMERGM` v07 (Final Run)
- **CMR Concept ID**: `C2723754851-GES_DISC`
- **DOI**: [10.5067/GPM/IMERG/3B-MONTH/07](https://doi.org/10.5067/GPM/IMERG/3B-MONTH/07)
- **Source Classification**: Satellite Microwave/Infrared Retrieval with Monthly GPCC Gauge Calibration
- **Physical Variables**:
  - `precipitationCal`: Multi-satellite precipitation rate with gauge calibration ($mm/hr$).
    *Conversion Equation*: Accumulation for month $m$ is $P_m = \text{precipitationCal} \times H_m$, where $H_m \in \{672, 696, 720, 744\}$ is the exact number of hours in that calendar month.
    *Annual Total*: $\sum_{m=1}^{12} P_m$ ($mm/year$), requiring all 12 months valid.
  - `precipitationUncal`: Uncalibrated satellite precipitation estimate ($mm/hr$)
  - `probabilityLiquidPrecipitation`: Phase diagnosis percentage ($0–100\%$)
  - `gaugeRelativeWeighting`: Surface gauge weighting percentage ($0–100\%$)
- **Coverage**: 2000-06-01 to present (~24+ complete calendar years: 2001–2024)
- **Native Resolution**: Global $0.1^\circ \times 0.1^\circ$ geographic grid ($-60^\circ$ to $+60^\circ$ latitude)
- **Fill / Mask Policy**: Fill value `-9999.9` masked to `NaN`. Complete-year validation strictly rejects partial years.
- **Real Ingestion Method**: NASA GES DISC OPeNDAP (`https://gpm1.gesdisc.eosdis.nasa.gov/opendap/GPM_L3/GPM_3IMERGM.07/`).
- **GIBS WMTS Layer**: `IMERG_Precipitation_Rate` (Level 6 Web Mercator PNG tiles).
- **Statistical Estimator**: Annual accumulation OLS+HAC trend, with paired regional contrast estimator ($H_0: \beta_{\text{Region A}} - \beta_{\text{Region B}} = 0$) evaluating wet-get-wetter / dry-get-drier hypotheses.

#### 4. GRACE / GRACE-FO Terrestrial Water Storage Mascons
- **Agency & Provider**: NASA JPL / GFZ Potsdam / PO.DAAC
- **Collection / Version**: `TELLUS_GRAC_L3_JPL_RL06_MONTHLY` & `TELLUS_GRFO_L3_JPL_RL06_MONTHLY`
- **CMR Concept ID**: `C2016335231-PODAAC`
- **DOI**: [10.5067/TEMSC-3JC64](https://doi.org/10.5067/TEMSC-3JC64)
- **Source Classification**: Satellite Gravimetry (K-Band Ranging inter-satellite distance perturbations)
- **Physical Variables**:
  - `lwe_thickness`: Liquid water equivalent thickness anomaly ($cm$ water relative to 2004–2009 mean baseline).
  - `uncertainty`: Mascon solution formal 1-sigma uncertainty ($cm$).
- **Coverage**: GRACE (2002-04 to 2017-06), GRACE-FO (2018-06 to present).
- **Critical Scientific Constraint**: 11-month observation gap (2017-07 to 2018-05). Interpolating this gap is scientifically invalid and strictly forbidden. Analysis uses interrupted time series modeling.
- **Native Resolution**: $0.5^\circ$ equal-area mascons (JPL RL06M).
- **Real Ingestion Method**: PO.DAAC Drive / Cloud S3 bucket (`podaac-ops-cumulus-protected`).

---

### Domain 3: Land Surface & Terrestrial Biosphere (Skin Temperature, Vegetation)

#### 5. MODIS Land Surface Temperature (MOD11A2)
- **Agency & Provider**: NASA GSFC / USGS / LP DAAC
- **Collection / Version**: `MOD11A2` v061 (Terra MODIS)
- **CMR Concept ID**: `C2269056084-LPCLOUD`
- **DOI**: [10.5067/MODIS/MOD11A2.061](https://doi.org/10.5067/MODIS/MOD11A2.061)
- **Source Classification**: Thermal Infrared Satellite Radiometry
- **Physical Variables**:
  - `LST_Day_1km`: Daytime clear-sky land surface skin temperature ($K \rightarrow$ convert to °C with scale factor 0.02: $T_{\text{°C}} = \text{raw} \times 0.02 - 273.15$)
  - `LST_Night_1km`: Nighttime clear-sky land surface skin temperature (°C)
  - `QC_Day`, `QC_Night`: 8-bit quality control flags (bits [0-1]: QA word, bits [2-3]: data quality).
- **Coverage**: 2000-02-18 to present
- **Native Resolution**: 1 km sinusoidal projection tiles (h/v grid). 8-day composite.
- **Critical Scientific Constraint**: Day and night LST must never be blended into a simple average. Clear-sky sampling bias must be documented.
- **Real Ingestion Method**: NASA LP DAAC AppEEARS API (`https://appeears.earthdatacloud.nasa.gov/api/`) or CMR S3 direct access.
- **GIBS WMTS Layer**: `MODIS_Terra_LST_Day_8Day` (Level 7 Web Mercator PNG tiles).

#### 6. MODIS Vegetation Indices (MOD13A3 NDVI / EVI)
- **Agency & Provider**: NASA GSFC / USGS / LP DAAC
- **Collection / Version**: `MOD13A3` v061
- **CMR Concept ID**: `C2327962326-LPCLOUD`
- **DOI**: [10.5067/MODIS/MOD13A3.061](https://doi.org/10.5067/MODIS/MOD13A3.061)
- **Source Classification**: Optical Multispectral Radiometry (Red & Near-Infrared surface reflectance)
- **Physical Variables**:
  - `1 km monthly NDVI`: Normalized Difference Vegetation Index (scale factor: 0.0001, valid range: -0.2 to 1.0)
  - `1 km monthly EVI`: Enhanced Vegetation Index (scale factor: 0.0001)
  - `pixel reliability`: 0 = Good data, 1 = Marginal, 2 = Snow/Ice, 3 = Cloudy, -1 = Fill.
- **Coverage**: 2000-02-01 to present
- **Native Resolution**: 1 km sinusoidal projection tiles. Monthly composite.
- **Real Ingestion Method**: NASA LP DAAC AppEEARS / CMR direct archive.
- **GIBS WMTS Layer**: `MODIS_Terra_NDVI_Monthly` or `MODIS_Terra_CorrectedReflectance_TrueColor`.

---

### Domain 4: Cryosphere & Polar Ice (Sea Ice, Snow Cover)

#### 7. NOAA/NSIDC Sea Ice Index (Version 4)
- **Agency & Provider**: NSIDC (National Snow and Ice Data Center) / NOAA NCEI
- **Collection / Version**: `G02135` v4.0
- **CMR Concept ID**: `NSIDC_G02135_V4`
- **DOI**: [10.7265/N5K072F8](https://doi.org/10.7265/N5K072F8)
- **Source Classification**: Multi-Sensor Passive Microwave Radiometry (SMMR, SSM/I, SSMIS)
- **Physical Variables**:
  - `extent`: Sea area with ice concentration $\ge 15\%$ ($10^6\text{ km}^2$).
  - `area`: Total integrated sea ice area ($10^6\text{ km}^2$).
  - Hemispheres: Northern Hemisphere (Arctic) & Southern Hemisphere (Antarctic).
  - Annual Indicators: September Arctic Minimum, March Arctic Maximum.
- **Coverage**: 1978-11-01 to present (46 continuous years).
- **Native Resolution**: Polar stereographic 25 km grid. Monthly means.
- **Real Ingestion Method**: NSIDC HTTPS open archive (`https://masie_web.apps.nsidc.org/pub/DATASETS/NOAA/G02135/`).
- **GIBS WMTS Layer**: `Sea_Ice_Concentration_North` and `Sea_Ice_Concentration_South`.
- **Statistical Estimator**: Sen's nonparametric slope with Yue-Pilon pre-whitening and Mann-Kendall trend significance test.

---

### Domain 5: Ocean & Marine Surfaces (Sea Surface Temperature)

#### 8. NOAA Daily Optimum Interpolation Sea Surface Temperature (OISST v2.1)
- **Agency & Provider**: NOAA NCEI (National Centers for Environmental Information)
- **Collection / Version**: `NOAA_OISST_V2.1` v2.1
- **CMR Concept ID**: `NOAA_NCEI_OISST_AVHRR_V2.1`
- **DOI**: [10.25921/RE9P-PT57](https://doi.org/10.25921/RE9P-PT57)
- **Source Classification**: Blended Satellite (AVHRR) + In-Situ (Ships, Buoys, Argo floats) Optimum Interpolation
- **Physical Variables**:
  - `sst`: Sea surface temperature (°C).
  - `anom`: Daily SST anomaly relative to 1971–2000 climatology (°C).
  - `err`: Estimated standard error of the OI analysis (°C).
- **Coverage**: 1981-09-01 to present (43+ continuous years).
- **Native Resolution**: Global $0.25^\circ \times 0.25^\circ$ marine grid.
- **Real Ingestion Method**: NOAA NCEI THREDDS / OPeNDAP server (`https://www.ncei.noaa.gov/thredds/dodsC/OisstBase/NetCDF/V2.1/AVHRR/`).
- **GIBS WMTS Layer**: `GHRSST_L4_MUR_Sea_Surface_Temperature`.

---

### Domain 6: Earth Radiation Budget & Energy Imbalance

#### 9. CERES Energy Balanced and Filled (EBAF Ed4.2.1)
- **Agency & Provider**: NASA Langley Research Center / Atmospheric Science Data Center (ASDC)
- **Collection / Version**: `CERES_EBAF-TOA` Edition 4.2.1
- **CMR Concept ID**: `CERES_EBAF_ED4.2`
- **DOI**: [10.5067/TERRA+AQUA/CERES/EBAF-TOA_L3B004.2](https://doi.org/10.5067/TERRA+AQUA/CERES/EBAF-TOA_L3B004.2)
- **Source Classification**: Broadband Satellite Radiometry (Terra & Aqua CERES instruments)
- **Physical Variables**:
  - `toa_net_all_mon`: Net downward top-of-atmosphere radiative flux ($W/m^2$, planetary energy imbalance).
  - `solar_mon`: Incoming solar irradiance ($W/m^2$).
  - `toa_lw_all_mon`: Outgoing longwave radiation ($W/m^2$).
- **Coverage**: 2000-03-01 to present (~25 continuous years).
- **Native Resolution**: Global $1.0^\circ \times 1.0^\circ$ grid. Monthly means.
- **Real Ingestion Method**: NASA ASDC OPeNDAP / Direct HTTPS download.

---

## 2. Dynamic Map Layer Architecture (NASA GIBS WMTS Integration)

### The Architectural Problem
In the initial implementation:
1. `EarthTrendMap.tsx` and `EarthTrendMapWrapper.tsx` rendered only vector basemaps (OpenFreeMap).
2. When the user selected a dataset (e.g. MERRA-2, GPM IMERG, MODIS LST, or NSIDC Sea Ice), **zero raster layers were added to MapLibre**.
3. `buildGibsTileUrl` existed in `frontend/lib/map/gibs-layers.ts` but had no connection to MapLibre's rendering lifecycle.

### The Technical Solution
1. **Prop & State Wiring**:
   - Forward `selectedDataset` and `mapDate` from `useInvestigationState()` down to `EarthTrendMapWrapper` and `EarthTrendMap`.
   - Read the dataset's `gibs_layer` from the catalog.
2. **MapLibre Raster Source Lifecycle**:
   - When a dataset with `gibs_layer` is active, compute the tile URL template:
     `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{gibs_layer}/default/{mapDate}/{tileMatrixSet}/{z}/{y}/{x}.{format}`
   - Register source `nasa-gibs-raster-source` and layer `nasa-gibs-raster-layer` with type `"raster"`.
   - Place `nasa-gibs-raster-layer` **below** vector labels, administrative boundaries, and custom user-drawn polygon paths, ensuring clear geographic visibility.
3. **Smooth Tile Swapping & Date Scrubbing**:
   - When the user scrubs the timeline or switches datasets, MapLibre's raster tile source updates via `(map.getSource('nasa-gibs-raster-source') as maplibregl.RasterTileSource).setTiles([newTileUrl])`.
   - Include a layer opacity slider ($0\% - 100\%$) and visibility toggle directly in the on-map HUD.

---

## 3. Space Agencies Vector SVG Logo System

### Requirements
Replace all plain text agency badges (e.g. `"NASA GES DISC / GMAO"`, `"NOAA NCEI"`, `"NASA LP DAAC"`) with high-fidelity, scalable vector SVG logos that look stunning in both light and dark backgrounds.

### Implemented Logo Specifications
Create `frontend/components/icons/AgencyLogos.tsx` containing:
1. **NASA ("Meatball") Insignia**:
   - Official Pantone 286 Blue circular field (`#0b3d91`).
   - Stylized stars constellation.
   - Red aeronautical vector chevron (`#fc3d21`).
   - White elliptical orbital path.
   - Serif NASA wordmark.
2. **ESA (European Space Agency)**:
   - Official deep navy circular emblem with stylized orbital globe curve.
3. **JAXA (Japan Aerospace Exploration Agency)**:
   - Signature ultramarine dynamic wing and orbital curve mark (`#005bac`).
4. **NOAA (National Oceanic and Atmospheric Administration)**:
   - Dual-tone ocean blue / sky blue roundel with white sea gull and waves.
5. **Copernicus Programme**:
   - European Union Earth Observation circular sunburst emblem (`#003399` & `#fdb813`).
6. **USGS (United States Geological Survey)**:
   - Deep forest green emblem (`#006633`) with official monogram.
7. **NSIDC (National Snow and Ice Data Center)**:
   - Crisp cyan polar snowflake and navigation compass star emblem (`#0284c7`).

### Integration Touchpoints
- Top navigation header: Agency insignia beside dataset title.
- Activity Dock dataset picker: Crisp agency logo inside selector button and each dropdown row.
- Dataset Catalog modal: Agency logos alongside collection versions.
- Telemetry footer: Crisp vector logo replacing plain agency text.

---

## 4. D3 Time-Series Graph Design & Perfection

### Visual Standards
1. **Monotone Cubic Spline Interpolation**:
   - Eliminate jagged polyline segments using D3 `curveMonotoneX` for natural physical continuity.
2. **HAC 95% Confidence Interval Envelope**:
   - Render a shaded semi-transparent ribbon between lower and upper confidence bounds:
     `fill="rgba(2, 132, 199, 0.12)"`, bounded by dashed stroke guidelines.
3. **Authoritative Decadal Trend Slope Overlay**:
   - Draw the fitted Newey-West HAC OLS slope line ($\hat{y}_t = \hat{\beta}_0 + \hat{\beta}_1 (t - t_0)$) with direct annotation of rate of change: e.g. `+0.37 °C / decade (p = 0.002)`.
4. **Interactive Scrubber & Dynamic Crosshair**:
   - Vertical hair-line tracker synchronized with mouse movement.
   - Dual-halo cursor with pulse beacon on active year point.
   - Direct two-way sync: hovering on the chart scrubs the map date and updates the on-map GIBS imagery.
5. **Light Mode Tooltip HUD**:
   - Glassmorphic card displaying Year, Region A, Region B, Decadal delta, and statistical confidence.

---

## 5. Strict Real-Data Enforcement Strategy

### Zero-Mock Elimination Plan
1. **Backend Pipeline**:
   - Remove `_get_synthetic_cube` fallback branch from production execution in `backend/src/backend/stepper.py`.
   - Default `execution_mode` to `auto`, requiring verified NetCDF granules or real NASA API queries.
   - For datasets pending full quantitative pipeline activation, return explicit, informative `UnsupportedDatasetError` detailing the collection concept ID, DOI, and scheduled pipeline phase. Never manufacture fake numbers.
2. **Frontend UI**:
   - Disallow any hardcoded sample/mock arrays.
   - Ensure the chart and table render only verified backend responses.

---

## Decisions Made

| Decision | Choice | Rationale |
|---|---|---|
| Map raster layer engine | Native MapLibre raster source via NASA GIBS WMTS | Directly renders real satellite imagery for any date without custom tiling servers |
| Agency branding | Pure SVG vector components | Crisp at any resolution, zero external network image dependencies |
| Chart interpolation | D3 monotone cubic splines (`curveMonotoneX`) | Preserves physical monotonicity and eliminates artificial spline ringing |
| Uncertainty visualization | HAC 95% shaded confidence interval envelope | Conveys true observational and serial autocorrelation uncertainty |
| Real data guarantee | Hard rejection of synthetic fallbacks in production | Guarantees scientific integrity and compliance with NASA challenge guidelines |

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| NASA GIBS rate-limiting or downtime | Satellite tiles fail to load on map | Graceful fallback to vector basemap with clear status banner |
| Upstream NASA POWER API latency | Regional NetCDF download takes 5–10s | SQLite WAL caching with SHA-256 integrity verification |
| High-density screen rendering jank | Chart scrubber stutters on scrub | Use `requestAnimationFrame` and CSS hardware-accelerated transforms |
