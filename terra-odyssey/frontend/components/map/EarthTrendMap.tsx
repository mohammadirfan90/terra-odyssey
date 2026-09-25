"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { Map, MapControls, useMap } from "@/components/ui/map";
import type { StructuredGridMapResponse } from "@/lib/api/types";
import { buildGridRenderPackage } from "@/lib/map/grid-to-canvas";
import { inspectNearestCell, type CellInspectionResult } from "@/lib/map/cell-index";
import { OPEN_FREE_MAP_STYLES } from "@/lib/map/open-source-basemap";
import { recordExploratoryDraw } from "@/lib/map/selection-history";
import { ProjectionToggle } from "./ProjectionToggle";
import { CellInspector } from "./CellInspector";
import { RegionDrawControls } from "./RegionDrawControls";

interface EarthTrendMapProps {
  gridData?: StructuredGridMapResponse | null;
  regionA?: [number, number, number, number] | null;
  regionB?: [number, number, number, number] | null;
  onUpdateRegions?: (
    regionA: [number, number, number, number],
    regionB: [number, number, number, number] | null,
    selectionMeta: ReturnType<typeof recordExploratoryDraw>
  ) => void;
  className?: string;
}

function MapStateBridge({
  onMapStateChange,
}: {
  onMapStateChange: (map: maplibregl.Map | null, isLoaded: boolean) => void;
}) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    onMapStateChange(map, isLoaded);
  }, [map, isLoaded, onMapStateChange]);

  return null;
}

export default function EarthTrendMap({
  gridData,
  regionA,
  regionB,
  onUpdateRegions,
  className = "w-full h-[540px]",
}: EarthTrendMapProps) {
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [projection, setProjection] = useState<"mercator" | "globe">("mercator");
  const [inspection, setInspection] = useState<CellInspectionResult | null>(null);
  const [drawingTarget, setDrawingTarget] = useState<"A" | "B" | null>(null);
  const [isExploratory, setIsExploratory] = useState(false);
  const [dragStart, setDragStart] = useState<[number, number] | null>(null);
  const markerARef = useRef<maplibregl.Marker | null>(null);
  const markerBRef = useRef<maplibregl.Marker | null>(null);

  const mapProjection = useMemo<maplibregl.ProjectionSpecification>(
    () => ({ type: projection }),
    [projection]
  );

  const handleMapStateChange = useCallback(
    (nextMap: maplibregl.Map | null, loaded: boolean) => {
      setMap(nextMap);
      setIsMapLoaded(loaded);
    },
    []
  );

  // Set up persistent study-region layers after Mapcn has loaded the style.
  useEffect(() => {
    if (!map || !isMapLoaded) return;

    if (!map.getSource("region-a-source")) {
      map.addSource("region-a-source", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
    }
    if (!map.getLayer("region-a-layer")) {
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
    }

    if (!map.getSource("region-b-source")) {
      map.addSource("region-b-source", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
    }
    if (!map.getLayer("region-b-layer")) {
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
    }
  }, [map, isMapLoaded]);

  // Keep cell inspection in sync with the currently selected grid response.
  useEffect(() => {
    if (!map || !isMapLoaded) return;

    const handleClick = (event: maplibregl.MapMouseEvent) => {
      if (!gridData || drawingTarget) return;
      const result = inspectNearestCell(event.lngLat.lng, event.lngLat.lat, gridData);
      setInspection(result);
    };

    map.on("click", handleClick);
    return () => {
      map.off("click", handleClick);
    };
  }, [map, isMapLoaded, gridData, drawingTarget]);

  // Render the gridded slope values as crisp GeoJSON cells.
  useEffect(() => {
    if (!map || !isMapLoaded || !gridData) return;

    const renderPackage = buildGridRenderPackage(gridData, "RdBu");

    if (map.getLayer("trend-grid-layer")) map.removeLayer("trend-grid-layer");
    if (map.getSource("trend-grid-source")) map.removeSource("trend-grid-source");
    if (map.getLayer("trend-fallback-layer")) map.removeLayer("trend-fallback-layer");
    if (map.getSource("trend-fallback-source")) map.removeSource("trend-fallback-source");

    map.addSource("trend-fallback-source", {
      type: "geojson",
      data: renderPackage.geoJsonFallback,
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
  }, [map, isMapLoaded, gridData]);

  // Update both region outlines and their text markers.
  useEffect(() => {
    if (!map || !isMapLoaded) return;

    const bboxToGeoJson = (bounds: [number, number, number, number]): GeoJSON.Feature => ({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [[
          [bounds[0], bounds[1]],
          [bounds[2], bounds[1]],
          [bounds[2], bounds[3]],
          [bounds[0], bounds[3]],
          [bounds[0], bounds[1]],
        ]],
      },
      properties: {},
    });

    const sourceA = map.getSource("region-a-source") as maplibregl.GeoJSONSource | undefined;
    sourceA?.setData({
      type: "FeatureCollection",
      features: regionA ? [bboxToGeoJson(regionA)] : [],
    });

    if (regionA) {
      const center: [number, number] = [(regionA[0] + regionA[2]) / 2, (regionA[1] + regionA[3]) / 2];
      if (!markerARef.current) {
        const element = document.createElement("div");
        element.className =
          "terra-region-a-marker rounded border border-white bg-amber-500 px-1.5 py-0.5 font-mono text-[10px] font-bold text-black shadow-lg pointer-events-none";
        element.textContent = "REGION A";
        markerARef.current = new maplibregl.Marker({ element }).setLngLat(center).addTo(map);
      } else {
        markerARef.current.setLngLat(center);
      }
    } else if (markerARef.current) {
      markerARef.current.remove();
      markerARef.current = null;
    }

    const sourceB = map.getSource("region-b-source") as maplibregl.GeoJSONSource | undefined;
    sourceB?.setData({
      type: "FeatureCollection",
      features: regionB ? [bboxToGeoJson(regionB)] : [],
    });

    if (regionB) {
      const center: [number, number] = [(regionB[0] + regionB[2]) / 2, (regionB[1] + regionB[3]) / 2];
      if (!markerBRef.current) {
        const element = document.createElement("div");
        element.className =
          "terra-region-b-marker rounded border border-white bg-cyan-400 px-1.5 py-0.5 font-mono text-[10px] font-bold text-black shadow-lg pointer-events-none";
        element.textContent = "REGION B";
        markerBRef.current = new maplibregl.Marker({ element }).setLngLat(center).addTo(map);
      } else {
        markerBRef.current.setLngLat(center);
      }
    } else if (markerBRef.current) {
      markerBRef.current.remove();
      markerBRef.current = null;
    }
  }, [map, isMapLoaded, regionA, regionB]);

  const handleMouseDown = (event: React.MouseEvent) => {
    if (!drawingTarget || !map) return;
    const rect = map.getContainer().getBoundingClientRect();
    const lngLat = map.unproject([event.clientX - rect.left, event.clientY - rect.top]);
    setDragStart([lngLat.lng, lngLat.lat]);
  };

  const handleMouseUp = (event: React.MouseEvent) => {
    if (!drawingTarget || !dragStart || !map) return;
    const rect = map.getContainer().getBoundingClientRect();
    const end = map.unproject([event.clientX - rect.left, event.clientY - rect.top]);
    const [startLon, startLat] = dragStart;
    setDragStart(null);

    const minLon = Math.min(startLon, end.lng);
    const maxLon = Math.max(startLon, end.lng);
    const minLat = Math.min(startLat, end.lat);
    const maxLat = Math.max(startLat, end.lat);

    if (Math.abs(maxLon - minLon) < 0.5 || Math.abs(maxLat - minLat) < 0.5) {
      setDrawingTarget(null);
      return;
    }

    const bounds: [number, number, number, number] = [minLon, minLat, maxLon, maxLat];
    setIsExploratory(true);
    const metadata = recordExploratoryDraw(gridData?.provenance.map_family_id);

    if (drawingTarget === "A") {
      onUpdateRegions?.(bounds, regionB || null, metadata);
    } else if (regionA) {
      onUpdateRegions?.(regionA, bounds, metadata);
    }

    setDrawingTarget(null);
  };

  return (
    <div
      className={`relative rounded-lg overflow-hidden border border-slate-800 bg-slate-950 ${className}`}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      <Map
        theme="dark"
        styles={OPEN_FREE_MAP_STYLES}
        center={[0, 20]}
        zoom={1.5}
        projection={mapProjection}
        attributionControl={false}
        className="h-full w-full"
      >
        <MapStateBridge onMapStateChange={handleMapStateChange} />
        <MapControls
          position="top-right"
          showZoom
          showCompass
          showFullscreen
          className="right-4 top-4 z-30"
        />

        <RegionDrawControls
          drawingTarget={drawingTarget}
          onStartDrawing={setDrawingTarget}
          onClear={() => onUpdateRegions?.([0, 0, 0, 0], null, recordExploratoryDraw())}
          onConfirm={() => setDrawingTarget(null)}
          hasRegionA={!!regionA}
          hasRegionB={!!regionB}
          isExploratory={isExploratory}
        />

        <div className="absolute right-16 top-4 z-30">
          <ProjectionToggle projection={projection} onToggle={setProjection} />
        </div>

        <CellInspector
          inspection={inspection}
          units={gridData?.legend.units || "degC/decade"}
          onClose={() => setInspection(null)}
        />
      </Map>
    </div>
  );
}
