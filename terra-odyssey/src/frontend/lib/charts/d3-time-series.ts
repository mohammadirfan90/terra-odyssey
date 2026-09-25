/**
 * D3 time-series mathematical utilities and layout helpers.
 * Computes scales, paths, and linear fits for Region A, Region B, and Difference series.
 */

import * as d3 from "d3";

export interface TimeSeriesDatum {
  year: number;
  region_a_value: number;
  region_b_value?: number;
  difference_value?: number;
  coverage_fraction_a?: number;
  coverage_fraction_b?: number;
}

export interface TrendFit {
  slope_per_year: number;
  intercept: number;
  start_point: { year: number; val: number };
  end_point: { year: number; val: number };
}

/**
 * Compute linear regression fit for trend line rendering.
 * \hat{y} = intercept + slope * (year - mean_year)
 */
export function computeLinearTrend(data: { year: number; val: number }[]): TrendFit | null {
  const valid = data.filter((d) => !isNaN(d.val) && d.val !== null);
  if (valid.length < 2) return null;

  const n = valid.length;
  const meanX = d3.mean(valid, (d) => d.year) ?? 0;
  const meanY = d3.mean(valid, (d) => d.val) ?? 0;

  let num = 0;
  let den = 0;
  for (const d of valid) {
    const dx = d.year - meanX;
    const dy = d.val - meanY;
    num += dx * dy;
    den += dx * dx;
  }

  const slope = den !== 0 ? num / den : 0;
  const minYear = d3.min(valid, (d) => d.year)!;
  const maxYear = d3.max(valid, (d) => d.year)!;

  const startVal = meanY + slope * (minYear - meanX);
  const endVal = meanY + slope * (maxYear - meanX);

  return {
    slope_per_year: slope,
    intercept: meanY,
    start_point: { year: minYear, val: startVal },
    end_point: { year: maxYear, val: endVal },
  };
}

export interface ChartDimensions {
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
}

export const DEFAULT_CHART_DIMENSIONS: ChartDimensions = {
  width: 720,
  height: 380,
  margin: { top: 20, right: 30, bottom: 40, left: 60 },
};

/**
 * Color tokens for scientific time-series plotting.
 */
export const CHART_COLORS = {
  regionA: "#f59e0b", // Warm amber
  regionATrend: "#d97706",
  regionB: "#06b6d4", // Cool cyan
  regionBTrend: "#0891b2",
  difference: "#94a3b8", // Slate neutral
  differenceTrend: "#cbd5e1",
  zeroReference: "#475569", // Dark slate dashed
  gridLines: "rgba(51, 65, 85, 0.4)",
  crosshair: "#f8fafc",
  coverageGood: "#10b981",
  coverageWarning: "#f59e0b",
  coverageDanger: "#ef4444",
};
