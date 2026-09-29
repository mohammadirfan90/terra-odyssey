/**
 * ActivityDock — NASA Mission Control Dock above the footer ribbon.
 *
 * Composed of two wide, high-precision instrument surfaces:
 *   • Left / Center : Full-width animated time-series chart with interactive
 *                     scrubber, radar loading telemetry, and hover crosshair.
 *   • Right         : Mission controls (Dataset picker, Variable picker, Area
 *                     drawing tools with live Stop action, and 1-click climate benchmarks).
 *
 * Trend Evidence is hosted in the dedicated Right-Side Floating Card (`FloatingEvidenceCard`),
 * and can be toggled via the dock's header action.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Globe,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type ActivityAccent,
  type ActivityEntry,
  type ActivityKind,
  markUndone,
  pushActivity,
  useActivityLog,
} from "@/lib/state/activity-log";
import { useInvestigationState } from "@/lib/state/investigation";
import { useCatalog } from "@/lib/api/client";
import { DockVariablePicker } from "./DockVariablePicker";
import { DockDatasetPicker } from "./DockDatasetPicker";
import { AgencyLogo } from "@/components/icons/AgencyLogos";
import { DockTimeSeriesChart } from "./DockTimeSeriesChart";
import type { DatasetMetadata, EvidencePayload, TimeSeriesPayload } from "@/lib/api/types";

export interface ActivityDockProps {
  onSelectDataset: (dataset: DatasetMetadata) => void;
  series: TimeSeriesPayload | null | undefined;
  seriesLoading?: boolean;
  seriesError?: boolean;
  evidence?: EvidencePayload | null | undefined;
  jobStatus?: "idle" | "submitted" | "running" | "succeeded" | "failed" | "cancel_requested" | "cancelled";
  stage?: string;
  progress?: number;
  errorMessage?: string;
  onRetry?: () => void;
  onRunDefault?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  evidenceCardOpen?: boolean;
  onToggleEvidenceCard?: () => void;
  className?: string;
}

export function ActivityDock({
  onSelectDataset,
  series,
  seriesLoading = false,
  seriesError = false,
  evidence,
  jobStatus = "idle",
  stage,
  errorMessage,
  onRetry,
  onRunDefault,
  collapsed = false,
  onToggleCollapse,
  evidenceCardOpen = true,
  onToggleEvidenceCard,
  className,
}: ActivityDockProps) {
  const snapshot = useInvestigationState();
  const { data: datasets } = useCatalog();
  const log = useActivityLog();
  const prevSnapshotRef = useRef<typeof snapshot | null>(null);

  const activeDataset = useMemo(
    () => datasets?.find((d) => d.dataset_id === snapshot.selectedDataset),
    [datasets, snapshot.selectedDataset],
  );

  const activeVariable = useMemo(() => {
    if (!activeDataset) return null;
    return activeDataset.variables?.[snapshot.selectedVariable] ?? null;
  }, [activeDataset, snapshot.selectedVariable]);

  // ── Activity capture for user actions ──────────────────────────────────
  useEffect(() => {
    const prev = prevSnapshotRef.current;
    prevSnapshotRef.current = snapshot;

    if (!prev) return;

    const datasetTitle = (id: string) =>
      datasets?.find((d) => d.dataset_id === id)?.title ?? id;

    if (prev.selectedDataset !== snapshot.selectedDataset) {
      pushActivity({
        kind: "dataset",
        label: `Dataset → ${datasetTitle(snapshot.selectedDataset)}`,
        prevLabel: `Dataset → ${datasetTitle(prev.selectedDataset)}`,
        accent: "cyan",
        undo: () => snapshot.setSelectedDataset(prev.selectedDataset),
      });
    }

    if (
      prev.selectedVariable !== snapshot.selectedVariable &&
      !snapshot.customVariable
    ) {
      pushActivity({
        kind: "variable",
        label: `Variable → ${snapshot.selectedVariable}`,
        prevLabel: `Variable → ${prev.selectedVariable}`,
        accent: "purple",
        undo: () => {
          snapshot.setSelectedVariable(prev.selectedVariable);
          snapshot.setCustomVariable(null);
        },
      });
    }

    if (prev.customVariable !== snapshot.customVariable) {
      const label = snapshot.customVariable
        ? `Custom var → "${snapshot.customVariable.name}"`
        : `Custom var → none`;
      const prevLabel = prev.customVariable
        ? `Custom var → "${prev.customVariable.name}"`
        : `Custom var → none`;
      pushActivity({
        kind: "custom",
        label,
        prevLabel,
        accent: "amber",
        undo: () => snapshot.setCustomVariable(prev.customVariable),
      });
    }

    if (
      prev.regionA.bbox.join(",") !== snapshot.regionA.bbox.join(",") ||
      prev.regionA.name !== snapshot.regionA.name
    ) {
      pushActivity({
        kind: "region",
        label: `Region → ${snapshot.regionA.name}`,
        prevLabel: `Region → ${prev.regionA.name}`,
        accent: "emerald",
        undo: () => snapshot.setRegionA(prev.regionA),
      });
    }

    if (prev.drawMode !== snapshot.drawMode && snapshot.drawMode === "idle") {
      pushActivity({
        kind: "clear",
        label: "Drawing completed/reset",
        prevLabel: `Was drawing · ${prev.drawMode.replace("draw-", "")}`,
        accent: "rose",
        undo: () => snapshot.setDrawMode(prev.drawMode),
      });
    }
  }, [snapshot, datasets]);

  const handleClearShapes = () => {
    window.dispatchEvent(new CustomEvent("terra-odyssey:clear-shapes"));
  };

  const isComputing = jobStatus === "submitted" || jobStatus === "running";

  // Primary slope summary for collapsed bar & badge
  const primaryResult = evidence?.results?.[0];
  const slopeVal = primaryResult?.effect?.estimate;
  const slopeUnit = primaryResult?.effect?.unit_per_decade ?? "degC/dec";
  const contrastSummary = evidence?.contrast ?? null;
  const [dockHeight, setDockHeight] = useState<number>(270);
  const [isResizing, setIsResizing] = useState(false);

  // Stable callbacks — must NOT be inline arrows in JSX or useEffect deps will fire every render
  const handlePeriodChange = useCallback(
    (p: { start_year: number; end_year: number }) => snapshot.setPeriod(p),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const handleYearChange = useCallback(
    (yr: number) => snapshot.setMapDate(`${yr}-07-01`),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsResizing(true);
    const startY = e.clientY;
    const startHeight = dockHeight;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaY = startY - moveEvent.clientY; // dragging up increases dock height
      const nextHeight = Math.max(180, Math.min(600, startHeight + deltaY));
      setDockHeight(nextHeight);
    };

    const handlePointerUp = () => {
      setIsResizing(false);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  // ── Collapsed Ribbon View ─────────────────────────────────────────────
  if (collapsed) {
    return (
      <section
        aria-label="Activity dock minimized"
        className={cn(
          "app-dock flex h-11 w-full min-w-0 items-center justify-between px-3 py-1",
          "text-[var(--text-primary)]",
          className,
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          {/* Active Dataset & Variable */}
          <div className="flex min-w-0 items-center gap-1.5 text-[10.5px]">
            <AgencyLogo agency={activeDataset?.provider || "NASA"} size={16} />
            <span className="truncate font-semibold text-[var(--text-primary)]">
              {activeDataset?.title ?? snapshot.selectedDataset}
            </span>
            <span className="text-[var(--text-muted)]">·</span>
            <span className="truncate text-[var(--text-secondary)]">
              {activeVariable?.long_name ?? snapshot.selectedVariable}
            </span>
          </div>

          <span className="hidden h-3 w-px bg-[var(--border-default)] sm:inline" />

          {/* Stat summary */}
          {contrastSummary ? (
            <div className="hidden items-center gap-1.5 font-mono text-[10px] sm:flex text-[var(--text-primary)]">
              <span className="font-sans font-bold text-[8.5px] uppercase tracking-wider text-purple-500">Contrast Δβ:</span>
              <span className="font-bold">
                {contrastSummary.contrast_slope > 0 ? "+" : ""}{contrastSummary.contrast_slope.toFixed(2)} {contrastSummary.units}
              </span>
              <span className="px-1 py-0.2 text-[8px] font-bold text-purple-500 uppercase">
                {contrastSummary.contrast_status === "opposite_trend_pair" ? "Opposite Pair" : "Paired"}
              </span>
            </div>
          ) : slopeVal != null ? (
            <div className="hidden items-center gap-1 font-mono text-[10px] sm:flex">
              <span className="text-[var(--text-muted)]">Trend:</span>
              <span
                className={cn(
                  "font-bold",
                  slopeVal > 0 ? "text-rose-500" : "text-[var(--accent)]",
                )}
              >
                {slopeVal > 0 ? "+" : ""}
                {slopeVal.toFixed(3)} {slopeUnit}
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {onToggleEvidenceCard && (
            <button
              type="button"
              onClick={onToggleEvidenceCard}
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded transition",
                evidenceCardOpen
                  ? "text-emerald-500 hover:bg-emerald-500/10"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)]",
              )}
              title="Toggle right-side floating evidence card"
              aria-label="Toggle evidence card"
            >
              {evidenceCardOpen ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          )}

          {/* Expand Action */}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex h-5 w-5 items-center justify-center rounded text-[var(--accent)] transition hover:bg-[var(--bg-surface-2)]"
            aria-label="Expand mission dock"
            title="Expand mission dock"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
        </div>
      </section>
    );
  }

  // ── Expanded 2-Column Wide Mission Dock ───────────────────────────────
  return (
    <section
      aria-label="Activity dock"
      style={{ height: dockHeight }}
      className={cn(
        "app-dock flex w-full min-w-0 flex-col overflow-hidden text-[var(--text-primary)] transition-[height] duration-75 ease-out select-none",
        isResizing && "transition-none",
        className,
      )}
    >
      {/* ── Vertical Height Resizer Handle ─────────────────────────────── */}
      <div
        onPointerDown={handleResizeStart}
        title="Drag up or down to resize dock height"
        className="group relative flex h-2 w-full cursor-ns-resize items-center justify-center bg-[var(--bg-surface-2)] hover:bg-[var(--accent-soft)] transition-colors border-b border-[var(--border-default)] select-none"
      >
        <div className="h-1 w-12 rounded-full bg-[var(--border-strong)] group-hover:bg-[var(--accent)] transition-colors" />
      </div>

      {/* Top Header Strip with Controls */}
      <div className="flex h-6 flex-shrink-0 items-center justify-between border-b border-[var(--border-default)] bg-[var(--bg-surface-2)] px-3">
        <div className="flex items-center gap-2">
          <AgencyLogo agency={activeDataset?.provider || "NASA"} size={16} />
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
            Terra Odyssey Mission Telemetry
          </span>
          <span className="text-[var(--text-muted)]">·</span>
          <span className="font-mono text-[8.5px] uppercase text-[var(--text-secondary)]">
            {isComputing
              ? `Processing: ${stage ?? "Analyzing"}`
              : series?.data?.length
                ? `${series.data.length} Records Loaded`
                : "Awaiting Query"}
          </span>
          {contrastSummary && (
            <>
              <span className="text-[var(--text-muted)]">·</span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 font-mono text-[8.5px] font-bold text-purple-500">
                <span>Contrast Δβ: {contrastSummary.contrast_slope > 0 ? "+" : ""}{contrastSummary.contrast_slope.toFixed(2)} {contrastSummary.units}</span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* Main 2-Column Wide Grid */}
      <div className="grid h-[calc(100%-32px)] min-h-0 grid-cols-[minmax(0,1fr)_310px] items-stretch divide-x divide-[var(--border-default)]">
        {/* ── Left Column: Wide Animated Time-Series & Scrubber ───────── */}
        <div className="flex min-h-0 min-w-0 flex-col">
          <DockTimeSeriesChart
            series={series ?? null}
            isLoading={seriesLoading}
            isError={seriesError}
            isComputing={isComputing}
            stage={stage}
            errorMessage={errorMessage}
            onRetry={onRetry}
            onRunDefault={onRunDefault}
            unsupportedReason={
              activeDataset?.capabilities?.trend_supported === false
                ? (activeDataset?.capabilities?.unsupported_reason || "Quantitative trend analysis is not available for this product.")
                : (activeDataset?.capabilities?.unsupported_reason ?? null)
            }
            unit={activeVariable?.canonical_unit ?? "°C"}
            variableTitle={activeVariable?.long_name ?? activeDataset?.primary_variable}
            variableKey={snapshot.selectedVariable}
            regionAName={snapshot.regionA.name}
            regionBName={snapshot.regionB?.name ?? "Region B"}
            startYear={snapshot.period.start_year}
            endYear={snapshot.period.end_year}
            onPeriodChange={handlePeriodChange}
            onYearChange={handleYearChange}
            className="h-full min-h-0 flex-1"
          />
        </div>

        {/* ── Right Column: Mission Controls ───────── */}
        <div className="flex min-h-0 min-w-0 flex-col bg-[var(--bg-surface-2)]">
          {/* Header */}
          <div className="flex flex-shrink-0 flex-col border-b border-[var(--border-default)]">
            {/* Title row */}
            <div className="flex h-8 items-center justify-between gap-2 px-3">
              <div className="flex min-w-0 items-center">
                <span className="typo-micro truncate font-bold uppercase tracking-[0.16em] text-[var(--text-primary)]">
                  Mission Controls
                </span>
              </div>
              {onToggleCollapse && (
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  className="flex h-5 flex-shrink-0 items-center rounded-md px-1.5 typo-micro font-semibold uppercase tracking-wider text-[var(--text-muted)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                  title="Minimize dock to HUD bar"
                >
                  Minimize
                </button>
              )}
            </div>

            {/* Region / clear toolbar row */}
            <div className="flex items-center gap-3 border-t border-[var(--border-default)] px-3 py-1.5">
              <button
                type="button"
                onClick={() => {
                  snapshot.setRegionA({ bbox: [-180.0, -85.0, 180.0, 85.0], name: "Entire Earth (Global)" });
                  snapshot.setRegionB(null);
                }}
                className="flex h-6 min-w-0 flex-1 items-center justify-center rounded-md typo-micro font-bold uppercase tracking-wider text-[var(--accent)] transition hover:bg-[var(--accent-soft)]"
                title="Select Entire Earth (Global Grid)"
              >
                <span className="truncate">Entire Earth</span>
              </button>
              <span className="h-3 w-px bg-[var(--border-default)]" aria-hidden="true" />
              <button
                type="button"
                onClick={handleClearShapes}
                className="flex h-6 min-w-0 flex-1 items-center justify-center rounded-md typo-micro font-bold uppercase tracking-wider text-rose-500 transition hover:bg-rose-500/10"
                aria-label="Clear drawn shapes and reset"
                title="Clear analysis: removes drawn regions, resets to Entire Earth, and re-runs the investigation"
              >
                <span className="truncate">Clear analysis</span>
              </button>
            </div>
          </div>

          {/* Form Selectors: Dataset & Variable */}
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
            {/* Dataset */}
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="typo-eyebrow text-[var(--text-secondary)]">
                  Dataset
                </span>
                <span
                  className={cn(
                    "typo-micro max-w-[60%] truncate font-bold uppercase tracking-wider",
                    activeDataset?.data_type === "reanalysis_model"
                      ? "text-emerald-500"
                      : "text-[var(--accent)]",
                  )}
                  title={`Data type: ${activeDataset?.data_type ?? "unknown"}`}
                >
                  <span className="truncate">
                    {activeDataset?.data_type === "reanalysis_model"
                      ? "Reanalysis"
                      : activeDataset?.data_type === "satellite_retrieval"
                        ? "Satellite"
                        : activeDataset?.data_type === "surface_observation_analysis"
                          ? "In-Situ"
                          : activeDataset?.data_type === "satellite_gravimetry"
                            ? "Gravimetry"
                            : activeDataset?.data_type === "satellite_radiometry"
                              ? "Radiometry"
                              : activeDataset?.data_type === "derived_index"
                                ? "Derived"
                                : "Open Data"}
                  </span>
                </span>
              </div>
              <DockDatasetPicker onSelectDataset={onSelectDataset} />
            </div>

            {/* Variable */}
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="typo-eyebrow text-[var(--text-secondary)]">
                  Variable
                </span>
                {activeVariable?.canonical_unit ? (
                  <span
                    className="truncate typo-micro font-bold uppercase tracking-wider text-purple-500"
                    title={`Canonical unit: ${activeVariable.canonical_unit}`}
                  >
                    {activeVariable.canonical_unit}
                  </span>
                ) : null}
              </div>
              <DockVariablePicker />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}