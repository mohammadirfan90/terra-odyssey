/**
 * API client and TanStack Query hooks for Terra Odyssey.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { emitError } from "@/lib/telemetry/error-events";
import type {
  DatasetMetadata,
  DatasetCapabilities,
  CapabilitiesResponse,
  InvestigationRequest,
  JobStatusResponse,
  StructuredGridMapResponse,
  TimeSeriesPayload,
  EvidencePayload,
  CandidatePreset,
  UniversalQueryResponse,
} from "./types";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

const DEFAULT_CAPABILITIES: DatasetCapabilities = {
  discoverable: true,
  previewable: true,
  series_supported: true,
  trend_supported: true,
  contrast_supported: true,
  badges: ["Browse", "View", "Analyze", "Compare"],
  unsupported_reason: null,
};

// Offline developer sample fixtures
export const FALLBACK_DATASETS: DatasetMetadata[] = [
  {
    dataset_id: "merra2_t2m",
    capabilities: DEFAULT_CAPABILITIES,
    title: "MERRA-2 2-meter Air Temperature",
    collection: "M2TMNXSLV",
    version: "5.12.4",
    doi: "https://doi.org/10.5067/VJAFPLI1CSIV",
    data_type: "reanalysis_model",
    citation_statement: "Global Modeling and Assimilation Office (GMAO) (2015), MERRA-2 2D monthly mean t2m, NASA GES DISC.",
    measurement_principle: "Assimilated atmospheric reanalysis model incorporating satellite radiances and conventional observations",
    spatial_resolution: { lat_deg: 0.5, lon_deg: 0.625 },
    temporal_bounds: { start_year: 1980, end_year: 2024 },
    primary_variable: "T2M",
    variables: {
      T2M: {
        variable_name: "T2M",
        long_name: "2-meter Air Temperature",
        standard_units: "K",
        canonical_unit: "degC",
        fill_value: 1e15,
        valid_min: 150.0,
        valid_max: 350.0,
        description: "Monthly mean 2-meter ambient air temperature",
      },
    },
  },
  {
    dataset_id: "gpm_imerg_precipitation",
    capabilities: DEFAULT_CAPABILITIES,
    title: "GPM IMERG Final Monthly Precipitation",
    collection: "GPM_3IMERGM",
    version: "07",
    doi: "https://doi.org/10.5067/GPM/IMERG/3B-MONTH/07",
    data_type: "satellite_retrieval",
    citation_statement: "Huffman et al. (2023), GPM IMERG Final Precipitation L3 1 month 0.1 x 0.1 degree V07, NASA GES DISC.",
    measurement_principle: "Multi-satellite passive microwave and infrared precipitation retrieval with rain gauge calibration",
    spatial_resolution: { lat_deg: 0.1, lon_deg: 0.1 },
    temporal_bounds: { start_year: 2000, end_year: 2024 },
    primary_variable: "precipitationCal",
    variables: {
      precipitationCal: {
        variable_name: "precipitationCal",
        long_name: "Calibrated Precipitation Accumulation",
        standard_units: "mm/hr",
        canonical_unit: "mm/year",
        fill_value: -9999.9,
        valid_min: 0.0,
        valid_max: 50000.0,
        description: "Monthly accumulation of precipitation calibrated with rain gauge networks",
      },
    },
  },
  {
    dataset_id: "gistemp_v4",
    capabilities: DEFAULT_CAPABILITIES,
    title: "NASA GISS Surface Temperature Analysis (GISTEMP v4)",
    collection: "GISTEMP_V4",
    version: "4.0",
    doi: "https://doi.org/10.2767/92882",
    data_type: "surface_observation_analysis",
    citation_statement: "GISTEMP Team (2024), GISS Surface Temperature Analysis (GISTEMP v4), NASA Goddard Institute for Space Studies.",
    measurement_principle: "Centenary surface temperature anomalies over land and ocean with 250 km spatial smoothing",
    spatial_resolution: { lat_deg: 2.0, lon_deg: 2.0 },
    temporal_bounds: { start_year: 1880, end_year: 2024 },
    primary_variable: "temperature_anomaly",
    variables: {
      temperature_anomaly: {
        variable_name: "temperature_anomaly",
        long_name: "Surface Temperature Anomaly (vs 1951–1980)",
        standard_units: "degC",
        canonical_unit: "degC",
        fill_value: 9999.0,
        valid_min: -25.0,
        valid_max: 25.0,
        description: "Monthly surface temperature anomalies relative to the 1951–1980 base period.",
      },
    },
  },
  {
    dataset_id: "nsidc_sea_ice",
    capabilities: DEFAULT_CAPABILITIES,
    title: "NOAA/NSIDC Sea Ice Index (v4)",
    collection: "G02135",
    version: "4.0",
    doi: "https://doi.org/10.7265/N5K072F8",
    data_type: "satellite_retrieval",
    citation_statement: "Fetterer et al. (2017), Sea Ice Index, Version 4, NSIDC / NOAA.",
    measurement_principle: "Passive microwave brightness temperatures calibrated for sea ice extent (>=15% concentration threshold)",
    spatial_resolution: { lat_deg: 0.25, lon_deg: 0.25 },
    temporal_bounds: { start_year: 1978, end_year: 2024 },
    primary_variable: "extent",
    variables: {
      extent: {
        variable_name: "extent",
        long_name: "Sea Ice Extent",
        standard_units: "10^6 km^2",
        canonical_unit: "10^6 km^2",
        fill_value: -9999.0,
        valid_min: 0.0,
        valid_max: 30.0,
        description: "Ocean area with at least 15% sea ice concentration.",
      },
      area: {
        variable_name: "area",
        long_name: "Sea Ice Area",
        standard_units: "10^6 km^2",
        canonical_unit: "10^6 km^2",
        fill_value: -9999.0,
        valid_min: 0.0,
        valid_max: 30.0,
        description: "Actual surface area of ice-covered water excluding open water within floes.",
      },
    },
  },
  /* ── NASA partner agencies ───────────────────────── */
  {
    dataset_id: "noaa_oisst",
    capabilities: DEFAULT_CAPABILITIES,
    title: "NOAA OISST v2.1 Sea Surface Temperature",
    collection: "NOAA_OISST_V2_1",
    version: "2.1",
    doi: "https://doi.org/10.25923/R9PZ-WT56",
    data_type: "satellite_retrieval",
    citation_statement:
      "Huang et al. (2021), NOAA OISST v2.1 daily SST, NOAA NCEI.",
    measurement_principle:
      "Satellite + in-situ blended sea-surface temperature analysis (partner agency)",
    spatial_resolution: { lat_deg: 0.25, lon_deg: 0.25 },
    temporal_bounds: { start_year: 1981, end_year: 2024 },
    primary_variable: "sst",
    variables: {
      sst: {
        variable_name: "sst",
        long_name: "Sea Surface Temperature",
        standard_units: "K",
        canonical_unit: "degC",
        fill_value: -999.0,
        valid_min: -2.0,
        valid_max: 45.0,
        description:
          "Daily mean sea-surface temperature, blended from satellites + ships + buoys.",
      },
      anom: {
        variable_name: "anom",
        long_name: "SST Anomaly (vs 1971–2000)",
        standard_units: "K",
        canonical_unit: "degC",
        fill_value: -999.0,
        valid_min: -10.0,
        valid_max: 10.0,
        description: "Departure from the 1971–2000 monthly climatology.",
      },
    },
  },
  {
    dataset_id: "grace_tws",
    capabilities: DEFAULT_CAPABILITIES,
    title: "GRACE / GRACE-FO Terrestrial Water Storage Mascons",
    collection: "TELLUS_GRAC_L3_JPL_RL06_v04",
    version: "RL06.1",
    doi: "https://doi.org/10.5067/TEMSC-3JC64",
    data_type: "satellite_gravimetry",
    citation_statement: "Watkins et al. (2015), JPL GRACE/GRACE-FO RL06M Mascon Solutions, PO.DAAC.",
    measurement_principle: "Inter-satellite K-band and laser ranging measuring changes in Earth's gravitational field",
    spatial_resolution: { lat_deg: 0.5, lon_deg: 0.5 },
    temporal_bounds: { start_year: 2002, end_year: 2024 },
    primary_variable: "lwe_thickness",
    variables: {
      lwe_thickness: {
        variable_name: "lwe_thickness",
        long_name: "Liquid Water Equivalent Thickness Anomaly",
        standard_units: "cm",
        canonical_unit: "cm",
        fill_value: -9999.0,
        valid_min: -1000.0,
        valid_max: 1000.0,
        description: "Equivalent water thickness anomaly relative to the 2004–2009 mean baseline (11-month mission transition gap uninterpolated).",
      },
    },
  },
  {
    dataset_id: "ceres_ebaf",
    capabilities: DEFAULT_CAPABILITIES,
    title: "CERES EBAF Top-of-Atmosphere Radiative Flux (Ed4.2.1)",
    collection: "CERES_EBAF_Ed4.2.1",
    version: "Ed4.2.1",
    doi: "https://doi.org/10.5067/TERRA+AQUA/CERES/EBAF_L3B004.2",
    data_type: "satellite_retrieval",
    citation_statement: "Loeb et al. (2018), CERES EBAF TOA Edition 4.0/4.2.1, NASA Langley ASDC.",
    measurement_principle: "Broadband scanning radiometers measuring incoming solar, reflected shortwave, and emitted longwave radiation",
    spatial_resolution: { lat_deg: 1.0, lon_deg: 1.0 },
    temporal_bounds: { start_year: 2000, end_year: 2024 },
    primary_variable: "toa_net",
    variables: {
      toa_net: {
        variable_name: "toa_net",
        long_name: "TOA Net Radiative Flux (Downward Positive)",
        standard_units: "W/m^2",
        canonical_unit: "W/m^2",
        fill_value: -999.0,
        valid_min: -50.0,
        valid_max: 50.0,
        description: "Net downward top-of-atmosphere radiative flux (Earth's energy imbalance).",
      },
      toa_sw: {
        variable_name: "toa_sw",
        long_name: "TOA Reflected Shortwave Flux",
        standard_units: "W/m^2",
        canonical_unit: "W/m^2",
        fill_value: -999.0,
        valid_min: 0.0,
        valid_max: 450.0,
        description: "Top-of-atmosphere reflected solar shortwave radiative flux.",
      },
      toa_lw: {
        variable_name: "toa_lw",
        long_name: "TOA Emitted Longwave Flux",
        standard_units: "W/m^2",
        canonical_unit: "W/m^2",
        fill_value: -999.0,
        valid_min: 50.0,
        valid_max: 400.0,
        description: "Top-of-atmosphere outgoing longwave thermal radiative flux.",
      },
    },
  },
  {
    dataset_id: "esa_cci_landcover",
    title: "ESA CCI Land Cover (Copernicus)",
    collection: "ESA_CCI_LC",
    version: "v2.1.1",
    doi: "https://doi.org/10.5285/17f3246adbe44d3cb1a4b80a8c6912cb",
    data_type: "satellite_retrieval",
    citation_statement:
      "ESA (2024), Climate Change Initiative Land Cover dataset, ESA CCI.",
    measurement_principle:
      "Multi-sensor MERIS / PROBA-V / Sentinel-3 classification (partner agency)",
    spatial_resolution: { lat_deg: 0.00278, lon_deg: 0.00278 },
    temporal_bounds: { start_year: 1992, end_year: 2023 },
    primary_variable: "lccs_class",
    variables: {
      lccs_class: {
        variable_name: "lccs_class",
        long_name: "Land Cover Class",
        standard_units: "1",
        canonical_unit: "class",
        fill_value: 0,
        valid_min: 0,
        valid_max: 220,
        description:
          "Discrete land-cover class label (e.g. cropland, forest, urban, water).",
      },
    },
  },
  /* ── Open-source / public-domain ─────────────────── */
  {
    dataset_id: "natural_earth_admin0",
    title: "Natural Earth Admin-0 Countries",
    collection: "NE_ADMIN_0",
    version: "5.1.4",
    doi: "https://www.naturalearthdata.com/",
    data_type: "open_source",
    citation_statement:
      "Natural Earth (public domain) — admin-0 country boundaries (1:110m).",
    measurement_principle:
      "Open-source cartographic boundary dataset (NaturalEarthData.com)",
    spatial_resolution: { lat_deg: 0.0, lon_deg: 0.0 },
    temporal_bounds: { start_year: 2024, end_year: 2024 },
    primary_variable: "geometry",
    variables: {
      geometry: {
        variable_name: "geometry",
        long_name: "Country Polygon",
        standard_units: "1",
        canonical_unit: "feature",
        fill_value: 0,
        valid_min: 0,
        valid_max: 1,
        description: "Public-domain country polygon geometry.",
      },
    },
  },
  {
    dataset_id: "osm_waterways",
    title: "OpenStreetMap Major Waterways",
    collection: "OSM_WATERWAYS",
    version: "2024-06",
    doi: "https://www.openstreetmap.org/copyright",
    data_type: "open_source",
    citation_statement:
      "© OpenStreetMap contributors (ODbL 1.0). Major rivers + lakes.",
    measurement_principle:
      "Volunteer-mapped global hydrology layer (open-source)",
    spatial_resolution: { lat_deg: 0.0, lon_deg: 0.0 },
    temporal_bounds: { start_year: 2024, end_year: 2024 },
    primary_variable: "geometry",
    variables: {
      geometry: {
        variable_name: "geometry",
        long_name: "Waterway Geometry",
        standard_units: "1",
        canonical_unit: "feature",
        fill_value: 0,
        valid_min: 0,
        valid_max: 1,
        description: "OpenStreetMap river / lake geometries (lines + polygons).",
      },
    },
  },
  {
    dataset_id: "copernicus_dem_30",
    title: "Copernicus DEM (GLO-30) Elevation",
    collection: "COP_DEM_GLO30",
    version: "2024",
    doi: "https://doi.org/10.5270/ESA-c5d3d65",
    data_type: "satellite_retrieval",
    citation_statement:
      "ESA & Airbus (2024), Copernicus DEM GLO-30, ESA Earth Observation Portal.",
    measurement_principle:
      "Open-source 30 m global elevation model derived from SAR (partner agency)",
    spatial_resolution: { lat_deg: 0.000277, lon_deg: 0.000277 },
    temporal_bounds: { start_year: 2021, end_year: 2024 },
    primary_variable: "elevation",
    variables: {
      elevation: {
        variable_name: "elevation",
        long_name: "Surface Elevation",
        standard_units: "m",
        canonical_unit: "m",
        fill_value: -9999,
        valid_min: -500,
        valid_max: 9000,
        description:
          "30-metre global digital elevation model above mean sea level.",
      },
    },
  },
  {
    dataset_id: "etopo1_bedrock",
    title: "ETOPO1 Global Relief (NOAA)",
    collection: "ETOPO1",
    version: "1",
    doi: "https://doi.org/10.25923/R4KK-DD27",
    data_type: "open_source",
    citation_statement:
      "NOAA NCEI (2022), ETOPO1 1 arc-minute global relief model.",
    measurement_principle:
      "Open-source blended land topography + bathymetry (partner agency)",
    spatial_resolution: { lat_deg: 0.0166, lon_deg: 0.0166 },
    temporal_bounds: { start_year: 2022, end_year: 2022 },
    primary_variable: "z",
    variables: {
      z: {
        variable_name: "z",
        long_name: "Elevation / Bathymetry",
        standard_units: "m",
        canonical_unit: "m",
        fill_value: -9999,
        valid_min: -11000,
        valid_max: 9000,
        description:
          "Bedrock elevation / ocean depth in metres above sea level (negative = below).",
      },
    },
  },
];

export const CANDIDATE_PRESETS: CandidatePreset[] = [
  {
    id: "arctic-vs-tropics-warming",
    title: "Arctic Amplification vs Tropical Warming",
    dataset_id: "merra2_t2m",
    variable: "T2M",
    period: { start_year: 2000, end_year: 2024 },
    region_a: {
      name: "Barents-Kara Arctic",
      bbox: [30.0, 72.0, 70.0, 82.0],
    },
    region_b: {
      name: "Equatorial Pacific",
      bbox: [-160.0, -5.0, -120.0, 5.0],
    },
    scientific_question: "Does the high Arctic exhibit significantly accelerated warming relative to the equatorial tropics?",
    known_phenomenon: "Polar sea ice albedo feedback vs convective tropical energy transport",
  },
  {
    id: "california-vs-southeast-precip",
    title: "US Southwest Aridification vs Southeast Wetting",
    dataset_id: "gpm_imerg_precipitation",
    variable: "precipitationCal",
    period: { start_year: 2000, end_year: 2024 },
    region_a: {
      name: "California Central Valley",
      bbox: [-122.5, 35.0, -118.5, 39.5],
    },
    region_b: {
      name: "US Gulf Coastal Plain",
      bbox: [-92.0, 30.0, -84.0, 34.0],
    },
    scientific_question: "Do Mediterranean California and the Southeast US display divergent 25-year precipitation trends?",
    known_phenomenon: "Hydroclimate divergence and atmospheric river variability",
  },
];

export const DEFAULT_SERIES = [
  { year: 2000, region_a_value: -14.2, region_b_value: 26.5, difference_value: -40.7, coverage_fraction_a: 1.0, coverage_fraction_b: 1.0 },
  { year: 2001, region_a_value: -13.8, region_b_value: 26.8, difference_value: -40.6, coverage_fraction_a: 1.0, coverage_fraction_b: 1.0 },
  { year: 2002, region_a_value: -13.5, region_b_value: 27.1, difference_value: -40.6, coverage_fraction_a: 1.0, coverage_fraction_b: 1.0 },
  { year: 2003, region_a_value: -14.0, region_b_value: 26.9, difference_value: -40.9, coverage_fraction_a: 1.0, coverage_fraction_b: 1.0 },
  { year: 2004, region_a_value: -13.2, region_b_value: 27.3, difference_value: -40.5, coverage_fraction_a: 1.0, coverage_fraction_b: 1.0 },
  { year: 2005, region_a_value: -12.9, region_b_value: 27.2, difference_value: -40.1, coverage_fraction_a: 1.0, coverage_fraction_b: 1.0 },
  { year: 2006, region_a_value: -13.1, region_b_value: 27.4, difference_value: -40.5, coverage_fraction_a: 1.0, coverage_fraction_b: 1.0 },
  { year: 2007, region_a_value: -12.4, region_b_value: 27.0, difference_value: -39.4, coverage_fraction_a: 1.0, coverage_fraction_b: 1.0 },
  { year: 2008, region_a_value: -12.8, region_b_value: 27.5, difference_value: -40.3, coverage_fraction_a: 1.0, coverage_fraction_b: 1.0 },
  { year: 2009, region_a_value: -12.6, region_b_value: 27.3, difference_value: -39.9, coverage_fraction_a: 1.0, coverage_fraction_b: 1.0 },
  { year: 2010, region_a_value: -12.1, region_b_value: 27.6, difference_value: -39.7, coverage_fraction_a: 1.0, coverage_fraction_b: 1.0 },
  { year: 2011, region_a_value: -12.3, region_b_value: 27.4, difference_value: -39.7, coverage_fraction_a: 1.0, coverage_fraction_b: 1.0 },
  { year: 2012, region_a_value: -11.8, region_b_value: 27.8, difference_value: -39.6, coverage_fraction_a: 1.0, coverage_fraction_b: 1.0 },
  { year: 2013, region_a_value: -12.2, region_b_value: 27.5, difference_value: -39.7, coverage_fraction_a: 1.0, coverage_fraction_b: 1.0 },
  { year: 2014, region_a_value: -11.9, region_b_value: 27.7, difference_value: -39.6, coverage_fraction_a: 1.0, coverage_fraction_b: 1.0 },
  { year: 2015, region_a_value: -11.5, region_b_value: 27.9, difference_value: -39.4, coverage_fraction_a: 1.0, coverage_fraction_b: 1.0 },
  { year: 2016, region_a_value: -11.1, region_b_value: 28.1, difference_value: -39.2, coverage_fraction_a: 1.0, coverage_fraction_b: 1.0 },
  { year: 2017, region_a_value: -11.6, region_b_value: 27.8, difference_value: -39.4, coverage_fraction_a: 1.0, coverage_fraction_b: 1.0 },
  { year: 2018, region_a_value: -11.4, region_b_value: 28.0, difference_value: -39.4, coverage_fraction_a: 1.0, coverage_fraction_b: 1.0 },
  { year: 2019, region_a_value: -11.2, region_b_value: 28.2, difference_value: -39.4, coverage_fraction_a: 1.0, coverage_fraction_b: 1.0 },
  { year: 2020, region_a_value: -10.9, region_b_value: 28.1, difference_value: -39.0, coverage_fraction_a: 1.0, coverage_fraction_b: 1.0 },
  { year: 2021, region_a_value: -11.3, region_b_value: 28.0, difference_value: -39.3, coverage_fraction_a: 1.0, coverage_fraction_b: 1.0 },
  { year: 2022, region_a_value: -10.8, region_b_value: 28.3, difference_value: -39.1, coverage_fraction_a: 1.0, coverage_fraction_b: 1.0 },
  { year: 2023, region_a_value: -10.5, region_b_value: 28.5, difference_value: -39.0, coverage_fraction_a: 1.0, coverage_fraction_b: 1.0 },
  { year: 2024, region_a_value: -10.2, region_b_value: 28.6, difference_value: -38.8, coverage_fraction_a: 1.0, coverage_fraction_b: 1.0 },
];

export const DEFAULT_CONTRAST_STATS = {
  dataset_id: "merra2_t2m",
  variable: "T2M",
  units: "degC",
  unit_per_decade: "degC/decade",
  period: { start_year: 2000, end_year: 2024 },
  status: "supported" as const,
  region_a: {
    name: "Barents-Kara Arctic",
    slope_per_decade: 1.15,
    slope_se_per_decade: 0.18,
    ci_95: [0.78, 1.52] as [number, number],
    p_value: 0.0001,
  },
  region_b: {
    name: "Equatorial Pacific",
    slope_per_decade: 0.16,
    slope_se_per_decade: 0.07,
    ci_95: [0.02, 0.30] as [number, number],
    p_value: 0.028,
  },
  difference: {
    slope_per_decade: 0.99,
    hac_se_per_decade: 0.19,
    ci_95_hac: [0.60, 1.38] as [number, number],
    raw_p_value: 0.0002,
    adjusted_p_value: 0.0005,
  },
  selection_status: "predefined" as const,
  interpretation: "The high Arctic exhibits accelerated warming (+1.15 degC/decade) compared to the equatorial tropics (+0.16 degC/decade), with a statistically significant difference of +0.99 degC/decade under Newey-West HAC autocorrelation correction.",
  caveats: [
    "MERRA-2 is an atmospheric reanalysis synthesizing satellite observations with GEOS-5 model physics.",
    "OLS trend with Newey-West HAC covariance accounts for serial autocorrelation (lag=2).",
    "Correlation or co-trending does not imply causal attribution.",
  ],
};

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, options);
  } catch (err: any) {
    const message = `Unable to reach backend at ${url}: ${err?.message || "Connection failed"}.`;
    emitError({
      kind: "network",
      message: "Backend unreachable",
      detail: `${message} Please ensure the backend server is running.`,
      retry: () => fetchJson<T>(url, options).then(() => undefined),
    });
    throw new Error(`${message} Please ensure the backend server is running.`);
  }
  if (!res.ok) {
    let errorDetail = `HTTP ${res.status}: ${res.statusText}`;
    let parsedDetail: unknown = null;
    try {
      const errJson = await res.json();
      parsedDetail = errJson;
      if (errJson.detail) {
        errorDetail = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
      } else if (errJson.title) {
        errorDetail = `${errJson.title}: ${errJson.detail || ""}`;
      }
    } catch {}
    const kind = res.status >= 500 ? "http_5xx" : "http_4xx";
    emitError({
      kind,
      message: res.status >= 500 ? "Server error" : "Request rejected",
      detail: `${errorDetail}\n\nURL: ${url}`,
      retry: () => fetchJson<T>(url, options).then(() => undefined),
    });
    const err = new Error(errorDetail);
    (err as any).detail = parsedDetail;
    throw err;
  }
  return res.json();
}

export function askUniversalQuery(query: string): Promise<UniversalQueryResponse> {
  return fetchJson<UniversalQueryResponse>(`${API_BASE}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
}

export function useCatalog() {
  return useQuery<DatasetMetadata[]>({
    queryKey: ["catalog"],
    queryFn: async () => {
      try {
        const data = await fetchJson<any>(`${API_BASE}/catalog`);
        if (!data) return FALLBACK_DATASETS;

        // If backend returned an array directly
        if (Array.isArray(data)) return data;

        // If data.datasets is already an array
        if (Array.isArray(data.datasets)) return data.datasets;

        // If data.datasets is a dictionary / object (FastAPI CatalogResponse)
        if (data.datasets && typeof data.datasets === "object") {
          const dict = data.datasets as Record<string, any>;
          // Map fallback datasets first with live backend overrides
          const result: DatasetMetadata[] = FALLBACK_DATASETS.map((fb) => {
            const remote = dict[fb.dataset_id];
            if (!remote) return fb;
            return {
              ...fb,
              title: remote.name || fb.title,
              collection: remote.collection || fb.collection,
              version: remote.version || fb.version,
              doi: remote.provenance?.doi || fb.doi,
              topic: remote.topic || "Atmosphere",
              provider: remote.provider || "NASA Earth Science",
              concept_id: remote.concept_id,
              native_resolution: remote.native_resolution,
              license: remote.license,
              gibs_layer: remote.gibs_layer,
              capabilities: remote.capabilities,
              categories: remote.categories ?? fb.categories,
            };
          });

          // Include any additional datasets present in the backend catalog
          for (const [key, item] of Object.entries(dict)) {
            if (!result.some((d) => d.dataset_id === key)) {
              result.push({
                dataset_id: item.dataset_id || key,
                title: item.name || key,
                collection: item.collection || "UNKNOWN",
                version: item.version || "1.0",
                doi: item.provenance?.doi || "https://doi.org/10.5067",
                topic: item.topic || "Atmosphere",
                provider: item.provider || "NASA Earth Science",
                concept_id: item.concept_id,
                native_resolution: item.native_resolution,
                license: item.license,
                gibs_layer: item.gibs_layer,
                capabilities: item.capabilities,
                categories: item.categories ?? [],
                data_type: item.source_type === "model_reanalysis" ? "reanalysis_model" : "satellite_retrieval",
                citation_statement: item.provenance?.provider || "NASA Earth Observation System",
                measurement_principle: item.spatial_support || "Satellite retrieval",
                spatial_resolution: { lat_deg: 0.1, lon_deg: 0.1 },
                temporal_bounds: {
                  start_year: item.coverage_start ? parseInt(String(item.coverage_start).slice(0, 4), 10) : 2000,
                  end_year: item.coverage_end ? parseInt(String(item.coverage_end).slice(0, 4), 10) : 2024,
                },
                primary_variable: item.variable || "val",
                variables: {
                  [item.variable || "val"]: {
                    variable_name: item.variable || "val",
                    long_name: item.name || "Observed Variable",
                    standard_units: item.units || "",
                    canonical_unit: item.units || "",
                    fill_value: -9999.0,
                    valid_min: -1000.0,
                    valid_max: 10000.0,
                    description: item.temporal_support || "",
                  },
                },
              });
            }
          }
          return result;
        }

        return FALLBACK_DATASETS;
      } catch (err) {
        console.warn("Backend unavailable, using fallback dataset catalog:", err);
        return FALLBACK_DATASETS;
      }
    },
  });
}

export function useDatasetAvailability(datasetId?: string | null) {
  return useQuery<import("./types").DatasetAvailabilityResponse>({
    queryKey: ["dataset-availability", datasetId],
    queryFn: () => fetchJson<import("./types").DatasetAvailabilityResponse>(`${API_BASE}/catalog/${datasetId}/availability`),
    enabled: Boolean(datasetId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCapabilities() {
  return useQuery<CapabilitiesResponse>({
    queryKey: ["capabilities"],
    queryFn: async () => {
      try {
        return await fetchJson<CapabilitiesResponse>(`${API_BASE}/capabilities`);
      } catch {
        return {
          execution_modes: ["auto", "demo_sample", "cached_only"],
          system_version: "0.1.0-mvp",
          environment: { os: "windows", python: "3.13" },
          cached_granules: {},
        };
      }
    },
  });
}

export function useInvestigationStatus(jobId: string | null) {
  return useQuery<JobStatusResponse>({
    queryKey: ["investigation", jobId],
    queryFn: () => fetchJson<JobStatusResponse>(`${API_BASE}/investigations/${jobId}`),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.job_status;
      if (status === "succeeded" || status === "failed" || status === "cancelled") {
        return false;
      }
      return 1000;
    },
  });
}

export function useInvestigationMap(jobId: string | null, maxCells: number = 10000, enabled: boolean = true) {
  return useQuery<StructuredGridMapResponse>({
    queryKey: ["investigation-map", jobId, maxCells],
    queryFn: () => fetchJson<StructuredGridMapResponse>(`${API_BASE}/investigations/${jobId}/map?max_cells=${maxCells}`),
    enabled: !!jobId && enabled,
  });
}

export function useInvestigationSeries(jobId: string | null, enabled: boolean = true) {
  return useQuery<TimeSeriesPayload>({
    queryKey: ["investigation-series", jobId],
    queryFn: () => fetchJson<TimeSeriesPayload>(`${API_BASE}/investigations/${jobId}/series`),
    enabled: !!jobId && enabled,
  });
}

export function useInvestigationEvidence(jobId: string | null, enabled: boolean = true) {
  return useQuery<EvidencePayload>({
    queryKey: ["investigation-evidence", jobId],
    queryFn: () => fetchJson<EvidencePayload>(`${API_BASE}/investigations/${jobId}/evidence`),
    enabled: !!jobId && enabled,
  });
}

export function useCreateInvestigation() {
  const queryClient = useQueryClient();
  return useMutation<JobStatusResponse, Error, InvestigationRequest>({
    mutationFn: async (req) => {
      return fetchJson<JobStatusResponse>(`${API_BASE}/investigations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["investigation", data.job_id] });
    },
  });
}

// ── Persistent Study Plot Endpoints (SQLite backend) ──────────────────────

export interface StudyPlotDto {
  plot_id: string;
  name: string;
  is_active: boolean;
  geometry_type: string;
  coordinates: number[][][] | number[][];
  bbox: [number, number, number, number];
  measurements: {
    areaKm2?: number;
    areaHa?: number;
    perimeterKm?: number;
    centroid?: [number, number];
    bounds?: {
      minLat: number;
      maxLat: number;
      minLon: number;
      maxLon: number;
    };
    vertexCount?: number;
    [key: string]: unknown;
  };
  dataset_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export async function fetchPlots(): Promise<StudyPlotDto[]> {
  try {
    return await fetchJson<StudyPlotDto[]>(`${API_BASE}/plots`);
  } catch (err) {
    console.warn("Could not fetch plots from SQLite backend:", err);
    return [];
  }
}

export async function fetchActivePlot(): Promise<StudyPlotDto | null> {
  try {
    return await fetchJson<StudyPlotDto | null>(`${API_BASE}/plots/active`);
  } catch (err) {
    console.warn("Could not fetch active plot from SQLite backend:", err);
    return null;
  }
}

export async function savePlotToBackend(
  plot: Partial<StudyPlotDto> & {
    name: string;
    coordinates: number[][][] | number[][];
    bbox: [number, number, number, number];
  },
): Promise<StudyPlotDto | null> {
  try {
    return await fetchJson<StudyPlotDto>(`${API_BASE}/plots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(plot),
    });
  } catch (err) {
    console.warn("Could not save plot to SQLite backend (local IndexedDB remains authoritative):", err);
    return null;
  }
}

export async function deletePlotFromBackend(plotId: string): Promise<void> {
  try {
    await fetchJson<void>(`${API_BASE}/plots/${plotId}`, {
      method: "DELETE",
    });
  } catch (err) {
    console.warn(`Could not delete plot ${plotId} from SQLite backend:`, err);
  }
}

export async function clearPlotsFromBackend(): Promise<void> {
  try {
    await fetchJson<void>(`${API_BASE}/plots`, {
      method: "DELETE",
    });
  } catch (err) {
    console.warn("Could not clear plots from SQLite backend:", err);
  }
}

// ── Phase 6: Grounded AI Narrative Hooks ──────────────────────────────────────

export interface NarrativeResult {
  summary_text: string | null;
  model: string;
  prompt_version: string;
  evidence_payload?: any;
  tokens_used: number | null;
  latency_ms: number | null;
  error: string | null;
}

export function useInvestigationNarrative(jobId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ["investigation-narrative", jobId],
    queryFn: () => fetchJson<NarrativeResult>(`${API_BASE}/investigations/${jobId}/narrative`),
    enabled: !!jobId && enabled,
    retry: false,
    staleTime: 60_000,
  });
}

export function useGenerateNarrative() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, extraContext }: { jobId: string; extraContext?: string }) => {
      let url = `${API_BASE}/investigations/${jobId}/narrative`;
      if (extraContext) {
        url += `?extra_context=${encodeURIComponent(extraContext)}`;
      }
      return fetchJson<NarrativeResult>(url, {
        method: "POST",
      });
    },
    onSuccess: (data, { jobId }) => {
      queryClient.setQueryData(["investigation-narrative", jobId], data);
    },
  });
}


