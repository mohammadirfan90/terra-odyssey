"use client";

import React, { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import type { StructuredGridMapResponse } from "@/lib/api/types";
import { buildGridRenderPackage } from "@/lib/map/grid-to-canvas";
import { inspectNearestCell, type CellInspectionResult } from "@/lib/map/cell-index";
import { ProjectionToggle } from "./ProjectionToggle";
import { CellInspector } from "./CellInspector";
import { RegionDrawControls } from "./RegionDrawControls";
import { recordExploratoryDraw } from "@/lib/map/selection-history";

interface EarthTrendMapProps {
  gridData?: StructuredGridMapResponse | null;
  regionA?: [number, number, number, number] | null;
  regionB?: [number, number, number, number] | null;
  onUpdateRegions?: (
    regionA: [number, number, number, number],
    regionB: [number, number, number, number] | null,
    selectionMeta: any
  ) => void;
  className?: string;
}

export default function EarthTrendMap({
  gridData,
  regionA,
  regionB,
  onUpdateRegions,
  className = "w-full h-[540px]",
}: EarthTrendMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerARef = useRef<maplibregl.Marker | null>(null);
  const markerBRef = useRef<maplibregl.Marker | null>(null);

  const [projection, setProjection] = useState<"mercator" | "globe">("mercator");
  const [inspection, setInspection] = useState<CellInspectionResult | null>(null);
  const [drawingTarget, setDrawingTarget] = useState<"A" | "B" | null>(null);
  const [isExploratory, setIsExploratory] = useState<boolean>(false);

  // Drawing state
  const dragStartRef = useRef<[number, number] | null>(null);

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: [
              "https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
              "https://b.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            attribution: "© CartoDB, © OpenStreetMap",
          },
        },
        layers: [
          {
            id: "osm-tiles",
            type: "raster",
            source: "osm",
            minzoom: 0,
            maxzoom: 18,
          },
        ],
      },
      center: [0, 20],
      zoom: 1.5,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");

    map.on("load", () => {
      mapRef.current = map;

      // Add Region A & Region B GeoJSON sources and outline layers
      map.addSource("region-a-source", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "region-a-layer",
        type: "line",
        source: "region-a-source",
        paint: {
          "line-color": "#f59e0b",
          "line-width": 2.5,
          "line-dasharray": [2, 1],
        },
      });

      map.addSource("region-b-source", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "region-b-layer",
        type: "line",
        source: "region-b-source",
        paint: {
          "line-color": "#06b6d4",
          "line-width": 2.5,
          "line-dasharray": [2, 1],
        },
      });

      // Click or mousemove cell inspector
      map.on("click", (e) => {
        if (!gridData) return;
        const res = inspectNearestCell(e.lngLat.lng, e.lngLat.lat, gridData);
        setInspection(res);
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update projection (Mercator vs Globe)
  useEffect(() => {
    if (!mapRef.current) return;
    try {
      if ((mapRef.current as any).setProjection) {
        (mapRef.current as any).setProjection({ type: projection });
      }
    } catch (e) {
      console.warn("Projection switch notice:", e);
    }
  }, [projection]);

  // Update Grid Raster / Canvas Layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !gridData) return;

    const renderPkg = buildGridRenderPackage(gridData, "RdBu");

    // Remove existing layer/source if present
    if (map.getLayer("trend-grid-layer")) map.removeLayer("trend-grid-layer");
    if (map.getSource("trend-grid-source")) map.removeSource("trend-grid-source");
    if (map.getLayer("trend-fallback-layer")) map.removeLayer("trend-fallback-layer");
    if (map.getSource("trend-fallback-source")) map.removeSource("trend-fallback-source");

    // Add GeoJSON polygon layer (crisp un-interpolated cell polygons)
    map.addSource("trend-fallback-source", {
      type: "geojson",
      data: renderPkg.geoJsonFallback,
    });

    map.addLayer(
      {
        id: "trend-fallback-layer",
        type: "fill",
        source: "trend-fallback-source",
        paint: {
          "fill-color": ["get", "fillColor"],
          "fill-opacity": 0.85,
          "fill-outline-color": "#1e293b",
        },
      },
      "region-a-layer"
    );
  }, [gridData]);

  // Update Region A & B outlines and persistent text labels
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // Helper to convert bbox [minLon, minLat, maxLon, maxLat] to Polygon GeoJSON
    const bboxToGeoJson = (b: [number, number, number, number]): GeoJSON.Feature => ({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [[
          [b[0], b[1]],
          [b[2], b[1]],
          [b[2], b[3]],
          [b[0], b[3]],
          [b[0], b[1]],
        ]],
      },
      properties: {},
    });

    // Update Region A
    const srcA = map.getSource("region-a-source") as maplibregl.GeoJSONSource;
    if (srcA) {
      srcA.setData({
        type: "FeatureCollection",
        features: regionA ? [bboxToGeoJson(regionA)] : [],
      });
    }

    if (regionA) {
      const centerLon = (regionA[0] + regionA[2]) / 2;
      const centerLat = (regionA[1] + regionA[3]) / 2;
      if (!markerARef.current) {
        const el = document.createElement("div");
        el.className =
          "px-1.5 py-0.5 rounded bg-amber-500 text-black font-bold font-mono text-[10px] shadow-lg border border-white pointer-events-none";
        el.innerText = "REGION A";
        markerARef.current = new maplibregl.Marker({ element: el }).setLngLat([centerLon, centerLat]).addTo(map);
      } else {
        markerARef.current.setLngLat([centerLon, centerLat]);
      }
    } else if (markerARef.current) {
      markerARef.current.remove();
      markerARef.current = null;
    }

    // Update Region B
    const srcB = map.getSource("region-b-source") as maplibregl.GeoJSONSource;
    if (srcB) {
      srcB.setData({
        type: "FeatureCollection",
        features: regionB ? [bboxToGeoJson(regionB)] : [],
      });
    }

    if (regionB) {
      const centerLon = (regionB[0] + regionB[2]) / 2;
      const centerLat = (regionB[1] + regionB[3]) / 2;
      if (!markerBRef.current) {
        const el = document.createElement("div");
        el.className =
          "px-1.5 py-0.5 rounded bg-cyan-400 text-black font-bold font-mono text-[10px] shadow-lg border border-white pointer-events-none";
        el.innerText = "REGION B";
        markerBRef.current = new maplibregl.Marker({ element: el }).setLngLat([centerLon, centerLat]).addTo(map);
      } else {
        markerBRef.current.setLngLat([centerLon, centerLat]);
      }
    } else if (markerBRef.current) {
      markerBRef.current.remove();
      markerBRef.current = null;
    }
  }, [regionA, regionB]);

  // Handle Box Drag Selection
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!drawingTarget || !mapRef.current) return;
    const map = mapRef.current;
    const rect = mapContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const lngLat = map.unproject([e.clientX - rect.left, e.clientY - rect.top]);
    dragStartRef.current = [lngLat.lng, lngLat.lat];
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!drawingTarget || !dragStartRef.current || !mapRef.current) return;
    const map = mapRef.current;
    const rect = mapContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const endLngLat = map.unproject([e.clientX - rect.left, e.clientY - rect.top]);
    const startLngLat = dragStartRef.current;
    dragStartRef.current = null;

    const minLon = Math.min(startLngLat[0], endLngLat.lng);
    const maxLon = Math.max(startLngLat[0], endLngLat.lng);
    const minLat = Math.min(startLngLat[1], endLngLat.lat);
    const maxLat = Math.max(startLngLat[1], endLngLat.lat);

    // Minimum area sanity check
    if (Math.abs(maxLon - minLon) < 0.5 || Math.abs(maxLat - minLat) < 0.5) {
      setDrawingTarget(null);
      return;
    }

    const newBbox: [number, number, number, number] = [minLon, minLat, maxLon, maxLat];
    setIsExploratory(true);

    const meta = recordExploratoryDraw(gridData?.provenance.map_family_id);

    if (drawingTarget === "A") {
      onUpdateRegions?.(newBbox, regionB || null, meta);
    } else if (drawingTarget === "B") {
      if (regionA) {
        onUpdateRegions?.(regionA, newBbox, meta);
      }
    }

    setDrawingTarget(null);
  };

  return (
    <div
      className={`relative rounded-lg overflow-hidden border border-slate-800 bg-slate-950 ${className}`}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Region Draw Toolbar */}
      <RegionDrawControls
        drawingTarget={drawingTarget}
        onStartDrawing={(target) => setDrawingTarget(target)}
        onClear={() => onUpdateRegions?.([0, 0, 0, 0], null, recordExploratoryDraw())}
        onConfirm={() => setDrawingTarget(null)}
        hasRegionA={!!regionA}
        hasRegionB={!!regionB}
        isExploratory={isExploratory}
      />

      {/* Projection Switcher */}
      <div className="absolute top-4 right-14 z-30">
        <ProjectionToggle projection={projection} onToggle={setProjection} />
      </div>

      {/* Cell Inspector Popover */}
      <CellInspector
        inspection={inspection}
        units={gridData?.legend.units || "degC/decade"}
        onClose={() => setInspection(null)}
      />

      {/* Frozen Zero-Centred Diverging Map Legend */}
      {gridData && (
        <div className="absolute bottom-4 right-4 z-30 flex flex-col space-y-1.5 p-2.5 rounded-lg bg-slate-900/95 border border-slate-800 shadow-xl backdrop-blur-md text-[10px] font-mono">
          <div className="flex items-center justify-between text-slate-300 font-sans font-semibold">
            <span>{gridData.legend.variable}</span>
            <span className="text-slate-400 font-mono text-[9px]">{gridData.legend.units}</span>
          </div>

          {/* Diverging color gradient bar */}
          <div className="w-48 h-3 rounded-sm bg-gradient-to-r from-[#2166ac] via-[#f7f7f7] to-[#b2182b] border border-slate-700 shadow-inner" />

          <div className="flex justify-between text-slate-400 text-[9px]">
            <span>-{(gridData.legend.maximum || 1).toFixed(2)}</span>
            <span className="text-slate-200 font-bold">0.00</span>
            <span>+{(gridData.legend.maximum || 1).toFixed(2)}</span>
          </div>

          <div className="pt-1 border-t border-slate-800 flex items-center justify-between text-[9px] text-slate-400">
            <span>FDR Discovery:</span>
            <span className="text-emerald-400 font-semibold">BY ≤ 0.05</span>
          </div>
        </div>
      )}
    </div>
  );
}
