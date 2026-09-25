/**
 * Mathematical grid cell indexing and un-interpolated nearest-cell resolution.
 */

import type { StructuredGridMapResponse } from "@/lib/api/types";

export interface CellInspectionResult {
  row: number;
  col: number;
  longitude: number;
  latitude: number;
  slope_per_decade: number | null;
  slope_se_per_decade: number | null;
  ci_lower_per_decade: number | null;
  ci_upper_per_decade: number | null;
  raw_p_value: number | null;
  adjusted_p_value: number | null;
  coverage_fraction: number | null;
  eligibility_code: string;
  evidence_code: string;
  is_fdr_discovery: boolean;
}

export function inspectNearestCell(
  lon: number,
  lat: number,
  gridData: StructuredGridMapResponse
): CellInspectionResult | null {
  const { grid, bands, legend } = gridData;
  const { width, height, longitude, latitude } = grid;

  if (width === 0 || height === 0) return null;

  // Find nearest longitude index
  let bestCol = 0;
  let minLonDist = Math.abs(longitude[0] - lon);
  for (let c = 1; c < width; c++) {
    const dist = Math.abs(longitude[c] - lon);
    if (dist < minLonDist) {
      minLonDist = dist;
      bestCol = c;
    }
  }

  // Find nearest latitude index
  let bestRow = 0;
  let minLatDist = Math.abs(latitude[0] - lat);
  for (let r = 1; r < height; r++) {
    const dist = Math.abs(latitude[r] - lat);
    if (dist < minLatDist) {
      minLatDist = dist;
      bestRow = r;
    }
  }

  const idx = bestRow * width + bestCol;
  const slope = bands.slope_per_decade[idx] ?? null;
  const slopeSe = bands.slope_se_per_decade ? bands.slope_se_per_decade[idx] ?? null : null;
  const ciLower = bands.ci_lower_per_decade ? bands.ci_lower_per_decade[idx] ?? null : null;
  const ciUpper = bands.ci_upper_per_decade ? bands.ci_upper_per_decade[idx] ?? null : null;
  const rawP = bands.raw_p_value ? bands.raw_p_value[idx] ?? null : null;
  const adjP = bands.adjusted_p_value ? bands.adjusted_p_value[idx] ?? null : null;
  const coverage = bands.coverage_fraction ? bands.coverage_fraction[idx] ?? null : null;
  const eligCode = bands.eligibility_code ? bands.eligibility_code[idx] || "eligible" : "eligible";
  const evCode = bands.evidence_code ? bands.evidence_code[idx] || "inconclusive" : "inconclusive";

  const isFdrDiscovery = adjP !== null && adjP < (legend.fdr_level || 0.05);

  return {
    row: bestRow,
    col: bestCol,
    longitude: longitude[bestCol],
    latitude: latitude[bestRow],
    slope_per_decade: slope,
    slope_se_per_decade: slopeSe,
    ci_lower_per_decade: ciLower,
    ci_upper_per_decade: ciUpper,
    raw_p_value: rawP,
    adjusted_p_value: adjP,
    coverage_fraction: coverage,
    eligibility_code: eligCode,
    evidence_code: evCode,
    is_fdr_discovery: isFdrDiscovery,
  };
}
