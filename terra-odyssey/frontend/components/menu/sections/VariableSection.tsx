/**
 * Variable selector — list every variable exposed by the chosen dataset
 * and append a "Custom variable…" option that opens an inline form.
 *
 * Backend has no custom-variable resolver yet (custom support lives only
 * client-side today), so we surface a user-provided label as a badge on the
 * panel without rewriting the underlying `selectedVariable` API call.
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Sigma, SlidersHorizontal, X } from "lucide-react";
import { useCatalog } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { CustomVariable } from "@/lib/state/investigation";

export interface VariableSectionProps {
  selectedDatasetId: string;
  selectedVariable: string;
  onSelectVariable: (variableName: string) => void;
  customVariable: CustomVariable | null;
  onCustomVariableChange: (cv: CustomVariable | null) => void;
}

export function VariableSection({
  selectedDatasetId,
  selectedVariable,
  onSelectVariable,
  customVariable,
  onCustomVariableChange,
}: VariableSectionProps) {
  const { data: datasets } = useCatalog();
  const [open, setOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const dataset = useMemo(
    () => datasets?.find((d) => d.dataset_id === selectedDatasetId) ?? null,
    [datasets, selectedDatasetId],
  );

  const variables = useMemo(() => {
    if (!dataset) return [];
    return Object.values(dataset.variables);
  }, [dataset]);

  const selected = variables.find((v) => v.variable_name === selectedVariable);

  // Close popovers on outside click.
  useEffect(() => {
    if (!open && !formOpen) return;
    const handler = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        // Keep form open if user opens it (it's an inline form below list).
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, formOpen]);

  return (
    <div ref={rootRef} className="space-y-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-xl border bg-slate-900/60 px-2.5 py-2 text-left transition",
          open
            ? "border-cyan-400/60 ring-1 ring-cyan-400/30"
            : "border-white/10 hover:border-white/25 hover:bg-slate-900/80",
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border border-purple-500/30 bg-purple-500/15 text-purple-300">
            <Sigma className="h-3 w-3" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-[11px] font-semibold text-slate-100">
              {customVariable ? (
                <span className="inline-flex items-center gap-1">
                  <SlidersHorizontal className="h-2.5 w-2.5 text-amber-300" aria-hidden="true" />
                  Custom: {customVariable.name}
                </span>
              ) : (
                <span>{selected?.long_name ?? "Select variable"}</span>
              )}
            </div>
            <div className="mt-0.5 truncate text-[10px] text-slate-500">
              {customVariable
                ? `Δ ${selectedVariable} · ${customVariable.units ?? "—"}`
                : `${selected?.variable_name ?? ""} · ${selected?.canonical_unit ?? ""}`}
            </div>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 flex-shrink-0 text-slate-400 transition",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className="rounded-xl border border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur-2xl">
          <div className="max-h-44 overflow-y-auto py-1">
            {variables.length === 0 ? (
              <div className="px-3 py-4 text-center text-[10px] text-slate-500">
                No variables for this dataset
              </div>
            ) : (
              variables.map((v) => {
                const isSelected = v.variable_name === selectedVariable && !customVariable;
                return (
                  <button
                    key={v.variable_name}
                    type="button"
                    onClick={() => {
                      onSelectVariable(v.variable_name);
                      onCustomVariableChange(null);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-start gap-2 px-2.5 py-1.5 text-left transition",
                      isSelected ? "bg-cyan-500/10" : "hover:bg-white/[0.04]",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full",
                        isSelected
                          ? "bg-cyan-500/30 text-cyan-200"
                          : "border border-white/15 bg-slate-900 text-transparent",
                      )}
                      aria-hidden="true"
                    >
                      {isSelected ? <Check className="h-2.5 w-2.5" /> : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1">
                        <span className="text-[11px] font-medium text-slate-100">
                          {v.long_name}
                        </span>
                        <span className="font-mono text-[9.5px] uppercase text-slate-500">
                          {v.variable_name}
                        </span>
                      </div>
                      <div className="truncate text-[10px] text-slate-500">
                        {v.canonical_unit} · {v.description}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <div className="border-t border-white/[0.07] p-1.5">
            <button
              type="button"
              onClick={() => setFormOpen((f) => !f)}
              aria-expanded={formOpen}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-medium transition",
                formOpen
                  ? "bg-amber-500/15 text-amber-200"
                  : "text-slate-300 hover:bg-white/[0.04]",
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                <SlidersHorizontal className="h-3 w-3" aria-hidden="true" />
                Custom variable…
              </span>
              <ChevronDown
                className={cn("h-3 w-3 transition", formOpen && "rotate-180")}
                aria-hidden="true"
              />
            </button>
            {formOpen ? (
              <CustomVariableForm
                initial={customVariable}
                onSubmit={(cv) => {
                  onCustomVariableChange(cv);
                  setOpen(false);
                  setFormOpen(false);
                }}
                onClear={() => {
                  onCustomVariableChange(null);
                  setFormOpen(false);
                }}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {customVariable && !open ? (
        <div className="flex items-center justify-between gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5">
          <span className="truncate text-[10px] text-amber-200">
            <SlidersHorizontal className="mr-1 inline h-2.5 w-2.5" aria-hidden="true" />
            Custom: {customVariable.name}
          </span>
          <button
            type="button"
            onClick={() => onCustomVariableChange(null)}
            aria-label="Clear custom variable"
            className="flex h-4 w-4 items-center justify-center rounded-full text-amber-200 hover:bg-amber-500/20"
          >
            <X className="h-2.5 w-2.5" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CustomVariableForm({
  initial,
  onSubmit,
  onClear,
}: {
  initial: CustomVariable | null;
  onSubmit: (cv: CustomVariable) => void;
  onClear: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [units, setUnits] = useState(initial?.units ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");

  return (
    <div className="mt-1 space-y-1.5 rounded-lg border border-white/[0.05] bg-slate-900/60 p-2">
      <label className="block">
        <span className="mb-0.5 block text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">
          Name
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Temperature anomaly"
          className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-1 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="mb-0.5 block text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">
          Units
        </span>
        <input
          type="text"
          value={units}
          onChange={(e) => setUnits(e.target.value)}
          placeholder="e.g. °C/decade"
          className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-1 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="mb-0.5 block text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">
          Formula (optional)
        </span>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. T2M - climatology"
          className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-1 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none"
        />
      </label>
      <div className="flex items-center justify-end gap-1.5 pt-0.5">
        <button
          type="button"
          onClick={onClear}
          className="rounded-md px-2 py-1 text-[10px] font-semibold text-slate-400 hover:bg-white/5 hover:text-slate-200"
        >
          Clear
        </button>
        <button
          type="button"
          disabled={!name.trim()}
          onClick={() =>
            onSubmit({
              name: name.trim(),
              units: units.trim() || undefined,
              description: description.trim() || undefined,
            })
          }
          className={cn(
            "rounded-md px-2 py-1 text-[10px] font-semibold transition",
            name.trim()
              ? "bg-amber-500/20 text-amber-200 hover:bg-amber-500/30"
              : "bg-slate-800 text-slate-500",
          )}
        >
          Apply
        </button>
      </div>
    </div>
  );
}
