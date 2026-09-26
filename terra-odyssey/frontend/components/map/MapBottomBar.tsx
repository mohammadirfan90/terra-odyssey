"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Globe,
  Locate,
  Map as MapIcon,
  Minus,
  Plus,
  X,
} from "lucide-react";
import * as maplibregl from "maplibre-gl";

import { useMap } from "@/components/ui/map";
import { cn } from "@/lib/utils";

type Projection = "mercator" | "globe";

const MAX_PITCH = 60;
const PITCH_EPSILON = 0.5;
const BEARING_EPSILON = 0.5;

function clampPitch(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_PITCH, Math.max(0, value));
}

function normalizeBearing(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const mod = value % 360;
  return mod < 0 ? mod + 360 : mod;
}

export function MapBottomBar() {
  const { map } = useMap();
  const [bearing, setBearing] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [projection, setProjection] = useState<Projection>("mercator");
  const [compassOpen, setCompassOpen] = useState(false);
  const [locating, setLocating] = useState(false);

  // Capture the live map instance in a ref so callbacks always see the latest
  // value, even if they were attached before the map finished mounting.
  const mapRef = useRef<maplibregl.Map | null>(null);
  useEffect(() => {
    mapRef.current = map;
  }, [map]);

  // Keep bearing/pitch in sync with the live map (drag-to-rotate, scroll-zoom,
  // touch gestures, programmatic easeTo, etc.).
  useEffect(() => {
    const instance = mapRef.current;
    if (!instance) return;

    const onRotate = () => {
      const next = normalizeBearing(instance.getBearing());
      setBearing((prev) =>
        Math.abs(prev - next) < BEARING_EPSILON ? prev : next,
      );
    };
    const onPitch = () => {
      const next = clampPitch(instance.getPitch());
      setPitch((prev) => (Math.abs(prev - next) < PITCH_EPSILON ? prev : next));
    };

    onRotate();
    onPitch();

    instance.on("rotate", onRotate);
    instance.on("pitch", onPitch);

    return () => {
      instance.off("rotate", onRotate);
      instance.off("pitch", onPitch);
    };
  }, [map]);

  // Drive the basemap projection whenever the projection changes. MapLibre
  // requires the style to be loaded before setProjection can run.
  useEffect(() => {
    const instance = mapRef.current;
    if (!instance) return;

    const apply = () => {
      try {
        instance.setProjection({ type: projection });
      } catch {
        // Style may still be swapping; ignore.
      }
    };

    if (instance.isStyleLoaded()) apply();
    instance.once("style.load", apply);
    return () => {
      instance.off("style.load", apply);
    };
  }, [projection]);

  // Close the compass popover on outside clicks + Escape.
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!compassOpen) return;

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setCompassOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCompassOpen(false);
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [compassOpen]);

  const handleZoomIn = useCallback(() => {
    const instance = mapRef.current;
    if (!instance) return;
    instance.zoomTo(instance.getZoom() + 1, { duration: 300 });
  }, []);

  const handleZoomOut = useCallback(() => {
    const instance = mapRef.current;
    if (!instance) return;
    instance.zoomTo(instance.getZoom() - 1, { duration: 300 });
  }, []);

  const handleLocate = useCallback(() => {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const instance = mapRef.current;
        instance?.flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 14,
          duration: 1500,
        });
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 10000 },
    );
  }, []);

  const handleTiltChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = clampPitch(Number(event.target.value));
      setPitch(value);
      const instance = mapRef.current;
      instance?.easeTo({ pitch: value, duration: 200 });
    },
    [],
  );

  const handleHeadingChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = normalizeBearing(Number(event.target.value));
      setBearing(value);
      const instance = mapRef.current;
      instance?.easeTo({ bearing: value, duration: 200 });
    },
    [],
  );

  const handleResetBearing = useCallback(() => {
    const instance = mapRef.current;
    if (!instance) return;
    instance.resetNorthPitch({ duration: 300 });
    setCompassOpen(false);
  }, []);

  return (
    <div className="pointer-events-none absolute bottom-3 right-3 z-30 flex justify-end">
      <div className="pointer-events-auto inline-flex items-center gap-0.5 rounded-full border border-white/15 bg-slate-950/85 px-1.5 py-1 shadow-lg backdrop-blur-md">
        <button
          type="button"
          aria-label="Find my location"
          title="Find my location"
          disabled={locating}
          onClick={handleLocate}
          className="flex h-7 w-7 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
        >
          <Locate
            className={cn("h-3.5 w-3.5", locating && "animate-spin")}
            aria-hidden="true"
          />
        </button>

        <span className="mx-0.5 h-4 w-px bg-white/10" aria-hidden="true" />

        <div className="relative">
          <button
            ref={triggerRef}
            type="button"
            aria-label={`Compass — heading ${Math.round(bearing)}°`}
            aria-expanded={compassOpen}
            title="Tilt and heading"
            onClick={() => setCompassOpen((open) => !open)}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full transition",
              compassOpen
                ? "bg-white/15"
                : "bg-slate-900/90 hover:bg-white/10",
            )}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              style={{
                transform: `rotateZ(${-bearing}deg)`,
                transition: "transform 200ms ease-out",
              }}
              aria-hidden="true"
            >
              <path d="M12 2 L16 12 H12 Z" className="fill-rose-500" />
              <path d="M12 2 L8 12 H12 Z" className="fill-rose-300" />
              <path d="M12 22 L16 12 H12 Z" className="fill-slate-500" />
              <path d="M12 22 L8 12 H12 Z" className="fill-slate-700" />
              <circle cx="12" cy="12" r="1.5" className="fill-white" />
            </svg>
          </button>

          {compassOpen && (
            <div
              ref={popoverRef}
              role="dialog"
              aria-label="Tilt and heading"
              className="absolute bottom-[calc(100%+8px)] right-0 w-72 rounded-2xl border border-white/10 bg-slate-950/95 p-4 text-slate-100 shadow-2xl backdrop-blur-xl"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold tracking-tight">
                  Tilt and heading
                </h3>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setCompassOpen(false)}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>

              <div className="space-y-3">
                <SliderRow
                  label="Tilt"
                  value={pitch}
                  min={0}
                  max={MAX_PITCH}
                  step={1}
                  unit="°"
                  onChange={handleTiltChange}
                />
                <SliderRow
                  label="Heading"
                  value={bearing}
                  min={0}
                  max={360}
                  step={1}
                  unit="°"
                  onChange={handleHeadingChange}
                />
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleResetBearing}
                  className="rounded-md px-2 py-1 text-xs font-semibold text-cyan-400 transition hover:bg-cyan-500/10 hover:text-cyan-300"
                >
                  Reset to north
                </button>
              </div>

              <span
                aria-hidden="true"
                className="absolute -bottom-1.5 right-4 h-3 w-3 rotate-45 border-b border-r border-white/10 bg-slate-950/95"
              />
            </div>
          )}
        </div>

        <span className="mx-0.5 h-4 w-px bg-white/10" aria-hidden="true" />

        <button
          type="button"
          aria-label={
            projection === "globe" ? "Switch to 2D" : "Switch to 3D Globe"
          }
          aria-pressed={projection === "globe"}
          title={projection === "globe" ? "Switch to 2D" : "Switch to 3D Globe"}
          onClick={() =>
            setProjection(projection === "mercator" ? "globe" : "mercator")
          }
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full transition",
            projection === "globe"
              ? "bg-cyan-600 text-white"
              : "bg-slate-900/90 text-slate-300 hover:bg-white/10",
          )}
        >
          {projection === "globe" ? (
            <Globe className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <MapIcon className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>

        <span className="mx-0.5 h-4 w-px bg-white/10" aria-hidden="true" />

        <div className="flex items-center rounded-full bg-slate-900/90">
          <button
            type="button"
            aria-label="Zoom out"
            title="Zoom out"
            onClick={handleZoomOut}
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/10"
          >
            <Minus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            title="Zoom in"
            onClick={handleZoomIn}
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/10"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  unit = "",
  onChange,
}: SliderRowProps) {
  return (
    <label className="flex items-center gap-3 text-xs">
      <span className="w-16 flex-shrink-0 font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        className={cn(
          "h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-cyan-500",
          "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:shadow",
          "[&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-cyan-400",
        )}
      />
      <span className="w-10 text-right font-mono text-[11px] tabular-nums text-slate-200">
        {Math.round(value)}
        {unit}
      </span>
    </label>
  );
}
