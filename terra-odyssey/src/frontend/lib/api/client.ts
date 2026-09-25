/**
 * API client and TanStack Query hooks for Terra Odyssey.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  DatasetMetadata,
  CapabilitiesResponse,
  InvestigationRequest,
  JobStatusResponse,
  StructuredGridMapResponse,
  TimeSeriesPayload,
  EvidencePayload,
  CandidatePreset,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

// Offline developer sample fixtures
export const FALLBACK_DATASETS: DatasetMetadata[] = [
  {
    dataset_id: "merra2_t2m",
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
  const res = await fetch(url, options);
  if (!res.ok) {
    let errorDetail = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const errJson = await res.json();
      if (errJson.detail) errorDetail = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
      else if (errJson.title) errorDetail = `${errJson.title}: ${errJson.detail || ""}`;
    } catch {}
    throw new Error(errorDetail);
  }
  return res.json();
}

export function useCatalog() {
  return useQuery<DatasetMetadata[]>({
    queryKey: ["catalog"],
    queryFn: async () => {
      try {
        const data = await fetchJson<{ datasets: DatasetMetadata[] }>(`${API_BASE}/catalog`);
        return data.datasets;
      } catch (err) {
        console.warn("Backend unavailable, using fallback dataset catalog:", err);
        return FALLBACK_DATASETS;
      }
    },
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

export function useInvestigationMap(jobId: string | null, maxCells: number = 10000) {
  return useQuery<StructuredGridMapResponse>({
    queryKey: ["investigation-map", jobId, maxCells],
    queryFn: () => fetchJson<StructuredGridMapResponse>(`${API_BASE}/investigations/${jobId}/map?max_cells=${maxCells}`),
    enabled: !!jobId,
  });
}

export function useInvestigationSeries(jobId: string | null) {
  return useQuery<TimeSeriesPayload>({
    queryKey: ["investigation-series", jobId],
    queryFn: () => fetchJson<TimeSeriesPayload>(`${API_BASE}/investigations/${jobId}/series`),
    enabled: !!jobId,
  });
}

export function useInvestigationEvidence(jobId: string | null) {
  return useQuery<EvidencePayload>({
    queryKey: ["investigation-evidence", jobId],
    queryFn: () => fetchJson<EvidencePayload>(`${API_BASE}/investigations/${jobId}/evidence`),
    enabled: !!jobId,
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
