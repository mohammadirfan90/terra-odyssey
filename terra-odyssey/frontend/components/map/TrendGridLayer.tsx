"use client";

/**
 * TrendGridLayer — High-Fidelity Scientific Spatial Trend Heatmap Overlay.
 *
 * Visual & UX Architecture:
 *   • Smooth, translucent diverging color ramps (RdBu, BrBG, PRGn) respecting variable domain
 *   • Zero-trend & domain-specific transparency (no milky fog or equator sea ice)
 *   • Wireframe gridlines OFF by default (no Excel spreadsheet cage) with user toggle
 *   • Single-cell glowing hover reticle with live statistical telemetry
 *   • Real-time opacity slider (10% to 100%, default 40%)
 *   • BY-FDR Significance filter mode (1-click isolate verified trend discoveries)
 *   • Non-colliding bottom-left docking (clears the right-side evidence card completely)
 */

import React, { useEffect, useRef, useState, useMemo } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource } from "maplibre-gl";
import type { StructuredGridMapResponse } from "@/lib/api/types";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
  Eye,
  EyeOff,
  Sparkles,
  Grid,
  Sliders,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getVariablePalette,
  getDivergingColorCss,
  getPaletteGradientCss,
} from "@/lib/map/color-scale";

// ── Layer / Source IDs ──────────────────────────────────────────────────────────
const SOURCE_ID = "terra-trend-grid";
const FILL_LAYER_ID = "terra-trend-fill";
const BORDER_LAYER_ID = "terra-trend-border";
const HOVER_OUTLINE_LAYER_ID = "terra-trend-hover-outline";
const STIPPLE_LAYER_ID = "terra-trend-stipple";

export interface TrendGridLayerProps {
  map: maplibregl.Map | null;
  isMapLoaded: boolean;
  gridData: StructuredGridMapResponse | null | undefined;
  visible?: boolean;
  selectedDataset?: string;
  variableName?: string;
}

export function TrendGridLayer({
  map,
  isMapLoaded,
  gridData,
  visible = true,
  selectedDataset,
  variableName,
}: TrendGridLayerProps) {
  const [layerVisible, setLayerVisible] = useState(visible);
  const [userOpacity, setUserOpacity] = useState(0.42);
  const [showGridlines, setShowGridlines] = useState(false);
  const [significantOnly, setSignificantOnly] = useState(false);

  const [hoveredCell, setHoveredCell] = useState<{
    id: number;
    slope: number;
    pAdj: number | null;
    significant: boolean;
    nYears: number | null;
    lon: number;
    lat: number;
  } | null>(null);

  const hasLayersRef = useRef(false);

  // Determine active scientific color palette
  const activePalette = useMemo(() => {
    return getVariablePalette(variableName || selectedDataset || gridData?.legend.variable || "");
  }, [variableName, selectedDataset, gridData]);

  // ── Convert grid bands + metadata to GeoJSON with scientific masking ────────
  const geojson = useMemo(() => {
    if (!gridData) return null;
    const { grid, bands, legend } = gridData;
    const lats = grid.latitude;
    const lons = grid.longitude;
    const maxAbs = Math.max(Math.abs(legend.minimum ?? 0), Math.abs(legend.maximum ?? 0), 0.001);

    const slopes = bands.slope_per_decade ?? [];
    const adjP = bands.adjusted_p_value ?? [];
    const rawP = bands.raw_p_value ?? [];
    const nYears = (bands as any).n_years ?? [];
    const evidCodes = bands.evidence_code ?? [];

    const isSeaIce =
      selectedDataset?.toLowerCase().includes("sea_ice") ||
      selectedDataset?.toLowerCase().includes("nsidc") ||
      variableName?.toLowerCase().includes("ice");

    const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [];

    const dLon = lons.length > 1 ? Math.abs(lons[1] - lons[0]) / 2 : 0.25;
    const dLat = lats.length > 1 ? Math.abs(lats[1] - lats[0]) / 2 : 0.25;

    let cellId = 0;
    for (let li = 0; li < lats.length; li++) {
      const lat = lats[li];

      // Physical Domain Masking: Sea ice does not exist in equatorial or temperate waters
      if (isSeaIce && Math.abs(lat) < 54) {
        continue;
      }

      for (let lj = 0; lj < lons.length; lj++) {
        const idx = li * lons.length + lj;
        const slope = slopes[idx];
        if (slope == null || Number.isNaN(slope)) continue;

        const lon = lons[lj];
        const pAdj = adjP[idx] as number | null;
        const pRaw = rawP[idx] as number | null;
        const significant = pAdj != null ? pAdj < 0.05 : false;
        const evidCode = evidCodes[idx] ?? "unknown";

        // Negligible trend screening: smooth fade into transparent
        const relativeMag = Math.abs(slope) / maxAbs;
        const isNearZero = relativeMag < 0.04;

        // If user enabled Significant Only, hide non-significant cells
        if (significantOnly && !significant) {
          continue;
        }

        const colorCss = getDivergingColorCss(slope, maxAbs, activePalette);

        // Opacity weight: significant cells get crisp saturation, insignificant get subtle wash
        let baseAlpha = significant ? 0.90 : 0.40;
        if (isNearZero) baseAlpha = 0.08;

        features.push({
          type: "Feature",
          id: cellId++,
          geometry: {
            type: "Polygon",
            coordinates: [[
              [lon - dLon, lat - dLat],
              [lon + dLon, lat - dLat],
              [lon + dLon, lat + dLat],
              [lon - dLon, lat + dLat],
              [lon - dLon, lat - dLat],
            ]],
          },
          properties: {
            cellId: cellId - 1,
            slope,
            slope_per_decade: slope,
            p_adj: pAdj,
            p_raw: pRaw,
            significant,
            evid_code: evidCode,
            n_years: nYears[idx] ?? null,
            color: colorCss,
            baseAlpha,
            lat,
            lon,
          },
        });
      }
    }

    return { type: "FeatureCollection" as const, features };
  }, [gridData, selectedDataset, variableName, activePalette, significantOnly]);

  // ── Mount / update MapLibre sources & layers ────────────────────────────────
  useEffect(() => {
    if (!map || !isMapLoaded || !geojson) return;

    const addOrUpdateSource = () => {
      const existing = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (existing) {
        existing.setData(geojson);
      } else {
        map.addSource(SOURCE_ID, {
          type: "geojson",
          data: geojson,
          generateId: true,
        });

        // Anchor below UI borders and markers
        const style = map.getStyle();
        const beforeId = style?.layers?.find((l) =>
          /^(terra-shape|terra-persistent|boundary|label|place)/i.test(l.id ?? ""),
        )?.id;

        // 1. Fill Layer — smooth scientific gradient with controllable opacity
        map.addLayer(
          {
            id: FILL_LAYER_ID,
            type: "fill",
            source: SOURCE_ID,
            paint: {
              "fill-color": ["get", "color"],
              "fill-opacity": [
                "*",
                ["get", "baseAlpha"],
                userOpacity,
              ],
            },
            layout: { visibility: layerVisible ? "visible" : "none" },
          },
          beforeId,
        );

        // 2. Cell Borders — OFF by default (0 opacity), user can toggle on
        map.addLayer(
          {
            id: BORDER_LAYER_ID,
            type: "line",
            source: SOURCE_ID,
            paint: {
              "line-color": "rgba(255, 255, 255, 0.4)",
              "line-width": 0.5,
              "line-opacity": showGridlines ? 0.35 : 0,
            },
            layout: { visibility: layerVisible ? "visible" : "none" },
          },
          beforeId,
        );

        // 3. Hover Outline Layer — glowing highlight on hovered cell ONLY
        map.addLayer(
          {
            id: HOVER_OUTLINE_LAYER_ID,
            type: "line",
            source: SOURCE_ID,
            paint: {
              "line-color": "#38bdf8",
              "line-width": 2.5,
              "line-opacity": 0.95,
            },
            filter: ["==", ["get", "cellId"], -1],
            layout: { visibility: layerVisible ? "visible" : "none" },
          },
          beforeId,
        );

        // 4. Stipple dots on non-significant cells (subtle, non-intrusive)
        map.addLayer(
          {
            id: STIPPLE_LAYER_ID,
            type: "circle",
            source: SOURCE_ID,
            filter: ["==", ["get", "significant"], false],
            paint: {
              "circle-radius": 1.5,
              "circle-color": "rgba(148, 163, 184, 0.4)",
              "circle-stroke-width": 0,
              "circle-opacity": showGridlines ? 0.4 : 0,
            },
            layout: { visibility: layerVisible ? "visible" : "none" },
          },
          beforeId,
        );

        hasLayersRef.current = true;

        // Hover events
        map.on("mouseenter", FILL_LAYER_ID, () => {
          map.getCanvas().style.cursor = "crosshair";
        });
        map.on("mouseleave", FILL_LAYER_ID, () => {
          map.getCanvas().style.cursor = "";
          setHoveredCell(null);
          if (map.getLayer(HOVER_OUTLINE_LAYER_ID)) {
            map.setFilter(HOVER_OUTLINE_LAYER_ID, ["==", ["get", "cellId"], -1]);
          }
        });
        map.on("mousemove", FILL_LAYER_ID, (e) => {
          const feat = e.features?.[0];
          if (!feat?.properties) return;
          const p = feat.properties;
          const cId = p.cellId ?? -1;

          setHoveredCell({
            id: cId,
            slope: p.slope_per_decade ?? p.slope ?? 0,
            pAdj: p.p_adj ?? null,
            significant: !!p.significant,
            nYears: p.n_years ?? null,
            lon: p.lon ?? e.lngLat.lng,
            lat: p.lat ?? e.lngLat.lat,
          });

          if (map.getLayer(HOVER_OUTLINE_LAYER_ID)) {
            map.setFilter(HOVER_OUTLINE_LAYER_ID, ["==", ["get", "cellId"], cId]);
          }
        });
      }
    };

    if (map.isStyleLoaded()) {
      addOrUpdateSource();
    } else {
      map.once("load", addOrUpdateSource);
    }

    return () => {
      try {
        if (map.getLayer(STIPPLE_LAYER_ID)) map.removeLayer(STIPPLE_LAYER_ID);
        if (map.getLayer(HOVER_OUTLINE_LAYER_ID)) map.removeLayer(HOVER_OUTLINE_LAYER_ID);
        if (map.getLayer(BORDER_LAYER_ID)) map.removeLayer(BORDER_LAYER_ID);
        if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch (_) {}
      hasLayersRef.current = false;
    };
  }, [map, isMapLoaded, geojson]);

  // ── Sync Opacity, Gridlines, and Visibility dynamically ────────────────────
  useEffect(() => {
    if (!map || !hasLayersRef.current) return;
    const vis = layerVisible ? "visible" : "none";
    for (const id of [FILL_LAYER_ID, BORDER_LAYER_ID, HOVER_OUTLINE_LAYER_ID, STIPPLE_LAYER_ID]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis);
    }

    // Dynamic opacity update
    if (map.getLayer(FILL_LAYER_ID)) {
      map.setPaintProperty(FILL_LAYER_ID, "fill-opacity", [
        "*",
        ["get", "baseAlpha"],
        userOpacity,
      ]);
    }

    // Dynamic gridlines update
    if (map.getLayer(BORDER_LAYER_ID)) {
      map.setPaintProperty(BORDER_LAYER_ID, "line-opacity", showGridlines ? 0.35 : 0);
    }
    if (map.getLayer(STIPPLE_LAYER_ID)) {
      map.setPaintProperty(STIPPLE_LAYER_ID, "circle-opacity", showGridlines ? 0.4 : 0);
    }
  }, [map, layerVisible, userOpacity, showGridlines]);

  if (!gridData) return null;

  const legend = gridData.legend;
  const fdrSummary = gridData.fdr_summary;
  const unit = legend.units ?? "/ decade";
  const gradientCss = getPaletteGradientCss(activePalette);

  // ── Floating Scientific Trend Console (Bottom-Left Docking) ────────────────
  return (
    <div
      role="region"
      aria-label="Spatial trend field controls"
      className="pointer-events-none absolute bottom-[calc(var(--dock-h,260px)+44px)] left-4 z-30 flex flex-col items-start gap-2 select-none animate-in fade-in slide-in-from-bottom-2"
    >
      {/* ── Main Compact Legend & Layer Console ────────────────────────────── */}
      <div className="pointer-events-auto rounded-2xl border border-slate-200/90 bg-white/95 p-3 shadow-xl backdrop-blur-xl w-64 text-slate-800 transition-all hover:border-slate-300">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-rose-50 border border-rose-200 text-rose-600">
              <TrendingUp className="h-3 w-3" />
            </span>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-900 leading-none">
                Spatial Trend Field
              </span>
              <span className="text-[8.5px] font-mono text-slate-500 leading-none mt-0.5">
                BY-FDR Verified · {activePalette}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setLayerVisible((v) => !v)}
              className={cn(
                "flex h-6 items-center gap-1 rounded-md px-1.5 text-[9px] font-semibold transition shadow-2xs border",
                layerVisible
                  ? "border-cyan-300 bg-cyan-50 text-cyan-800 hover:bg-cyan-100"
                  : "border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200",
              )}
              title={layerVisible ? "Hide trend overlay" : "Show trend overlay"}
            >
              {layerVisible ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
              <span>{layerVisible ? "On" : "Off"}</span>
            </button>
          </div>
        </div>

        {layerVisible && (
          <div className="pt-2 flex flex-col gap-2">
            {/* Quick Filter Buttons: Sig Only & Grid Mesh */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setSignificantOnly((v) => !v)}
                className={cn(
                  "flex items-center justify-center gap-1 rounded-lg border py-1 text-[9px] font-semibold transition shadow-2xs",
                  significantOnly
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800 font-bold"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100",
                )}
                title="Only show cells passing the False Discovery Rate significance threshold"
              >
                <Sparkles className="h-2.5 w-2.5 text-emerald-600" />
                <span>{significantOnly ? "Sig. Only (Active)" : "Sig. Only"}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowGridlines((v) => !v)}
                className={cn(
                  "flex items-center justify-center gap-1 rounded-lg border py-1 text-[9px] font-semibold transition shadow-2xs",
                  showGridlines
                    ? "border-cyan-300 bg-cyan-50 text-cyan-800 font-bold"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100",
                )}
                title="Toggle discrete cell wireframe gridlines"
              >
                <Grid className="h-2.5 w-2.5 text-cyan-600" />
                <span>{showGridlines ? "Mesh On" : "Smooth Field"}</span>
              </button>
            </div>

            {/* Opacity Slider */}
            <div className="flex items-center justify-between text-[9px] text-slate-600 px-0.5">
              <div className="flex items-center gap-1 text-slate-500 font-medium">
                <Sliders className="h-2.5 w-2.5" />
                <span>Overlay Opacity:</span>
              </div>
              <span className="font-mono font-bold text-slate-800">
                {Math.round(userOpacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.10"
              max="1.0"
              step="0.05"
              value={userOpacity}
              onChange={(e) => setUserOpacity(parseFloat(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-cyan-600"
              aria-label="Adjust trend overlay opacity"
            />

            {/* Smooth Diverging Colour Scale Bar */}
            <div className="mt-0.5">
              <div
                className="h-3.5 w-full rounded-md shadow-inner border border-slate-200/60"
                style={{ background: gradientCss }}
              />
              <div className="flex justify-between text-[8.5px] font-mono font-medium text-slate-600 mt-1">
                <span>{legend.minimum?.toFixed(2) ?? "-"}</span>
                <span className="text-slate-400 font-normal">0.00</span>
                <span>{legend.maximum?.toFixed(2) ?? "+"}</span>
              </div>
              <div className="text-center text-[8.5px] text-slate-500 font-medium -mt-0.5">
                {unit}
              </div>
            </div>

            {/* BY-FDR Discovery Metrics Strip */}
            {fdrSummary && (
              <div className="rounded-lg border border-indigo-100 bg-indigo-50/70 p-2 text-[9px] text-indigo-900">
                <div className="flex items-center justify-between font-bold mb-1">
                  <div className="flex items-center gap-1">
                    <Info className="h-2.5 w-2.5 text-indigo-600" />
                    <span className="uppercase tracking-wide text-[8.5px]">BY-FDR Control (α=0.05)</span>
                  </div>
                  <span className="text-[8.5px] font-mono text-emerald-700 bg-emerald-100/80 px-1 py-0.2 rounded font-bold">
                    {fdrSummary.n_significant} / {fdrSummary.n_tested} sig
                  </span>
                </div>
                {fdrSummary.fdr_threshold != null && (
                  <div className="flex justify-between text-[8.5px] text-indigo-700 font-mono">
                    <span>FDR Threshold:</span>
                    <span>p ≤ {fdrSummary.fdr_threshold.toFixed(4)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Live Hover Inspection Box */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2 text-[9.5px]">
              {hoveredCell ? (
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between font-bold text-slate-900">
                    <div className="flex items-center gap-1">
                      {hoveredCell.slope > 0 ? (
                        <TrendingUp className="h-3 w-3 text-rose-500" />
                      ) : hoveredCell.slope < 0 ? (
                        <TrendingDown className="h-3 w-3 text-blue-500" />
                      ) : (
                        <Minus className="h-3 w-3 text-slate-400" />
                      )}
                      <span>
                        {hoveredCell.slope > 0 ? "+" : ""}
                        {hoveredCell.slope.toFixed(3)} {unit}
                      </span>
                    </div>
                    {hoveredCell.significant ? (
                      <span className="flex items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.2 text-[8.5px] font-bold text-emerald-800">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        sig.
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 rounded bg-slate-200 px-1.5 py-0.2 text-[8.5px] font-semibold text-slate-600">
                        <AlertCircle className="h-2.5 w-2.5 text-slate-400" />
                        n.s.
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-slate-500 font-mono text-[8.5px] mt-0.5">
                    <span>
                      p<sub>adj</sub>:{" "}
                      {hoveredCell.pAdj != null ? hoveredCell.pAdj.toFixed(4) : "—"}
                    </span>
                    <span>
                      {hoveredCell.lat.toFixed(1)}°N, {hoveredCell.lon.toFixed(1)}°E
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center text-slate-400 text-[8.5px] italic py-0.5">
                  Hover over map cells to inspect local slope & FDR significance
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
