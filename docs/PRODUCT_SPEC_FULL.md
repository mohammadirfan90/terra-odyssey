# Earth System Trend Detective
## Scientific product specification and implementation blueprint
Research date 24 September 2026 • Product horizon eight weeks • Intended team four to six students with scientific review

Build an investigation workspace that helps a user distinguish a measurable environmental trend from sampling artefacts and ordinary variability, compare regions, and export the evidence needed to reproduce the conclusion. The recommended first release combines NASA MERRA-2 near-surface air temperature with GPM IMERG precipitation. Add quality-filtered MODIS surface temperature and vegetation for selected regional investigations after the statistical core passes validation.

The proposed product name is **Terra Odyssey**, with the subtitle **Investigate environmental change with NASA data**. Its differentiation is a reproducible chain from data quality to effect size, uncertainty, regional contrast and a qualified finding. This is product integration and scientific communication novelty; it is not a claim to have invented a new statistical estimator.

This blueprint specifies a product to build. It does not report newly computed environmental trends, verified application performance or completed scientific validation. All demonstration scenarios are research protocols until the real data have been processed. Numerical engineering targets and quality thresholds are proposed acceptance criteria, not NASA requirements.

**Competition timing matters.** Official 2026 event pages identify 14–15 November 2026 as the hackathon dates and 28 October 2026 as the release date for complete challenge descriptions. Published local-event guidance says teams may not develop the solution they intend to submit before the event. The eight-week roadmap is therefore a standalone product-development plan, or a post-event continuation plan. It must not be presented as permission to submit eight weeks of prebuilt work. Verify the central participant rules and final challenge resources when released; retain the original challenge text below. [1–3]

## Reading guide
Sections 1–7 establish the scientific purpose and audience. Sections 8–14 specify datasets and inference. Sections 15–20 define the product experience. Sections 21–26 describe implementation and validation. Sections 27–35 turn the design into investigations, delivery work and judging evidence. Section 36 contains the numbered sources cited throughout.

# 1 Exact challenge statement
[Change is always occurring in the Earth’s interconnected environmental system, and when it runs in a consistent direction – rising or falling, increasing or decreasing, thickening or thinning – measured variables reflect it. But a variable can trend one way in one region and the opposite way in another, even when the same process drives both. Your challenge is to find and examine variables measured by NASA missions or produced by NASA models, visualize how they change over time, and determine what is changing, where it is changing, how much it is changing, and if these changes are what scientists call “significant.”]

The passage above is the supplied challenge statement, preserved verbatim. The following sections are interpretation and design requirements, not replacement wording. The full official brief, when released, may add constraints or resources. [1–3]

# 2 Sentence and phrase interpretation
## Sentence one
The first sentence establishes a changing, interconnected system and describes directional change through measured variables. It supplies scientific framing rather than a demand to implement every Earth-system domain. A strong application separates the physical quantity from the instrument, retrieval algorithm, sampling process and temporal summary that make it observable.

| Phrase | Scientific implication | Demonstration and measurable output |
| Change is always occurring | Variability includes seasons, weather, disturbances and persistent changes; change alone is not a trend. | Plot original observations and seasonal summaries; disclose record length and missingness. |
| Earth’s interconnected environmental system | Variables can interact through energy, water and biological processes. | Compare at least two physically relevant quantities on compatible support; label associations. |
| Consistent direction | A statistical tendency need not increase at every time step or remain linear indefinitely. | Report fitted slope over an explicit interval, residuals and sensitivity to start and end dates. |
| Rising or falling and increasing or decreasing | Direction depends on quantity, units, reference and spatial support. | Signed slope in physical units per decade, with no automatic good or bad label. |
| Thickening or thinning | Some variables describe stocks or geometry, not temperature or rainfall. | Maintain an extensible variable schema; do not force ice thickness into the first release. |
| Measured variables reflect it | Observations are imperfect proxies for environmental processes. | Identify measured, retrieved and modeled quantities and their quality limitations. |

**Explicit requirement and implied science.** Show temporal behavior and determine whether there is a directional tendency. Distinguish an anomaly from a trend: a warm month relative to a baseline is not itself evidence of persistent warming. A trend is a property of a specified variable, domain, period and estimator. A linear trend is a useful summary of that interval, not a forecast.

**Expected user and data capability.** An environmental analyst or student wants to know whether an apparent change is persistent enough to investigate. NASA archives supply repeated observations and model histories; the application must make their temporal support visible. MERRA-2 provides a long, regularly gridded model-assimilation history, while MODIS supplies remotely sensed surface quantities with sampling limitations. [4–9]

**Weak versus strong interpretation.** A weak response animates imagery or joins two endpoints. A strong response shows the full record, applies variable-specific quality controls, estimates a rate, evaluates uncertainty and exposes interval sensitivity. Common mistakes include treating seasonal cycles as trends, interpreting every short decline as climate change, equating a satellite retrieval with a direct ground measurement and allowing smoothing to create apparent evidence.

**Scientific questions and acceptance evidence.** Is the tendency monotonic enough for a single slope to summarize it? Does it survive removal of seasonality and plausible analysis changes? Deliver a time series, slope, interval, valid-observation count, coverage plot and methodological status. These outputs are necessary even when the finding is inconclusive.

## Sentence two
The second sentence explicitly demands attention to spatial heterogeneity. It also warns against assuming that common physical forcing produces a uniform regional response. It does not require the application to establish the cause of each observed contrast.

| Phrase | Scientific implication | Demonstration and measurable output |
| One way in one region | Spatial support matters; a country, basin and grid cell answer different questions. | Preserve region geometry, area weighting, native footprint and analysis grid. |
| The opposite way in another | Global or continental averages can hide local differences. | Compare positive and negative slopes for the same variable, interval and method. |
| Even when the same process drives both | Environmental responses depend on regional conditions; cause requires separate evidence. | Offer sourced possible mechanisms, with a hypothesis label and alternative explanations. |

**Explicit requirement and implied science.** The application must compare spatially distinct trends and avoid suggesting that the global average describes every location. The regional means must be comparable: different seasons, observation times or missing-data patterns can create a false contrast. Spatial autocorrelation means neighboring grid cells are not independent replications.

**Expected user and data capability.** A communicator wants to explain why two regions differ. Spatially gridded NASA products support maps and region summaries. Use common dates, fixed variable definitions and consistent masks, then display actual spatial coverage.

**Weak versus strong interpretation.** A weak map assigns red and blue to raw slopes and claims a meaningful regional difference. A strong comparison reports each region’s slope and uncertainty and estimates the slope of the paired regional difference series. One significant slope and one nonsignificant slope do not, by themselves, prove the slopes differ. Opposite point estimates with broad intervals are candidates for investigation, not established opposing changes.

**Scientific questions and acceptance evidence.** Are opposite signs supported after quality checks and multiplicity control? Is the contrast stable across sensible boundaries and periods? The product must return two linked series, a regional difference estimate, its uncertainty, area coverage and a record of how the pair was selected. It must be able to return “No supported opposite-trend pair found.”

## Sentence three
The third sentence defines the operational task. Its verbs require a complete path from finding suitable data to drawing a qualified conclusion. NASA missions and NASA models are alternatives in the wording; both are useful, but neither is a guarantee of trend suitability.

| Phrase | Literal requirement | Strong implementation and common failure |
| Find and examine variables | Discover a suitable scientific quantity and inspect it. | Catalog with units, coverage, retrieval or model provenance and quality rules; avoid an uncurated list of thousands of layers. |
| Measured by NASA missions | Use substantive NASA mission data. | IMERG precipitation or MODIS products drive calculations; NASA imagery as decoration is insufficient. |
| Produced by NASA models | Model outputs are allowed. | MERRA-2 is explicitly labeled reanalysis; do not call modeled air temperature a direct satellite thermometer measurement. |
| Visualize how they change over time | Expose temporal evidence. | Linked series, anomalies and interval controls; a static trend map alone is incomplete. |
| What is changing | Name the quantity precisely. | Near-surface air temperature, clear-sky land surface temperature and greenness are distinct variables. |
| Where it is changing | Preserve spatial context. | Grid or polygon result with footprint and boundaries; a national average is not a farm measurement. |
| How much it is changing | Quantify effect size. | Units per decade plus fitted change across the interval and uncertainty; avoid unlabeled scores. |
| Significant | Evaluate statistical evidence with assumptions stated. | Autocorrelation-aware inference, multiple-test correction and practical context; avoid treating p below 0.05 as proof. |

**Expected user and questions.** A technically capable nonspecialist wants an answer they can explain and reproduce: which quantity, where, during which years, at what rate, with what evidence and limitations? The app must state when it cannot answer.

**Required outputs.** Every accepted finding includes dataset release, variable, geometry, period, temporal and spatial aggregation, estimator, trend units, uncertainty interval, raw test result when valid, adjustment family when relevant, quality diagnostics and citations. These fields become the Investigation Record in Section 25.

# 3 Scientific problem definition
Environmental datasets are abundant, but a visually persuasive pattern can be produced by seasonal sampling, shifting observation coverage, serial dependence, sensor changes or selective choice of dates. The user problem is to convert a plausible visual question into a reproducible assessment whose strength and limits are apparent.

The analysis target is the average change in a defined environmental variable over a defined period and spatial support. The target is not automatically an externally forced climate response. Natural internal variability, human land-use changes and observational changes can contribute. A statistical trend cannot disentangle these contributions on its own. MERRA-2 observing-system changes and Terra orbital changes make this distinction concrete. [10,11]

Keep five layers separate in the data model and interface: **observations or model output**, **derived summaries**, **statistical inference**, **scientific interpretation**, and **hypotheses**. An analysis result can be valid as a summary of a product while still being an incomplete description of the physical system.

Core questions are descriptive and comparative. Attribution to greenhouse gases, irrigation, deforestation or circulation requires additional designs, controls, models or published attribution studies. The first release does not calculate causal effects, future hazards, crop yields or individual health risks.

# 4 Project concept and differentiation
Terra Odyssey is a web investigation workspace for assessing regional environmental trends using NASA data, transparent statistical methods and exportable provenance. Its mission is to make a defensible environmental finding easier to produce and harder to overstate.

The flagship experience begins with a question such as whether precipitation is changing differently across two regions. Users examine a trend field, select comparable areas, inspect the full records, test the paired contrast, compare temperature and export a qualified finding. A companion regional module explores how surface temperature and vegetation vary together.

Existing NASA tools already solve important parts of this problem. Giovanni supports geophysical analysis and comparison; its documentation includes trend-line functionality and cautions about interpretation. AppEEARS extracts selected products and quality information. Earthdata Search and CMR discover holdings. The product must build upon those capabilities rather than claim that NASA lacks maps or time-series tools. [12–15]

| Existing capability | What to reuse or learn | Proposed product contribution |
| Giovanni | Data selection, time-series and comparison workflows | Explicit analysis eligibility, residual diagnostics, fixed multiplicity families and sensitivity history in one investigation |
| AppEEARS | Regional extraction and quality-layer delivery | Versioned adapters that turn extraction into defensible trend-ready series |
| Earthdata Search and CMR | Authoritative collection and granule discovery | A small reviewed catalog with known scientific limits |
| GISTEMP maps and analysis | Long-term temperature context | Explain why a local product trend and a global temperature indicator answer different questions |
| Scientific notebooks and GIS | Flexible specialist analysis | A guided route for users who cannot assemble their own pipeline |

These are proposed integration advantages, not results of a comprehensive usability trial. Before promising a competitive advantage, observe five target users attempting the same investigation in an existing tool and in the prototype. Measure completion, interpretation accuracy and whether exports retain enough information for another user to reproduce the result.

NASA’s contribution is central: the values, quality flags, model histories and scientific documentation determine the result. The product can support environmental reporting and education at broad scale without requiring local soil reports. Its impact is better evidence and interpretation; claims of money saved, disasters prevented or policy improved require subsequent deployment studies.

# 5 Goals and success criteria
| Goal | Release acceptance criterion | Evidence |
| Answer the challenge | Every finding answers quantity, place, period, direction, magnitude and statistical status | Completed traceability matrix and three reproducible investigations |
| Scientific correctness | All production variables have reviewed units, quality masks and processing rules | Adapter tests and signed scientific checklist |
| Valid inference | False-positive behavior and interval coverage satisfy the simulation criteria in Section 26 | Versioned validation report |
| Regional comparison | Same-variable, same-period comparison includes a paired slope contrast | Numerical comparison against a reference notebook |
| Reproducibility | Frozen inputs and configuration reproduce results within documented numeric tolerances | Independent rerun on a clean environment |
| User comprehension | At least four of five pilot users distinguish “not detected” from “no change” | Moderated usability tasks, not a population estimate |
| Responsiveness | Cached regional result p95 below two seconds on the declared test environment | Load-test report with data size and concurrency |
| Honest communication | No generated finding lacks data, method, caveat and source | Export and UI audit |

The thresholds in this table are product decisions. They do not certify the scientific truth of every result. A release may pass engineering tests and still require variable-specific scientific review.

# 6 Audiences and primary persona
The primary persona is an **environmental analyst or advanced student preparing a defensible regional explanation**. This user understands basic charts and geographic context but may not know how to correct temporal dependence or preserve satellite quality flags. Designing for this user forces scientific clarity while preserving enough depth for expert review.

| Audience and knowledge | Goal and discovery | Most relevant features | Hidden complexity and export |
| Students with basic statistics | Understand why a visible trend may be uncertain | Guided investigation, glossary, sensitivity comparison | Hide file formats and job scheduling; export annotated charts and methods |
| Educators | Teach seasons, variability and regional contrast | Saved lessons, fixed example configurations, accessible data table | Hide ingestion; export lesson links and worksheets |
| Citizen scientists | Investigate a familiar region responsibly | Polygon selection, plain-language evidence, data coverage | Hide projection mechanics; export a cited finding |
| Science communicators | Explain a pattern without overstating certainty | Comparison story, caveat templates, shareable snapshot | Hide job internals; export publication graphics and provenance |
| Researchers | Inspect assumptions and reproduce results | Expert methods, diagnostics, raw summaries and manifests | Hide only operational plumbing; export NetCDF, CSV and configuration |
| Earth-system scientists | Evaluate mechanisms and product consistency | Multi-variable comparisons and product-specific limitations | Keep inference and regridding explicit; export reproducible analysis bundle |
| Environmental analysts | Compare regions and prioritize further assessment | Trend maps, regional contrasts and sensitivity checks | Hide infrastructure; export technical report and geospatial results |
| Data journalists | Produce transparent public reporting | Immutable findings, citations and readable uncertainty | Hide HDF parsing; export SVG or PNG and CSV |
| Planners and policymakers | Understand historical context for broader assessments | Reviewed regional reports and clear resolution limits | Hide estimator details initially, retain disclosure; export briefing |
| General public | Explore how environmental conditions vary | Curated questions, uncluttered maps, glossary | Hide advanced options; share read-only investigation |

Expert mode reveals choices and diagnostics but does not bypass scientific validity checks. Guided mode uses the same computation, with fewer controls. Neither mode turns regional evidence into parcel-level advice.

# 7 Scientific scope and variable taxonomy
| Domain | Candidate quantities | Decision and reason |
| Atmosphere and temperature | Near-surface air temperature | Core MERRA-2 variable; long regular history with reanalysis caveats |
| Water cycle and precipitation | Mean precipitation rate and annual accumulation | Core IMERG; spatially variable response and mission-derived observations |
| Land and energy | Day and night land surface temperature | Full product for selected regions; clear-sky sampling and orbit sensitivity |
| Vegetation and productivity | NDVI and EVI | Full product greenness measures; do not label as yield or carbon uptake |
| Hydrology | Total water storage anomaly | Advanced GRACE module for large basins; coarse effective resolution |
| Soil moisture | Surface and root-zone volumetric water content | Optional SMAP L4 context; short record and model dependence |
| Cryosphere | Monthly snow-covered fraction | Optional seasonal module; cloud, darkness and terrain limitations |
| Radiation and clouds | Top-of-atmosphere net flux and cloud context | Advanced CERES; uncertainty and calibration demand specialist review |
| Ocean and sea level | Sea surface temperature, altimetry, ocean color | Deferred; valuable but adds ocean masks, cross-mission and variable-specific methods |
| Atmospheric composition and aerosols | Column gases, aerosol optical depth | Deferred; changing retrievals and vertical sensitivity require separate design |
| Carbon cycle | Fluxes, stocks, productivity estimates | Deferred; greenness is not a substitute for carbon accounting |
| Fires | Active-fire detections and burned area | Deferred; detection opportunity and sensor harmonization need a dedicated module |
| Drought | Standardized precipitation or moisture indices | Deferred until baseline length and distributional calibration are justified |
| Solid Earth | Surface deformation | Deferred; line-of-sight geometry and short mission histories differ from the core |

The taxonomy is a screening exercise, not a promise to ingest every listed dataset. Only the nine product records in Section 8 are proposed implementation candidates. Additional products need a new science adapter and validation review before they enter the catalog.

# 8 NASA data catalog
## Catalog conventions and access contract
The catalog distinguishes documented product properties from proposed use. Coverage endpoints are intentionally not assumed to equal the research date. At ingestion, query CMR for the selected version, record its collection concept and revision, enumerate actual granules and freeze an acquisition manifest. “Ongoing” below describes an archive stream, not a guarantee that the newest month is available. This research checked public documentation; it did not authenticate to every service or execute a full historical download. Acquisition smoke tests are Week 1 acceptance gates. [15,21]

For each record, the official documentation and access route are identified by numbered references with full URLs in Section 36. CMR access starts at https://cmr.earthdata.nasa.gov/search/collections.json and https://cmr.earthdata.nasa.gov/search/granules.json. Search by short name and version, resolve the collection, then use returned data links. Do not construct undocumented archive paths. Earthdata Search is the manual fallback at https://search.earthdata.nasa.gov/. AppEEARS product availability must be checked through its product endpoint before scheduling an extraction. [14,15]

Storage estimates below describe selected decoded arrays, not billed storage or source-file sizes. Assume float32 values at four bytes per cell; QA, masks, coordinates, uncertainty, intermediate products and backups add overhead. Compression is not assumed. Estimates should be replaced with measured sample-granule sizes after acquisition.

## D1 MERRA 2 near surface air temperature
**Classification: Core.** Official collection MERRA-2 tavgM_2d_slv_Nx, identifier M2TMNXSLV, version 5.12.4; DOI 10.5067/AP1B0BA5PD2K. Provider NASA GMAO; distributor GES DISC. This is GEOS model and data-assimilation output, with many input platforms and instruments rather than a single satellite sensor. Selected variable T2M is 2 m air temperature in kelvin. Gridded monthly means are distributed in NetCDF4 on a global 0.5° latitude by 0.625° longitude grid. Archive coverage begins 1 January 1980; the documented nominal latency is about three weeks after month end. [4,36]

**Quality and limitations.** This reanalysis does not provide MODIS-like retrieval QA for every temperature value. Preserve fill values, metadata and observing-system notes. It is spatially complete through modeling where direct observations are sparse. Input-observation changes can affect its temporal behavior; a fixed model does not remove this risk. No per-cell total trend uncertainty should be invented. [11]

**Proposed use.** Ingest T2M only for 1981–2025, requiring a complete manifest before publication. Use 2001–2025 for comparisons with IMERG, and a common 2001–2020 anomaly reference. Convert kelvin to Celsius for absolute values; temperature differences retain the same numerical scale. Compute day-weighted annual means, annual trends and regional contrasts. Display a global trend map, linked series and annual anomalies. It answers where broad near-surface temperature tendencies differ, not neighborhood heat exposure or surface skin temperature.

**Access and cost.** Documentation and collection access: [4]; discover files through CMR or earthaccess [15,21]. Historical data are available; this monthly archive is not a real-time weather feed. A 576 × 361 grid over 540 months uses approximately 0.45 GB per float32 variable, before overhead. Downloading the full multivariable collection would be substantially larger. Comparison with D9 provides broad context, not an exact same-variable truth test.

## D2 GPM IMERG Final monthly precipitation
**Classification: Core.** Collection GPM_3IMERGM, version 07, DOI 10.5067/GPM/IMERG/3B-MONTH/07. Provider NASA precipitation team; distributor GES DISC. IMERG combines constellation microwave and infrared information with calibration associated with GPM and TRMM and gauge adjustment in the Final product. The monthly Level 3 gridded product has 0.1° spacing, global geographic coordinates and precipitation rates in mm/hour. Archive coverage begins in June 2000; use complete calendar years from 2001. Source science files use HDF5; access services may provide other formats. [5,37]

**Quality and limitations.** Satellite mixture, gauge coverage, terrain and snowfall affect performance. Preserve available precipitation-quality and uncertainty-related fields according to the actual release schema. A complete gridded estimate is not evidence of equally strong observations everywhere. Final delivery is delayed by several months; Early and Late runs are separate products and must not be appended to the trend series. [5,37]

**Proposed use.** Ingest precipitation for 2001–2025, subject to actual granule completeness. Convert monthly mean rate to monthly accumulation using the exact hours in that calendar month; sum all twelve valid months for annual mm/year. Trend units are change in annual accumulation per decade. Precompute an area-weighted 0.5° analysis grid; retain native 0.1° data only where needed. Produce opposite-trend candidates, rainfall series and temperature–precipitation comparison. Do not infer floods, extreme-rain frequency or drought severity from monthly means alone.

**Access and cost.** Use [37], CMR and GES DISC links. Historical Final data and distinct near-real-time streams exist, but only Final enters this pipeline. One global 3600 × 1800 field over 300 months is about 7.78 GB decoded; at 0.5° it is 0.31 GB. QA and raw archives add storage. This variable supplies a mission-derived core alongside the modeled D1 record.

## D3 MODIS land surface temperature
**Classification: Supporting in the full product.** MOD11A2.061, DOI 10.5067/MODIS/MOD11A2.061; Terra platform, MODIS instrument; MODAPS production and LP DAAC distribution. Select LST_Day_1km, LST_Night_1km, QC_Day, QC_Night, observation-time and clear-sky information where available. Level 3 HDF-EOS2/HDF4 tiles use the MODIS sinusoidal grid at nominal 1 km resolution and eight-day cadence. Coverage starts in February 2000. Temperature scaling is 0.02 K for the documented packed LST values. [6,8,38]

**Quality and limitations.** Decode QA bits before aggregation. The default strict mask accepts good mandatory quality, good data quality and the smallest documented LST-error category; preserve the exact bit policy in configuration. Error categories are not independent Gaussian error bars. Cloud screening creates clear-sky sampling, and changing acquisition times can affect surface temperature. Day and night remain separate. [10,38]

**Proposed use.** Acquire two to four regional tiles or equivalent subsets, initially 2001–2021. Annotate orbital drift beginning around 2020 and the 2022 orbit change. Compare a shorter 2001–2019 descriptive estimate and a separately labeled 2001–2025 sensitivity analysis; none is an automatic correction for drift. Aggregate accepted composites into fixed seasons using interval-overlap weights and disclose that within-composite daily values are unavailable. Compare D4 at a common regional grid. Never present this as air temperature, all-weather temperature or an urban street measurement.

**Access and cost.** Documentation [6,38]; AppEEARS if supported, otherwise CMR and tiles [14,15]. Historical standard processing is suitable for retrospective analysis with these caveats; near-real-time MODIS products are distinct. Poll monthly for revised historical granules, not a guaranteed service latency. A 100,000-cell subset, two temperature fields and about 966 composites requires about 0.77 GB decoded, before QA. Regional processing is moderate; global 1 km processing is outside the first release.

## D4 MODIS vegetation indices
**Classification: Supporting in the full product.** MOD13A3.061, DOI 10.5067/MODIS/MOD13A3.061; Terra/MODIS, MODAPS and LP DAAC. Monthly Level 3, nominal 1 km sinusoidal HDF-EOS2/HDF4 tiles, available from February 2000. Select NDVI, EVI and associated quality/reliability fields. NDVI and EVI are dimensionless indices, with a documented packed scale of 0.0001. They describe spectral vegetation properties, not measured yield, biomass or net carbon uptake. [7,9,39]

**Quality and limitations.** Preserve MODLAND quality, usefulness, aerosol, cloud, snow and land/water information. Pin accepted bit combinations using the collection file specification. NDVI saturation, soil background, atmosphere, compositing and changing observation geometry can influence values. A quality category does not supply a total measurement-error distribution. Monthly composites do not represent uniformly sampled daily observations. [9,39]

**Proposed use.** Acquire the same regional footprint and initial years as D3. Use strict high-quality, snow-free land observations for a predefined growing season appropriate to each demonstration region. Record the calendar choice before inspecting trends. Compare NDVI and EVI as sensitivity measures rather than treating them as independent confirmation. Produce seasonal greenness trends, coverage heatmaps and detrended temperature–greenness association. A decrease can motivate ecological investigation but cannot establish crop loss or its cause.

**Access and cost.** Documentation [7,39]; AppEEARS availability query then extraction, or CMR tiles. Historical data are available; treat this as a standard retrospective product, not an operational near-real-time feed. Poll monthly and inspect actual availability. At 100,000 cells, 252 months and two indices, decoded values occupy about 0.20 GB plus QA. Avoid globally downloading every reflectance band when the product only uses indices and quality layers.

## D5 GRACE and GRACE FO total water storage
**Classification: Experimental research extension.** TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4, JPL Release 06.3 Version 04, DOI 10.5067/TEMSC-3JC634. JPL processing; PO.DAAC distribution. GRACE and GRACE-FO satellite gravity observations underpin Level 3 monthly equivalent-water-height anomalies. NetCDF files are distributed on a 0.5° geographic grid, but the underlying mascons have approximately 3° support; the finer grid is not independent 0.5° resolving power. Coverage begins in 2002 and includes missing months and the intermission gap. [18]

**Quality and limitations.** Use coastal filtering, land masks, supplied uncertainty and product gain-factor guidance as applicable. Gravity-derived storage integrates components including groundwater, soil water, snow and surface water. Leakage and glacial-isostatic-adjustment choices matter. Do not equate total storage change with groundwater depletion without additional component estimates and uncertainty. [18]

**Proposed use.** Restrict to large basins and 2003–2025 where available. Preserve actual observation epochs, gaps and the native anomaly reference. A basin series can compare storage response with D2 precipitation, but it needs a reviewed irregular-time estimator and error covariance treatment before significance is enabled. The first extension exposes descriptive series and metadata; the general annual inference engine must not interpolate over the mission gap.

**Access and cost.** Use PO.DAAC collection documentation [18], CMR and earthaccess. Historical data are available; monthly releases have mission-dependent latency and are not a real-time service. Refresh monthly after manifest comparison. At 720 × 360 cells, 270 epochs and one float32 variable, storage is about 0.28 GB before uncertainty and masks. Computational cost is modest; defensible interpretation is the main cost. Visualize basin anomalies with gap marks and uncertainty, not a high-resolution groundwater hotspot map.

## D6 SMAP modeled surface and root zone moisture
**Classification: Optional short-record context.** SPL4SMGP.008; NASA SMAP mission, L-band radiometer assimilation into a land model, distributed by NSIDC DAAC. Level 4 HDF5 geophysical output at three-hourly cadence on the 9 km EASE-Grid 2.0, starting 31 March 2015. Selected fields are surface and root-zone volumetric soil moisture, expressed in m³/m³. This is model-assimilated output, not a direct 9 km root-zone sensor measurement. [17]

**Quality and limitations.** Preserve land, frozen-ground and snow context and review companion analysis-update information when interpreting assimilation support. Gap-free model output can include periods or locations without a useful satellite update. Surface and root-zone layers have distinct depths and physical meaning. The roughly decade-long record is weak for general claims about long-term climate trends. [17]

**Proposed use.** Extract a demonstration basin for 2016–2025, aggregate to monthly values, and use anomaly comparison with D2 and D4. Label the baseline as a short product reference, not a climate normal. The default 20-year trend-significance threshold excludes this record; show descriptive tendencies only. It cannot replace laboratory soil chemistry or infer available phosphorus, potassium or farm fertility.

**Access and cost.** Official catalog [17]; CMR, earthaccess or AppEEARS when listed. Record the source DOI from the resolved collection rather than guessing it. This standard Level 4 history is available with delayed updates; query current coverage and do not advertise an unverified latency or a separate NRT service. A subset of 10,000 cells, two fields and 120 monthly aggregates is about 9.6 MB. Acquiring all three-hourly inputs for that subset is about 2.34 GB over ten years, excluding metadata and QA. Never fetch the global three-hourly archive for a small demonstration.

## D7 CERES top of atmosphere energy flux
**Classification: Experimental research extension.** CERES EBAF Edition 4.2.1, DOI 10.5067/TERRA-AQUA-NOAA20/CERES/EBAF_L3B004.2.1. CERES science team and NASA ASDC distribute monthly Level 3B NetCDF fields at 1° geographic spacing, starting March 2000. Instruments include CERES on Terra, Aqua and NOAA-20 with associated imager information. Select top-of-atmosphere all-sky net flux in W/m², preserving the source sign convention and exact variable name from the file. [19,40]

**Quality and limitations.** EBAF includes adjustments and filling; surface fluxes in the broader family are computed quantities and should not be confused with direct surface measurements. Calibration, platform transitions and product revisions affect interpretation. Review the current data-quality summary, fill values and uncertainty characterization; do not turn an aggregate uncertainty assessment into invented pixelwise error bars. [19,40]

**Proposed use.** Use 2001–2025 global or large regional annual means only after radiation-science review. Display net flux and temperature alongside one another as energy-system context. Do not infer a local causal temperature response from a correlation. Version changes trigger full recomputation. This module broadens the scientific story but is unnecessary for a strong initial challenge response.

**Access and cost.** Use the official CERES ordering and subsetting tool linked in [19]; obtain release documentation [40]. Historical monthly data exist; this is not an NRT feed and a fixed release latency is not assumed. Monthly availability polling is sufficient. A 360 × 180 grid, 300 months and one float32 variable is about 78 MB. Preprocessing and computation are low to moderate; uncertainty review is high. Visualize large-scale anomalies with an explicit flux sign legend and product revision history.

## D8 MODIS snow cover
**Classification: Optional cryosphere module.** MOD10CM.061, DOI 10.5067/MODIS/MOD10CM.061; Terra/MODIS, NSIDC DAAC. Monthly Level 3 global land snow-cover fields on a 0.05° geographic climate-modeling grid, HDF-EOS2/HDF4, starting February 2000. Snow-covered fraction is represented as percentage values with reserved nonmeasurement codes; mask those codes before averaging. [20,41]

**Quality and limitations.** Cloud, darkness, forest canopy and terrain limit optical snow detection. Preserve the product’s quality and valid-observation information; zero snow is not the same as no observation. A monthly snow fraction is not snow depth, ice thickness, snow water equivalent or glacier mass. The Terra observation-history caveat remains relevant. [10,20]

**Proposed use.** Begin with one broad mountain or high-latitude region for 2001–2021. Analyze a fixed spring month or season, with coverage diagnostics and an explicit calendar. Compare with D1 temperature at a deliberately coarser common scale. Use percentage points per decade, not percent per decade unless a separate relative-change definition is supplied. Findings remain conditional on optical coverage and seasonal choice.

**Access and cost.** Catalog and user guide [20,41], CMR and service-supported regional subsets. Historical standard processing is available; separate NRT snow products are not substituted. Poll monthly for updates and QA revisions. A 100,000-cell monthly subset over 252 months occupies about 0.10 GB as float32. Global storage at native spacing would be about 26 GB for one field over that interval. Display seasonal maps, series and observation coverage together; do not interpolate across persistent polar darkness to make a complete trend map.

## D9 GISTEMP temperature context and benchmark
**Classification: Supporting benchmark.** NASA GISS Surface Temperature Analysis, GISTEMP v4. This is a station and sea-surface-temperature analysis, not an individual satellite mission product or the same quantity as MERRA-2 air temperature everywhere. Global and regional monthly anomalies extend from 1880; gridded products include a 2° latitude–longitude grid and NetCDF distribution. Anomalies use the 1951–1980 reference. Text series and observational-uncertainty ensemble resources are also available. [16,35]

**Quality and limitations.** Sampling, coverage, interpolation and source-data revisions matter. Use supplied missing-value conventions and uncertainty guidance. The uncertainty ensemble describes observational-analysis uncertainty, not every source of internal climate variability. Spatial and variable-definition differences prevent treating agreement with D1 as exact validation or fully independent evidence. [16,35]

**Proposed use.** Store the official global annual series and a small gridded subset for teaching and broad consistency checks. Reproduce the supplied series from its own matching grid and mask only when those definitions permit it. Compare 1981–2025 warming context with D1, documenting the distinct targets. A large discrepancy triggers investigation; agreement does not prove regional retrieval accuracy.

**Access and cost.** Direct downloads from [16] and [35]; no speculative API endpoint. Archive and monthly updates exist; this is not an NRT monitoring service. Text series are tiny; a decoded 180 × 90 × 1,752 monthly grid is about 114 MB per field. Keep this out of the core NASA mission/model compliance claim, which is already met by D1 and D2. Visualize as a labeled contextual series, not an interchangeable replacement for local air or surface temperature.

# 9 Dataset selection rationale
The minimum viable scientific suite is D1 plus D2. It combines a long NASA model history with a mission-derived precipitation product, regular temporal sampling, global spatial coverage and manageable processing. Multi-variable comparison uses their overlapping years and a common coarse grid. Their different origins do not guarantee independent errors; IMERG uses ancillary model information, and both reflect the same climate system. [4,5,11]

The full production suite adds D3 and D4 for two or three fixed regional case studies and D9 for context. A globally complete 1 km vegetation–temperature product is deferred. The advanced suite adds D5, D6, D7 or D8 one at a time, with separate scientific acceptance tests. Eight weeks does not make four specialist modules cheap.

| Candidate | Selection decision | Complement or limitation |
| D1 and D2 | Include first | Long histories, spatial comparison, annual trends and anomalies; no local report collection |
| D3 and D4 | Include after core validation | Surface and vegetation context; QA, season selection and observation-time effects raise difficulty |
| D9 | Include as context | Broad consistency and education; not independent same-variable ground truth |
| D5 | Research tier | Storage versus precipitation; irregular sampling and coarse physical resolution |
| D6 | Optional context only | Moisture anomalies, but too short for default long-record inference |
| D7 and D8 | One optional domain at a time | Radiation or cryosphere breadth with specialist uncertainty issues |
| MOD11C3 and MOD13C2 monthly CMG | Screened alternative, not production default | Convenient 0.05° products, but compositing and climatological filling require a separate eligibility audit [42,43] |
| Raw radiances and Level 1 scenes | Exclude | Retrieval development is unnecessary to answer the challenge |
| NRT data appended to standard archives | Exclude | Processing changes can imitate change |
| New-mission short records | Exclude as long-term backbone | Valuable observations may lack enough temporal support |
| Global high-resolution archive ingestion | Exclude initially | Storage and preprocessing would displace statistical validation |

None of the chosen products alone supplies fully independent validation of every physical trend. Computational validation can compare against official tools on matching inputs; physical validation requires suitable independent observations or published assessments. The product should be honest about this distinction instead of declaring every cross-product agreement a validation success.

# 10 Acquisition and processing strategy
## Processing sequence
1. Resolve the approved collection and version from CMR; capture documentation, access requirements and actual coverage.
2. Acquire one sample granule per product and a small region spanning several seasons. Test credentials, dimensions, coordinates, units, quality layers and scale factors.
3. Enumerate and download the frozen historical subset with checksums, retry state and source revisions. Store raw files unchanged.
4. Validate expected dates, duplicate epochs, coordinate order, fill values and physical ranges. Quarantine failures rather than silently dropping them.
5. Decode scale and offset once, preserving original metadata. Convert units using an explicit transformation record.
6. Apply the product-specific quality policy before temporal or spatial averaging. Retain valid count and coverage layers.
7. Aggregate to agreed calendar periods and spatial support. Store normalized cubes, masks, cell bounds and weights.
8. Assess inference eligibility, fit trends and run diagnostics. Keep withheld results visible with reasons.
9. Produce versioned numerical outputs, map assets, regional series and the Investigation Record.
10. Serve cached tiles and summaries to the interface, with links to methods and source citations.

Use batch ingestion for known historical archives. Reserve on-demand jobs for polygon aggregation, permitted period changes and approved comparisons over already acquired cubes. External NASA services should not be in the critical path of every map interaction.

## Product adapter contract
Each adapter implements discover, fetch, decode, validate, quality_mask, aggregate and cite. Its manifest names exact source fields, units, grid bounds, time bounds, calendar, fill rules, QA bit masks, retrieval dates and software version. A reviewed adapter is the admission ticket to the catalog. A dataset that loads successfully but lacks a defensible quality policy remains disabled for inference.

Monthly temperature aggregation uses days as weights. Precipitation accumulation uses hours in each month before annual summation. Eight-day composites use their actual interval bounds, including shorter final periods of a year; overlap weighting is an approximation to monthly support and must be disclosed. No routine gap filling is permitted in the production trend series.

## Failure recovery and updates
Store per-granule states: discovered, acquired, verified, normalized, published or quarantined. A retry resumes from the last verified stage. Use bounded exponential backoff for temporary failures and surface authentication or quota errors clearly. Do not retry a malformed scientific file indefinitely.

A monthly update job compares source revisions and granule checksums. Publish a new data release if source values change; do not mutate old investigation snapshots. New processing collections are parallel releases until scientifically compared. Keep a change log of affected variables, dates and investigations. Raw retention and immutable manifests allow replay if a transformation bug is found.

# 11 Trend analysis methodology
## Define the estimand before fitting
For the core annual workflow, the estimand is the linear change in an annual regional mean or grid-cell summary over the chosen years. Report the slope per decade and the fitted change between the first and last year coordinates. The latter is not the observed endpoint difference. For precipitation, the annual summary is a total; for temperature, a duration-weighted mean. Treat these definitions as part of the variable, not a cosmetic chart setting.

Fit an intercept and a centered time coordinate in decimal years. Compute in float64 even if stored input cubes are float32. Centering improves numeric conditioning. The initial estimator is ordinary least squares with heteroskedasticity and autocorrelation consistent covariance for eligible regularly spaced annual records. Use a Bartlett kernel, two annual lags and the documented finite-sample correction as an initial configuration; test lag choices one, three and five as sensitivity analyses. These choices are project defaults that require calibration, not universal rules. The covariance implementation assumes equally spaced time observations; dropping gaps and treating the remainder as contiguous is invalid. [28,44]

For implementation, calculate the slope standard error from the HAC covariance diagonal. The initial test uses the slope divided by that standard error and a two-sided Student t reference with n minus two degrees of freedom; its validity is approximate under dependence and must pass the stated calibration tests. Use the same reference quantile for the 95% interval. Zero variance or a nonfinite covariance returns a diagnostic status. Do not silently switch distributions or methods when a test fails.

## Eligibility rules
The initial inference profile requires at least 20 consecutive complete annual summaries, a fixed region mask and no unresolved product discontinuity. Each core annual summary requires all twelve valid monthly inputs. For regional optical products, define a fixed spatial eligibility mask first; require at least 80% valid area in each accepted month or season and assess the coverage trend. These numeric limits are proposed conservative product policies and must be tested for the chosen regions.

A longer record with an isolated gap does not become uniformly sampled merely because missing rows are deleted. The core engine returns descriptive results or a longest-contiguous-interval option requiring explicit user selection. An advanced irregular-time model may be added later with its own validation. Ten to nineteen years may support exploratory effect-size estimates but receive no default significance label; fewer than ten years are shown as observations and anomalies only. These are interface safeguards, not claims that inference is mathematically impossible for shorter records.

## Seasonality and anomalies
Annual aggregation is the simplest initial defense against seasonal confounding, but it can hide opposite seasonal trends. The full product therefore supports fixed seasonal summaries and month-specific analyses as separate, declared questions. DJF is assigned to the year of January and February and requires the preceding December. A growing season is fixed from external scientific context before fitting, not chosen to maximize the slope.

An anomaly subtracts the same calendar-month reference mean from each monthly value. Use 2001–2020 as a common comparison reference where coverage permits. This is a project reference period, not a claim that twenty years is a standard 30-year climate normal. MERRA-2 can additionally show 1991–2020 context, but comparisons must share a reference. Constant baseline shifts do not change a complete-series linear slope with an intercept. Missing seasonal coverage and changes in normalization can alter interpretation.

A monthly expert model includes month indicators and a linear time term, with temporal covariance treatment and annual-block resampling. It is deferred until the annual pipeline passes validation. Seasonal decomposition and moving averages are visualization aids; significance is calculated on the specified unsmoothed analysis series. A three- or five-year rolling display marks its window and edge losses.

## Robust estimates and nonparametric tests
Theil–Sen estimates the median of pairwise slopes and is useful as an outlier-resistant sensitivity estimate. Use actual time coordinates. Its usual independent-sample interval must not be presented as autocorrelation-aware. For regional series, obtain a dependence-aware interval using the resampling procedure below. Avoid computing all pairwise monthly slopes over a global high-resolution grid. [27]

Mann–Kendall tests for monotonic association with time rather than estimating a physical rate. Seasonal Kendall compares within seasons and addresses seasonality, but serial dependence remains relevant. Modified Mann–Kendall methods address variance under dependence with assumptions and implementation choices; they are not an automatic substitute for inspecting a record. Keep seasonal or modified tests as expert cross-checks after benchmarking, with the exact variant reported. Do not select whichever test returns the smallest p-value. [22,23]

## Dependence and resampling
For an eligible annual regional record, fit the chosen mean model, center its residuals and resample contiguous residual blocks. Reconstruct the fitted mean plus resampled residuals and refit to estimate slope uncertainty. Initial block lengths are two, three and five years; use at least 2,000 replicates for a reported interval and a recorded random seed. For a null test, simulate under the no-trend mean model rather than merely counting positive bootstrap slopes. Retain the season model when resampling monthly records, using whole-year-aligned blocks initially.

Block resampling has a stationary-time-series foundation. [45] This is a proposed residual-block procedure, justified only when residual behavior is sufficiently stable and weakly dependent over the interval. It does not solve long-memory, strong nonstationarity, undocumented steps or extremely short records. Compare its interval and test behavior with the HAC implementation using the validation simulations. If materially different defensible choices change the conclusion, label the result method-sensitive and withhold a simplified significance badge. No rule guarantees that agreement between two estimators makes their shared assumptions true.

For two regions, resample the paired residual vectors using the same time blocks, or fit the difference series directly. Separate resampling would lose cross-region covariance. For multivariable association tests, do not use a paired bootstrap as a null-independence test because it preserves the association; generate null series that preserve each variable’s temporal structure while breaking their alignment, under a reviewed stationary procedure.

## Outliers and discontinuities
Flag unusual observations and inspect their QA and source history. Real environmental extremes must not be removed simply because they weaken a result. Compare least squares and Theil–Sen; retain any manual exclusion with its scientific reason in the manifest. A step associated with a sensor or product transition is not repaired by fitting a straight line through it.

Use known event annotations and product metadata before automated change-point detection. The advanced module may estimate a segmented model with minimum segment lengths and penalized complexity, but selected break dates create additional inferential uncertainty. A simple p-value after choosing the most favorable breakpoint is invalid. The initial product reports such records as requiring review.

## Method routing
| Data situation | Default computation | Inference behavior |
| Complete annual D1 or D2 record of at least 20 years | OLS slope with HAC covariance; robust sensitivity | Two-sided inference after diagnostics; spatial adjustment for maps |
| Eligible regional optical series | Seasonal or annual summaries, coverage audit and robust comparison | Only after sampling and orbit review; otherwise descriptive |
| Strong monthly seasonality | Annual or fixed-season summary | Monthly model is expert extension |
| Sparse or irregular GRACE series | Actual-time descriptive series | No core-engine p-value; specialist module required |
| Short SMAP history | Anomalies and descriptive slope | No long-record significance badge |
| Step, residual instability or strong method sensitivity | Plot and diagnostic record | Withhold simplified conclusion |
| Raw extremes or count processes | Separate model required | Do not apply Gaussian mean-trend inference blindly |

# 12 Significance and uncertainty policy
Statistical significance describes incompatibility with a specified null model under the test’s assumptions. A p-value is not the probability that the null is true, the probability a finding is false, or the probability that the trend will continue. A confidence interval describes the long-run performance of a procedure under its assumptions; it does not certify that all observational and structural errors are included. Effect size and importance must be reported separately. [26]

The default null hypothesis is zero linear slope for the stated annual-summary model. Use a two-sided test with a declared nominal level of 0.05. Report the raw p-value and method even if the UI uses a short label. Local 95% intervals describe each estimate before map-wide selection; they are not simultaneous confidence bands for all cells. A large noisy slope can fail a test, while a small well-estimated slope can pass it without being practically important.

## Spatial multiplicity
Thousands of unadjusted tests produce misleading apparent patterns. Define a test family before computing a map: one variable, fixed analysis grid, fixed geographic domain, period, estimator and quality policy. Panning or zooming must not change this family. Preserve the number of eligible tests and the family identifier. [24]

Use Benjamini–Yekutieli adjustment as the conservative initial map default because general spatial dependence is not automatically covered by the simpler Benjamini–Hochberg assumptions. Sort valid p-values, apply the harmonic-factor adjustment and enforce monotonic adjusted values, capped at one. Flag cells at adjusted p ≤ 0.05. This controls an expected false-discovery proportion under the method’s conditions; it is not a per-cell probability of truth. The guarantee still depends on valid input p-values. A BH view may be offered only as a clearly named sensitivity analysis with its dependence assumptions explained. [25]

Map families are separate from repeated user exploration. Trying many periods, regions, variables and lags creates selection beyond a single map. Log the search history. Findings selected after exploration stay exploratory unless confirmed with an independently specified analysis or a defensible selection-aware procedure. Do not erase the history when the user finds an attractive map.

## Three separate questions in the interface
| Question | Display | Meaning |
| What size is the tendency | Slope, physical units and fitted interval change | Magnitude within this product and analysis definition |
| How strong is statistical evidence | Interval, raw p and adjusted p when applicable | Conditional evidence under the stated method |
| Does it matter scientifically | Context and an externally justified relevance threshold if available | Interpretation requiring domain knowledge |

Do not invent universal danger thresholds. A planner may supply a documented relevance threshold for an appropriate variable and spatial scale; store its source separately from the statistical test. A nonsignificant result is not proof of no change. A test of whether change is smaller than a meaningful bound would require an equivalence-testing design, outside the core.

## UI language
Use “An increasing trend is detected under this analysis” only when eligibility, diagnostics and the declared test pass. For maps append “after adjustment across this map’s test family.” Use “Trend estimate is positive; evidence does not meet the selected threshold” when appropriate. Use “Not enough valid data for this test,” “Result changes with analysis choices,” or “Observation changes require review” when those are the actual limitations.

An interval tooltip should state: “This interval represents statistical uncertainty under the selected model. It does not include every source of sensor, sampling or model error.” A significance tooltip should state: “Passing this threshold does not establish a cause or practical importance.”

Uncertainty has separate components: retrieval or measurement uncertainty, temporal variability, spatial sampling, preprocessing sensitivity and model structure. Never add arbitrary components in quadrature. Where a source supplies an appropriate ensemble, recompute the statistic across members and state which uncertainty it represents. Where covariance information is absent, disclose that limitation rather than treating all pixels or months as independent.

# 13 Spatial analysis methodology
Use geographic coordinates for region exchange and native grids for scientific values. Web Mercator may serve the display, but it must not define physical areas. Compute weights from cell bounds and geodesic or equal-area polygon intersections. Cosine-latitude weighting is only an approximation for regular geographic grids; exact spherical cell area is inexpensive and preferable.

For a region, multiply cell area by polygon-overlap fraction and the fixed eligible-domain mask. Aggregate valid values and return valid area divided by target area. Do not silently change the denominator from month to month. If observations are missing, report observed-area means with coverage and apply the eligibility rule; compare against a stricter fixed-support subset to test sensitivity. Removing missing values without tracking their geography can create an artificial trend.

Distinguish a trend of a regional mean from the mean of individual pixel trends. They can diverge when masks, weights or available times vary. The default regional result computes the time series first, then fits it. Map values are separately fitted at the analysis-cell scale.

## Resolution and scale
Regrid D2 to a 0.5° grid for global trend exploration using area-overlap averaging of its precipitation field. For D1–D2 comparisons, aggregate both to a common 1° grid or use the identical region geometry with each product’s weights. Do not interpolate MERRA-2 to 1 km and imply new information. Preserve original and analysis resolution in every chart and export. Conservative regridding requires cell bounds and mask handling; test conservation on known fields. [30]

Regions may be bounding boxes, validated GeoJSON polygons, saved study areas or named administrative units with a versioned boundary source. Countries are convenient navigation units, not necessarily physical systems. Large basins and coherent ecological regions can be more informative. A point click returns a grid-cell footprint, not a station observation.

Reject invalid polygons and enforce vertex and area limits. Handle dateline-crossing shapes as valid split geometries; test polar regions separately. Warn when a polygon is smaller than one meaningful source footprint. The GRACE module requires a much larger-scale support rule than the core grid.

## Opposite trend discovery
The initial detector searches a predefined set of regions or a fixed trend field for positive and negative slope candidates. Require common variable, dates, season, method and adequate coverage. Show candidate selection criteria and the number inspected. Sort by magnitude only after quality eligibility; significance and sensitivity remain separate fields.

For a selected pair, compute the annual difference series and its slope with shared-time dependence preserved. To label both directions supported, each regional trend must meet its declared inferential rule; to assert different rates, the contrast itself needs an appropriate interval and test. An exploratory map-selected pair cannot be promoted to independent confirmation using the same data.

Spatial clustering is optional. Connected components can group contiguous candidates for navigation without claiming independent statistical discoveries. A formal hotspot test requires its own spatial null and multiple-testing design. The core uses “candidate trend area,” not a statistically certified hotspot. Transects are useful for teaching gradients but are deferred unless a demonstration question needs them.

# 14 Multi variable methodology
The first comparison offers temperature and precipitation over the same years and region. Show native-unit series side by side. A standardized anomaly view may aid comparison but must retain the baseline, mean and standard deviation and keep native values one click away. Do not compare a Celsius slope numerically with a millimeter slope as though magnitude were commensurate.

A co-trend classification reports the signs and uncertainty of two separate slopes. It does not establish correlation, coupling or a causal feedback. A scatterplot of two trending variables can show a strong relationship because both vary with time. Therefore provide both raw-anomaly association and association after removing the specified seasonal and trend components. Label the latter as a different question about residual co-variability.

For the core, Pearson and Spearman coefficients are descriptive on aligned valid annual or seasonal summaries. Inference for correlation is deferred until its dependence-preserving null procedure is validated. Never reuse an ordinary independent-observation correlation p-value for persistent climate series. Report paired sample count, masks and whether detrending was applied.

Lagged investigation is an advanced exploratory feature. Choose a physically motivated, limited lag range in advance, such as zero to three months for a particular vegetation response study. Display all inspected lags; adjust the family of valid tests if inference is enabled. A best lag selected from many is not a discovered causal delay. Annual and monthly lag definitions are different and must be explicit.

Useful investigations include precipitation with temperature, precipitation with seasonal vegetation, surface temperature with vegetation, and basin storage with precipitation. Common seasonality, circulation, irrigation and land-cover change are possible confounders. Datasets can share inputs and errors; matching patterns across products do not necessarily provide independent support.

Do not implement a composite “Earth health” score. A fingerprint view may show several independently defined indicators with their signs, units and evidence status. Clustering these vectors is an exploratory organization tool whose scaling and missing-data decisions are disclosed. Established causal relationships appear only in sourced contextual explanations, not as a classification produced by the correlation engine.

# 15 Feature specification
Every feature below consumes approved catalog products and the same immutable result objects. Priority P0 is required for the core, P1 follows scientific validation, and P2 is optional. Complexity is relative to a small team: low is mostly interface integration, medium needs one bounded service, and high needs scientific plus engineering validation.

## F1 Guided question and variable discovery
**Problem and interaction.** Users do not know which measurement answers their question. Start with temperature or precipitation, show a plain-language definition and let the user inspect units, coverage and provenance before proceeding. **Data and computation.** Catalog metadata and precomputed availability summaries; no inferred scientific result. **Output and visualization.** A selected variable and a compact coverage timeline. **Priority and complexity.** P0, low. **Dependencies and pitfalls.** Requires reviewed catalog entries; do not rank a dataset solely by resolution or newest mission date.

## F2 Linked map and region selection
**Problem and interaction.** Users need to locate change and choose a meaningful support. Pan the trend map, inspect a cell, select a study region or draw a polygon. **Data and computation.** Derived raster, geometry validation and area-overlap weights. **Output and visualization.** Slope map with source footprint, polygon outline and coverage. **Priority and complexity.** P0, medium. **Dependencies and pitfalls.** Requires F1 and spatial service; display resampling must not alter numerical results or exaggerate native resolution.

## F3 Time series and trend evidence
**Problem and interaction.** A map alone hides the history. Selecting a region opens annual values, fit and diagnostics. **Data and computation.** Quality-filtered summaries, OLS/HAC and sensitivity estimate. **Output and visualization.** Series, slope interval, valid years and residual view. **Priority and complexity.** P0, high. **Dependencies and pitfalls.** Scientific engine must be validated; gaps remain gaps and smoothing must not feed the test.

## F4 Significance and uncertainty layers
**Problem and interaction.** Users confuse magnitude with confidence. Toggle an evidence overlay and inspect a cell’s status. **Data and computation.** Raw tests, adjusted values, family metadata and diagnostic flags. **Output and visualization.** Hatching for insufficient evidence, separate missing-data texture and accessible legend. **Priority and complexity.** P0, high. **Dependencies and pitfalls.** Requires a completed fixed family; never recalculate adjustment only over the visible viewport.

## F5 Regional comparison and opposite trend candidates
**Problem and interaction.** Users need to understand spatial differences. Choose two regions or inspect detector candidates, then open a paired comparison. **Data and computation.** Aligned region series, separate trends and difference-series slope. **Output and visualization.** Small multiples and an interval plot for the contrast. **Priority and complexity.** P0 for manual comparison, P1 for discovery; high. **Dependencies and pitfalls.** Requires selection-history recording; a map-selected result remains exploratory and candidates may fail the contrast test.

## F6 Anomaly and season explorer
**Problem and interaction.** Users need to separate unusual conditions from persistent change. Toggle monthly anomalies and fixed seasons, with a visible reference period. **Data and computation.** Calendar-aware climatology, temporal weights and eligibility. **Output and visualization.** Year-by-month anomaly heatmap and season-specific series. **Priority and complexity.** P1, medium. **Dependencies and pitfalls.** Baseline completeness must be checked; a changed reference is not new physical evidence.

## F7 Multi variable comparison
**Problem and interaction.** Users want to explore co-variation. Add one compatible variable and choose raw or detrended comparison. **Data and computation.** Common time support, aggregation, descriptive Pearson/Spearman association and slope signs. **Output and visualization.** Paired series and scatterplot with sample count. **Priority and complexity.** P1, high. **Dependencies and pitfalls.** No default correlation significance or causal language; retain shared-input caveats and resolution differences.

## F8 Evidence and methods inspector
**Problem and interaction.** Users need to understand why a conclusion was produced. Open the evidence panel from any finding. **Data and computation.** Provenance graph, analysis configuration and diagnostics. **Output and visualization.** Readable sequence from source through transformations to result. **Priority and complexity.** P0, medium. **Dependencies and pitfalls.** Method names alone are insufficient; include parameters, masks and excluded-data counts.

## F9 Sensitivity comparison
**Problem and interaction.** Users may overtrust one analysis choice. Run a predefined comparison of period, coverage threshold or covariance lag. **Data and computation.** Bounded reruns with unique configuration hashes. **Output and visualization.** Slope-and-interval small multiples, changed-status explanation. **Priority and complexity.** P1, high. **Dependencies and pitfalls.** Do not average methods into an undocumented confidence score or select the most favorable outcome.

## F10 Saved investigations and history
**Problem and interaction.** Users need to return to an analysis and disclose exploration. Save a snapshot, clone it to change parameters and share a read-only URL. **Data and computation.** Immutable configuration, results and parent identifiers. **Output and visualization.** Chronological configuration history and saved findings. **Priority and complexity.** P0 local/session save; P1 server persistence, medium. **Dependencies and pitfalls.** Sharing a custom location must be explicit; old snapshots must not silently update with new source values.

## F11 Export and scientific report
**Problem and interaction.** Users need usable evidence outside the app. Export a chart, CSV, geospatial result or report bundle. **Data and computation.** Existing result objects, deterministic templates and dataset citations. **Output and visualization.** PNG/SVG, CSV, GeoTIFF where applicable, JSON manifest and readable report. **Priority and complexity.** P0 CSV/JSON/PNG; P1 report, medium. **Dependencies and pitfalls.** Charts retain units, dates and status; exported rounded values must not replace full-precision arrays.

## F12 Guided learning and accessible use
**Problem and interaction.** Users need help without losing scientific accuracy. Choose a curated lesson, open a term definition or switch from map to table. **Data and computation.** Real saved investigations and reviewed explanations. **Output and visualization.** Stepwise lesson with keyboard navigation and textual finding. **Priority and complexity.** P0 accessibility, P1 lessons, medium. **Dependencies and pitfalls.** Educational examples must not contain invented production measurements or predetermined discoveries.

# 16 User journeys
## Primary investigation
An analyst chooses precipitation, a 2001–2025 interval and a predefined regional comparison. The app displays the data source, available years, units and analysis grid before the user runs it. The map first shows magnitude, then evidence status. Selecting two areas opens aligned annual totals and reveals whether their signs and contrast are supported.

The analyst inspects residuals and coverage, runs the predefined period sensitivity check and adds temperature on the same spatial and temporal support. The app distinguishes co-trends from detrended association. The analyst writes a qualified finding using a result template, checks citations and exports the complete record. A failed diagnostic redirects the journey to an explanation and a narrower defensible question, rather than blocking exploration without context.

## Educator journey
An educator opens a published investigation, hides expert parameters and asks students to identify seasonality, trend direction and uncertainty. Students compare a short and a long interval, explain why the results differ and export a table with their interpretation. Both configurations remain visible. The lesson does not reward finding statistical significance.

## Expert review journey
A researcher opens a shared snapshot, downloads the manifest and numerical outputs, reviews the QA policy and reproduces the slope in an independent notebook. If a source revision has superseded the snapshot, the app offers a new run while retaining the historical result. A reviewer can reject the finding without losing the exploratory work that led to it.

# 17 Information architecture
| Area | Contents | Primary action |
| Start | Product purpose, two core phenomena, three reviewed investigations | Start or open an investigation |
| Explore | Variable, period, map, region selector, availability | Select a defensible analysis target |
| Workspace | Map and series, region comparison, analysis status | Run or compare configurations |
| Evidence | Effect, interval, tests, QA, caveats and provenance | Assess whether a finding is supportable |
| Methods | Parameters, assumptions, diagnostics, references | Inspect or change permitted choices |
| Findings | Draft statements linked to result identifiers | Save a qualified interpretation |
| Export | Figures, data, manifest and report | Share a reproducible snapshot |

Use one persistent investigation header showing variable, region, dates and data release. Separate navigation between investigations from controls within one analysis. Advanced settings expand in place; users should not have to remember which hidden global settings affected a result.

# 18 UI and interaction design
Use a restrained scientific publication style: off-white or white surfaces, dark text, fine neutral dividers and a limited set of semantic colors. The application name and source labels should be prominent without imitating NASA branding or implying agency endorsement. Use a legible sans-serif such as Source Sans 3 for UI and a monospace face only for identifiers and numeric inspection.

On desktop, use a narrow variable-and-region control column, a central map with a lower time-series area, and an evidence panel that opens on the right. At approximately 1,280 px width and above, all three can coexist. On tablets, evidence becomes a tab. On phones, prioritize viewing saved investigations, readable series and exports; polygon editing and advanced model configuration remain desktop-oriented.

Slope maps use a colorblind-conscious diverging palette centered on zero. Positive and negative colors mean direction, not harm and benefit. Missing data use a neutral texture; inconclusive inference uses a different hatch. A displayed zero and an unobserved cell must never look identical. Use sequential palettes for absolute quantities and fixed symmetric scales for comparisons where meaningful.

Keep titles explicit: variable, region, years and units. Legends show analysis resolution and whether the layer is magnitude, anomaly, uncertainty or evidence status. Avoid rainbow palettes, spinning globes and decorative particle animations. Animated time maps are optional exploration aids, not proof of a trend.

Support keyboard access to every control, visible focus, adequate contrast, reduced motion, resizable text and a table alternative for maps. Charts need screen-reader summaries and downloadable values. Avoid meaning encoded only by color. A light theme is the first release; dark mode is optional only after all scientific color encodings are rechecked.

Loading states distinguish cached retrieval from queued scientific computation. Show stages such as validating, aggregating, fitting and publishing rather than a fabricated percent complete. Retain the previous result but label it as belonging to the previous configuration. A failed source download does not erase a saved investigation.

Empty states explain whether there are no data, too few valid observations, no supported opposite-sign pair or no result for that configuration. Error messages identify a remedy: choose a longer interval, reduce the polygon complexity or wait for the queued job. Never replace an unavailable scientific result with mock data.

# 19 Visualization specification
| Visualization | Purpose | Misinterpretation to prevent |
| Annual time series with fitted line | Show temporal evidence and average rate | Keep real observations visible; do not imply linear evolution at every date |
| Confidence interval or fitted-mean band | Show model-conditional uncertainty | Label what the band covers; it is not a prediction band or total measurement error |
| Monthly anomaly heatmap | Reveal seasons, unusual years and gaps | State reference and units; gray cells are missing, not neutral |
| Raster slope map | Locate direction and magnitude | Show analysis grid, physical units and a zero-centered legend |
| Evidence overlay | Show adjusted-test status | Keep magnitude visible and disclose test family; no truth-probability label |
| Uncertainty-width map | Locate weakly constrained estimates | Large uncertainty is not itself a large environmental change |
| Small multiples | Compare regions, seasons or methods | Lock scales where comparison needs them and disclose different support |
| Slope interval plot | Compare rates and paired contrast | Overlap of two separate intervals is not the formal contrast test |
| Scatterplot | Explore variable association | Distinguish raw, anomalous and detrended values; label paired sample size |
| Correlation matrix | Summarize a small approved variable set | No causal arrows; missing combinations remain empty; many tests require correction |
| Distribution plot | Inspect residuals and unusual values | Do not assume normality merely because a histogram looks smooth |
| Before and after maps | Compare equal-duration means | This is a period difference, not a full trend estimate |
| Temporal animation | Explore evolving patterns | Preserve fixed scales; label incomplete coverage and dates |
| Cross-variable fingerprint | Organize signs and evidence by variable | Retain units and separate confidence; no universal environmental score |

Chart exports embed the data release, interval, method identifier and a source citation in the caption. Exported map pixels are visual products; numerical GeoTIFF or NetCDF output carries the actual analysis grid and full metadata separately.

# 20 AI strategy
The core product does not require an AI model. Deterministic templates can accurately state the variable, period, magnitude, uncertainty and caveats. Prioritize them because they are easier to test and reproduce.

If time remains, use AI to translate a natural-language question into an allowed analysis configuration. The user must see and confirm the interpreted variable, region, period and method before a job runs. The model may recommend a catalog entry with citations, explain a diagnostic or summarize an already computed result. It must never calculate scientific values in prose, select hidden p-value thresholds, fabricate citations or fill missing observations.

Ground generation in two restricted inputs: the typed result object and a curated, versioned collection of NASA documentation and reviewed methodological passages. Each numeric statement must bind to a result field. Each explanatory claim must bind to a source passage. A validator checks units, signs, dates, confidence status and citation existence before display. If validation fails, return the deterministic explanation.

A hypothesis suggestion appears in a separate panel with the label “Possible explanation requiring further evidence.” It includes alternative mechanisms and observations that would help discriminate them. The system never upgrades an association to an established causal finding. Prompt injection in retrieved text must not grant access to credentials or execute analysis tools; the model receives only allowlisted operations.

Evaluation includes wrong-unit prompts, requests for unsupported causes, nonexistent datasets, missing-data results, short records, nonsignificant results and deliberately conflicting documentation. AI output is optional in exports and stores model version, prompt-template version, retrieved source identifiers and the original computed result. It contributes no hidden chain-of-thought; the evidence and method are the explanation.

# 21 Technical architecture
Use a modular monolith with separate worker processes. A small team can maintain one repository, one API and a bounded set of scientific adapters more reliably than a collection of independently deployed microservices.

| Component | Proposed technology | Purpose and boundary |
| Web client | React and TypeScript | Investigation state, accessible forms and evidence views |
| Map | MapLibre GL JS | Display tiled scientific layers and validated polygons [31] |
| Charts | Vega-Lite or a small D3 layer | Linked series and accessible SVG output; choose one primary library |
| API | Python FastAPI with typed request models | Validate configurations, serve metadata and schedule analysis [32] |
| Scientific engine | NumPy, SciPy, statsmodels, xarray | Numeric estimation and labeled arrays [27–29] |
| Spatial processing | Rasterio, Shapely, pyproj, reviewed regridding | Geometry, raster windows and physical-area weights |
| Batch worker | Python task worker; Redis-backed queue if needed | Isolate expensive jobs, retries and resource limits |
| Parallel arrays | Dask locally before distributed deployment | Process larger-than-memory cubes with controlled chunks [29] |
| Metadata store | PostgreSQL with PostGIS | Regions, configurations, jobs and immutable investigation metadata |
| Scientific storage | Object storage with NetCDF/Zarr and derived GeoTIFF | Versioned arrays and source manifests; not raster blobs in SQL |
| Tile delivery | Precomputed tiles or a bounded raster tile service plus CDN | Keep browser requests small and independent of raw NASA downloads |
| Reporting | Server templates reading result objects | Reproducible figures, citations and reports |
| Deployment | Containers on one managed host plus object storage | Reproducible runtime without an initial Kubernetes requirement |

The architecture has two distinct paths. The ingestion worker talks to NASA services and writes validated versioned cubes. The analysis worker reads those cubes and writes immutable results. The API exposes only approved result objects and bounded jobs. The browser receives tiles and compact series, not raw global archives. This separation protects responsiveness and preserves reproducibility if a source service is temporarily unavailable.

Anonymous users can explore public data and run bounded jobs. Sign-in is optional for private saved investigations and collaboration. NASA acquisition credentials remain server-side and never enter share URLs, client bundles or logs. Store secrets in the deployment secret manager and rotate them through the supported provider mechanism.

Log job identifiers, configuration hashes, source versions, durations, memory use and failure codes. Monitor queue delay, failed ingestion, stale releases, missing-month changes and numeric regression failures. A worker memory cap should fail a job cleanly rather than crash the API. Pin dependency versions after the acquisition spike; upgrade only with the frozen scientific regression suite.

# 22 Data model and schema
| Entity | Essential fields and constraints |
| Mission and instrument | id, official_name, agency, platform, documentation_url; many-to-many relationship to datasets |
| Dataset release | id, short_name, version, DOI, CMR concept and revision, source_metadata_hash, acquired_at, coverage, status |
| Variable | id, release_id, source_field, scientific_name, units, kind, level, native_grid, time_support, QA_policy_id |
| Granule | id, release_id, source_url, source_revision, checksum, time_bounds, footprint, byte_count, processing_state |
| Region | id, geometry, CRS, geometry_hash, name, boundary_source and version, area, privacy |
| Processing recipe | id, adapter_version, scale_rules, QA_bits, units_transform, temporal_rule, spatial_weights_hash |
| Analysis configuration | id, canonical_JSON, SHA256, dataset_release_ids, region_ids, dates, estimator and parameters, baseline, family_id |
| Job | id, config_id, state, created_at, worker_version, progress_stage, errors, resource_usage |
| Result | id, config_id, units, slope, interval, raw_p, adjusted_p, diagnostics, n_valid, coverage, assets and hashes |
| Test family | id, domain_geometry, grid_hash, variable, period, method, eligibility_mask_hash, number_tested, adjustment |
| Investigation | id, owner_nullable, title, parent_snapshot, config_ids, findings, visibility, immutable_published_at |
| Finding | id, investigation_id, result_ids, text, interpretation_level, caveats, citations, author_revision |
| Citation | id, title, authors_or_agency, DOI_or_URL, release, access_date, source_snapshot_hash |

Results are immutable after publication. A modified configuration creates a new result, even if only a baseline or QA threshold changes. Model unresolved values as null with a reason code; zero must retain its numerical meaning. Store native precision and avoid serializing NaN as invalid JSON.

Normalize scientific identifiers and references, but retain a versioned JSON configuration for reproducibility. Do not require every future statistical parameter to become a new database column. Enforce uniqueness of a configuration hash within the corresponding code and data release, and use transactional publication so a result cannot appear before its assets are complete.

# 23 API contracts
All routes below are proposed application endpoints, not NASA service endpoints. Use a versioned prefix /v1. Responses include request_id, schema_version and data_release when applicable. Long jobs return HTTP 202; users poll a job resource or subscribe to status updates. Read operations do not mutate snapshots.

| Endpoint | Request | Response or behavior |
| GET /datasets | Optional domain and status filters | Approved releases, provenance and available coverage |
| GET /variables | dataset_id or phenomenon | Units, time support, quality notes and compatible analyses |
| POST /regions | GeoJSON geometry and optional label | Validated geometry id, area and resolution warnings |
| POST /analyses | Typed analysis configuration | job_id, config_hash and validated or rejected eligibility |
| GET /jobs/{id} | Job identifier | queued, running, failed or complete, with current stage |
| GET /results/{id} | Result identifier | Effect, interval, test status, diagnostics and asset links |
| GET /results/{id}/series | Optional approved variable view | Values, dates, valid coverage and quality flags |
| GET /results/{id}/tiles/{z}/{x}/{y} | Layer and fixed style id | Cached image tile; computation does not run here |
| POST /comparisons | Two results and declared contrast | Compatibility checks and queued paired analysis |
| POST /investigations | Title and result identifiers | Draft id; publication is a separate explicit action |
| POST /investigations/{id}/publish | Visibility and current revision | Immutable share URL and snapshot identifier |
| POST /reports | Snapshot id and export format | Report job and later a signed download link |

## Example analysis request
The following is a contract example with configuration values, not an invented scientific result.

```json
{
  "dataset": "M2TMNXSLV",
  "version": "5.12.4",
  "variable": "T2M",
  "region_id": "registered_region_id",
  "period": {"start": "2001-01-01", "end": "2025-12-31"},
  "aggregation": "annual_day_weighted_mean",
  "method": {"name": "ols_hac", "kernel": "bartlett", "maxlags": 2},
  "quality_profile": "core_complete_annual_v1",
  "baseline": {"start": "2001-01-01", "end": "2020-12-31"},
  "analysis_code_version": "resolved_at_submission"
}
```

A result schema contains slope_per_decade, slope_units, interval_low, interval_high, interval_method, raw_p, adjusted_p, family_id, n_years, coverage_fraction, diagnostics and provenance_id. A withheld result leaves inferential fields null and supplies a status such as insufficient_contiguous_years or unresolved_discontinuity. This is preferable to a fabricated value or a misleading zero.

Validate variable–method compatibility, geometry, period, units and estimated job size before enqueueing. Use HTTP 422 for invalid scientific configurations, 404 for absent resources, 429 for quotas and 503 for transient service unavailability. Deduplicate equivalent jobs with an idempotency key based on canonical configuration, code and frozen source release. Do not expose arbitrary Python, SQL, URLs or filesystem paths through these contracts.

# 24 Performance and cost strategy
The core has approximately 208,000 native MERRA-2 cells and 6.48 million native IMERG cells per time step. Reducing IMERG to the chosen 0.5° analysis grid brings a global field to approximately 259,000 cells. At 25 annual values per cell, a global mean-trend computation is tractable in chunks; bootstrap inference at every native high-resolution pixel is a very different workload.

Precompute a small set of fixed variable–period–method maps. Store slope, standard error, valid count, diagnostics and adjusted-test status as derived layers. Arbitrary periods are queued and cached, not recomputed on each slider movement. Debounce changes and require an explicit Analyze action for expensive work.

For regional series, cache polygon weights and read only intersecting cube chunks. Choose time-contiguous chunks for regression and spatial tiles for map extraction; benchmark whether separate analysis and serving layouts are warranted. An initial chunk holding 540 months by 64 by 64 float32 cells is about 8.8 MB per variable, before temporary arrays. Do not launch more tasks than the worker memory budget allows. [29]

Keep browser payloads to tiles and compact time series. Target less than 1 MB for a typical region-result JSON and progressively load diagnostics. Use a web worker only for client-side geometry simplification or visual transformations; authoritative science remains on the server. The map renderer must not trigger live NASA archive downloads.

Initial planning envelope: one 8-vCPU worker with 32 GB RAM, a smaller API process and 50–200 GB of working storage for selected products and revisions. This is an engineering estimate, not a measured requirement or current cloud quote. Benchmark ten representative jobs, including worst-case polygons, before purchasing larger infrastructure. Set a configurable monthly spending cap and job quota; calculate cost from observed compute-hours, storage-months and egress rather than assuming public data imply free operation.

Acceptance targets are cached map interaction below one second, cached region results p95 below two seconds, and uncached jobs acknowledged below one second with asynchronous completion. Benchmark at ten concurrent exploratory users on a declared deployment. Publish measured completion ranges for heavy jobs instead of promising a universal turnaround time.

# 25 Reproducible investigation record
A reproducible record preserves the scientific target and every transformation that affects the answer. A share URL alone is insufficient if it resolves to changing data. Published snapshots retain source manifests and result checksums; a newer analysis is a separate linked record.

The downloadable bundle contains investigation.json, source_manifest.json, processing_recipe.json, results.json, regional_series.csv, citations.bib and the exported figures. Geospatial outputs include a GeoTIFF or NetCDF with coordinate metadata where applicable. A reproducibility README gives the exact container digest, dependency lockfile, command and expected output hashes or numerical tolerances.

| Record group | Required contents |
| Identity | Schema version, investigation id, author or anonymous status, creation and analysis timestamps |
| Scientific target | Question, variable definition, units, geometry and hash, dates, season and estimand |
| Source | Dataset DOI, release, granule identifiers and revisions, checksums, acquisition date |
| Preparation | Scale and offset, fill mask, QA policy, calendar, unit conversion and aggregation |
| Spatial support | Native and analysis grids, bounds, masks, polygon weights and regridding method |
| Inference | Estimator, covariance settings, interval procedure, test family, adjustment and random seed |
| Diagnostics | Coverage, excluded values and reasons, residual checks and sensitivity results |
| Results | Full-precision estimates, uncertainty, valid tests, statuses and result-asset checksums |
| Interpretation | Finding text, evidence level, caveats, hypotheses and source citations |
| Runtime | Code commit, container digest, library versions and deterministic settings |

Bitwise identity is desirable for stored files but not guaranteed across numerical libraries and hardware. Define variable-specific tolerances for regenerated numeric values, while configuration and manifest hashes must match exactly. Never advertise a result as reproducible when the input archive or recipe is unavailable. If licensing or storage policy prevents redistribution of a source file, retain its authoritative identifier, checksum and retrieval procedure.

# 26 Scientific validation framework
## Validation layers
**Acquisition validation** confirms the right product and release, not merely a successful HTTP response. Check actual metadata, dimensions, time bounds, units, fill values, geographic extent and checksums. Manually inspect one source granule and its decoded output for every adapter.

**Numerical validation** compares slopes, covariance and regional weights with independent small reference calculations. Test constant fields, known ramps, a single missing month, leap years, dateline polygons and latitude-dependent cell areas. Constant series require a defined zero-variance status rather than division by zero or an artificial significant result.

**Statistical validation** uses synthetic data solely as labeled algorithm test fixtures. No generated measurement enters production maps or demonstrations. Simulate independent noise, weak and strong serial dependence, changing variance, seasonality, outliers, missingness related to the signal, steps and long-memory stress cases. Some cases are expected to trigger withholding rather than produce valid inference.

For at least 1,000 independent null realizations in each supported scenario, estimate empirical false-positive frequency. For the initial nominal 5% test, a proposed acceptance range of 3–7% is a practical screening gate; report binomial Monte Carlo uncertainty and investigate systematic inflation. For nominal 95% intervals, target 93–97% coverage across supported scenarios. These targets are finite-simulation criteria, not theoretical guarantees.

For spatial tests, simulate correlated fields containing both null and known nonzero slopes. Measure false discovery proportion per realization, average it and report Monte Carlo uncertainty. Verify that the adjusted procedure controls the intended rate under the tested conditions. FDR adjustment cannot repair systematically invalid local p-values. Test a correlated null field separately from a mixture with genuine signals. [24,25]

**Scientific comparison** reproduces a matching official-tool regional series where available, using the same product, dates and averaging rules. Giovanni is useful here, but differing masks or algorithms must be reconciled before declaring a discrepancy a software defect. GISTEMP provides broad temperature context, not a direct pixelwise reference for MERRA-2 or MODIS. [12,13,16]

**External evidence review** compares direction and spatial behavior with relevant published studies only after matching quantity, period, scale and method. A disagreement can arise from a genuine different question. The team must document those differences rather than tune the application until it reproduces a preferred conclusion.

## Required test cases
| Test | Expected result |
| Packed MODIS value and fill code | Scale once; exclude fill before conversion |
| Precipitation rate across February in leap and common years | Correct hours and annual accumulation |
| Descending latitude and 0–360° longitude | Correct location after normalization |
| Polygon crossing the dateline | Same area and statistics as its equivalent split geometry |
| Tiny polygon on a coarse grid | Footprint warning; no false high-resolution claim |
| Missing annual month | Annual total withheld; no silent zero replacement |
| Signal-dependent missingness | Coverage warning and failed robustness if bias is material |
| Serially correlated null series | Calibrated test or withheld unsupported condition |
| Sensor-like step | Diagnostic flag; no automatic climatic explanation |
| Repeated p-values and empty test family | Stable adjusted values and explicit empty status |
| Region pair with shared variability | Paired contrast preserves covariance |
| Changed source granule | New release and configuration hash; old snapshot unchanged |
| Export round trip | Dates, units, methods and numerical values retained |

Maintain a frozen real-data regression subset with source checksums. Use unit tests for scientific transformations and integration tests for the complete pipeline. A science reviewer signs off on variable definitions, a statistical reviewer checks inference, and a developer who did not write the adapter reruns its manifest. If those roles must be shared in a small team, record the limitation and seek external review for the most consequential methods.

# 27 Concrete investigation protocols
These are implementable scenarios, not assertions that the indicated regions have a particular significant trend. Use actual archived values and accept an inconclusive outcome. Bounding boxes below are WGS84 and ordered west, south, east, north. They are transparent study supports rather than official administrative boundaries.

## Investigation A Regional precipitation contrasts
**Question.** Do broad western and eastern portions of the Sahel exhibit different precipitation tendencies over 2001–2025? **Data.** D2 monthly Final precipitation, with D1 temperature as a follow-up. **Regions.** Western box −15°, 10°, 0°, 18° and eastern box 15°, 10°, 30°, 18°, restricted to the frozen land mask.

**Analysis.** Convert rates to monthly totals, require complete annual totals, compute area-weighted regional series, fit OLS/HAC and estimate the slope of the paired difference. Run the predefined period and covariance sensitivity checks. **Visuals.** Regional map, two annual-total charts, contrast interval and optional temperature series. **Statistical interpretation.** Opposite signs are an empirical question; describe contrast evidence and multiplicity/selection status explicitly.

**Caveats and challenge value.** These boxes contain heterogeneous environments and do not isolate a single mechanism. Gauge and satellite sampling changes matter. The scenario demonstrates spatial heterogeneity with a mission-derived quantity; it must not be titled “Sahel reversal confirmed” before analysis. If signs are the same, explain differing magnitudes and use the discovery protocol below for the opposite-direction requirement.

## Investigation B Systematic opposite direction discovery
**Question.** Where does the same precipitation variable show supported opposite trend directions under a fixed analysis? **Data and domain.** D2, 2001–2025, predefined global 0.5° land grid with eligible cells. **Analysis.** Compute the full family, apply the declared adjustment, group neighboring candidate cells for navigation and select two physically interpretable areas after viewing their records.

**Visuals.** A map with candidate regions, linked series, coverage and the selection history. **Statistical interpretation.** The discovery is exploratory and uses the same data that selected the regions. A follow-up fixed-region analysis can clarify the pattern but is not independent confirmation. **Caveats.** No supported pair may remain; return that result honestly. A shorter seasonal analysis is a separate exploratory question, not a hidden rescue attempt.

This protocol directly tests the challenge’s spatial contrast requirement without preselecting a desired scientific outcome. The final demo must use an actually computed and reviewed pair, or explicitly explain why the available evidence does not support one.

## Investigation C Surface temperature and vegetation in Bangladesh
**Question.** How do clear-sky surface temperature and seasonal vegetation indices vary across two broad study areas? **Data.** D3 and D4, 2001–2021 initially. **Regions.** Northwest box 88.0°, 24.0°, 89.5°, 26.0° and southwest box 89.0°, 22.0°, 90.0°, 23.5°; clip to a reviewed land mask and show the footprints. Bangladesh is a demonstration location, not an assumed user residence.

**Analysis.** Inspect data coverage first, choose a fixed scientifically reviewed season, decode QA, aggregate to a common coarse regional grid and compare slopes. Show day and night LST separately. Compute descriptive detrended association with EVI and NDVI as sensitivity views. **Visuals.** Coverage heatmap, regional series, paired trend signs and detrended scatterplot.

**Caveats and value.** Irrigation, crop calendars, land cover, clouds and orbit timing complicate interpretation. The 2001–2019 sensitivity interval is too short for the default inferential profile and remains descriptive. No soil report is needed for this investigation; it also cannot produce a farm prescription, soil-fertility estimate or crop-yield claim. The case demonstrates interconnected-system questions while making sampling limits visible.

## Investigation D Basin storage and precipitation
**Question.** How do total water storage anomalies and precipitation vary across the Ganges–Brahmaputra basin? **Data.** D5 and D2, 2003–2025 subject to observed epochs; use a cited, versioned basin polygon rather than a country boundary. **Analysis.** Area aggregation at GRACE-appropriate support, preserved gaps and a reviewed specialist trend method only if implemented. **Visuals.** Storage anomalies with gaps and uncertainty, aligned precipitation and a methods panel.

**Interpretation and caveats.** Storage integrates multiple water components. An association does not establish pumping or a precipitation-driven causal response. Intermission gaps and correlated mascon errors remain explicit. This advanced example tests whether the product can admit that its default engine is unsuitable rather than forcing every dataset through one pipeline.

## Investigation E Long record temperature context
**Question.** How does broad near-surface warming context differ between a high-latitude land region and a tropical land region? **Data.** D1 for 1981–2025, with D9 global context kept separate. **Regions.** Use published frozen land-region polygons and store their source and version. **Analysis.** Annual means, regional slopes, paired contrast and start-date sensitivity. **Visuals.** Aligned time series and interval plot.

**Interpretation and caveats.** Both regions may warm; this illustrates differences in magnitude, not necessarily opposite directions. GISTEMP’s global surface-temperature analysis is a contextual benchmark, not a validation of every MERRA-2 regional value. This scenario provides a long-record demonstration when an optical case is coverage-limited.

# 28 Advanced capability roadmap
| Capability | Value | Feasibility and acceptance condition |
| Automatic opposite-trend candidates | Makes spatial heterogeneity discoverable | Medium; fixed family, quality filters and retained selection history |
| Sensitivity workspace | Shows dependence on reasonable choices | Medium; bounded parameter set and result caching |
| Seasonal trend fields | Reveals hidden seasonal differences | Medium; declare additional test families and calendar rules |
| Cross-variable residual association | Tests a different question from co-trending | High; validate temporal null before inferential labels |
| Change-point analysis | Distinguishes linear summaries from steps | High; selection-aware inference and product-event annotations |
| Multi-scale regional analysis | Exposes aggregation dependence | Medium to high; preserve area weights and scale labels |
| GRACE storage module | Adds hydrological depth | High scientific cost; irregular times and covariance review |
| Scientific narrative assistant | Makes evidence easier to read | Medium; optional and fully grounded in typed outputs |
| Downloadable notebook | Supports external reproduction | Medium; generate from frozen recipe and pin dependencies |
| Collaborative investigation | Supports review and teaching | Medium; identity, revisions and explicit sharing controls |
| Temporal animation | Supports pattern exploration | Low to medium after tile pipeline; no inferential claim |
| Cross-mission consistency | Tests product disagreement | High; overlap, sampling and calibration analysis first |

Select at most two P1 extensions for the eight-week full-product target after the core passes. A completed sensitivity workspace is more valuable than four partially validated new domains.

# 29 Eight week development plan
This is a product-development schedule. For an eligible competition entry, apply the event’s permitted preparation rules and begin submitted-solution work only when allowed. An eight-week continuation beginning after 15 November 2026 is one compatible planning option; the table uses relative weeks so it does not imply permission to prebuild a submission. [1,2]

| Week | Goals and deliverables | Dependencies and definition of done |
| 1 | Confirm estimands; acquire sample D1/D2 granules; review metadata; create reference notebook and catalog | Data access works, units and dimensions verified, one real regional series reproduced; fallback scope chosen if access fails |
| 2 | Freeze historical manifests; build adapters, quality checks and normalized cubes; geometry and time tests | Week 1 source contracts; repeatable ingestion completes for the chosen subset and all calendar/unit tests pass |
| 3 | Implement annual trend engine, HAC inference, diagnostics and test-family adjustment | Stable cubes; synthetic calibration report and independent numeric comparison pass supported scenarios |
| 4 | Implement region weights, paired contrasts, API and job states; precompute first maps | Validated engine; one end-to-end real investigation completes and reproduces from its configuration |
| 5 | Build linked map/series workspace, evidence panel, save and export; test accessibility | Stable result schema; five users attempt the primary journey and interpretation problems are recorded |
| 6 | Add predefined sensitivity views and one full-product extension, preferably regional MODIS | Core scientific acceptance; extension passes adapter review or is removed from release |
| 7 | Conduct scientific review, real-data regression tests, load tests and report QA | Feature freeze; critical errors resolved, latency measured, uncertainty language reviewed |
| 8 | Deploy, document, rerun from clean environment, prepare demo and recovery recording | Reproducible release tag, complete source list, reviewed demos and no unresolved critical scientific defects |

The scientific/data stream and UX/backend stream can run in parallel after Week 1 defines variable and result contracts. UI development should use genuine small real-data subsets and clearly labeled algorithm fixtures only in tests. Avoid a mock scientific demo that later becomes mistaken for production evidence.

The critical path is acquisition, correct aggregation, valid inference, reproducible results and understandable presentation. AI, animation, collaboration and additional domains are postponed if any critical-path step slips. Reserve at least one week for validation and defect correction. A four-person team should plan approximately 15–20 hours per person per week, an explicit 480–640 person-hour assumption; lower availability requires removing full-product extensions.

Major schedule risks are source-service access, unresolved sampling bias and statistical calibration. By the end of Week 2, stop adding datasets. By the end of Week 4, freeze the core result schema. By the end of Week 6, remove incomplete advanced features rather than weakening validation.

# 30 Team and workstreams
| Workstream | Suggested owner | Responsibilities and handoff |
| Scientific analysis | Science lead | Estimands, variable definitions, caveats, demonstrations and review of findings |
| Data engineering | Data lead | NASA acquisition, adapters, QA, manifests and normalized cubes |
| Statistical backend | Backend lead with science lead | Estimation, diagnostics, test families, jobs and API contracts |
| Frontend and visualization | Frontend lead | Maps, charts, investigation workflow and accessible evidence views |
| UX and communication | Shared or fifth member | User testing, report templates, lessons and demo narrative |
| Validation and release | Rotating reviewer or sixth member | Independent reproduction, regression suite, deployment and documentation |

For four students, combine data/backend operations and share communication, but keep review separate from implementation where possible. Hold two short integration sessions weekly around a real investigation, not just feature status. Every scientific change needs a corresponding result-schema, documentation or validation update. An external Earth-observation or statistics mentor is more useful at review checkpoints than as an assumed full-time contributor.

# 31 Scope tiers
**Core Scientific Product.** D1 and D2, annual analysis, global precomputed maps, predefined regions plus bounded polygons, manual two-region comparison, valid significance policy, provenance, CSV/JSON/chart exports and three reviewed real-data investigations. It answers all essential challenge questions without AI or local field data.

**Full Product.** Add predefined sensitivity comparisons, an opposite-trend candidate workflow, selected regional D3/D4 investigations, anomaly/season views, descriptive multivariable association, immutable server snapshots and a readable report export. This is the eight-week target only if the core passes by Week 4.

**Ambitious Research Product.** Add one specialist domain, a validated monthly inference engine, dependence-aware association tests, change-point analysis or collaborative notebooks. These are alternatives, not a mandatory combined list. A two-month student project should not promise global high-resolution coverage and comprehensive Earth-system attribution.

Release blocking defects include incorrect units, fill values treated as observations, missing months treated as zeros, unadjusted significance presented as map-wide evidence, unreproducible source revisions and unsupported causal wording. Cosmetic polish and optional AI do not compensate for these failures.

# 32 Risk register
| Risk | Consequence | Mitigation and owner |
| Dataset access or authentication fails | Pipeline cannot acquire real data | Week 1 sample acquisition, documented manual fallback; data lead |
| API limits or upstream outage | Ingestion stalls | Bounded retries, checkpoints, preacquired immutable data; data lead |
| Excessive archive size | Schedule and storage overrun | Variable subsets, coarse global grids and regional high-resolution data; data lead |
| Resolution mismatch | False local precision or association | Common support and visible native footprint; science lead |
| Temporal mismatch | Invalid comparisons | Explicit time bounds, complete common periods and calendar tests; backend lead |
| Missingness depends on conditions | Biased trend | QA coverage plots, fixed-support sensitivity and withholding; science lead |
| Sensor or observing-system change | Artificial change | Product-event annotations, version control and specialist review; science lead |
| Serial dependence | Overconfident tests | Calibrated covariance and resampling, diagnostic limits; statistics reviewer |
| Multiple comparisons | False discoveries | Fixed test family, adjusted values and exploration history; backend lead |
| Low power and false negatives | “No change” misinterpretation | Report intervals, record length and detection limits; science lead |
| Measurement uncertainty absent | Incomplete uncertainty claim | Label statistical interval and omitted uncertainty components; science lead |
| Visual encoding bias | Users misread evidence or direction | Separate magnitude, missingness and evidence encodings; UX lead |
| AI hallucination | Unsupported finding | Optional grounded generation and deterministic fallback; backend lead |
| Causal overclaim | Misleading scientific or planning use | Typed interpretation levels and report review; science lead |
| Memory or job overload | Unresponsive service | Chunk limits, queue quotas and asynchronous processing; backend lead |
| Infrastructure cost | Unsustainable operation | Measured workload, budget cap and cached products; release lead |
| Source revision | Old result no longer reproducible | Immutable manifests, snapshots and retained raw subsets; data lead |
| Scope growth | Validation is displaced | Tiered scope, Week 6 freeze and explicit feature removal; team lead |
| User-selected periods | Selective inference | Record all configurations and label exploratory findings; UX and science leads |
| Competition timing mismatch | Submission eligibility risk | Follow final rules; separate eight-week product from event build; team lead |

# 33 Challenge traceability and historical evidence
| Challenge intent | Scientific interpretation | Data and analysis | Feature and visualization | User outcome |
| Directional environmental change | Estimate a quantity over time | D1/D2 annual summaries and slope | F3 series and fit | Understand direction and rate |
| Interconnected system | Compare relevant variables cautiously | D1–D2 common support; D3–D4 extension | F7 linked charts and scatterplot | Distinguish co-trends from association |
| Regional differences | Preserve spatial heterogeneity | Grid fields and region-weighted series | F2 map and F5 comparison | Locate and compare change |
| Opposite directions | Test actual sign patterns and contrasts | D2 fixed-field discovery and paired analysis | Candidate map and contrast interval | Examine a supported or inconclusive contrast |
| NASA mission or model variables | NASA science drives computation | D1 NASA model and D2 mission-derived product | F1 catalog and F8 provenance | Identify the source of each result |
| Temporal visualization | Expose the record behind a summary | Original accepted values and anomalies | F3 and F6 | See variability, seasons and gaps |
| Magnitude | Preserve physical units | Per-decade slope and fitted interval change | Numeric effect and interval chart | Quantify how much and how fast |
| Significance | Conditional inference with error control | Eligibility, temporal covariance and map adjustment | F4 evidence layer | Understand strength and limits |

## What previous projects suggest
NASA’s 2024 winner announcement describes Waterwise by GaamaRamma as a data-centered agricultural water application and NVS-knot as an agricultural solution using environmental information. These examples support the relevance of a clear user problem and substantive data use. They do not prove that agriculture has higher win probability or that the described systems were independently validated for operational decisions. [33]

The 2025 announcement includes Twisters’ weather application, QUEÑARIS’ environmental restoration concept and Zumorroda-X’s farming education game. The range suggests that technical tools, local relevance and understandable scientific experiences can all be recognized. This is an inference from selected examples, not a causal explanation of judges’ decisions. [34]

A focused review of these official winner descriptions cannot establish how every participant treated a problem, the strength of all finalist implementations or the reasons each judge voted. There is no controlled comparison against unsuccessful teams or complete public scoring dataset here. Consequently, the product strategy is to demonstrate correct science, useful interaction, reproducibility and a coherent story, without claiming a numerical chance of winning.

Before event submission, map this blueprint to the actual 2026 judging rubric and complete challenge resources. Do not assume that a previous year’s rubric, award category or preferred technology remains unchanged.

# 34 Demonstration strategy
Prepare a five-minute live demonstration backed by a saved real-data snapshot and a short screen recording for network failure. The demonstration must be rehearsed on actual results; no direction, significance or regional contrast is predetermined.

| Time | Action | Evidence judges should see |
| 0:00–0:30 | State the user question and why regional averages can mislead | A clear variable and two comparable regions |
| 0:30–1:10 | Open the fixed precipitation investigation and inspect the map | NASA product, period, units and analysis scale |
| 1:10–2:00 | Select regions and reveal annual histories | Actual observations, slope and uncertainty |
| 2:00–2:40 | Toggle evidence and explain the regional contrast | Adjustment family, paired difference and caveat |
| 2:40–3:20 | Change one predefined sensitivity setting | Whether the conclusion survives a reasonable alternative |
| 3:20–4:00 | Add temperature or a reviewed regional vegetation example | Co-variation clearly separated from causation |
| 4:00–4:35 | Open provenance and methods | Source release, QA, transformations and diagnostics |
| 4:35–5:00 | Export and state the qualified finding | Reproducible record and an honest limit |

The opening narrative can be: “A map can show change without showing whether the evidence supports it. We let you inspect both.” The final finding should name the actual result and its uncertainty, not a generic promise to solve climate change.

If no supported opposite-direction pair exists under the selected settings, explain that outcome and show another reviewed, explicitly distinct investigation. Never alter dates during a demo solely to manufacture significance. The most convincing failure case is a visually striking pattern that the application correctly flags as unsupported.

# 35 Documentation and release package
| Document | Required contents | Owner |
| Overview | User problem, scope tiers, core journey and NASA contribution | Team lead |
| Challenge interpretation | Exact supplied passage and requirement mapping | Science lead |
| Data catalog and dictionary | Identifiers, units, releases, quality policies, fields and access | Data lead |
| Scientific methods | Estimands, aggregation, trends, uncertainty, assumptions and limitations | Science and statistics leads |
| Spatial methods | Areas, masks, grids, regridding and polygon edge cases | Data lead |
| Architecture | Components, job flow, deployment and security | Backend lead |
| API reference | Schemas, examples, status codes, limits and compatibility rules | Backend lead |
| Reproducibility guide | Manifests, container, rerun command and numeric tolerances | Release lead |
| Validation report | Synthetic calibration, real-data comparisons and unresolved limits | Independent reviewer |
| User guide | Investigation workflow, uncertainty language and export | UX lead |
| Developer guide | Adapter contract, local setup, tests and contribution process | Data and backend leads |
| Deployment guide | Secrets, migrations, storage, monitoring, backup and rollback | Release lead |
| Demo guide | Real snapshots, interpretation, timing and failure recovery | Communication lead |
| References | Dataset citations, methods papers, official tools and access dates | Science lead |

The release package contains a tagged source repository, locked runtime, catalog, frozen demonstration manifests, validation report, installation guide and accessible demo. Document unsupported configurations as explicitly as supported ones. A future contributor should be able to add a dataset only by satisfying the adapter and scientific-review contracts, not by adding a name to a dropdown.

# 36 Sources and references
Sources were checked on 24 September 2026. Dataset endpoints and releases should be rechecked during acquisition. Numbered references distinguish external scientific documentation from design decisions in this blueprint. The exact challenge passage in Section 1 is user-supplied; the linked challenge hub is its official context. Some source portals render metadata dynamically, so collection discovery and authenticated retrieval remain implementation acceptance tests.

[1] NASA Space Apps. Santiago Dominican Republic 2026 local event guidance. Includes the restriction on starting submitted-solution development before the hackathon.
https://www.spaceappschallenge.org/2026/local-events/santiago-dominican-republic/

[2] NASA Space Apps. Rohnert Park 2026 local event. Event dates and full-description release timing.
https://www.spaceappschallenge.org/2026/local-events/rohnert-park/

[3] NASA Space Apps. 2026 challenges hub. Official context for the supplied challenge summary; final brief should be checked when published.
https://www.spaceappschallenge.org/2026/challenges/

[4] Global Modeling and Assimilation Office. MERRA-2 tavgM_2d_slv_Nx monthly single-level diagnostics V5.12.4. GES DISC. DOI 10.5067/AP1B0BA5PD2K.
https://doi.org/10.5067/AP1B0BA5PD2K
https://disc.gsfc.nasa.gov/datasets/M2TMNXSLV_5.12.4/summary

[5] NASA GPM. IMERG Integrated Multi-satellitE Retrievals for GPM. Product behavior, runs, units and latency discussion.
https://gpm.nasa.gov/data/imerg

[6] Wan, Z., Hook, S. and Hulley, G. MODIS Terra Land Surface Temperature Emissivity 8-Day L3 Global 1km SIN Grid V061. LP DAAC. DOI 10.5067/MODIS/MOD11A2.061.
https://doi.org/10.5067/MODIS/MOD11A2.061

[7] NASA LP DAAC. MODIS Terra Vegetation Indices Monthly L3 Global 1km SIN Grid V061. DOI 10.5067/MODIS/MOD13A3.061.
https://doi.org/10.5067/MODIS/MOD13A3.061
https://ladsweb.modaps.eosdis.nasa.gov/missions-and-measurements/products/MOD13A3

[8] NASA MODIS. Land Surface Temperature and Emissivity product overview.
https://modis.gsfc.nasa.gov/data/dataprod/mod11.php

[9] NASA MODIS. Vegetation Indices product overview and algorithm context.
https://modis.gsfc.nasa.gov/data/dataprod/mod13.php

[10] NASA Terra. Orbital changes and impacts from orbital drift.
https://terra.nasa.gov/topics/orbital-changes
https://terra.nasa.gov/about/terras-orbit-changes/terra-orbital-drift-information/impacts-from-orbital-drift
https://science.nasa.gov/science-research/earth-science/terra-the-end-of-an-era/

[11] NASA GMAO. MERRA-2 Input Observations Summary and Assessment. NASA Technical Reports Server record 20160014544. Observing-system changes and reanalysis interpretation.
https://ntrs.nasa.gov/search.jsp?R=20160014544
https://gmao.gsfc.nasa.gov/science-snapshots/merra-2-observing-system-time-series/

[12] NASA Earthdata. Giovanni tool overview.
https://www.earthdata.nasa.gov/data/tools/giovanni

[13] NASA GES DISC. Giovanni user manual and release documentation. Includes trend-line capabilities and interpretation caveat.
https://giovanni.gsfc.nasa.gov/giovanni/doc/UsersManualworkingdocument.docx.html

[14] NASA AppEEARS. API documentation. Product discovery, authentication, extraction tasks and output resources.
https://appeears.earthdatacloud.nasa.gov/api/

[15] NASA Earthdata. Common Metadata Repository Search API documentation.
https://cmr.earthdata.nasa.gov/search/site/docs/search/api.html

[16] NASA GISS. GISS Surface Temperature Analysis GISTEMP v4 and downloadable data.
https://data.giss.nasa.gov/gistemp/
https://data.giss.nasa.gov/gistemp/data_v4.html

[17] NASA NSIDC DAAC. SMAP L4 Global 3-hourly 9 km EASE-Grid Surface and Root Zone Soil Moisture Geophysical Data V008. SPL4SMGP.008.
https://www.earthdata.nasa.gov/data/catalog/nsidc-cprd-spl4smgp-008

[18] NASA JPL and PO.DAAC. GRACE and GRACE-FO JPL Mascon Coastal Resolution Improvement Filtered RL06.3 Version 04. DOI 10.5067/TEMSC-3JC634.
https://podaac.jpl.nasa.gov/dataset/TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4
https://grace.jpl.nasa.gov/data/get-data/jpl_global_mascons/

[19] NASA CERES. EBAF Edition 4.2.1 products and ordering tool. DOI 10.5067/TERRA-AQUA-NOAA20/CERES/EBAF_L3B004.2.1.
https://ceres.larc.nasa.gov/Data/
https://ceres-tool.larc.nasa.gov/ord-tool/jsp/EBAF421Selection.jsp

[20] NASA NSIDC DAAC. MODIS Terra Snow Cover Monthly L3 Global 0.05Deg CMG Version 61. DOI 10.5067/MODIS/MOD10CM.061.
https://nsidc.org/data/mod10cm/versions/61

[21] NASA Earthdata earthaccess project. Authentication, discovery and access documentation.
https://earthaccess.readthedocs.io/en/latest/

[22] Hirsch, R. M., Slack, J. R. and Smith, R. A. 1982. Techniques of trend analysis for monthly water quality data. Water Resources Research 18, 107–121. DOI 10.1029/WR018i001p00107.
https://pubs.usgs.gov/publication/70011649

[23] Hamed, K. H. and Rao, A. R. 1998. A modified Mann-Kendall trend test for autocorrelated data. Journal of Hydrology 204, 182–196. DOI 10.1016/S0022-1694(97)00125-X.
https://doi.org/10.1016/S0022-1694(97)00125-X

[24] Wilks, D. S. 2016. The Stippling Shows Statistically Significant Grid Points How Research Results are Routinely Overstated and Overinterpreted and What to Do about It. Bulletin of the American Meteorological Society 97, 2263–2273. DOI 10.1175/BAMS-D-15-00267.1.
https://journals.ametsoc.org/view/journals/bams/97/12/bams-d-15-00267.1.xml

[25] Benjamini, Y. and Yekutieli, D. 2001. The control of the false discovery rate in multiple testing under dependency. Annals of Statistics 29, 1165–1188. DOI 10.1214/aos/1013699998.
https://doi.org/10.1214/aos/1013699998
https://www.math.tau.ac.il/~yekutiel/papers/papers.html

[26] Wasserstein, R. L. and Lazar, N. A. 2016. The ASA Statement on p-Values Context Process and Purpose. The American Statistician 70, 129–133. DOI 10.1080/00031305.2016.1154108.
https://doi.org/10.1080/00031305.2016.1154108

[27] SciPy developers. scipy.stats.theilslopes reference. Estimator and interval behavior.
https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.theilslopes.html

[28] statsmodels developers. cov_hac reference. HAC covariance and equal-spacing assumption.
https://www.statsmodels.org/stable/generated/statsmodels.stats.sandwich_covariance.cov_hac.html

[29] xarray developers. Parallel computing with Dask. Chunking and lazy execution.
https://docs.xarray.dev/en/stable/user-guide/dask.html

[30] xESMF developers. Comparison of regridding algorithms.
https://xesmf.readthedocs.io/en/stable/notebooks/Compare_algorithms.html

[31] MapLibre project. MapLibre GL JS documentation.
https://maplibre.org/maplibre-gl-js/docs/

[32] FastAPI project. Official documentation.
https://fastapi.tiangolo.com/

[33] NASA. NASA International Space Apps Challenge Announces 2024 Global Winners.
https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-international-space-apps-challenge-announces-2024-global-winners/

[34] NASA. NASA Announces 2025 International Space Apps Challenge Global Winners. 18 December 2025.
https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-announces-2025-international-space-apps-challenge-global-winners/

[35] NASA GISS. GISTEMP Observational Uncertainty Ensemble.
https://data.giss.nasa.gov/gistemp/uncertainty/

[36] Gelaro, R. et al. 2017. The Modern-Era Retrospective Analysis for Research and Applications Version 2 MERRA-2. Journal of Climate 30, 5419–5454. DOI 10.1175/JCLI-D-16-0758.1.
https://doi.org/10.1175/JCLI-D-16-0758.1
https://gmao.gsfc.nasa.gov/gmao-products/merra-2/

[37] NASA GPM and GES DISC. Precipitation data directory and GPM IMERG Final Precipitation L3 1 month 0.1 degree V07. DOI 10.5067/GPM/IMERG/3B-MONTH/07.
https://gpm.nasa.gov/data/directory
https://disc.gsfc.nasa.gov/datasets/GPM_3IMERGM_07/summary

[38] NASA LAADS DAAC. MOD11A2 Collection 6.1 file specification. Scale factors, fields and quality bit definitions.
https://ladsweb.modaps.eosdis.nasa.gov/filespec/MODIS/61/MOD11A2

[39] NASA LAADS DAAC. MOD13A3 Collection 6.1 file specification.
https://ladsweb.modaps.eosdis.nasa.gov/filespec/MODIS/61/MOD13A3

[40] NASA CERES. EBAF Edition 4.2 data quality summary with Edition 4.2.1 discussion, version 5.
https://ceres.larc.nasa.gov/documents/DQ_summaries/Versioned/CERES_EBAF_Ed4.2_DQS_V5.pdf

[41] NASA NSIDC DAAC. MOD10CM Version 61 user guide.
https://nsidc.org/sites/default/files/mod10cm-v061-userguide_0.pdf

[42] NASA LP DAAC. MOD11C3.061 monthly land surface temperature climate-modeling grid. DOI 10.5067/MODIS/MOD11C3.061.
https://doi.org/10.5067/MODIS/MOD11C3.061

[43] NASA LP DAAC. MOD13C2.061 monthly vegetation climate-modeling grid and MOD13 user documentation.
https://www.earthdata.nasa.gov/data/catalog/lpcloud-mod13c2-061
https://www.ctahr.hawaii.edu/grem/mod13ug/Sec-MOD13C1.html


[44] Newey, W. K. and West, K. D. 1987. A Simple Positive Semi-Definite Heteroskedasticity and Autocorrelation Consistent Covariance Matrix. Econometrica 55, 703–708. Author working-paper version at NBER.
https://www.nber.org/papers/t0055

[45] Künsch, H. R. 1989. The Jackknife and the Bootstrap for General Stationary Observations. Annals of Statistics 17, 1217–1241. Author publication archive.
https://people.math.ethz.ch/~kuensch/papers/
