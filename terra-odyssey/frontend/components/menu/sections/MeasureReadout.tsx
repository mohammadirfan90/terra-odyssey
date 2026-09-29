/**
 * Live measurement readout. Shown when the user draws a measure shape.
 * Receives the latest `DrawShape` from the Map component and renders the
 * distance / area / radius computed by `lib/map/draw-shapes.ts`.
 */

"use client";

import { Ruler, Square } from "lucide-react";
import { formatArea, formatDistance, type DrawShape, type MeasureResult, measureShape } from "@/lib/map/draw-shapes";

export interface MeasureReadoutProps {
  /** The most recently drawn measure shape, or null. */
  shape: DrawShape | null;
  /** Mode that produced the shape (for the header label). */
  mode: "measure-line" | "measure-polygon" | "measure-circle" | null;
}

const MODE_LABEL: Record<NonNullable<MeasureReadoutProps["mode"]>, string> = {
  "measure-line": "Line",
  "measure-polygon": "Polygon",
  "measure-circle": "Circle",
};

export function MeasureReadout({ shape, mode }: MeasureReadoutProps) {
  if (!shape || !mode) {
    return (
      <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] text-slate-500">
        <Ruler className="h-3 w-3 text-slate-400" aria-hidden="true" />
        Pick a measure tool above, then draw on the map.
      </div>
    );
  }

  const m: MeasureResult = measureShape(shape);

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2 shadow-sm">
      <div className="mb-1 flex items-center gap-1.5">
        <Square className="h-3 w-3 text-amber-600" aria-hidden="true" />
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-800">
          Measure · {MODE_LABEL[mode]}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-1 text-[10.5px]">
        {m.lengthM !== undefined ? (
          <Stat label="Length" value={formatDistance(m.lengthM)} />
        ) : null}
        {m.areaSqM !== undefined ? (
          <Stat label="Area" value={formatArea(m.areaSqM)} />
        ) : null}
        {m.widthM !== undefined ? (
          <Stat label="Width" value={formatDistance(m.widthM)} />
        ) : null}
        {m.heightM !== undefined ? (
          <Stat label="Height" value={formatDistance(m.heightM)} />
        ) : null}
        {m.radiusM !== undefined ? (
          <Stat label="Radius" value={formatDistance(m.radiusM)} />
        ) : null}
      </dl>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-amber-200/60 bg-white/80 px-2 py-1 shadow-xs">
      <dt className="text-[8.5px] font-bold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </dt>
      <dd className="font-mono text-[11px] font-semibold tabular-nums text-amber-900">
        {value}
      </dd>
    </div>
  );
}
