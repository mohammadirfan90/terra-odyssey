/**
 * Multi-Variable Co-Plotting and Co-Variation Utilities.
 *
 * Facilitates side-by-side and dual-axis alignment of multi-variable Earth science series
 * (e.g. MERRA-2 Temperature alongside GPM IMERG Precipitation or MODIS NDVI).
 *
 * Adheres strictly to SCIENTIFIC_RULES.md:
 * - Missing values are NEVER silently zeroed or interpolated.
 * - Paired observations track explicit valid counts (N).
 * - Statistical associations are classified as "co-variation" or "statistical association",
 *   NEVER causal attribution.
 */

import * as d3 from "d3";

export interface VariableSeriesDatum {
  timestamp: string; // ISO date string e.g. "2015-06" or "2015"
  year: number;
  month?: number;
  value: number | null;
  coverage_fraction?: number;
}

export interface CoPlotDatum {
  timestamp: string;
  year: number;
  month?: number;
  primary_val: number | null;
  secondary_val: number | null;
  primary_zscore?: number | null;
  secondary_zscore?: number | null;
  both_valid: boolean;
}

export type CovariationClass =
  | "strong_positive"
  | "moderate_positive"
  | "weak_positive"
  | "uncorrelated"
  | "weak_negative"
  | "moderate_negative"
  | "strong_negative"
  | "insufficient_data";

export interface CoPlotSummary {
  primary_variable: string;
  primary_units: string;
  secondary_variable: string;
  secondary_units: string;
  n_total_timestamps: number;
  n_paired_valid: number;
  primary_valid_count: number;
  secondary_valid_count: number;
  pearson_r: number | null;
  covariation_class: CovariationClass;
  scientific_caveat: string;
}

/**
 * Standard variable color themes for multi-variable charts.
 */
export const VARIABLE_PALETTES: Record<
  string,
  { primaryColor: string; accentColor: string; label: string; defaultUnits: string }
> = {
  T2M: {
    primaryColor: "#f97316", // Orange
    accentColor: "#ea580c",
    label: "2m Air Temperature (MERRA-2)",
    defaultUnits: "°C",
  },
  PRECTOTCORR: {
    primaryColor: "#0284c7", // Sky blue
    accentColor: "#0369a1",
    label: "Precipitation Rate (GPM / MERRA-2)",
    defaultUnits: "mm/day",
  },
  NDVI: {
    primaryColor: "#16a34a", // Forest green
    accentColor: "#15803d",
    label: "Normalized Difference Vegetation Index (MODIS)",
    defaultUnits: "NDVI [-1, 1]",
  },
  LST_Day: {
    primaryColor: "#dc2626", // Red
    accentColor: "#b91c1c",
    label: "Land Surface Temperature - Day (MODIS)",
    defaultUnits: "K",
  },
};

/**
 * Compute Pearson correlation coefficient r between two paired series.
 * Returns null if valid paired count < 3 or standard deviation is 0.
 */
export function computePearsonCorrelation(
  pairs: { x: number; y: number }[]
): { r: number; n: number } | null {
  const n = pairs.length;
  if (n < 3) return null;

  const meanX = d3.mean(pairs, (p) => p.x);
  const meanY = d3.mean(pairs, (p) => p.y);
  if (meanX === undefined || meanY === undefined) return null;

  let num = 0;
  let denX = 0;
  let denY = 0;

  for (const p of pairs) {
    const dx = p.x - meanX;
    const dy = p.y - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const denom = Math.sqrt(denX * denY);
  if (denom === 0) return null;

  const r = Math.max(-1, Math.min(1, num / denom));
  return { r, n };
}

/**
 * Classifies the empirical co-variation strength based on Pearson r and sample size.
 */
export function classifyCovariation(r: number | null, n: number): CovariationClass {
  if (r === null || n < 3) return "insufficient_data";
  if (r >= 0.7) return "strong_positive";
  if (r >= 0.4) return "moderate_positive";
  if (r >= 0.15) return "weak_positive";
  if (r <= -0.7) return "strong_negative";
  if (r <= -0.4) return "moderate_negative";
  if (r <= -0.15) return "weak_negative";
  return "uncorrelated";
}

/**
 * Aligns two disparate variable time series by their timestamp key, computes normalized
 * z-score anomalies for visual overlay, and calculates paired correlation metrics.
 */
export function alignCoPlotSeries(
  primaryData: VariableSeriesDatum[],
  secondaryData: VariableSeriesDatum[],
  meta: {
    primaryVariable: string;
    primaryUnits: string;
    secondaryVariable: string;
    secondaryUnits: string;
  }
): { merged: CoPlotDatum[]; summary: CoPlotSummary } {
  const secMap = new Map<string, VariableSeriesDatum>();
  for (const item of secondaryData) {
    secMap.set(item.timestamp, item);
  }

  const allTimestamps = new Set<string>();
  for (const d of primaryData) allTimestamps.add(d.timestamp);
  for (const d of secondaryData) allTimestamps.add(d.timestamp);

  const primMap = new Map<string, VariableSeriesDatum>();
  for (const item of primaryData) {
    primMap.set(item.timestamp, item);
  }

  const sortedTimestamps = Array.from(allTimestamps).sort();

  // Primary valid values for z-score calculation
  const primValidValues: number[] = [];
  // Secondary valid values for z-score calculation
  const secValidValues: number[] = [];

  const rawMerged: CoPlotDatum[] = sortedTimestamps.map((ts) => {
    const p = primMap.get(ts);
    const s = secMap.get(ts);

    const pVal = p && p.value !== null && !isNaN(p.value) ? p.value : null;
    const sVal = s && s.value !== null && !isNaN(s.value) ? s.value : null;

    if (pVal !== null) primValidValues.push(pVal);
    if (sVal !== null) secValidValues.push(sVal);

    const year = p?.year ?? s?.year ?? parseInt(ts.split("-")[0], 10);
    const month = p?.month ?? s?.month;

    return {
      timestamp: ts,
      year,
      month,
      primary_val: pVal,
      secondary_val: sVal,
      both_valid: pVal !== null && sVal !== null,
    };
  });

  // Calculate means and standard deviations for standardized anomalies (z-scores)
  const primMean = d3.mean(primValidValues) ?? 0;
  const primStd = d3.deviation(primValidValues) || 1;

  const secMean = d3.mean(secValidValues) ?? 0;
  const secStd = d3.deviation(secValidValues) || 1;

  // Augment with z-scores
  const merged: CoPlotDatum[] = rawMerged.map((d) => ({
    ...d,
    primary_zscore: d.primary_val !== null ? (d.primary_val - primMean) / primStd : null,
    secondary_zscore: d.secondary_val !== null ? (d.secondary_val - secMean) / secStd : null,
  }));

  // Calculate paired correlation
  const pairedValid = merged
    .filter((d) => d.both_valid && d.primary_val !== null && d.secondary_val !== null)
    .map((d) => ({ x: d.primary_val!, y: d.secondary_val! }));

  const corr = computePearsonCorrelation(pairedValid);
  const r = corr ? corr.r : null;
  const covariationClass = classifyCovariation(r, pairedValid.length);

  const summary: CoPlotSummary = {
    primary_variable: meta.primaryVariable,
    primary_units: meta.primaryUnits,
    secondary_variable: meta.secondaryVariable,
    secondary_units: meta.secondaryUnits,
    n_total_timestamps: merged.length,
    n_paired_valid: pairedValid.length,
    primary_valid_count: primValidValues.length,
    secondary_valid_count: secValidValues.length,
    pearson_r: r !== null ? Math.round(r * 1000) / 1000 : null,
    covariation_class: covariationClass,
    scientific_caveat:
      "Observed correlation reflects empirical statistical co-variation over the selected period; " +
      "it does not establish a causal mechanism without an explicit physical or experimental framework.",
  };

  return { merged, summary };
}
