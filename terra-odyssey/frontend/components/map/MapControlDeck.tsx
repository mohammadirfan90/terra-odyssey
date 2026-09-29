"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Compass,
  Eye,
  Globe,
  Layers,
  Locate,
  Map as MapIcon,
  Minus,
  Plus,
  Satellite,
  Sliders,
  X,
} from "lucide-react";
import * as maplibregl from "maplibre-gl";

import { useMap } from "@/components/ui/map";
import { cn } from "@/lib/utils";

type Projection = "mercator" | "globe";
export type DeckMapType = "default" | "satellite";
export type DeckDetailLevel = "clean" | "exploration" | "everything" | "custom";

/**
 * Per-category visibility toggles used by the "Custom" detail mode.
 * Each entry maps to a set of basemap layer-id prefixes; when a toggle
 * is off, every layer whose id starts with one of its prefixes is hidden.
 */
export interface DeckCustomOptions {
  borders: boolean;
  labels: boolean;
  roads: boolean;
  transit: boolean;
  water: boolean;
  landmarks: boolean;
}

export const DEFAULT_CUSTOM_OPTIONS: DeckCustomOptions = {
  borders: true,
  labels: true,
  roads: true,
  transit: false,
  water: true,
  landmarks: false,
};

export interface CustomToggleDescriptor {
  key: keyof DeckCustomOptions;
  label: string;
  description: string;
}

export const CUSTOM_TOGGLES: ReadonlyArray<CustomToggleDescriptor> = [
  { key: "borders",   label: "Borders",   description: "Country / region outlines." },
  { key: "labels",    label: "Labels",    description: "Place & area names." },
  { key: "roads",     label: "Roads",     description: "Streets, highways, paths." },
  { key: "transit",   label: "Transit",   description: "Railways & aeroways." },
  { key: "water",     label: "Water",     description: "Waterway labels & names." },
  { key: "landmarks", label: "Landmarks", description: "Glaciers, terrain names." },
];

const MAX_PITCH = 60;
const PITCH_EPSILON = 0.5;
const BEARING_EPSILON = 0.5;

const MAP_TYPE_OPTIONS = [
  { id: "default" as const, label: "Default", Icon: MapIcon },
  { id: "satellite" as const, label: "Satellite", Icon: Satellite },
];

const DETAIL_OPTIONS = [
  { id: "clean" as const, label: "Clean", Icon: Compass },
  { id: "exploration" as const, label: "Exploration", Icon: Eye },
  { id: "everything" as const, label: "Everything", Icon: Layers },
  { id: "custom" as const, label: "Custom", Icon: Sliders },
];

function clampPitch(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_PITCH, Math.max(0, value));
}

function normalizeBearing(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const mod = value % 360;
  return mod < 0 ? mod + 360 : mod;
}

export interface MapControlDeckProps {
  mapType: DeckMapType;
  detailLevel: DeckDetailLevel;
  onChangeMapType: (id: DeckMapType) => void;
  onChangeDetailLevel: (id: DeckDetailLevel) => void;
  customOptions: DeckCustomOptions;
  onChangeCustomOptions: (next: DeckCustomOptions) => void;
  bottomOffset?: number;
}

/**
 * Unified, fully-rounded map controls deck. Combines locate, heading,
 * projection, zoom and map-style/detail-level options into a single
 * floating control in the bottom-right of the map.
 *
 * NASA GIBS satellite overlay is intentionally not exposed here —
 * only the basemap is rendered.
 */
export function MapControlDeck({
  bottomOffset = 12,
  mapType,
  detailLevel,
  onChangeMapType,
  onChangeDetailLevel,
  customOptions,
  onChangeCustomOptions,
}: MapControlDeckProps) {
  const { map } = useMap();
  const [bearing, setBearing] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [projection, setProjection] = useState<Projection>("mercator");
  const [compassOpen, setCompassOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [locating, setLocating] = useState(false);

  const mapRef = useRef<maplibregl.Map | null>(null);
  useEffect(() => {
    mapRef.current = map;
  }, [map]);

  // Sync bearing/pitch with the live map.
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

  // Drive basemap projection.
  useEffect(() => {
    const instance = mapRef.current;
    if (!instance) return;

    const apply = () => {
      try {
        instance.setProjection({ type: projection });
      } catch {
        /* style may still be swapping; ignore */
      }
    };

    if (instance.isStyleLoaded()) apply();
    instance.once("style.load", apply);
    return () => {
      instance.off("style.load", apply);
    };
  }, [projection]);

  const popoverRef = useRef<HTMLDivElement | null>(null);
  const compassTriggerRef = useRef<HTMLButtonElement>(null);
  const layersTriggerRef = useRef<HTMLButtonElement>(null);

  // Close popovers on outside click / Escape.
  useEffect(() => {
    if (!compassOpen && !layersOpen) return;

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (compassTriggerRef.current?.contains(target)) return;
      if (layersTriggerRef.current?.contains(target)) return;
      setCompassOpen(false);
      setLayersOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCompassOpen(false);
        setLayersOpen(false);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [compassOpen, layersOpen]);

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
    <div
      className="pointer-events-none absolute right-3 z-30 flex flex-col items-end gap-2 transition-[bottom] duration-300"
      style={{ bottom: `${bottomOffset}px` }}
    >
      {/* ── Layer manager popover (above the pill) ───────────────── */}
      {layersOpen && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Layer manager"
          className="pointer-events-auto w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white/98 text-slate-900 shadow-xl backdrop-blur-2xl"
        >
          <div className="space-y-2 p-2.5">
            <SegmentedRow
              label="NASA Basemap"
              options={MAP_TYPE_OPTIONS}
              value={mapType}
              onChange={(id) => onChangeMapType(id as DeckMapType)}
            />
            <SegmentedRow
              label="Detail"
              options={DETAIL_OPTIONS}
              value={detailLevel}
              onChange={(id) => onChangeDetailLevel(id as DeckDetailLevel)}
            />
            {detailLevel === "custom" && (
              <CustomToggles
                options={customOptions}
                onChange={onChangeCustomOptions}
              />
            )}
            <div className="border-t border-slate-200 pt-2">
              <div className="mb-1 px-1 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Compare
              </div>
              <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                {(["Date", "Region", "Dataset"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    title={`Compare by ${mode.toLowerCase()} — full split-pane swipe UI coming soon`}
                    className="flex-1 rounded-lg px-1.5 py-1 text-[10px] font-semibold text-slate-500 transition hover:bg-white hover:text-slate-800"
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <p className="mt-1 px-1 text-[9px] leading-tight text-slate-500">
                Compare mode scaffolding · full UI in a follow-up.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Compass popover (above the pill) ───────────────────── */}
      {compassOpen && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Tilt and heading"
          className="pointer-events-auto w-60 rounded-3xl border border-slate-200 bg-white/98 p-3 text-slate-900 shadow-xl backdrop-blur-xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
              Tilt & heading
            </h3>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setCompassOpen(false)}
              className="flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-800"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>

          <div className="space-y-2">
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

          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={handleResetBearing}
              className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-cyan-700 transition hover:bg-cyan-50 hover:text-cyan-900"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* ── Single fully-rounded pill control ──────────────────── */}
      <div className="pointer-events-auto inline-flex items-center gap-0.5 rounded-full border border-slate-200 bg-white/95 px-1.5 py-1 shadow-md backdrop-blur-md">
        <button
          type="button"
          aria-label="Locate me"
          title="Locate me"
          disabled={locating}
          onClick={handleLocate}
          className="flex h-7 w-7 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
        >
          <Locate
            className={cn("h-3.5 w-3.5", locating && "animate-spin")}
            aria-hidden="true"
          />
        </button>

        <span className="mx-0.5 h-4 w-px bg-slate-200" aria-hidden="true" />

        <button
          ref={compassTriggerRef}
          type="button"
          aria-label={`Reset north — heading ${Math.round(bearing)}°`}
          aria-expanded={compassOpen}
          title="Reset north"
          onClick={() => {
            setCompassOpen((open) => !open);
            setLayersOpen(false);
          }}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full transition shadow-sm",
            compassOpen
              ? "bg-slate-200"
              : "bg-slate-100 hover:bg-slate-200",
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
            <path d="M12 22 L16 12 H12 Z" className="fill-slate-400" />
            <path d="M12 22 L8 12 H12 Z" className="fill-slate-600" />
            <circle cx="12" cy="12" r="1.5" className="fill-white" />
          </svg>
        </button>

        <span className="mx-0.5 h-4 w-px bg-slate-200" aria-hidden="true" />

        <button
          type="button"
          aria-label={
            projection === "globe" ? "Switch to 2D projection" : "Switch to 3D globe projection"
          }
          aria-pressed={projection === "globe"}
          title={projection === "globe" ? "Switch to 2D projection" : "Switch to 3D globe projection"}
          onClick={() =>
            setProjection(projection === "mercator" ? "globe" : "mercator")
          }
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full transition shadow-sm",
            projection === "globe"
              ? "bg-cyan-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200",
          )}
        >
          {projection === "globe" ? (
            <Globe className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <MapIcon className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>

        <span className="mx-0.5 h-4 w-px bg-slate-200" aria-hidden="true" />

        <div className="flex items-center rounded-full bg-slate-100 text-slate-700 shadow-sm">
          <button
            type="button"
            aria-label="Zoom out"
            title="Zoom out"
            onClick={handleZoomOut}
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-200"
          >
            <Minus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            title="Zoom in"
            onClick={handleZoomIn}
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-200"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <span className="mx-0.5 h-4 w-px bg-slate-200" aria-hidden="true" />

        <button
          ref={layersTriggerRef}
          type="button"
          aria-label="Layer manager"
          aria-expanded={layersOpen}
          title="Layer manager"
          onClick={() => {
            setLayersOpen((open) => !open);
            setCompassOpen(false);
          }}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full transition shadow-sm",
            layersOpen
              ? "bg-slate-200 text-slate-900"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200",
          )}
        >
          <Layers className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

interface SegmentedOption<T extends string> {
  id: T;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}

function SegmentedRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div>
      <h4 className="mb-1 px-1 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </h4>
      <div
        role="radiogroup"
        aria-label={label}
        className="grid grid-cols-2 gap-0.5 rounded-xl border border-slate-200 bg-slate-100 p-0.5"
      >
        {options.map((option) => {
          const selected = value === option.id;
          const Icon = option.Icon;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.id)}
              className={cn(
                "flex items-center justify-center gap-1 rounded-lg px-1.5 py-1 text-[10.5px] font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500",
                selected
                  ? "bg-white text-cyan-800 shadow-sm"
                  : "text-slate-600 hover:bg-white/60 hover:text-slate-900",
              )}
            >
              <Icon className="h-2.5 w-2.5" aria-hidden="true" />
              <span>{option.label}</span>
            </button>
          );
        })}
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
    <label className="flex items-center gap-2 text-[11px]">
      <span className="w-14 flex-shrink-0 font-semibold uppercase tracking-wide text-slate-500">
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
          "h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-cyan-600",
          "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-600 [&::-webkit-slider-thumb]:shadow-sm",
          "[&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-cyan-600",
        )}
      />
      <span className="w-8 text-right font-mono text-[11px] tabular-nums text-slate-700">
        {Math.round(value)}
        {unit}
      </span>
    </label>
  );
}

interface CustomTogglesProps {
  options: DeckCustomOptions;
  onChange: (next: DeckCustomOptions) => void;
}

/**
 * Per-category visibility checkboxes rendered when the user picks
 * "Custom" detail mode. Toggling a category live-applies to the basemap.
 */
function CustomToggles({ options, onChange }: CustomTogglesProps) {
  const handleToggle = (key: keyof DeckCustomOptions) => {
    onChange({ ...options, [key]: !options[key] });
  };

  return (
    <div>
      <h4 className="mb-1 px-1 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">
        Custom layers
      </h4>
      <div className="space-y-0.5 rounded-xl border border-slate-200 bg-slate-50 p-1">
        {CUSTOM_TOGGLES.map((descriptor) => {
          const checked = options[descriptor.key];
          return (
            <label
              key={descriptor.key}
              title={descriptor.description}
              className="group flex cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-slate-100"
            >
              <span
                className={cn(
                  "flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded border transition-all duration-150",
                  checked
                    ? "border-cyan-600 bg-cyan-600 text-white"
                    : "border-slate-300 bg-white text-transparent",
                )}
                aria-hidden="true"
              >
                {checked ? (
                  <svg viewBox="0 0 12 12" className="h-2 w-2" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M2 6.5 L4.8 9 L10 3.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </span>
              <span className="flex-1 min-w-0 truncate text-[11px] font-medium leading-tight text-slate-700">
                {descriptor.label}
              </span>
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                onChange={() => handleToggle(descriptor.key)}
                aria-label={`Toggle ${descriptor.label}`}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}
