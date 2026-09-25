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
