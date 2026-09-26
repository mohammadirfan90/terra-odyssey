"use client";

import React, { useState } from "react";
import { Layers, X } from "lucide-react";

export const MAP_TYPE_OPTIONS = [
  { id: "default", label: "Default" },
  { id: "satellite", label: "Satellite" },
] as const;

export const DETAIL_OPTIONS = [
  {
    id: "clean",
    label: "Clean",
    description: "No borders, labels, places, or roads.",
  },
  {
    id: "exploration",
    label: "Exploration",
    description: "Borders, labels, places, and roads.",
  },
  {
    id: "everything",
    label: "Everything",
    description:
      "All borders, labels, places, roads, transit, landmarks and water.",
  },
  {
    id: "custom",
    label: "Custom",
    description: "Choose your own look and feel.",
  },
] as const;

export type DetailLevel = (typeof DETAIL_OPTIONS)[number]["id"];
export type MapType = (typeof MAP_TYPE_OPTIONS)[number]["id"];

interface LayerControlsProps {
  mapType: MapType;
  detailLevel: DetailLevel;
  onChangeMapType: (id: MapType) => void;
  onChangeDetailLevel: (id: DetailLevel) => void;
}

export function LayerControls({
  mapType,
  detailLevel,
  onChangeMapType,
  onChangeDetailLevel,
}: LayerControlsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute bottom-6 left-4 z-30">
      {!open && (
        <button
          type="button"
          aria-label="Open map layers"
          aria-expanded={false}
          onClick={() => setOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-slate-950/85 text-slate-300 shadow-lg backdrop-blur-md transition hover:bg-white/10"
          title="Map layers"
        >
          <Layers className="h-4 w-4" aria-hidden="true" />
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Map details"
          className="w-[320px] max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white text-slate-900 shadow-2xl"
        >
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
            <h3 className="text-sm font-semibold tracking-tight">Details</h3>
            <button
              type="button"
              aria-label="Close layers"
              onClick={() => setOpen(false)}
              className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </header>

          <div className="space-y-5 px-4 py-4">
            <DetailSection
              detailLevel={detailLevel}
              onChangeDetailLevel={onChangeDetailLevel}
            />

            <Section title="Map type">
              <div className="grid grid-cols-2 gap-2">
                {MAP_TYPE_OPTIONS.map((option) => (
                  <MapTypeTile
                    key={option.id}
                    label={option.label}
                    active={mapType === option.id}
                    onClick={() => onChangeMapType(option.id)}
                  />
                ))}
              </div>
            </Section>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailSection({
  detailLevel,
  onChangeDetailLevel,
}: {
  detailLevel: DetailLevel;
  onChangeDetailLevel: (id: DetailLevel) => void;
}) {
  return (
    <section>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Details
      </h4>
      <div role="radiogroup" aria-label="Map detail level" className="divide-y divide-slate-100">
        {DETAIL_OPTIONS.map((option) => {
          const selected = detailLevel === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChangeDetailLevel(option.id)}
              className="flex w-full items-start gap-3 rounded-md px-2 py-2 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                  selected
                    ? "border-cyan-500 bg-cyan-500"
                    : "border-slate-300 bg-white"
                }`}
              >
                {selected && (
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                )}
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold text-slate-900">
                  {option.label}
                </span>
                <span className="block text-xs text-slate-500">
                  {option.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h4>
      {children}
    </section>
  );
}

function MapTypeTile({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-lg p-2 text-xs font-medium transition ${
        active
          ? "ring-2 ring-cyan-500"
          : "ring-1 ring-transparent hover:bg-slate-50"
      }`}
    >
      <span
        className={`flex h-12 w-12 items-center justify-center overflow-hidden rounded-md ${
          active ? "" : "border border-slate-200 bg-slate-50"
        }`}
      >
        <span
          aria-hidden="true"
          className="block h-12 w-12 rounded-md border border-slate-200 bg-slate-100"
        />
      </span>
      <span className="text-slate-700">{label}</span>
    </button>
  );
}
