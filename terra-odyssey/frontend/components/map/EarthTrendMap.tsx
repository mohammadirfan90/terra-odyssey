"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { Map, useMap } from "@/components/ui/map";
import type { StructuredGridMapResponse } from "@/lib/api/types";
import { OPEN_FREE_MAP_STYLES } from "@/lib/map/open-source-basemap";
import { recordExploratoryDraw } from "@/lib/map/selection-history";
import {
  type DrawShape,
  type MeasureResult,
  bboxOfRing,
  circleAreaSqKm,
  haversineKm,
  measureShape,
  polygonAreaSqM,
  polygonPerimeterM,
  rectangleAreaSqM,
  rectangleRing,
  shapeToRing,
  vincentyMetres,
} from "@/lib/map/draw-shapes";
import { Check, Globe, Magnet, Play, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgencyLogo } from "@/components/icons/AgencyLogos";
import {
  DATASET_TO_GIBS_LAYER,
  GIBS_AVAILABLE_LAYERS,
  buildGibsTileUrl,
} from "@/lib/map/gibs-layers";
import {
  computeIntelligentSnap,
  type MagneticSnapResult,
} from "@/lib/map/magnetic-snapping";
import {
  savePlot,
  getActivePlot,
  getAllPlots,
  deletePlot,
  setActivePlot,
  type PersistedPlot,
} from "@/lib/storage/plot-storage";
import { useInvestigationState, getInvestigationStore } from "@/lib/state/investigation";
import {
  MapControlDeck,
  DEFAULT_CUSTOM_OPTIONS,
  type DeckCustomOptions,
  type DeckDetailLevel,
  type DeckMapType,
} from "./MapControlDeck";

interface EarthTrendMapProps {
  gridData?: StructuredGridMapResponse | null;
  regionA?: [number, number, number, number] | null;
  regionB?: [number, number, number, number] | null;
  onUpdateRegions?: (
    regionA: [number, number, number, number],
    regionB: [number, number, number, number] | null,
    selectionMeta: ReturnType<typeof recordExploratoryDraw>,
  ) => void;
  /**
   * Receives the live MapLibre instance once it's available (and `null`
   * on unmount). Lets external UI (the search bar) drive the camera.
   */
  onMapInstanceChange?: (map: maplibregl.Map | null) => void;
  className?: string;
  bottomOffset?: number;
  /**
   * When false (default), the NASA GIBS observation layer, persistent
   * plot overlays, and the trend grid raster are all suppressed so the
   * basemap loads alone. The page flips this to true only after the user
   * explicitly selects a dataset/variable/region.
   */
  hasUserInitiated?: boolean;
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

// ── Transient scratch drawing layers (in-progress mouse interactions) ────
const SHAPE_SOURCE_ID = "terra-shape-source";
const SHAPE_FILL_LAYER_ID = "terra-shape-fill";
const SHAPE_LINE_LAYER_ID = "terra-shape-line";
const SHAPE_POINTS_SOURCE_ID = "terra-shape-points-source";
const SHAPE_POINTS_LAYER_ID = "terra-shape-points-layer";

// ── Permanent persisted plot layers (survives zoom, pan, style switches) ─
export const PERSISTENT_PLOT_SOURCE_ID = "terra-persistent-plot-source";
export const PERSISTENT_PLOT_FILL_ID = "terra-persistent-plot-fill";
export const PERSISTENT_PLOT_LINE_ID = "terra-persistent-plot-line";
export const PERSISTENT_PLOT_POINTS_SOURCE_ID = "terra-persistent-plot-points-source";
export const PERSISTENT_PLOT_POINTS_LAYER_ID = "terra-persistent-plot-points-layer";

export default function EarthTrendMap({
  gridData,
  regionA,
  regionB,
  onUpdateRegions,
  onMapInstanceChange,
  className = "w-full h-[540px]",
  bottomOffset = 12,
  hasUserInitiated = false,
}: EarthTrendMapProps) {
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // Read investigation state reactively
  const { drawMode, selectedDataset, mapDate } = useInvestigationState();
  const [gibsVisible, setGibsVisible] = useState(true);
  const [gibsOpacity] = useState(0.85);
  const [gibsMode, setGibsMode] = useState<"science" | "truecolor">("science");
  const currentGibsKeyRef = useRef<string | null>(null);

  // Resolved NASA GIBS satellite observation layer definition
  const effectiveGibsKey =
    gibsMode === "truecolor"
      ? "MODIS_Terra_CorrectedReflectance_TrueColor"
      : DATASET_TO_GIBS_LAYER[selectedDataset] ||
        "MODIS_Terra_CorrectedReflectance_TrueColor";
  const { urlTemplate, effectiveDate } = buildGibsTileUrl(effectiveGibsKey, mapDate);
  const activeGibsDef = GIBS_AVAILABLE_LAYERS[effectiveGibsKey];

  const [mapType, setMapType] = useState<DeckMapType>("satellite");
  const [detailLevel, setDetailLevel] = useState<DeckDetailLevel>("exploration");
  const [customOptions, setCustomOptions] = useState<DeckCustomOptions>(
    () => ({ ...DEFAULT_CUSTOM_OPTIONS }),
  );
  const [hasTileError, setHasTileError] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  // ── Drawing state (per-mode) ─────────────────────────────────
  // Rectangle: dragStart + currentDragEnd
  // Polygon:  vertexPoints[] + active vertex (on mouse move)
  // Circle:   centre + edge point (on mouse move)
  // Line:     vertexPoints[] + active vertex (on mouse move)
  const dragStartRef = useRef<[number, number] | null>(null);
  const dragEndRef = useRef<[number, number] | null>(null);
  const verticesRef = useRef<[number, number][]>([]);
  const centerRef = useRef<[number, number] | null>(null);
  const lastShapeRef = useRef<DrawShape | null>(null);
  const activePlotRef = useRef<PersistedPlot | null>(null);
  const [activePlotState, setActivePlotState] = useState<PersistedPlot | null>(null);
  const [allPlots, setAllPlots] = useState<PersistedPlot[]>([]);
  const allPlotsRef = useRef<PersistedPlot[]>([]);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [liveMetrics, setLiveMetrics] = useState<{
    areaKm2: number | null;
    perimeterKm: number | null;
    vertexCount: number;
  } | null>(null);
  const [polygonVertexCount, setPolygonVertexCount] = useState<number>(0);
  const rafIdRef = useRef<number | null>(null);
  const pendingMousePointRef = useRef<[number, number] | null>(null);
  const isSnappedToOriginRef = useRef<boolean>(false);
  const activeSnapRef = useRef<MagneticSnapResult | null>(null);
  const [activeSnap, setActiveSnap] = useState<MagneticSnapResult | null>(null);

  // If the basemap never finishes loading within 12s, surface a clear
  // error UI instead of leaving the user staring at an indefinite
  // spinner. This handles offline environments, blocked CDNs, and
  // service outages from OpenFreeMap / Esri.
  useEffect(() => {
    if (isMapLoaded || loadFailed) return;
    const timeout = window.setTimeout(() => setLoadFailed(true), 12_000);
    return () => window.clearTimeout(timeout);
  }, [isMapLoaded, loadFailed]);

  useEffect(() => {
    if (isMapLoaded) setLoadFailed(false);
  }, [isMapLoaded]);

  const handleMapStateChange = useCallback(
    (nextMap: maplibregl.Map | null, loaded: boolean) => {
      setMap(nextMap);
      setIsMapLoaded(loaded);
      onMapInstanceChange?.(nextMap);
    },
    [onMapInstanceChange],
  );

  const handleSelectPlotById = useCallback(
    (id: string, panTo: boolean = false) => {
      const target = allPlotsRef.current.find((p) => p.id === id);
      if (!target) return;
      activePlotRef.current = target;
      setActivePlotState(target);
      setActivePlot(target);
      if (map) {
        renderPersistentPlotsOnMap(map, allPlotsRef.current, target.id);
        if (panTo && target.bbox) {
          map.fitBounds(
            [
              [target.bbox[0], target.bbox[1]],
              [target.bbox[2], target.bbox[3]],
            ],
            { padding: 80, maxZoom: 8, duration: 600 },
          );
        }
      }
      window.dispatchEvent(
        new CustomEvent("terra-odyssey:active-plot-changed", {
          detail: { plot: target },
        }),
      );
    },
    [map],
  );

  // ── Rehydrate and bind persistent plot layers across zoom & style changes ──
  useEffect(() => {
    if (!map || !isMapLoaded) return;

    ensurePersistentPlotLayers(map);

    // Rehydrate all saved plots and active plot from Dual-Persistence Storage
    getAllPlots().then((plots) => {
      allPlotsRef.current = plots;
      setAllPlots(plots);
      getActivePlot().then((active) => {
        const currentActive = active || (plots.length > 0 ? plots[0] : null);
        if (currentActive) {
          activePlotRef.current = currentActive;
          setActivePlotState(currentActive);
          renderPersistentPlotsOnMap(map, plots, currentActive.id);
          window.dispatchEvent(
            new CustomEvent("terra-odyssey:active-plot-changed", {
              detail: { plot: currentActive },
            }),
          );
        } else {
          renderPersistentPlotsOnMap(map, plots, null);
        }
      });
    });

    const onStyleLoad = () => {
      ensurePersistentPlotLayers(map);
      renderPersistentPlotsOnMap(map, allPlotsRef.current, activePlotRef.current?.id || null);
    };
    map.on("style.load", onStyleLoad);

    const onPlotClick = (e: maplibregl.MapLayerMouseEvent) => {
      if (getInvestigationStore().state.drawMode !== "idle") return;
      const clickedId = e.features?.[0]?.properties?.id;
      if (!clickedId) return;

      const target = allPlotsRef.current.find((p) => p.id === clickedId);
      if (!target) return;

      activePlotRef.current = target;
      setActivePlotState(target);
      setActivePlot(target);
      renderPersistentPlotsOnMap(map, allPlotsRef.current, target.id);

      window.dispatchEvent(
        new CustomEvent("terra-odyssey:active-plot-changed", {
          detail: { plot: target },
        }),
      );

      // Show interactive on-map popup with quick "Analyze this section" action
      if (popupRef.current) {
        popupRef.current.remove();
      }
      const container = document.createElement("div");
      container.className = "flex flex-col gap-1.5 p-1 text-slate-800 text-xs min-w-[170px]";
      container.innerHTML = `
        <div class="flex items-center justify-between gap-2 border-b border-slate-100 pb-1">
          <span class="font-bold text-slate-900 text-[11px] truncate max-w-[120px]">${target.name || "Study Plot"}</span>
          <span class="rounded bg-cyan-100 text-cyan-800 text-[9px] px-1 py-0.2 font-mono font-bold shrink-0">${target.measurements?.areaKm2?.toLocaleString() ?? 0} km²</span>
        </div>
        <button id="btn-analyze-popup" class="flex items-center justify-center gap-1.5 rounded-md bg-cyan-600 hover:bg-cyan-700 text-white font-semibold px-2 py-1 text-[11px] transition shadow-sm w-full cursor-pointer">
          ▶ Analyze this section
        </button>
      `;
      const btn = container.querySelector("#btn-analyze-popup");
      btn?.addEventListener("click", () => {
        window.dispatchEvent(
          new CustomEvent("terra-odyssey:analyze-section", {
            detail: {
              bbox: target.bbox,
              name: target.name || "Drawn section",
              areaKm2: target.measurements?.areaKm2,
            },
          }),
        );
        popupRef.current?.remove();
      });

      popupRef.current = new maplibregl.Popup({ closeButton: true, offset: 12, className: "terra-plot-popup" })
        .setLngLat(e.lngLat)
        .setDOMContent(container)
        .addTo(map);
    };

    const onPlotEnter = () => {
      if (getInvestigationStore().state.drawMode === "idle") {
        map.getCanvas().style.cursor = "pointer";
      }
    };
    const onPlotLeave = () => {
      map.getCanvas().style.cursor = "";
    };

    map.on("click", PERSISTENT_PLOT_FILL_ID, onPlotClick);
    map.on("mouseenter", PERSISTENT_PLOT_FILL_ID, onPlotEnter);
    map.on("mouseleave", PERSISTENT_PLOT_FILL_ID, onPlotLeave);

    const handlePlotSaved = (event: Event) => {
      const customEvent = event as CustomEvent<{ plot: PersistedPlot }>;
      if (customEvent.detail?.plot) {
        const plot = customEvent.detail.plot;
        activePlotRef.current = plot;
        setActivePlotState(plot);
        const updated = [plot, ...allPlotsRef.current.filter((p) => p.id !== plot.id)];
        allPlotsRef.current = updated;
        setAllPlots(updated);
        renderPersistentPlotsOnMap(map, updated, plot.id);
      }
    };

    const handlePlotDeleted = (event: Event) => {
      const id = (event as CustomEvent<{ id: string }>).detail?.id;
      if (!id) return;
      const remaining = allPlotsRef.current.filter((p) => p.id !== id);
      allPlotsRef.current = remaining;
      setAllPlots(remaining);
      if (activePlotRef.current?.id === id) {
        const nextActive = remaining.length > 0 ? remaining[0] : null;
        activePlotRef.current = nextActive;
        setActivePlotState(nextActive);
        setActivePlot(nextActive);
      }
      renderPersistentPlotsOnMap(map, remaining, activePlotRef.current?.id || null);
    };

    const handleClearShapes = () => {
      activePlotRef.current = null;
      setActivePlotState(null);
      allPlotsRef.current = [];
      setAllPlots([]);
      setLiveMetrics(null);
      setPolygonVertexCount(0);
      renderPersistentPlotsOnMap(map, [], null);
      clearShapeLayers(map);
      if (popupRef.current) popupRef.current.remove();
    };

    window.addEventListener("terra-odyssey:plot-saved", handlePlotSaved);
    window.addEventListener("terra-odyssey:plot-deleted", handlePlotDeleted);
    window.addEventListener("terra-odyssey:clear-shapes", handleClearShapes);

    return () => {
      map.off("style.load", onStyleLoad);
      map.off("click", PERSISTENT_PLOT_FILL_ID, onPlotClick);
      map.off("mouseenter", PERSISTENT_PLOT_FILL_ID, onPlotEnter);
      map.off("mouseleave", PERSISTENT_PLOT_FILL_ID, onPlotLeave);
      window.removeEventListener("terra-odyssey:plot-saved", handlePlotSaved);
      window.removeEventListener("terra-odyssey:plot-deleted", handlePlotDeleted);
      window.removeEventListener("terra-odyssey:clear-shapes", handleClearShapes);
      if (popupRef.current) popupRef.current.remove();
    };
  }, [map, isMapLoaded]);

  // Surface a clean error state when tile sources can't fetch.
  useEffect(() => {
    if (!map) return;
    const onError = (event: unknown) => {
      const err = (event as { error?: { status?: number } })?.error;
      const status = err?.status;
      if (status === 404 || status === 403) {
        setHasTileError(true);
        setLoadFailed(true);
      }
    };
    map.on("error", onError as never);
    return () => {
      map.off("error", onError as never);
    };
  }, [map]);

  useEffect(() => {
    if (!map || !isMapLoaded) return;
    const onIdle = () => setHasTileError(false);
    map.once("idle", onIdle);
    return () => {
      map.off("idle", onIdle);
    };
  }, [map, isMapLoaded, mapType]);

  // ── Toggle satellite raster overlay whenever mapType changes ──
  useEffect(() => {
    if (!map || !isMapLoaded) return;

    const sourceId = "satellite-source";
    const layerId = "satellite-layer";
    const legacyIds = ["google-satellite-source", "google-satellite-layer"];

    for (const id of legacyIds) {
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    }

    if (mapType === "satellite") {
      const tileUrls = [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ];

      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);

      map.addSource(sourceId, {
        type: "raster",
        tiles: tileUrls,
        tileSize: 256,
        minzoom: 0,
        maxzoom: 18,
        attribution:
          "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
      });

      const style = map.getStyle();
      const firstLayerId = style?.layers?.[0]?.id;
      map.addLayer(
        {
          id: "satellite-bg-layer",
          type: "background",
          paint: { "background-color": "#1f2937" },
        },
        firstLayerId,
      );

      const anchorId = map
        .getStyle()
        .layers?.find((l) =>
          /^(boundary|label|highway|water_name)/i.test(l.id ?? ""),
        )?.id;

      map.addLayer(
        {
          id: layerId,
          type: "raster",
          source: sourceId,
          paint: { "raster-opacity": 1 },
        },
        anchorId,
      );

      for (const l of map.getStyle().layers ?? []) {
        const id = l.id ?? "";
        if (!id) continue;
        if (id === "satellite-layer" || id === "satellite-bg-layer") continue;
        if (l.type === "fill" && !/boundary|landcover|glacier/i.test(id)) {
          try {
            map.setLayoutProperty(id, "visibility", "none");
          } catch {
            // ignore
          }
        }
      }
    } else if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);

      for (const l of map.getStyle().layers ?? []) {
        const id = l.id ?? "";
        if (!id) continue;
        if (id === "satellite-layer" || id === "satellite-bg-layer") continue;
        if (l.type === "fill" && !/boundary|landcover|glacier/i.test(id)) {
          try {
            map.setLayoutProperty(id, "visibility", "visible");
          } catch {
            // ignore
          }
        }
      }
    }
  }, [map, isMapLoaded, mapType]);

  // ── Real NASA GIBS Satellite / Science Data Layer ──────────
  useEffect(() => {
    if (!map || !isMapLoaded || !urlTemplate) return;
    // Suppress the active NASA observation layer until the user has
    // explicitly kicked off an investigation. The basemap itself stays
    // visible as a canvas for the user to draw a region on.
    if (!hasUserInitiated) {
      const sourceId = "nasa-gibs-raster-source";
      const layerId = "nasa-gibs-raster-layer";
      if (map.getLayer(layerId)) {
        try { map.removeLayer(layerId); } catch {}
      }
      if (map.getSource(sourceId)) {
        try { map.removeSource(sourceId); } catch {}
      }
      currentGibsKeyRef.current = null;
      return;
    }

    const sourceId = "nasa-gibs-raster-source";
    const layerId = "nasa-gibs-raster-layer";

    // If layer key changed, cleanly remove old raster source & layer to prevent format/level mismatch
    if (currentGibsKeyRef.current !== effectiveGibsKey) {
      if (map.getLayer(layerId)) {
        try { map.removeLayer(layerId); } catch {}
      }
      if (map.getSource(sourceId)) {
        try { map.removeSource(sourceId); } catch {}
      }
      currentGibsKeyRef.current = effectiveGibsKey;
    }

    const existingSource = map.getSource(sourceId) as
      | maplibregl.RasterTileSource
      | undefined;

    if (existingSource) {
      if (typeof existingSource.setTiles === "function") {
        existingSource.setTiles([urlTemplate]);
      }
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(
          layerId,
          "visibility",
          gibsVisible ? "visible" : "none",
        );
        map.setPaintProperty(
          layerId,
          "raster-opacity",
          gibsVisible ? gibsOpacity : 0,
        );
      }
      return;
    }

    try {
      map.addSource(sourceId, {
        type: "raster",
        tiles: [urlTemplate],
        tileSize: 256,
        minzoom: 0,
        // NASA GIBS WMTS layers (MODIS, VIIRS, OISST, etc.) typically
        // cap out at z=9. Asking for tiles beyond that returns the
        // server's "Map data not yet available" placeholder, so we
        // clamp the source here. MapLibre will over-zoom smoothly
        // (the last available tile stays visible), giving users the
        // feeling of deeper zoom without breaking the visual.
        maxzoom: 9,
        attribution: activeGibsDef?.attribution || "NASA EOSDIS GIBS",
      });

      // Find first vector boundary, label, or user drawing layer to place beneath
      const style = map.getStyle();
      const beforeId = style?.layers?.find((l) =>
        /^(terra-shape|terra-persistent|boundary|label|highway|place|water_name)/i.test(
          l.id ?? "",
        ),
      )?.id;

      map.addLayer(
        {
          id: layerId,
          type: "raster",
          source: sourceId,
          layout: {
            visibility: gibsVisible ? "visible" : "none",
          },
          paint: {
            "raster-opacity": gibsVisible ? gibsOpacity : 0,
            "raster-fade-duration": 400,
          },
        },
        beforeId,
      );
    } catch (err) {
      console.warn("GIBS layer mount note:", err);
    }
  }, [map, isMapLoaded, effectiveGibsKey, urlTemplate, gibsVisible, gibsOpacity, activeGibsDef, hasUserInitiated]);

  // ── Detail-level visibility rules ─────────────────────────────
  useEffect(() => {
    if (!map || !isMapLoaded) return;

    const style = map.getStyle();
    if (!style || !Array.isArray(style.layers)) return;

    const isCustom = detailLevel === "custom";
    const hideAll = detailLevel === "clean";
    const showEverything = detailLevel === "everything";

    const rules: Array<{ prefixes: string[]; show: boolean }> = [];
    if (hideAll) {
      rules.push(
        { prefixes: ["boundary_", "label_"], show: false },
        {
          prefixes: [
            "highway_",
            "railway_",
            "aeroway",
            "highway-name",
            "highway-shield",
          ],
          show: false,
        },
        { prefixes: ["water_name", "waterway_line_label"], show: false },
        { prefixes: ["landcover_glacier"], show: false },
      );
    } else if (showEverything) {
      // Show everything.
    } else if (isCustom) {
      if (!customOptions.borders)
        rules.push({ prefixes: ["boundary_"], show: false });
      if (!customOptions.labels)
        rules.push({ prefixes: ["label_"], show: false });
      if (!customOptions.roads)
        rules.push({
          prefixes: ["highway_", "highway-name", "highway-shield"],
          show: false,
        });
      if (!customOptions.transit)
        rules.push({
          prefixes: ["railway_", "aeroway", "transit_"],
          show: false,
        });
      if (!customOptions.water)
        rules.push({
          prefixes: ["water_name", "waterway_line_label"],
          show: false,
        });
      if (!customOptions.landmarks)
        rules.push({ prefixes: ["landcover_glacier"], show: false });
    } else {
      rules.push(
        { prefixes: ["railway_", "aeroway"], show: false },
        { prefixes: ["highway-name", "highway-shield"], show: false },
        { prefixes: ["water_name", "waterway_line_label"], show: false },
      );
    }

    for (const layer of style.layers) {
      if (!layer.id) continue;
      if (layer.id === "satellite-layer") continue;

      const matched = rules.find((rule) =>
        rule.prefixes.some((p) => layer.id!.startsWith(p)),
      );
      const visibility: "visible" | "none" = matched
        ? matched.show
          ? "visible"
          : "none"
        : "visible";

      if (map.getLayer(layer.id)) {
        try {
          map.setLayoutProperty(layer.id, "visibility", visibility);
        } catch {
          // ignore
        }
      }
    }
  }, [map, isMapLoaded, detailLevel, customOptions]);

  // Cleanup any legacy trend-grid layers.
  useEffect(() => {
    if (!map || !isMapLoaded) return;
    if (map.getLayer("trend-grid-layer")) map.removeLayer("trend-grid-layer");
    if (map.getSource("trend-grid-source"))
      map.removeSource("trend-grid-source");
    if (map.getLayer("trend-fallback-layer"))
      map.removeLayer("trend-fallback-layer");
    if (map.getSource("trend-fallback-source"))
      map.removeSource("trend-fallback-source");
  }, [map, isMapLoaded, gridData]);

  // ── Update cursor + transient shape layer when drawMode changes ─
  useEffect(() => {
    if (!map || !isMapLoaded) return;

    const canvas = map.getCanvas();
    const isDrawing =
      drawMode === "draw-rectangle-a" ||
      drawMode === "draw-polygon-a" ||
      drawMode === "draw-circle-a" ||
      drawMode === "measure-line" ||
      drawMode === "measure-polygon" ||
      drawMode === "measure-circle";
    canvas.style.cursor = isDrawing ? "crosshair" : "";

    if (!isDrawing) {
      // Clear any in-progress state.
      dragStartRef.current = null;
      dragEndRef.current = null;
      verticesRef.current = [];
      setPolygonVertexCount(0);
      centerRef.current = null;
      lastShapeRef.current = null;
      clearShapeLayers(map);
    } else {
      ensureShapeLayers(map);
    }
  }, [map, isMapLoaded, drawMode]);

  // ── Live re-render of the in-progress shape during mouse move ──
  const renderShape = useCallback(
    (shape: DrawShape | null) => {
      if (!map || !shape) return;
      ensureShapeLayers(map);
      const ring = shapeToRing(shape);
      const isPlot =
        drawMode === "draw-rectangle-a" ||
        drawMode === "draw-polygon-a" ||
        drawMode === "draw-circle-a";

      // Polygon-line vs rectangle — for line we use a polyline (open).
      const isLine = shape.kind === "line";
      const source = map.getSource(SHAPE_SOURCE_ID) as
        | maplibregl.GeoJSONSource
        | undefined;
      if (!source) return;

      if (isLine) {
        source.setData({
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: ring.map(([lon, lat]) => [lon, lat]),
          },
          properties: {},
        });
        // Hide the fill layer for lines.
        if (map.getLayer(SHAPE_FILL_LAYER_ID)) {
          map.setLayoutProperty(SHAPE_FILL_LAYER_ID, "visibility", "none");
        }
        if (map.getLayer(SHAPE_LINE_LAYER_ID)) {
          map.setLayoutProperty(SHAPE_LINE_LAYER_ID, "visibility", "visible");
        }
        setLineColor(map, isPlot ? "#38bdf8" : "#fbbf24");
      } else {
        source.setData({
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [
              ring.map(([lon, lat]) => [lon, lat]),
            ],
          },
          properties: {},
        });
        if (map.getLayer(SHAPE_FILL_LAYER_ID)) {
          map.setLayoutProperty(SHAPE_FILL_LAYER_ID, "visibility", "visible");
          setFillColor(map, isPlot ? "#38bdf8" : "#fbbf24");
        }
        if (map.getLayer(SHAPE_LINE_LAYER_ID)) {
          map.setLayoutProperty(SHAPE_LINE_LAYER_ID, "visibility", "visible");
          setLineColor(map, isPlot ? "#38bdf8" : "#fbbf24");
        }
      }
      lastShapeRef.current = shape;
    },
    [map, drawMode],
  );

  // ── Finalize drawn shape & commit to dual storage (IndexedDB + SQLite) ──
  const finalizeShape = useCallback(
    (shape: DrawShape) => {
      if (!map) return;
      updateShapePoints(map, []);
      const isPlot =
        drawMode === "draw-rectangle-a" ||
        drawMode === "draw-polygon-a" ||
        drawMode === "draw-circle-a";
      const isMeasure =
        drawMode === "measure-line" ||
        drawMode === "measure-polygon" ||
        drawMode === "measure-circle";

      if (isPlot) {
        const ring = shapeToRing(shape);
        const bbox = bboxOfRing(ring);

        // 100% WGS-84 Accurate Geodesic Measurements
        const areaSqM = polygonAreaSqM(ring);
        const areaKm2 = Number((areaSqM / 1_000_000).toFixed(2));
        const areaHa = Number((areaSqM / 10_000).toFixed(1));
        const perimeterM = polygonPerimeterM(ring);
        const perimeterKm = Number((perimeterM / 1_000).toFixed(2));

        // Calculate centroid
        const uniquePts = ring.slice(0, Math.max(1, ring.length - 1));
        let sumLon = 0;
        let sumLat = 0;
        for (const pt of uniquePts) {
          sumLon += pt[0];
          sumLat += pt[1];
        }
        const centroid: [number, number] = [
          Number((sumLon / uniquePts.length).toFixed(4)),
          Number((sumLat / uniquePts.length).toFixed(4)),
        ];

        const plotRecord: PersistedPlot = {
          id: `plot-${Date.now()}`,
          name: "Drawn study region",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          geometry: {
            type: "Polygon",
            coordinates: [ring],
          },
          bbox,
          measurements: {
            areaKm2,
            areaHa,
            perimeterKm,
            centroid,
            bounds: {
              minLon: Number(bbox[0].toFixed(4)),
              minLat: Number(bbox[1].toFixed(4)),
              maxLon: Number(bbox[2].toFixed(4)),
              maxLat: Number(bbox[3].toFixed(4)),
            },
            vertexCount: uniquePts.length,
          },
        };

        activePlotRef.current = plotRecord;
        setActivePlotState(plotRecord);
        const updatedPlots = [plotRecord, ...allPlotsRef.current.filter((p) => p.id !== plotRecord.id)];
        allPlotsRef.current = updatedPlots;
        setAllPlots(updatedPlots);
        setLiveMetrics(null);
        setPolygonVertexCount(0);
        window.dispatchEvent(
          new CustomEvent("terra-odyssey:live-drawing-metrics", { detail: null }),
        );

        // 1. Dual-Persistence: commit to IndexedDB + sync to SQLite
        savePlot(plotRecord).catch((err) => {
          console.warn("Storage sync warning:", err);
        });

        // 2. Render onto permanent map layer (survives zoom, pan, styles)
        renderPersistentPlotsOnMap(map, updatedPlots, plotRecord.id);

        // 3. Clear transient scratch layers
        clearShapeLayers(map);
        lastShapeRef.current = null;

        // 4. Broadcast active plot changed for telemetry footer
        window.dispatchEvent(
          new CustomEvent("terra-odyssey:active-plot-changed", {
            detail: { plot: plotRecord },
          }),
        );

        const metadata = recordExploratoryDraw(gridData?.provenance?.map_family_id);
        onUpdateRegions?.(bbox, regionB || null, metadata);

        window.dispatchEvent(
          new CustomEvent("terra-odyssey:plot-bbox", {
            detail: { mode: drawMode, bbox },
          }),
        );
      } else if (isMeasure) {
        const m: MeasureResult = measureShape(shape);
        window.dispatchEvent(
          new CustomEvent("terra-odyssey:measure-shape", {
            detail: { shape, mode: drawMode, measure: m },
          }),
        );
        lastShapeRef.current = shape;
      }

      setLiveMetrics(null);
      setPolygonVertexCount(0);
      activeSnapRef.current = null;
      setActiveSnap(null);
      window.dispatchEvent(
        new CustomEvent("terra-odyssey:live-drawing-metrics", { detail: null }),
      );

      // Snap back to idle so the user doesn't keep drawing
      getInvestigationStore().setDrawMode("idle");
    },
    [drawMode, gridData, map, onUpdateRegions, regionB],
  );

  // ── Explicit Stop Plotting & Cancel ───────────────────────────
  const handleStopPlotting = useCallback(() => {
    dragStartRef.current = null;
    dragEndRef.current = null;
    verticesRef.current = [];
    setPolygonVertexCount(0);
    centerRef.current = null;
    lastShapeRef.current = null;
    setLiveMetrics(null);
    activeSnapRef.current = null;
    setActiveSnap(null);
    if (map) {
      clearShapeLayers(map);
      updateShapePoints(map, []);
    }
    getInvestigationStore().setDrawMode("idle");
    window.dispatchEvent(
      new CustomEvent("terra-odyssey:live-drawing-metrics", { detail: null }),
    );
  }, [map]);

  // ── Finish & Complete Polygon ──────────────────────────────────
  const handleCompletePolygon = useCallback(() => {
    if (verticesRef.current.length >= 3) {
      finalizeShape({
        kind: "polygon",
        ring: [...verticesRef.current, verticesRef.current[0]],
      });
      verticesRef.current = [];
      setPolygonVertexCount(0);
      setLiveMetrics(null);
      activeSnapRef.current = null;
      setActiveSnap(null);
      if (map) updateShapePoints(map, []);
      window.dispatchEvent(
        new CustomEvent("terra-odyssey:live-drawing-metrics", { detail: null }),
      );
    }
  }, [finalizeShape, map]);

  // ── Clear Active Study Plot ────────────────────────────────────
  const handleClearActivePlot = useCallback(async () => {
    if (!activePlotState) return;
    const targetId = activePlotState.id;
    await deletePlot(targetId).catch(() => {});
    const remaining = allPlotsRef.current.filter((p) => p.id !== targetId);
    allPlotsRef.current = remaining;
    setAllPlots(remaining);

    const nextActive = remaining.length > 0 ? remaining[0] : null;
    activePlotRef.current = nextActive;
    setActivePlotState(nextActive);
    setActivePlot(nextActive);

    setLiveMetrics(null);
    setPolygonVertexCount(0);
    activeSnapRef.current = null;
    setActiveSnap(null);

    if (map) {
      renderPersistentPlotsOnMap(map, remaining, nextActive?.id || null);
      clearShapeLayers(map);
      updateShapePoints(map, []);
    }
    if (popupRef.current) popupRef.current.remove();

    window.dispatchEvent(
      new CustomEvent("terra-odyssey:active-plot-changed", {
        detail: { plot: nextActive },
      }),
    );

    if (!nextActive) {
      window.dispatchEvent(new CustomEvent("terra-odyssey:clear-shapes"));
    }
    window.dispatchEvent(
      new CustomEvent("terra-odyssey:live-drawing-metrics", { detail: null }),
    );
  }, [activePlotState, map]);

  const isSectionTargeted = Boolean(
    regionA &&
    activePlotState &&
    Math.abs(regionA[0] - activePlotState.bbox[0]) < 0.005 &&
    Math.abs(regionA[1] - activePlotState.bbox[1]) < 0.005 &&
    Math.abs(regionA[2] - activePlotState.bbox[2]) < 0.005 &&
    Math.abs(regionA[3] - activePlotState.bbox[3]) < 0.005,
  );

  const handleAnalyzeSectionOnly = useCallback(() => {
    if (!activePlotState) return;
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("terra-odyssey:analyze-section", {
          detail: {
            bbox: activePlotState.bbox,
            name: activePlotState.name || "Drawn section",
            areaKm2: activePlotState.measurements?.areaKm2,
          },
        }),
      );
    }
  }, [activePlotState]);

  const handleAnalyzeGlobal = useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("terra-odyssey:analyze-global"));
    }
  }, []);

  // Cancel drawing with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && drawMode !== "idle") {
        handleStopPlotting();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drawMode, handleStopPlotting]);

  // ── Mouse handlers for drawing with RAF throttling & magnetic snapping ────
  const handleMouseDown = (event: React.MouseEvent) => {
    if (!map || !drawMode || drawMode === "idle") return;
    const rect = map.getContainer().getBoundingClientRect();
    const point = map.unproject([
      event.clientX - rect.left,
      event.clientY - rect.top,
    ]);
    const ll: [number, number] = [point.lng, point.lat];

    if (drawMode === "draw-rectangle-a") {
      dragStartRef.current = ll;
      dragEndRef.current = ll;
    } else if (drawMode === "draw-polygon-a" || drawMode === "measure-polygon") {
      // Magnetic origin snapping: close polygon if clicking near vertex 0 or actively snapped to origin
      if (
        verticesRef.current.length >= 3 &&
        (activeSnapRef.current?.type === "origin" || isSnappedToOriginRef.current)
      ) {
        finalizeShape({
          kind: "polygon",
          ring: [...verticesRef.current, verticesRef.current[0]],
        });
        verticesRef.current = [];
        setPolygonVertexCount(0);
        updateShapePoints(map, []);
        isSnappedToOriginRef.current = false;
        activeSnapRef.current = null;
        setActiveSnap(null);
        return;
      }

      // If intelligent magnet snapped to an orthogonal, diagonal, or vertex, insert the snapped point!
      const insertPt: [number, number] = activeSnapRef.current?.isSnapped
        ? [activeSnapRef.current.lng, activeSnapRef.current.lat]
        : ll;

      verticesRef.current.push(insertPt);
      setPolygonVertexCount(verticesRef.current.length);
      ensureShapeLayers(map);
      updateShapePoints(map, verticesRef.current);

      if (verticesRef.current.length >= 3) {
        const ring: [number, number][] = [...verticesRef.current, verticesRef.current[0]];
        const areaSqM = polygonAreaSqM(ring);
        const areaKm2 = Number((areaSqM / 1_000_000).toFixed(2));
        const perimeterM = polygonPerimeterM(ring);
        const perimeterKm = Number((perimeterM / 1_000).toFixed(2));
        const metrics = { areaKm2, perimeterKm, vertexCount: verticesRef.current.length };
        setLiveMetrics(metrics);
        window.dispatchEvent(
          new CustomEvent("terra-odyssey:live-drawing-metrics", {
            detail: metrics,
          }),
        );
      }
    } else if (drawMode === "draw-circle-a" || drawMode === "measure-circle") {
      // First click sets centre; second click sets edge
      if (!centerRef.current) {
        centerRef.current = ll;
      } else {
        const edge = ll;
        const finalShape: DrawShape = {
          kind: "circle",
          center: centerRef.current,
          edge,
        };
        finalizeShape(finalShape);
        centerRef.current = null;
      }
    }
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!map) return;
    const rect = map.getContainer().getBoundingClientRect();
    const point = map.unproject([
      event.clientX - rect.left,
      event.clientY - rect.top,
    ]);
    const ll: [number, number] = [point.lng, point.lat];

    // Real-time cursor coordinates broadcast for footer telemetry
    window.dispatchEvent(
      new CustomEvent("terra-odyssey:cursor-telemetry", {
        detail: {
          lat: Number(point.lat.toFixed(4)),
          lon: Number(point.lng.toFixed(4)),
          zoom: Number(map.getZoom().toFixed(1)),
          pitch: Number(map.getPitch().toFixed(0)),
        },
      }),
    );

    if (!drawMode || drawMode === "idle") return;

    // Intelligent Algorithmic Snapping: Origin closure, vertex attraction, 90° ortho, 45° diag
    const snapResult = computeIntelligentSnap(
      map,
      ll,
      verticesRef.current,
      drawMode,
    );

    if (snapResult.isSnapped) {
      activeSnapRef.current = snapResult;
      setActiveSnap(snapResult);
      isSnappedToOriginRef.current = snapResult.type === "origin";
      pendingMousePointRef.current = [snapResult.lng, snapResult.lat];
    } else {
      activeSnapRef.current = null;
      setActiveSnap(null);
      isSnappedToOriginRef.current = false;
      pendingMousePointRef.current = ll;
    }

    // RAF throttling for buttery-smooth 60/120 fps tracking
    if (!rafIdRef.current) {
      rafIdRef.current = window.requestAnimationFrame(() => {
        rafIdRef.current = null;
        const currentLl = pendingMousePointRef.current;
        if (!currentLl || !map) return;

        let metrics: {
          areaKm2: number | null;
          perimeterKm: number | null;
          vertexCount: number;
        } | null = null;

        if (drawMode === "draw-rectangle-a") {
          if (!dragStartRef.current) return;
          dragEndRef.current = currentLl;
          const a = dragStartRef.current;
          const c = currentLl;
          renderShape({
            kind: "rectangle",
            a,
            c,
          });

          const ring = rectangleRing(a, c);
          const areaSqM = rectangleAreaSqM(a, c);
          const areaKm2 = Number((areaSqM / 1_000_000).toFixed(2));
          const perimeterM = polygonPerimeterM(ring);
          const perimeterKm = Number((perimeterM / 1_000).toFixed(2));
          metrics = { areaKm2, perimeterKm, vertexCount: 4 };
        } else if (drawMode === "draw-polygon-a" || drawMode === "measure-polygon") {
          if (verticesRef.current.length === 0) return;
          if (verticesRef.current.length === 1) {
            renderShape({
              kind: "line",
              points: [verticesRef.current[0], currentLl],
            });
            updateShapePoints(map, [verticesRef.current[0], currentLl]);
            const distM = vincentyMetres(
              verticesRef.current[0][0],
              verticesRef.current[0][1],
              currentLl[0],
              currentLl[1],
            );
            metrics = {
              areaKm2: null,
              perimeterKm: Number((distM / 1_000).toFixed(2)),
              vertexCount: 2,
            };
          } else {
            const ring: [number, number][] = [...verticesRef.current, currentLl, verticesRef.current[0]];
            renderShape({ kind: "polygon", ring });
            updateShapePoints(map, [...verticesRef.current, currentLl]);

            const areaSqM = polygonAreaSqM(ring);
            const areaKm2 = Number((areaSqM / 1_000_000).toFixed(2));
            const perimeterM = polygonPerimeterM(ring);
            const perimeterKm = Number((perimeterM / 1_000).toFixed(2));
            metrics = {
              areaKm2,
              perimeterKm,
              vertexCount: verticesRef.current.length + 1,
            };
          }
        } else if (drawMode === "draw-circle-a" || drawMode === "measure-circle") {
          if (!centerRef.current) return;
          renderShape({ kind: "circle", center: centerRef.current, edge: currentLl });
          const areaKm2 = Number(circleAreaSqKm(centerRef.current, currentLl).toFixed(2));
          const radiusKm = haversineKm(
            centerRef.current[0],
            centerRef.current[1],
            currentLl[0],
            currentLl[1],
          );
          const perimeterKm = Number((2 * Math.PI * radiusKm).toFixed(2));
          metrics = { areaKm2, perimeterKm, vertexCount: 64 };
        } else if (drawMode === "measure-line") {
          if (verticesRef.current.length === 0) return;
          renderShape({
            kind: "line",
            points: [...verticesRef.current, currentLl],
          });
          const pts = [...verticesRef.current, currentLl];
          let totalDistM = 0;
          for (let i = 0; i < pts.length - 1; i++) {
            totalDistM += vincentyMetres(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
          }
          metrics = {
            areaKm2: null,
            perimeterKm: Number((totalDistM / 1_000).toFixed(2)),
            vertexCount: pts.length,
          };
        }

        if (metrics) {
          setLiveMetrics(metrics);
          window.dispatchEvent(
            new CustomEvent("terra-odyssey:live-drawing-metrics", {
              detail: metrics,
            }),
          );
        }
      });
    }
  };

  const handleMouseUp = (_event: React.MouseEvent) => {
    if (!map || !drawMode || drawMode === "idle") return;

    if (drawMode === "draw-rectangle-a") {
      if (!dragStartRef.current || !dragEndRef.current) return;
      const a = dragStartRef.current;
      const c = dragEndRef.current;
      dragStartRef.current = null;
      dragEndRef.current = null;
      // Reject tiny drags
      const ring: [number, number][] = [
        [a[0], a[1]],
        [c[0], a[1]],
        [c[0], c[1]],
        [a[0], c[1]],
      ];
      const bbox = bboxOfRing(ring);
      if (
        Math.abs(bbox[2] - bbox[0]) < 0.01 ||
        Math.abs(bbox[3] - bbox[1]) < 0.01
      ) {
        clearShapeLayers(map);
        return;
      }
      finalizeShape({ kind: "rectangle", a, c });
    }
  };

  const handleDoubleClick = (event: React.MouseEvent) => {
    if (!map || !drawMode || drawMode === "idle") return;
    event.preventDefault();
    if (drawMode === "draw-polygon-a" || drawMode === "measure-polygon") {
      if (verticesRef.current.length < 3) {
        verticesRef.current = [];
        setPolygonVertexCount(0);
        clearShapeLayers(map);
        return;
      }
      finalizeShape({
        kind: "polygon",
        ring: [...verticesRef.current, verticesRef.current[0]],
      });
      verticesRef.current = [];
      setPolygonVertexCount(0);
      updateShapePoints(map, []);
    } else if (drawMode === "measure-line") {
      if (verticesRef.current.length < 2) {
        verticesRef.current = [];
        setPolygonVertexCount(0);
        clearShapeLayers(map);
        return;
      }
      finalizeShape({ kind: "line", points: verticesRef.current });
      verticesRef.current = [];
      setPolygonVertexCount(0);
    }
  };

  // External "clear" event → wipe the rendered shape.
  useEffect(() => {
    if (!map) return;
    const handler = () => clearShapeLayers(map);
    window.addEventListener("terra-odyssey:clear-shapes", handler);
    return () => window.removeEventListener("terra-odyssey:clear-shapes", handler);
  }, [map]);

  return (
    <div
      className={`relative rounded-lg overflow-hidden border border-slate-800 bg-slate-950 ${className}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      <Map
        theme="light"
        styles={OPEN_FREE_MAP_STYLES}
        center={[0, 20]}
        zoom={1.5}
        // GIBS + Esri World Imagery are our tile sources; neither serves
        // meaningful detail past ~z=16 for our use case. Capping here
        // prevents the over-zoom "Map data not yet available" tile artifact.
        maxZoom={16}
        attributionControl={false}
        className="h-full w-full"
      >
        <MapStateBridge onMapStateChange={handleMapStateChange} />

        <MapControlDeck
          mapType={mapType}
          detailLevel={detailLevel}
          onChangeMapType={setMapType}
          onChangeDetailLevel={setDetailLevel}
          customOptions={customOptions}
          onChangeCustomOptions={setCustomOptions}
          bottomOffset={bottomOffset ?? 12}
        />
      </Map>

      {/* ── Atmospheric / Orbital Spacecraft Limb Vignette ── */}
      <div
        className="pointer-events-none absolute inset-0 z-10 shadow-[inset_0_0_90px_rgba(15,23,42,0.28)]"
        aria-hidden="true"
      />

      {hasTileError && !loadFailed ? (
        <div
          role="status"
          className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full border border-rose-500/40 bg-rose-950/85 px-4 py-1.5 text-xs font-semibold text-rose-200 shadow-lg"
        >
          Tiles unavailable — check your network
        </div>
      ) : null}

      {loadFailed ? (
        <div
          role="alert"
          className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/85 backdrop-blur-md"
        >
          <div className="max-w-md rounded-2xl border border-rose-500/30 bg-slate-900/90 p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-rose-500/40 bg-rose-500/10 text-rose-300">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
                <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-white">Map tiles unavailable</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Terra Odyssey could not reach the OpenFreeMap basemap or the
              satellite imagery service. The scientific tools still work —
              search and AI guidance are unaffected.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex items-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
            >
              Retry
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Algorithmic Magnetic Snapping Reticle & Indicator ──── */}
      {drawMode !== "idle" && activeSnap?.isSnapped && activeSnap.screenPos ? (
        <div
          className="pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-1/2 transition-transform duration-75 ease-out"
          style={{
            left: `${activeSnap.screenPos.x}px`,
            top: `${activeSnap.screenPos.y}px`,
          }}
        >
          {/* Concentric snap pulse and reticle */}
          <div className="relative flex items-center justify-center">
            <span className="absolute h-9 w-9 rounded-full border-2 border-cyan-400 bg-cyan-400/20 animate-ping" />
            <span className="h-4 w-4 rounded-full border-2 border-white bg-cyan-500 shadow-[0_0_12px_#38bdf8]" />
            {/* Snapping Tag Pill */}
            <div className="absolute top-5 flex items-center gap-1.5 whitespace-nowrap rounded-md border border-cyan-300 bg-white/95 px-2 py-0.5 text-[10px] font-mono font-bold text-cyan-800 shadow-md backdrop-blur-md">
              <Magnet className="h-3 w-3 text-cyan-600" />
              <span>{activeSnap.label}</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Drawing Status HUD ────────────────────────────────────── */}
      {drawMode !== "idle" ? (
        <div
          role="region"
          aria-label="Drawing controls"
          className="pointer-events-auto absolute left-1/2 top-[72px] z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-md border border-slate-200 bg-white/95 px-2 py-0.5 text-[11px] shadow-sm backdrop-blur-md text-slate-700"
        >
          <span className="font-semibold text-slate-800 text-[11px]">Polygon</span>
          <span className="h-2.5 w-px bg-slate-200" aria-hidden="true" />
          <span className="font-mono text-[10px] text-slate-500">
            {polygonVertexCount} {polygonVertexCount === 1 ? "pt" : "pts"}
          </span>

          <div className="flex items-center gap-1 pl-1 border-l border-slate-200">
            {(drawMode === "draw-polygon-a" || drawMode === "measure-polygon") &&
              polygonVertexCount >= 3 && (
                <button
                  type="button"
                  onClick={handleCompletePolygon}
                  className="rounded bg-cyan-600 hover:bg-cyan-700 text-white px-1.5 py-0.5 text-[10px] font-medium transition"
                  title="Finish polygon"
                >
                  Done
                </button>
              )}

            <button
              type="button"
              onClick={handleStopPlotting}
              className="rounded text-slate-400 hover:text-slate-600 p-0.5 transition"
              title="Cancel (Esc)"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Active Study Region Micro-Chip ────────────────────────── */}
      {drawMode === "idle" && (activePlotState?.measurements?.areaKm2 || allPlots.length > 0) && activePlotState ? (
        <div
          role="region"
          aria-label="Active study region"
          className="pointer-events-auto absolute left-4 top-[72px] z-20 flex items-center gap-1.5 rounded-md border border-slate-200 bg-white/95 px-2 py-0.5 text-[11px] shadow-sm backdrop-blur-md text-slate-800"
        >
          {allPlots.length > 1 ? (
            <select
              value={activePlotState.id}
              onChange={(e) => handleSelectPlotById(e.target.value, true)}
              className="rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px] font-medium text-slate-800 focus:outline-none max-w-[110px] truncate"
              title="Switch active study plot"
              aria-label="Switch active study plot"
            >
              {allPlots.map((p, idx) => (
                <option key={p.id} value={p.id}>
                  {p.name && p.name !== "Drawn study region" ? p.name : `Region ${idx + 1}`} ({p.measurements?.areaKm2?.toLocaleString() ?? 0} km²)
                </option>
              ))}
            </select>
          ) : (
            <span className="font-mono text-cyan-800 font-semibold text-[11px]">
              {activePlotState.measurements.areaKm2?.toLocaleString()} km²
            </span>
          )}

          <span className="h-2.5 w-px bg-slate-200" aria-hidden="true" />

          {/* Quick toggle: Global vs Analyze */}
          {isSectionTargeted ? (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 rounded px-1.5 py-0.2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 shrink-0" />
                Section Active
              </span>
              <button
                type="button"
                onClick={handleAnalyzeGlobal}
                className="rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                title="Switch analysis to entire Earth (Global)"
              >
                Reset to Global
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleAnalyzeSectionOnly}
              className="flex items-center gap-1 rounded bg-cyan-700 hover:bg-cyan-800 text-white px-2 py-0.5 text-[10px] font-semibold transition shadow-xs"
              title="Analyze trend specifically on this section"
            >
              ▶ Analyze Section
            </button>
          )}

          <span className="h-2.5 w-px bg-slate-200" aria-hidden="true" />

          {/* Dismiss */}
          <button
            type="button"
            onClick={handleClearActivePlot}
            className="flex items-center justify-center rounded text-slate-400 hover:text-slate-600 p-0.5 transition"
            title="Clear region"
            aria-label="Clear region"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : null}
      {/* ── Active NASA Earth Observation Layer Legend (Docked Bottom-Left) ── */}
      <div
        role="region"
        aria-label="Active NASA Earth observation layer"
        className={cn(
          "pointer-events-auto absolute left-3 z-20 flex flex-col rounded-lg border border-slate-200/80 bg-white/90 px-2 py-1.5 text-slate-800 shadow-md backdrop-blur-md transition-[bottom] duration-300 select-none w-48",
          !hasUserInitiated && "hidden",
        )}
        style={{ bottom: `${bottomOffset ?? 16}px` }}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <AgencyLogo
              agency={
                selectedDataset.toLowerCase().includes("sea_ice") || selectedDataset.toLowerCase().includes("nsidc")
                  ? "NSIDC"
                  : selectedDataset.toLowerCase().includes("oisst") || selectedDataset.toLowerCase().includes("noaa")
                    ? "NOAA"
                    : "NASA"
              }
              size={14}
            />
            <span className="text-[10px] font-semibold text-slate-800 truncate">
              {activeGibsDef?.name || "NASA Observation Layer"}
            </span>
          </div>
          {activeGibsDef?.legendUnit && (
            <span className="font-mono text-[9px] font-medium text-slate-500 shrink-0">
              {activeGibsDef.legendUnit}
            </span>
          )}
        </div>

        {/* Real Scientific Legend Color Bar */}
        {gibsMode === "science" && activeGibsDef?.paletteType && (
          <div className="mt-1 flex flex-col">
            {activeGibsDef.paletteType === "precipitation" && (
              <div>
                <div
                  className="h-1.5 w-full rounded-full shadow-inner"
                  style={{
                    background: "linear-gradient(to right, #e0f3f8, #67a9cf, #02818a, #fed976, #fd8d3c, #e31a1c)",
                  }}
                />
                <div className="flex justify-between text-[7.5px] font-mono text-slate-500 mt-0.5">
                  <span>0.1 mm/hr</span>
                  <span>5</span>
                  <span>30+</span>
                </div>
              </div>
            )}

            {activeGibsDef.paletteType === "temperature" && (
              <div>
                <div
                  className="h-1.5 w-full rounded-full shadow-inner"
                  style={{
                    background: "linear-gradient(to right, #313695, #4575b4, #74add1, #abd9e9, #fdae61, #f46d43, #d73027, #a50026)",
                  }}
                />
                <div className="flex justify-between text-[7.5px] font-mono text-slate-500 mt-0.5">
                  <span>-20°C</span>
                  <span>15°C</span>
                  <span>+45°C</span>
                </div>
              </div>
            )}

            {activeGibsDef.paletteType === "vegetation" && (
              <div>
                <div
                  className="h-1.5 w-full rounded-full shadow-inner"
                  style={{
                    background: "linear-gradient(to right, #ffffe5, #d9f0a3, #78c679, #238443, #004529)",
                  }}
                />
                <div className="flex justify-between text-[7.5px] font-mono text-slate-500 mt-0.5">
                  <span>0.0</span>
                  <span>0.45</span>
                  <span>0.9</span>
                </div>
              </div>
            )}

            {activeGibsDef.paletteType === "ice" && (
              <div>
                <div
                  className="h-1.5 w-full rounded-full shadow-inner"
                  style={{
                    background: "linear-gradient(to right, #08306b, #2171b5, #6baed6, #c6dbef, #ffffff)",
                  }}
                />
                <div className="flex justify-between text-[7.5px] font-mono text-slate-500 mt-0.5">
                  <span>15%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Shape layer helpers ─────────────────────────────────────── */

function ensureShapeLayers(map: maplibregl.Map) {
  if (!map.getSource(SHAPE_SOURCE_ID)) {
    map.addSource(SHAPE_SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
  if (!map.getSource(SHAPE_POINTS_SOURCE_ID)) {
    map.addSource(SHAPE_POINTS_SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
  if (!map.getLayer(SHAPE_FILL_LAYER_ID)) {
    map.addLayer({
      id: SHAPE_FILL_LAYER_ID,
      type: "fill",
      source: SHAPE_SOURCE_ID,
      paint: {
        "fill-color": "#38bdf8",
        "fill-opacity": 0.2,
      },
    });
  }
  if (!map.getLayer(SHAPE_LINE_LAYER_ID)) {
    map.addLayer({
      id: SHAPE_LINE_LAYER_ID,
      type: "line",
      source: SHAPE_SOURCE_ID,
      paint: {
        "line-color": "#0ea5e9",
        "line-width": 2.5,
        "line-opacity": 1.0,
      },
    });
  }
  if (!map.getLayer(SHAPE_POINTS_LAYER_ID)) {
    map.addLayer({
      id: SHAPE_POINTS_LAYER_ID,
      type: "circle",
      source: SHAPE_POINTS_SOURCE_ID,
      paint: {
        "circle-radius": 5,
        "circle-color": "#0ea5e9",
        "circle-stroke-width": 2.5,
        "circle-stroke-color": "#ffffff",
      },
    });
  }
}

function updateShapePoints(map: maplibregl.Map, points: [number, number][]) {
  const source = map.getSource(SHAPE_POINTS_SOURCE_ID) as
    | maplibregl.GeoJSONSource
    | undefined;
  if (!source) return;
  source.setData({
    type: "FeatureCollection",
    features: points.map(([lon, lat]) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties: {},
    })),
  });
}

function clearShapeLayers(map: maplibregl.Map) {
  const source = map.getSource(SHAPE_SOURCE_ID) as
    | maplibregl.GeoJSONSource
    | undefined;
  if (source) {
    source.setData({ type: "FeatureCollection", features: [] });
  }
  const ptsSource = map.getSource(SHAPE_POINTS_SOURCE_ID) as
    | maplibregl.GeoJSONSource
    | undefined;
  if (ptsSource) {
    ptsSource.setData({ type: "FeatureCollection", features: [] });
  }
}

/* ── Permanent Persisted Plot Layer Helpers (survives zoom & style switches) ── */

export function ensurePersistentPlotLayers(map: maplibregl.Map) {
  if (!map.getSource(PERSISTENT_PLOT_SOURCE_ID)) {
    map.addSource(PERSISTENT_PLOT_SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
  if (!map.getSource(PERSISTENT_PLOT_POINTS_SOURCE_ID)) {
    map.addSource(PERSISTENT_PLOT_POINTS_SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
  if (!map.getLayer(PERSISTENT_PLOT_FILL_ID)) {
    map.addLayer({
      id: PERSISTENT_PLOT_FILL_ID,
      type: "fill",
      source: PERSISTENT_PLOT_SOURCE_ID,
      paint: {
        "fill-color": [
          "case",
          ["==", ["get", "isActive"], true],
          "#38bdf8",
          "#64748b",
        ],
        "fill-opacity": [
          "case",
          ["==", ["get", "isActive"], true],
          0.25,
          0.12,
        ],
      },
    });
  }
  if (!map.getLayer(PERSISTENT_PLOT_LINE_ID)) {
    map.addLayer({
      id: PERSISTENT_PLOT_LINE_ID,
      type: "line",
      source: PERSISTENT_PLOT_SOURCE_ID,
      paint: {
        "line-color": [
          "case",
          ["==", ["get", "isActive"], true],
          "#0ea5e9",
          "#94a3b8",
        ],
        "line-width": [
          "case",
          ["==", ["get", "isActive"], true],
          2.5,
          1.5,
        ],
        "line-opacity": 1.0,
      },
    });
  }
  if (!map.getLayer(PERSISTENT_PLOT_POINTS_LAYER_ID)) {
    map.addLayer({
      id: PERSISTENT_PLOT_POINTS_LAYER_ID,
      type: "circle",
      source: PERSISTENT_PLOT_POINTS_SOURCE_ID,
      paint: {
        "circle-radius": 4.5,
        "circle-color": "#0ea5e9",
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      },
    });
  }
}

export function renderPersistentPlotsOnMap(
  map: maplibregl.Map,
  plots: PersistedPlot[],
  activePlotId: string | null,
) {
  ensurePersistentPlotLayers(map);
  const polySource = map.getSource(PERSISTENT_PLOT_SOURCE_ID) as
    | maplibregl.GeoJSONSource
    | undefined;
  const ptsSource = map.getSource(PERSISTENT_PLOT_POINTS_SOURCE_ID) as
    | maplibregl.GeoJSONSource
    | undefined;

  if (!polySource) return;

  const validPlots = plots.filter((plot) => plot && plot.geometry);
  const features = validPlots.map((plot) => {
    const ring =
      plot.geometry.type === "Polygon" && Array.isArray(plot.geometry.coordinates[0])
        ? (plot.geometry.coordinates[0] as [number, number][])
        : (plot.geometry.coordinates as [number, number][]);

    return {
      type: "Feature" as const,
      id: plot.id,
      geometry: {
        type: "Polygon" as const,
        coordinates: [ring],
      },
      properties: {
        id: plot.id,
        name: plot.name,
        areaKm2: plot.measurements?.areaKm2,
        isActive: plot.id === activePlotId,
      },
    };
  });

  polySource.setData({
    type: "FeatureCollection",
    features,
  });

  const activePlot = validPlots.find((p) => p.id === activePlotId);
  if (ptsSource && activePlot) {
    const ring =
      activePlot.geometry.type === "Polygon" && Array.isArray(activePlot.geometry.coordinates[0])
        ? (activePlot.geometry.coordinates[0] as [number, number][])
        : (activePlot.geometry.coordinates as [number, number][]);
    const pts = ring.slice(0, Math.max(1, ring.length - 1));
    ptsSource.setData({
      type: "FeatureCollection",
      features: pts.map(([lon, lat]) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [lon, lat] },
        properties: {},
      })),
    });
  } else if (ptsSource) {
    ptsSource.setData({ type: "FeatureCollection", features: [] });
  }
}

export function renderPersistentPlotOnMap(
  map: maplibregl.Map,
  plot: PersistedPlot | null,
) {
  if (plot) {
    renderPersistentPlotsOnMap(map, [plot], plot.id);
  } else {
    renderPersistentPlotsOnMap(map, [], null);
  }
}

function setFillColor(map: maplibregl.Map, color: string) {
  if (map.getLayer(SHAPE_FILL_LAYER_ID)) {
    map.setPaintProperty(SHAPE_FILL_LAYER_ID, "fill-color", color);
  }
}

function setLineColor(map: maplibregl.Map, color: string) {
  if (map.getLayer(SHAPE_LINE_LAYER_ID)) {
    map.setPaintProperty(SHAPE_LINE_LAYER_ID, "line-color", color);
  }
}

// ── Suppress unused-imports hints ──────────────────────────────
void vincentyMetres;
void haversineKm;
