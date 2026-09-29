/**
 * Compact Dataset picker used inside the ActivityDock.
 *
 * Uses `createPortal` to render the popover directly into document.body
 * with `position: fixed` so it opens cleanly above the dock without being
 * clipped by any container overflow:hidden boundaries.
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { useCatalog } from "@/lib/api/client";
import type { DatasetMetadata } from "@/lib/api/types";
import { useInvestigationState } from "@/lib/state/investigation";
import { cn } from "@/lib/utils";
import { DataProvenance } from "@/components/dataset/DataProvenance";

const DATA_TYPE_LABEL: Record<string, string> = {
  reanalysis_model: "NASA Reanalysis",
  satellite_retrieval: "Satellite Retrieval",
  surface_observation_analysis: "In-Situ Analysis",
  satellite_gravimetry: "Gravimetry",
  satellite_radiometry: "Radiometry",
  derived_index: "Derived Index",
  open_source: "Open Source",
};

const DATA_TYPE_COLORS: Record<string, string> = {
  reanalysis_model: "text-emerald-500",
  satellite_retrieval: "text-purple-500",
  surface_observation_analysis: "text-blue-500",
  satellite_gravimetry: "text-[var(--accent)]",
  satellite_radiometry: "text-amber-500",
  derived_index: "text-teal-500",
  open_source: "text-[var(--text-secondary)]",
};

export interface DockDatasetPickerProps {
  /** Same handler as `MenuPanel.onSelectDataset` — keeps behaviour aligned. */
  onSelectDataset: (dataset: DatasetMetadata) => void;
  className?: string;
}

export function DockDatasetPicker({ onSelectDataset, className }: DockDatasetPickerProps) {
  const { data: datasets } = useCatalog();
  const { selectedDataset } = useInvestigationState();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [coords, setCoords] = useState<{ left: number; bottom: number; width: number } | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => datasets?.find((d) => d.dataset_id === selectedDataset) ?? null,
    [datasets, selectedDataset],
  );

  const filtered = useMemo(() => {
    if (!datasets) return [];
    const q = query.trim().toLowerCase();
    if (!q) return datasets;
    return datasets.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.dataset_id.toLowerCase().includes(q) ||
        (d.primary_variable ?? "").toLowerCase().includes(q) ||
        (d.provider ?? "").toLowerCase().includes(q),
    );
  }, [datasets, query]);

  // Track position when opening
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

  // Close on outside click
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
        aria-label="Select dataset"
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-xl border px-2.5 py-1.5 text-left transition",
          "border-[var(--border-default)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-2)]",
          open && "border-[var(--accent)]",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-semibold leading-tight text-[var(--text-primary)]">
              {selected?.title ?? "Select dataset"}
            </div>
            {selected ? (
              <div className="mt-0.5 flex items-center gap-1 leading-tight">
                <span
                  className={cn(
                    "text-[8.5px] font-bold uppercase tracking-wider",
                    DATA_TYPE_COLORS[selected.data_type] ?? "text-[var(--text-secondary)]",
                  )}
                >
                  {DATA_TYPE_LABEL[selected.data_type] ?? selected.data_type}
                </span>
                <span className="truncate font-mono text-[9.5px] text-[var(--text-muted)]">
                  {selected.dataset_id}
                </span>
              </div>
            ) : null}
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 flex-shrink-0 self-center text-[var(--text-muted)] transition",
            open && "rotate-180 text-[var(--accent)]",
          )}
          aria-hidden="true"
        />
      </button>

      {open && coords && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              role="dialog"
              aria-label="Dataset picker"
              style={{
                position: "fixed",
                left: `${coords.left}px`,
                bottom: `${coords.bottom}px`,
                width: `${coords.width}px`,
                zIndex: 99999,
              }}
              className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] animate-in fade-in slide-in-from-bottom-2 duration-150"
            >
              <div className="border-b border-[var(--border-default)] bg-[var(--bg-surface-2)] p-2">
                <div className="flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-1">
                  <Search className="h-3 w-3 text-[var(--text-muted)]" aria-hidden="true" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search datasets..."
                    autoFocus
                    className="w-full bg-transparent text-[11px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
                  />
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto py-1">
                {filtered.length === 0 ? (
                  <div className="px-3 py-4 text-center text-[10px] text-[var(--text-muted)]">
                    No datasets match
                  </div>
                ) : (
                  filtered.map((d) => {
                    const isSelected = d.dataset_id === selectedDataset;
                    return (
                      <button
                        key={d.dataset_id}
                        type="button"
                        onClick={() => {
                          onSelectDataset(d);
                          setOpen(false);
                          setQuery("");
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
                              ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--text-inverse)]"
                              : "border-[var(--border-strong)] text-transparent",
                          )}
                          aria-hidden="true"
                        >
                          {isSelected ? <Check className="h-2.5 w-2.5" /> : null}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[11px] font-medium text-[var(--text-primary)]">
                            {d.title}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1">
                            <span
                              className={cn(
                                "text-[8.5px] font-bold uppercase tracking-wider",
                                DATA_TYPE_COLORS[d.data_type] ?? "text-[var(--text-secondary)]",
                              )}
                            >
                              {DATA_TYPE_LABEL[d.data_type] ?? d.data_type}
                            </span>
                            <span className="truncate font-mono text-[9.5px] text-[var(--text-muted)]">
                              {d.dataset_id}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>,
            document.body,
          )
        : null}

      <DataProvenance dataset={selected} className="mt-2" />
    </div>
  );
}
