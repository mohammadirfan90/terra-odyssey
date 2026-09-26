"use client";

import React, { useCallback, useEffect, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { Map, useMap } from "@/components/ui/map";
import type { StructuredGridMapResponse } from "@/lib/api/types";
import { buildGridRenderPackage } from "@/lib/map/grid-to-canvas";
import { inspectNearestCell, type CellInspectionResult } from "@/lib/map/cell-index";
import { OPEN_FREE_MAP_STYLES } from "@/lib/map/open-source-basemap";
import { recordExploratoryDraw } from "@/lib/map/selection-history";
import { MapBottomBar } from "./MapBottomBar";
import { CellInspector } from "./CellInspector";
import {
  LayerControls,
  type DetailLevel,
  type MapType,
} from "./LayerControls";

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
  const [inspection, setInspection] = useState<CellInspectionResult | null>(null);
  const [drawingTarget, setDrawingTarget] = useState<"A" | "B" | null>(null);
  const [isExploratory, setIsExploratory] = useState(false);
  const [dragStart, setDragStart] = useState<[number, number] | null>(null);
  const [mapType, setMapType] = useState<MapType>("satellite");
  const [detailLevel, setDetailLevel] = useState<DetailLevel>("exploration");
  const [hasTileError, setHasTileError] = useState(false);

  const handleMapStateChange = useCallback(
    (nextMap: maplibregl.Map | null, loaded: boolean) => {
      setMap(nextMap);
      setIsMapLoaded(loaded);
    },
    []
  );

  // Surface a clean error state when tile sources can't fetch (offline,
  // CORS, blocked referrer). MapLibre would otherwise leave the canvas
  // showing the literal "Map data not yet available" placeholder image.
  useEffect(() => {
    if (!map) return;
    const onError = (event: unknown) => {
      const err = (event as { error?: { status?: number } })?.error;
      const status = err?.status;
      if (status === 404 || status === 403) {
        setHasTileError(true);
      }
    };
    map.on("error", onError as never);
    return () => {
      map.off("error", onError as never);
    };
  }, [map]);

  // Once tile loading succeeds for any source, clear the error banner.
  useEffect(() => {
    if (!map || !isMapLoaded) return;
    const onIdle = () => setHasTileError(false);
    map.once("idle", onIdle);
    return () => {
      map.off("idle", onIdle);
    };
  }, [map, isMapLoaded, mapType]);

  // Toggle the satellite raster overlay whenever mapType changes.
  useEffect(() => {
    if (!map || !isMapLoaded) return;

    const sourceId = "satellite-source";
    const layerId = "satellite-layer";
    // Legacy IDs from the previous Google-tiles implementation. We always
    // remove them so any orphaned layer/sources from prior renders stop
    // firing requests against mt[0-3].google.com.
    const legacyIds = ["google-satellite-source", "google-satellite-layer"];

    for (const id of legacyIds) {
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    }

    if (mapType === "satellite") {
      // Esri World Imagery is publicly licensed for non-commercial use. We add
      // a dark fallback background colour so any tile fetch failures (CORS,
      // rate-limit, offline) paint as a clean dark patch instead of MapLibre
      // rendering its "Map data not yet available" placeholder text.
      const tileUrls = [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ];

      // Always recreate the source so tile-URL changes (and cleanup from
      // prior renders) take effect cleanly.
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);

      map.addSource(sourceId, {
        type: "raster",
        tiles: tileUrls,
        tileSize: 256,
        minzoom: 0,
        maxzoom: 19,
        attribution:
          "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
      });

      // Insert the dark fallback background *at the very bottom* of the
      // style so it shows only when no other layer (the satellite raster or
      // a basemap fill) is painting.
      const style = map.getStyle();
      const firstLayerId = style?.layers?.[0]?.id;
      map.addLayer(
        {
          id: "satellite-bg-layer",
          type: "background",
          paint: { "background-color": "#1f2937" },
        },
        firstLayerId
      );

      // Place the satellite raster *above the basemap's land/water/park
      // fills* but *below the borders and labels* so country outlines and
      // place names still paint on top of the imagery.
      const anchorId = map
        .getStyle()
        .layers?.find((l) => /^(boundary|label|highway|water_name)/i.test(l.id ?? ""))
        ?.id;

      map.addLayer(
        {
          id: layerId,
          type: "raster",
          source: sourceId,
          paint: { "raster-opacity": 1 },
        },
        anchorId
      );

      // Hide basemap land/water/park fills so they don't tint the imagery.
      for (const l of map.getStyle().layers ?? []) {
        const id = l.id ?? "";
        if (!id) continue;
        if (id === "satellite-layer" || id === "satellite-bg-layer") continue;
        if (
          l.type === "fill" &&
          !/boundary|landcover|glacier/i.test(id)
        ) {
          try {
            map.setLayoutProperty(id, "visibility", "none");
          } catch {
            // ignore — third-party layers may reject this
          }
        }
      }
    } else if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);

      // Restore the basemap fill layers we hid when entering satellite mode.
      for (const l of map.getStyle().layers ?? []) {
        const id = l.id ?? "";
        if (!id) continue;
        if (id === "satellite-layer" || id === "satellite-bg-layer") continue;
        if (
          l.type === "fill" &&
          !/boundary|landcover|glacier/i.test(id)
        ) {
          try {
            map.setLayoutProperty(id, "visibility", "visible");
          } catch {
            // ignore
          }
        }
      }
    }
  }, [map, isMapLoaded, mapType]);

  // Apply visibility rules for the selected detail level (Clean /
  // Exploration / Everything / Custom). Iterates every basemap layer and
  // toggles `visibility` based on its prefix.
  useEffect(() => {
    if (!map || !isMapLoaded) return;

    const style = map.getStyle();
    if (!style || !Array.isArray(style.layers)) return;

    const hideAll = detailLevel === "clean";
    const showEverything = detailLevel === "everything";

    const rules: Array<{ prefix: string; show: boolean }> = [];
    if (hideAll) {
      // Hide borders, labels, roads, transit, landmarks, water labels.
      rules.push(
        { prefix: "boundary_", show: false },
        { prefix: "label_", show: false },
        { prefix: "highway_", show: false },
        { prefix: "railway_", show: false },
        { prefix: "aeroway", show: false },
        { prefix: "highway-name", show: false },
        { prefix: "highway-shield", show: false },
        { prefix: "water_name", show: false },
        { prefix: "waterway_line_label", show: false },
        { prefix: "landcover_glacier", show: false }
      );
    } else if (showEverything) {
      // Show everything (no overrides needed).
    } else {
      // Exploration (default): show borders + labels + roads; hide transit +
      // water labels + aeroway + highway shields.
      rules.push(
        { prefix: "railway_", show: false },
        { prefix: "aeroway", show: false },
        { prefix: "highway-name", show: false },
        { prefix: "highway-shield", show: false },
        { prefix: "water_name", show: false },
        { prefix: "waterway_line_label", show: false }
      );
    }

    for (const layer of style.layers) {
      if (!layer.id) continue;
      // Skip the satellite overlay layer (it shouldn't be touched by detail rules).
      if (layer.id === "satellite-layer") continue;

      const matched = rules.find((rule) => layer.id!.startsWith(rule.prefix));
      const visibility: "visible" | "none" = matched
        ? matched.show
          ? "visible"
          : "none"
        : "visible";

      if (map.getLayer(layer.id)) {
        try {
          map.setLayoutProperty(layer.id, "visibility", visibility);
        } catch {
          // Some third-party layers (e.g. terrain DEM, hillshade) reject
          // visibility changes. Ignore them silently.
        }
      }
    }
  }, [map, isMapLoaded, detailLevel]);

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

    map.addLayer({
      id: "trend-fallback-layer",
      type: "fill",
      source: "trend-fallback-source",
      paint: {
        "fill-color": ["get", "fillColor"],
        "fill-opacity": 0.85,
        "fill-outline-color": "#1e293b",
      },
    });
  }, [map, isMapLoaded, gridData]);

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
        theme="light"
        styles={OPEN_FREE_MAP_STYLES}
        center={[0, 20]}
        zoom={1.5}
        attributionControl={false}
        className="h-full w-full"
      >
        <MapStateBridge onMapStateChange={handleMapStateChange} />

        <MapBottomBar />

        <CellInspector
          inspection={inspection}
          units={gridData?.legend.units || "degC/decade"}
          onClose={() => setInspection(null)}
        />

        <LayerControls
          mapType={mapType}
          detailLevel={detailLevel}
          onChangeMapType={setMapType}
          onChangeDetailLevel={setDetailLevel}
        />
      </Map>

      {hasTileError ? (
        <div
          role="status"
          className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full border border-rose-500/40 bg-rose-950/85 px-4 py-1.5 text-xs font-semibold text-rose-200 shadow-lg"
        >
          Tiles unavailable — check your network
        </div>
      ) : null}
    </div>
  );
}
