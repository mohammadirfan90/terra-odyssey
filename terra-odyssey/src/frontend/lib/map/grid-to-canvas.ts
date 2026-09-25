/**
 * Grid to Canvas and GeoJSON converters for MapLibre rendering.
 */

import type { StructuredGridMapResponse } from "@/lib/api/types";
import { getDivergingColorRgba } from "./color-scale";

export interface GridRenderPackage {
  canvas: HTMLCanvasElement;
  coordinates: [[number, number], [number, number], [number, number], [number, number]];
  geoJsonFallback: GeoJSON.FeatureCollection;
  maxAbsSlope: number;
}

/**
 * Converts structured 2D grid into an offscreen canvas and fallback GeoJSON features.
 */
export function buildGridRenderPackage(
  gridData: StructuredGridMapResponse,
  palette: "RdBu" | "BrBG" = "RdBu"
): GridRenderPackage {
  const { grid, bands, legend } = gridData;
  const { width, height, longitude, latitude } = grid;
  const slopes = bands.slope_per_decade;
  const fdrDiscov = bands.adjusted_p_value;
  const evidenceCodes = bands.evidence_code || [];

  // Determine frozen symmetric domain [-maxAbs, +maxAbs]
  let maxAbs = Math.max(Math.abs(legend.minimum || -1), Math.abs(legend.maximum || 1));
  for (const s of slopes) {
    if (s !== null && s !== undefined && !isNaN(s)) {
      maxAbs = Math.max(maxAbs, Math.abs(s));
    }
  }

  // Create offscreen canvas with width x height
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const idx = row * width + col;
        const slope = slopes[idx];
        const [r, g, b, a] = getDivergingColorRgba(slope, maxAbs, palette);

        // MapLibre image buffer expects row 0 at the top (highest latitude)
        const pixelIdx = (row * width + col) * 4;
        data[pixelIdx] = r;
        data[pixelIdx + 1] = g;
        data[pixelIdx + 2] = b;
        data[pixelIdx + 3] = a;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  // MapLibre CanvasSource bounding quad: [[west, north], [east, north], [east, south], [west, south]]
  const west = longitude[0];
  const east = longitude[longitude.length - 1];
  const north = latitude[0];
  const south = latitude[latitude.length - 1];

  const coordinates: [[number, number], [number, number], [number, number], [number, number]] = [
    [west, north],
    [east, north],
    [east, south],
    [west, south],
  ];

  // Build GeoJSON polygon fallback for capped cells
  const features: GeoJSON.Feature[] = [];
  const dLon = width > 1 ? (east - west) / (width - 1) : 0.5;
  const dLat = height > 1 ? (south - north) / (height - 1) : -0.5;

  for (let row = 0; row < height; row++) {
    const lat = latitude[row];
    for (let col = 0; col < width; col++) {
      const lon = longitude[col];
      const idx = row * width + col;
      const slope = slopes[idx];
      const adjP = fdrDiscov ? fdrDiscov[idx] : null;
      const evCode = evidenceCodes[idx] || "inconclusive";
      const isFdrDiscovery = adjP !== null && adjP !== undefined && adjP < (legend.fdr_level || 0.05);

      const [r, g, b, a] = getDivergingColorRgba(slope, maxAbs, palette);
      const colorHex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;

      const cellWest = lon - dLon / 2;
      const cellEast = lon + dLon / 2;
      const cellNorth = lat - dLat / 2;
      const cellSouth = lat + dLat / 2;

      features.push({
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [[
            [cellWest, cellNorth],
            [cellEast, cellNorth],
            [cellEast, cellSouth],
            [cellWest, cellSouth],
            [cellWest, cellNorth],
          ]],
        },
        properties: {
          idx,
          row,
          col,
          lon,
          lat,
          slope,
          adjP,
          evidence_code: evCode,
          is_fdr_discovery: isFdrDiscovery,
          fillColor: colorHex,
          fillOpacity: a / 255,
        },
      });
    }
  }

  const geoJsonFallback: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features,
  };

  return {
    canvas,
    coordinates,
    geoJsonFallback,
    maxAbsSlope: maxAbs,
  };
}
