/**
 * TypeScript API contracts matching Terra Odyssey FastAPI schemas.
 */

export interface DatasetVariable {
  variable_name: string;
  long_name: string;
  standard_units: string;
  canonical_unit: string;
  fill_value: number;
  valid_min: number;
  valid_max: number;
  description: string;
}

export interface DatasetMetadata {
  dataset_id: string;
  title: string;
  collection: string;
  version: string;
  doi: string;
  data_type: "reanalysis_model" | "satellite_retrieval";
  citation_statement: string;
  measurement_principle: string;
  spatial_resolution: {
    lat_deg: number;
    lon_deg: number;
  };
  temporal_bounds: {
    start_year: number;
    end_year: number;
  };
  variables: Record<string, DatasetVariable>;
  primary_variable: string;
}

export interface CandidatePreset {
  id: string;
  title: string;
  dataset_id: string;
  variable: string;
  period: { start_year: number; end_year: number };
  region_a: {
    name: string;
    bbox: [number, number, number, number];
  };
  region_b?: {
    name: string;
    bbox: [number, number, number, number];
  };
  scientific_question: string;
  known_phenomenon: string;
}

export interface CapabilitiesResponse {
  execution_modes: string[];
  system_version: string;
  environment: Record<string, any>;
  cached_granules: Record<string, any>;
}

export interface InvestigationRequest {
  dataset_id: string;
  variable: string;
  period: {
    start_year: number;
    end_year: number;
  };
  region_a: [number, number, number, number] | Record<string, any>;
  region_b?: [number, number, number, number] | Record<string, any> | null;
  temporal_aggregation?: "annual_mean" | "annual_total" | "seasonal";
  spatial_aggregation?: "area_weighted";
  execution_mode?: "auto" | "live" | "cached_only" | "demo_sample";
  estimator_family?: "ols_hac";
  selection_status?: "predefined" | "exploratory_map_selected";
}

export interface JobStatusResponse {
  job_id: string;
  job_status: "submitted" | "running" | "succeeded" | "failed" | "cancel_requested" | "cancelled";
  stage: "validating" | "acquiring" | "normalizing" | "aggregating" | "analyzing" | "publishing";
  progress: number;
  result_status?: "supported" | "inconclusive" | "ineligible" | null;
  created_at: string;
  updated_at: string;
  error?: Record<string, any> | null;
}

export interface GridMetadata {
  crs: string;
  width: number;
  height: number;
  longitude: number[];
  latitude: number[];
  order: string;
}

export interface MapBands {
  slope_per_decade: (number | null)[];
  slope_se_per_decade?: (number | null)[];
  ci_lower_per_decade?: (number | null)[];
  ci_upper_per_decade?: (number | null)[];
  raw_p_value?: (number | null)[];
  adjusted_p_value?: (number | null)[];
  coverage_fraction?: (number | null)[];
  eligibility_code?: string[];
  evidence_code?: string[];
}

export interface LegendMetadata {
  variable: string;
  units: string;
  center: number;
  minimum: number;
  maximum: number;
  fdr_method?: string;
  fdr_level?: number;
}

export interface MapProvenance {
  map_family_id: string;
  family_size: number;
}

export interface StructuredGridMapResponse {
  grid: GridMetadata;
  bands: MapBands;
  legend: LegendMetadata;
  provenance: MapProvenance;
}

export interface TimeSeriesRecord {
  year: number;
  region_a_value: number;
  region_b_value?: number;
  difference_value?: number;
  coverage_fraction_a?: number;
  coverage_fraction_b?: number;
}

export interface TimeSeriesPayload {
  job_id: string;
  columns: string[];
  data: TimeSeriesRecord[];
}

export interface ScientificResultItem {
  target: string;
  effect: {
    estimate: number;
    unit_per_decade: string;
    fitted_change?: number;
    direction?: string;
  };
  uncertainty: {
    method: string;
    se: number;
    ci_95: [number, number];
    p_value: number;
    p_value_adjusted?: number;
  };
  status?: string;
  caveats?: string[];
}

export interface EvidencePayload {
  job_id: string;
  result_status: "supported" | "inconclusive" | "ineligible";
  results: ScientificResultItem[];
}
