/**
 * Right-side floating panel — the Terra Odyssey configuration hub.
 *
 * Surface contents (after the redesign):
 *   1. Header   — title + collapse + close
 *   2. Body     — Dataset picker (with `DataProvenance` disclosure below it)
 *   3. Footer   — `ThemeSwitcher` (Light / Dark / System) + version chip
 *
 * Variable selection, area-tool drawing, and live measurements all live in
 * the full-width `ActivityDock` at the bottom of the workspace; both this
 * panel and the dock read/write the same `useInvestigationState()` store so
 * either surface can drive the other.
 *
 * All chrome colors are driven by the CSS variables in `app/globals.css`
 * (see the `:root[data-theme="…"]` blocks), so this panel follows the
 * global theme toggle automatically — no per-component theme logic.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Database, X } from "lucide-react";
import { DatasetSection } from "./sections/DatasetSection";
import { DataProvenance } from "@/components/dataset/DataProvenance";
import { ThemeSwitcher } from "@/components/system/ThemeSwitcher";
import {
  type DrawMode,
  useInvestigationState,
} from "@/lib/state/investigation";
import type { DatasetMetadata } from "@/lib/api/types";
import { useCatalog } from "@/lib/api/client";
import { cn } from "@/lib/utils";

export interface MenuPanelProps {
  open: boolean;
  onClose: () => void;
  /** Called whenever the user picks a different dataset. */
  onSelectDataset: (d: DatasetMetadata) => void;
  /** Called when the user finishes drawing a plot shape. */
  onPlotComplete: (bbox: [number, number, number, number]) => void;
}

const PANEL_VERSION = "v0.1.0";

export function MenuPanel({
  open,
  onClose,
  onSelectDataset,
  onPlotComplete,
}: MenuPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  const { selectedDataset, setSelectedDataset } = useInvestigationState();
  const { data: datasets } = useCatalog();

  // Active dataset metadata — drives the DataProvenance disclosure.
  const activeDataset = useMemo(
    () => datasets?.find((d) => d.dataset_id === selectedDataset) ?? null,
    [datasets, selectedDataset],
  );

  // Forward "plot-bbox" events from the AreaSection when the user finishes
  // drawing a study region, so the parent can re-run the analysis.
  useEffect(() => {
    if (!open) return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{
        mode: DrawMode;
        bbox?: [number, number, number, number];
      }>).detail;
      if (!detail) return;
      const isPlot =
        detail.mode === "draw-rectangle-a" ||
        detail.mode === "draw-polygon-a" ||
        detail.mode === "draw-circle-a";
      if (isPlot && detail.bbox) onPlotComplete(detail.bbox);
    };
    window.addEventListener("terra-odyssey:plot-bbox", handler as EventListener);
    return () => {
      window.removeEventListener(
        "terra-odyssey:plot-bbox",
        handler as EventListener,
      );
    };
  }, [open, onPlotComplete]);

  // ESC closes the panel.
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <aside
      role="dialog"
      aria-label="Terra Odyssey menu"
      aria-modal="false"
      className={cn(
        "pointer-events-auto absolute right-[22px] top-[74px] z-50 flex w-[384px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-3xl border backdrop-blur-2xl transition-all",
        "border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)]",
        collapsed ? "h-auto" : "max-h-[calc(100vh-100px)]",
      )}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <header
        className={cn(
          "flex items-center justify-between gap-2 border-b px-4 py-2.5",
          "border-[var(--border-default)] bg-[var(--bg-surface-2)]",
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--accent-fg)]"
            aria-hidden="true"
          >
            <Database className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-primary)]">
              Terra Odyssey
            </h2>
            <p className="mt-0.5 truncate text-[9.5px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
              NASA Earth Science
            </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand menu" : "Collapse menu"}
            aria-expanded={!collapsed}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
          >
            {collapsed ? (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────── */}
      {!collapsed ? (
        <div className="flex-1 space-y-3 overflow-y-auto p-3">
          {/* Dataset picker — primary control surface */}
          <section>
            <SectionHeader label="Dataset" />
            <DatasetSection
              selectedDatasetId={selectedDataset}
              onSelect={(d) => {
                setSelectedDataset(d.dataset_id);
                onSelectDataset(d);
              }}
            />
          </section>

          {/* Data provenance disclosure — pinned under the picker.
              The component renders its own collapsible header, so we don't
              need an outer wrapper that would duplicate the label. */}
          <section>
            <DataProvenance dataset={activeDataset} />
          </section>
        </div>
      ) : null}

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer
        className={cn(
          "flex items-center justify-between gap-2 border-t px-3 py-2",
          "border-[var(--border-default)] bg-[var(--bg-surface-2)]",
        )}
      >
        <ThemeSwitcher size="sm" />
        <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
          {PANEL_VERSION}
        </span>
      </footer>
    </aside>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="mb-1.5 flex items-center justify-between">
      <span className="typo-eyebrow text-[var(--text-secondary)]">{label}</span>
    </div>
  );
}