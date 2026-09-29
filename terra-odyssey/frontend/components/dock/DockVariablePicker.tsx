/**
 * Compact Variable picker used inside the ActivityDock.
 *
 * Uses `createPortal` to render the popover directly into document.body
 * with `position: fixed` so it opens cleanly above the dock without being
 * clipped by any container overflow:hidden boundaries.
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X } from "lucide-react";
import { useCatalog } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import {
  type CustomVariable,
  useInvestigationState,
} from "@/lib/state/investigation";

export interface DockVariablePickerProps {
  className?: string;
}

export function DockVariablePicker({ className }: DockVariablePickerProps) {
  const { data: datasets } = useCatalog();
  const {
    selectedDataset,
    selectedVariable,
    setSelectedVariable,
    customVariable,
    setCustomVariable,
  } = useInvestigationState();
  const [open, setOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [coords, setCoords] = useState<{ left: number; bottom: number; width: number } | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const dataset = useMemo(
    () => datasets?.find((d) => d.dataset_id === selectedDataset) ?? null,
    [datasets, selectedDataset],
  );

  const variables = useMemo(() => {
    if (!dataset || !dataset.variables) return [];
    if (Array.isArray(dataset.variables)) return dataset.variables;
    return Object.values(dataset.variables);
  }, [dataset]);

  const selected = variables.find((v) => v.variable_name === selectedVariable);

  useEffect(() => {
    if (!open || !rootRef.current) return;
    const updatePosition = () => {
      if (!rootRef.current) return;
      const rect = rootRef.current.getBoundingClientRect();
      const popWidth = Math.max(340, rect.width);
      const safeLeft = Math.max(12, Math.min(window.innerWidth - popWidth - 12, rect.left));
      setCoords({
        left: safeLeft,
        bottom: window.innerHeight - rect.top + 6,
        width: popWidth,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Select variable"
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-xl border px-2.5 py-1.5 text-left transition",
          "border-[var(--border-default)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-2)]",
          open && "border-purple-500",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-semibold leading-tight text-[var(--text-primary)]">
              {customVariable ? (
                <span className="text-purple-500">
                  Custom: {customVariable.name}
                </span>
              ) : (
                <span>{selected?.long_name ?? "Select variable"}</span>
              )}
            </div>
            {(customVariable || (selected?.variable_name && selected?.canonical_unit)) && (
              <div className="mt-0.5 truncate text-[10px] leading-tight text-[var(--text-muted)]">
                {customVariable
                  ? `Δ ${selectedVariable} · ${customVariable.units ?? "—"}`
                  : `${selected?.variable_name} · ${selected?.canonical_unit}`}
              </div>
            )}
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 flex-shrink-0 self-center text-[var(--text-muted)] transition",
            open && "rotate-180 text-purple-500",
          )}
          aria-hidden="true"
        />
      </button>

      {open && coords && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              role="dialog"
              aria-label="Variable picker"
              style={{
                position: "fixed",
                left: `${coords.left}px`,
                bottom: `${coords.bottom}px`,
                width: `${coords.width}px`,
                zIndex: 99999,
              }}
              className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] animate-in fade-in slide-in-from-bottom-2 duration-150"
            >
              <div className="max-h-52 overflow-y-auto py-1">
                {variables.length === 0 ? (
                  <div className="px-3 py-4 text-center text-[10px] text-[var(--text-muted)]">
                    No variables available for this dataset
                  </div>
                ) : (
                  variables.map((v) => {
                    const isSelected =
                      v.variable_name === selectedVariable && !customVariable;
                    return (
                      <button
                        key={v.variable_name}
                        type="button"
                        onClick={() => {
                          setSelectedVariable(v.variable_name);
                          setCustomVariable(null);
                          setOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-start gap-2 px-2.5 py-1.5 text-left transition",
                          isSelected
                            ? "bg-[var(--bg-surface-2)] text-[var(--text-primary)] font-semibold"
                            : "hover:bg-[var(--bg-surface-2)] text-[var(--text-primary)]",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border",
                            isSelected
                              ? "border-purple-500 bg-purple-500 text-[var(--text-inverse)]"
                              : "border-[var(--border-strong)] text-transparent",
                          )}
                          aria-hidden="true"
                        >
                          {isSelected ? <Check className="h-2.5 w-2.5" /> : null}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-1">
                            <span className="text-[11px] font-medium text-[var(--text-primary)]">
                              {v.long_name}
                            </span>
                            <span className="font-mono text-[9.5px] uppercase font-bold text-purple-500">
                              {v.variable_name}
                            </span>
                          </div>
                          <div className="mt-0.5 truncate text-[10px] text-[var(--text-muted)]">
                            {v.canonical_unit} {v.description ? `· ${v.description}` : ""}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
              <div className="border-t border-[var(--border-default)] bg-[var(--bg-surface-2)] p-1.5">
                <button
                  type="button"
                  onClick={() => setFormOpen((f) => !f)}
                  aria-expanded={formOpen}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-medium transition",
                    formOpen
                      ? "bg-amber-500/15 text-amber-500 font-semibold"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]",
                  )}
                >
                  <span className="inline-flex items-center">
                    Custom variable…
                  </span>
                  <ChevronDown
                    className={cn("h-3 w-3 transition text-[var(--text-muted)]", formOpen && "rotate-180")}
                    aria-hidden="true"
                  />
                </button>
                {formOpen ? (
                  <DockCustomVariableForm
                    initial={customVariable}
                    onSubmit={(cv) => {
                      setCustomVariable(cv);
                      setOpen(false);
                      setFormOpen(false);
                    }}
                    onClear={() => {
                      setCustomVariable(null);
                      setOpen(false);
                      setFormOpen(false);
                    }}
                  />
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}

      {customVariable && !open ? (
        <div className="absolute right-0 -top-1 translate-y-[-100%] flex items-center gap-1.5 rounded-md border border-purple-500/50 bg-purple-500/10 px-1.5 py-0.5">
          <span className="truncate text-[10px] font-medium text-purple-500">
            Custom
          </span>
          <button
            type="button"
            onClick={() => setCustomVariable(null)}
            aria-label="Clear custom variable"
            className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-purple-500 hover:bg-purple-500/20"
          >
            <X className="h-2.5 w-2.5" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function DockCustomVariableForm({
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
    <div className="mt-1 space-y-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-2)] p-2">
      <label className="block">
        <span className="mb-0.5 block text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
          Name
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Temperature anomaly"
          className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-purple-500 focus:bg-[var(--bg-surface)] focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="mb-0.5 block text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
          Units
        </span>
        <input
          type="text"
          value={units}
          onChange={(e) => setUnits(e.target.value)}
          placeholder="e.g. °C/decade"
          className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-purple-500 focus:bg-[var(--bg-surface)] focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="mb-0.5 block text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
          Formula (optional)
        </span>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. T2M - climatology"
          className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-purple-500 focus:bg-[var(--bg-surface)] focus:outline-none"
        />
      </label>
      <div className="flex items-center justify-end gap-1.5 pt-0.5">
        <button
          type="button"
          onClick={onClear}
          className="rounded-md px-2 py-1 text-[10px] font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
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
            "rounded-md px-2.5 py-1 text-[10px] font-semibold transition",
            name.trim()
              ? "bg-purple-500 text-[var(--text-inverse)] hover:bg-purple-400"
              : "bg-[var(--bg-surface)] text-[var(--text-muted)] cursor-not-allowed",
          )}
        >
          Apply
        </button>
      </div>
    </div>
  );
}
