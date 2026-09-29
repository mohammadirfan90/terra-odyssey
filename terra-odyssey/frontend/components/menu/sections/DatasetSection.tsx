/**
 * Dataset selector — searchable combobox over the merged catalog
 * (NASA + partner agencies + open-source datasets).
 *
 * The dropdown is rendered into `document.body` via a React portal so it
 * can escape the parent `MenuPanel`'s `overflow-hidden` clip and overlap
 * the rest of the workspace cleanly. We track the trigger's geometry with
 * `getBoundingClientRect()` and reposition on scroll/resize while open.
 */

"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, Check } from "lucide-react";
import { useCatalog } from "@/lib/api/client";
import type { DatasetMetadata } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const DATA_TYPE_LABEL: Record<string, string> = {
  reanalysis_model: "NASA Reanalysis",
  satellite_retrieval: "Satellite Retrieval",
  surface_observation_analysis: "In-Situ Analysis",
  satellite_gravimetry: "Gravimetry",
  satellite_radiometry: "Radiometry",
  derived_index: "Derived Index",
  open_source: "Open Data",
};

const DATA_TYPE_COLORS: Record<string, string> = {
  reanalysis_model: "text-emerald-500",
  satellite_retrieval: "text-purple-500",
  surface_observation_analysis: "text-blue-500",
  satellite_gravimetry: "text-cyan-500",
  satellite_radiometry: "text-amber-500",
  derived_index: "text-teal-500",
  open_source: "text-slate-500",
};

export interface DatasetSectionProps {
  selectedDatasetId: string;
  onSelect: (dataset: DatasetMetadata) => void;
}

interface PopoverGeometry {
  top: number;
  left: number;
  width: number;
}

export function DatasetSection({ selectedDatasetId, onSelect }: DatasetSectionProps) {
  const { data: datasets } = useCatalog();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [geometry, setGeometry] = useState<PopoverGeometry | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => datasets?.find((d) => d.dataset_id === selectedDatasetId) ?? null,
    [datasets, selectedDatasetId],
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

  // Portal mounts after hydration to avoid SSR mismatch.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Measure trigger + viewport so the popover can overlay the panel chrome.
  const measureTrigger = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setGeometry({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    measureTrigger();
  }, [open, measureTrigger]);

  // Close on outside click (covers both trigger + portal content).
  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleKey);
    window.addEventListener("resize", measureTrigger);
    window.addEventListener("scroll", measureTrigger, true);
    return () => {
      window.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("resize", measureTrigger);
      window.removeEventListener("scroll", measureTrigger, true);
    };
  }, [open, measureTrigger]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-left transition",
          "border-[var(--border-default)] bg-[var(--bg-surface-2)] hover:bg-[var(--bg-elevated)]",
          open && "border-[var(--accent)]",
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0">
            <div className="truncate text-[11px] font-semibold text-[var(--text-primary)]">
              {selected?.title ?? "Select dataset"}
            </div>
            <div className="mt-0.5 flex items-center gap-1">
              {selected?.data_type ? (
                <span
                  className={cn(
                    "text-[8.5px] font-bold uppercase tracking-wider",
                    DATA_TYPE_COLORS[selected.data_type] ??
                      "text-[var(--text-muted)]",
                  )}
                >
                  {DATA_TYPE_LABEL[selected.data_type] ?? selected.data_type}
                </span>
              ) : null}
              {selected ? (
                <span className="truncate text-[10px] text-[var(--text-muted)] font-mono">
                  {selected.dataset_id}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 flex-shrink-0 text-[var(--text-muted)] transition",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {mounted && open && geometry
        ? createPortal(
            <div
              ref={popoverRef}
              role="listbox"
              aria-label="Datasets"
              style={{
                position: "fixed",
                top: geometry.top,
                left: geometry.left,
                width: geometry.width,
              }}
              className="z-[60] max-h-72 overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)]"
            >
              <div className="border-b border-[var(--border-default)] p-2">
                <div className="flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-2)] px-2 py-1">
                  <Search
                    className="h-3 w-3 text-[var(--text-muted)]"
                    aria-hidden="true"
                  />
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
                    const isSelected = d.dataset_id === selectedDatasetId;
                    return (
                      <button
                        key={d.dataset_id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          onSelect(d);
                          setOpen(false);
                          setQuery("");
                        }}
                        className={cn(
                          "flex w-full items-start gap-2 px-2.5 py-1.5 text-left transition",
                          isSelected
                            ? "bg-[var(--bg-surface-2)]"
                            : "hover:bg-[var(--bg-surface-2)]",
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
                          {isSelected ? (
                            <Check className="h-2.5 w-2.5" />
                          ) : null}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[11px] font-semibold text-[var(--text-primary)]">
                            {d.title}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <span
                              className={cn(
                                "text-[8.5px] font-bold uppercase tracking-wider",
                                DATA_TYPE_COLORS[d.data_type] ??
                                  "text-[var(--text-muted)]",
                              )}
                            >
                              {DATA_TYPE_LABEL[d.data_type] ?? d.data_type}
                            </span>
                            <span className="truncate text-[10px] text-[var(--text-muted)] font-mono">
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
    </div>
  );
}
