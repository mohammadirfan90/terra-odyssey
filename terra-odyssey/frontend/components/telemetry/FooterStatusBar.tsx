/**
 * FooterStatusBar — Live Earth System Telemetry & Geodesic Measurements Bar.
 *
 * Displays:
 *  - Left: Real-time cursor coordinates (Latitude, Longitude), Map Zoom & Pitch.
 *  - Center: Geodesic measurements of an actually-drawn plot
 *    (Area in km² and ha, Vincenty Perimeter in km, Centroid). Only shows
 *    real measurements when a plot has been drawn; otherwise shows a hint
 *    to draw a region.
 *  - Right: Authoritative NASA Earth Science provenance.
 *
 * Note: Storage status badge omitted per user direction.
 */

"use client";

import { useEffect, useState } from "react";
import { MapPin, Maximize2, Ruler } from "lucide-react";
import { getActivePlot, type PersistedPlot } from "@/lib/storage/plot-storage";
import { AgencyLogo } from "@/components/icons/AgencyLogos";

interface CursorTelemetry {
  lat: number;
  lon: number;
  zoom: number;
  pitch: number;
}

interface LiveDrawingMetrics {
  areaKm2: number | null;
  perimeterKm: number | null;
  vertexCount: number;
}

export interface FooterStatusBarProps {
  systemVersion?: string;
  className?: string;
}

function formatCoordinate(val: number, isLat: boolean): string {
  const dir = isLat ? (val >= 0 ? "N" : "S") : val >= 0 ? "E" : "W";
  return `${Math.abs(val).toFixed(4)}° ${dir}`;
}

export function FooterStatusBar({
  systemVersion = "0.1.0-mvp",
  className = "",
}: FooterStatusBarProps) {
  const [cursor, setCursor] = useState<CursorTelemetry | null>(null);
  const [activePlot, setActivePlot] = useState<PersistedPlot | null>(null);
  const [liveDrawing, setLiveDrawing] = useState<LiveDrawingMetrics | null>(null);

  // Initial load of active plot from dual-persistence store
  useEffect(() => {
    getActivePlot().then((plot) => {
      if (plot) setActivePlot(plot);
    });

    const handleCursor = (e: Event) => {
      const customEvent = e as CustomEvent<CursorTelemetry>;
      if (customEvent.detail) {
        setCursor(customEvent.detail);
      }
    };

    const handleActivePlotChanged = (e: Event) => {
      const customEvent = e as CustomEvent<{ plot: PersistedPlot | null }>;
      setActivePlot(customEvent.detail?.plot || null);
    };

    const handleLiveMetrics = (e: Event) => {
      const customEvent = e as CustomEvent<LiveDrawingMetrics | null>;
      setLiveDrawing(customEvent.detail || null);
    };

    const handleClearShapes = () => {
      setActivePlot(null);
      setLiveDrawing(null);
    };

    window.addEventListener("terra-odyssey:cursor-telemetry", handleCursor);
    window.addEventListener("terra-odyssey:active-plot-changed", handleActivePlotChanged);
    window.addEventListener("terra-odyssey:plot-saved", handleActivePlotChanged as EventListener);
    window.addEventListener("terra-odyssey:live-drawing-metrics", handleLiveMetrics);
    window.addEventListener("terra-odyssey:clear-shapes", handleClearShapes);

    return () => {
      window.removeEventListener("terra-odyssey:cursor-telemetry", handleCursor);
      window.removeEventListener("terra-odyssey:active-plot-changed", handleActivePlotChanged);
      window.removeEventListener("terra-odyssey:plot-saved", handleActivePlotChanged as EventListener);
      window.removeEventListener("terra-odyssey:live-drawing-metrics", handleLiveMetrics);
      window.removeEventListener("terra-odyssey:clear-shapes", handleClearShapes);
    };
  }, []);

  const measurements = activePlot?.measurements;

  return (
    <footer
      className={`app-footer flex items-center justify-between border-t border-slate-200 bg-slate-50/95 px-3 py-1.5 text-[10px] font-mono text-slate-600 backdrop-blur-md transition-all select-none ${className}`}
      role="contentinfo"
      aria-label="Earth telemetry and plot measurement status"
    >
      {/* ── Left: Live Cursor Coordinates & Map Telemetry ────────────── */}
      <div className="flex items-center gap-1">
        {cursor ? (
          <div className="flex items-center gap-1 text-slate-700">
            <span className="flex items-center gap-0.5">
              <span className="inline-block w-16 text-right tabular-nums font-semibold">
                {formatCoordinate(cursor.lat, true)}
              </span>
              <span className="text-slate-400">,</span>
              <span className="inline-block w-[4.5rem] text-right tabular-nums font-semibold">
                {formatCoordinate(cursor.lon, false)}
              </span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500">
              Zoom <span className="text-slate-800 font-semibold tabular-nums">{cursor.zoom.toFixed(1)}</span>
            </span>
            {cursor.pitch > 0 && (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-slate-500">
                  Tilt <span className="text-slate-800 font-semibold tabular-nums">{cursor.pitch.toFixed(1)}°</span>
                </span>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-slate-400">
            <span>Hover map for coordinates</span>
          </div>
        )}
      </div>

      {/* ── Center: Active Study Region / Live Drawing Geodesic Measurements ── */}
      {liveDrawing && (liveDrawing.areaKm2 != null || liveDrawing.perimeterKm != null) ? (
        <div className="flex items-center gap-2.5 rounded-full border border-cyan-300 bg-cyan-50 px-3 py-0.5 text-cyan-900 shadow-sm animate-pulse">
          <span className="flex h-2 w-2 rounded-full bg-cyan-500 animate-ping" />
          {liveDrawing.areaKm2 != null ? (
            <span className="flex items-center gap-1 font-semibold text-cyan-900">
              <Maximize2 className="h-3 w-3 text-cyan-600" aria-hidden="true" />
              <span>Live Area: {liveDrawing.areaKm2.toLocaleString()} km²</span>
            </span>
          ) : (
            <span className="text-slate-600">
              Drawing in progress ({liveDrawing.vertexCount} pts)
            </span>
          )}
          {liveDrawing.perimeterKm != null && (
            <>
              <span className="text-cyan-300">•</span>
              <span className="flex items-center gap-1 text-slate-600">
                <Ruler className="h-3 w-3 text-cyan-600" aria-hidden="true" />
                <span>Perimeter: {liveDrawing.perimeterKm.toLocaleString()} km</span>
              </span>
            </>
          )}
        </div>
      ) : measurements && measurements.areaKm2 ? (
        <div className="flex items-center gap-2.5 rounded-full border border-cyan-200 bg-cyan-50/80 px-3 py-0.5 text-cyan-900 shadow-sm">
          <span className="flex items-center gap-1 font-semibold text-cyan-800">
            <Maximize2 className="h-3 w-3 text-cyan-600" aria-hidden="true" />
            <span>
              Area: {measurements.areaKm2.toLocaleString()} km²
              {measurements.areaHa && (
                <span className="ml-1 text-[9px] font-normal text-cyan-700">
                  ({measurements.areaHa.toLocaleString()} ha)
                </span>
              )}
            </span>
          </span>

          {measurements.perimeterKm && (
            <>
              <span className="text-cyan-300">•</span>
              <span className="flex items-center gap-1 text-slate-600">
                <Ruler className="h-3 w-3 text-cyan-600" aria-hidden="true" />
                <span>Perimeter: {measurements.perimeterKm.toLocaleString()} km</span>
              </span>
            </>
          )}

          {measurements.centroid && (
            <>
              <span className="text-cyan-300">•</span>
              <span className="flex items-center gap-1 text-slate-600">
                <MapPin className="h-3 w-3 text-cyan-600" aria-hidden="true" />
                <span>
                  Centroid: {formatCoordinate(measurements.centroid[1], true)},{" "}
                  {formatCoordinate(measurements.centroid[0], false)}
                </span>
              </span>
            </>
          )}
        </div>
      ) : (
        <div className="hidden sm:flex items-center gap-1.5 text-slate-400 text-[10px]">
          <span>Draw a region · point · rectangle · polygon · circle · administrative boundary</span>
        </div>
      )}

      {/* ── Right: Clean Provenance ─── */}
      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
        <span>Terra Odyssey</span>
        <span className="text-slate-300">•</span>
        <AgencyLogo agency="NASA" size={16} showLabel={true} />
        <span className="text-slate-300">•</span>
        <span className="font-mono text-slate-400">{systemVersion}</span>
      </div>
    </footer>
  );
}
