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

export type CapabilityBadge = "Browse" | "View" | "Analyze" | "Compare";

export interface DatasetCapabilities {
  discoverable: boolean;
  previewable: boolean;
  series_supported: boolean;
  trend_supported: boolean;
  contrast_supported: boolean;
  badges: CapabilityBadge[];
  unsupported_reason?: string | null;
}

export interface DatasetCatalogItem {
  dataset_id: string;
  name: string;
  collection: string;
  version: string;
  topic?: string;
  provider?: string;
  concept_id?: string | null;
  native_resolution?: string | null;
  license?: string | null;
  citation_doi?: string | null;
  gibs_layer?: string | null;
  source_type: string;
  variable: string;
  units: string;
  spatial_support: string;
  temporal_support: string;
  coverage_start: string;
  coverage_end?: string | null;
  quality_policy: Record<string, any>;
  provenance: Record<string, any>;
  capabilities?: DatasetCapabilities;
  supported_aggregations?: string[];
  supported_spatial_aggregations?: string[];
}

export interface AvailabilityGap {
  start_date: string;
  end_date: string;
  description: string;
}

export interface EligibleSpan {
  start_year: number;
  end_year: number;
  complete_years: number;
  is_eligible: boolean;
}

export interface DatasetAvailabilityResponse {
  dataset_id: string;
  name: string;
  temporal_support: string;
  coverage_start: string;
  coverage_end: string;
  total_years: number;
  complete_years: number;
  completeness_pct: number;
  gaps: AvailabilityGap[];
  eligible_spans: EligibleSpan[];
  years_available: number[];
  gibs_layer?: string | null;
}

export interface CatalogResponse {
  datasets: Record<string, DatasetCatalogItem>;
  defaults: Record<string, any>;
  supported_estimators: string[];
  supported_aggregations: string[];
}

export interface DatasetMetadata {
  dataset_id: string;
  title: string;
  collection: string;
  version: string;
  doi: string;
  data_type:
    | "reanalysis_model"
    | "satellite_retrieval"
    | "surface_observation_analysis"
    | "satellite_gravimetry"
    | "satellite_radiometry"
    | "derived_index"
    | "open_source";
  citation_statement: string;
  measurement_principle: string;
  topic?: string;
  provider?: string;
  concept_id?: string | null;
  native_resolution?: string | null;
  license?: string | null;
  gibs_layer?: string | null;
  capabilities?: DatasetCapabilities;
  /** Multi-axis taxonomy: ["<Domain>:<Sub-topic>", "<Use Case>", ...] */
  categories?: string[];
  coverage_start?: string;
  coverage_end?: string | null;
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
  progress?: number;
  progress_pct?: number;
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

export interface FdrSummary {
  n_tested: number;
  n_significant: number;
  fdr_threshold: number | null;
  method: string;
  by_constant: number | null;
  alpha: number;
}

export interface StructuredGridMapResponse {
  grid: GridMetadata;
  bands: MapBands;
  legend: LegendMetadata;
  provenance: MapProvenance;
  fdr_summary?: FdrSummary | null;
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

export interface PairedContrastSummary {
  contrast_slope: number;
  contrast_ci_95: [number, number];
  contrast_p_value: number;
  contrast_status: string;
  region_a_slope?: number | null;
  region_b_slope?: number | null;
  units: string;
  evidence_text: string;
}

export interface SummaryStats {
  max_year: number;
  max_value: number;
  min_year: number;
  min_value: number;
  mean_value: number;
  std_value: number;
  baseline_mean: number;
  baseline_years: string;
  recent_mean: number;
  recent_years: string;
  decadal_shift: number;
}

export interface EvidencePayload {
  job_id: string;
  result_status: "supported" | "inconclusive" | "ineligible";
  results: ScientificResultItem[];
  contrast?: PairedContrastSummary | null;
  headline_text?: string | null;
  summary_stats?: SummaryStats | null;
}

export interface UniversalQueryRequest {
  query: string;
}

export interface UniversalQueryResponse {
  answer: string;
  model: string;
  provider: "NVIDIA NIM";
  latency_ms: number;
  caveat: string;
}
