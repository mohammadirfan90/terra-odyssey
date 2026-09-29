/**
 * FloatingEvidenceCard — Right-Side Floating Scientific Evidence Console.
 *
 * Layout: a single vertical scroll surface divided into clearly separated
 * zones that match the credibility hierarchy:
 *
 *   1. OBSERVED MEASUREMENT  — primary metric (slope estimate + unit),
 *      CI sparkline, dataset · variable · region · period · year subtitle,
 *      and an Evidence status pill (Supported / Inconclusive / Insufficient).
 *
 *   2. STATISTICAL ANALYSIS   — CI, p-value, sample size, weighting method,
 *      FDR policy, paired regional contrast (when active), diagnostics
 *      disclosure, and methodology & caveats.
 *
 *   3. CONCLUSION             — deterministic, model-free one-paragraph
 *      summary of the estimand (slope, CI, p-value) with a plain-text
 *      interpretation rule.
 *
 * Secondary disclosures (collapsed by default): per-year table with CSV
 * export, session activity log.
 */

"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  Maximize2,
  Minimize2,
  RotateCcw,
  X,
} from "lucide-react";
import type { EvidencePayload, ScientificResultItem, TimeSeriesPayload } from "@/lib/api/types";
import {
  type ActivityEntry,
  type ActivityKind,
} from "@/lib/state/activity-log";
import { cn } from "@/lib/utils";
import { useInvestigationState } from "@/lib/state/investigation";
import { StatusPill } from "@/components/system/StatusPill";
import { EmptyState } from "@/components/system/EmptyState";

export interface FloatingEvidenceCardProps {
  evidence: EvidencePayload | null | undefined;
  series?: TimeSeriesPayload | null | undefined;
  isLoading?: boolean;
  isComputing?: boolean;
  counts: Record<ActivityKind, number>;
  log: readonly ActivityEntry[];
  onUndo: (entry: ActivityEntry) => void;
  datasetTitle?: string;
  variableName?: string;
  open?: boolean;
  onClose?: () => void;
  className?: string;
}

export function FloatingEvidenceCard({
  evidence,
  series,
  isLoading = false,
  isComputing = false,
  counts,
  log,
  onUndo,
  datasetTitle = "MERRA-2 Reanalysis",
  variableName = "Surface Air Temperature",
  open = true,
  onClose,
  className,
}: FloatingEvidenceCardProps) {
  const [minimized, setMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [cardWidth, setCardWidth] = useState(340);
  const [cardHeight, setCardHeight] = useState(440);
  const [isResizing, setIsResizing] = useState(false);
  const [showPerYearTable, setShowPerYearTable] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);

  // Year cursor + region/period from the shared store — chart or external
  // pickers can pin a year to keep map + chart + evidence panel aligned.
  const { selectedYear, period: invPeriod, regionA: invRegionA } = useInvestigationState();

  // Resize handler for bottom-left corner
  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = cardWidth;
    const startH = cardHeight;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = startX - moveEvent.clientX;
      const deltaY = moveEvent.clientY - startY;
      setCardWidth(Math.max(300, Math.min(720, startW + deltaX)));
      setCardHeight(Math.max(320, Math.min(720, startH + deltaY)));
    };

    const handlePointerUp = () => {
      setIsResizing(false);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const primaryResult: ScientificResultItem | null =
    evidence?.results && evidence.results.length > 0 ? evidence.results[0] : null;

  const slope = primaryResult?.effect?.estimate ?? null;

  // Process annual records for breakdown table
  const seriesData = series?.data;
  const annualRecords = useMemo(() => {
    if (!seriesData || seriesData.length === 0) return [];
    const sorted = [...seriesData].sort((a, b) => a.year - b.year);
    const vals = sorted
      .map((d) => d.region_a_value)
      .filter((v) => v != null && !Number.isNaN(v));
    const meanVal = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;

    const startYr = sorted[0]?.year ?? 0;
    const slopePerYr = slope != null ? slope / 10 : 0;
    const intercept = meanVal - slopePerYr * (startYr + (sorted.length - 1) / 2);

    return sorted.map((r) => {
      const val = r.region_a_value;
      const fitted = intercept + slopePerYr * r.year;
      const anomaly = val != null ? val - meanVal : 0;
      return {
        year: r.year,
        value: val,
        fitted,
        anomaly,
        coverage: r.coverage_fraction_a ?? 1.0,
      };
    });
  }, [seriesData, slope]);

  if (!open) return null;

  const resultStatus =
    evidence?.result_status ?? (primaryResult as any)?.status ?? null;
  const isSupported = resultStatus === "supported";
  const isInconclusive = resultStatus === "inconclusive";

  const unitPerDecade = primaryResult?.effect?.unit_per_decade ?? "per decade";
  const unit = unitPerDecade.replace(/\/decade|per decade/i, "").trim() || "°C";
  const fittedChange = primaryResult?.effect?.fitted_change ?? null;

  const unc = (primaryResult as any)?.uncertainty;
  const method = (primaryResult as any)?.method;
  const diag = method?.diagnostics;

  const pValue: number | null =
    unc?.p_value ?? method?.decision_p_value ?? method?.p_value ?? null;

  const ci95: [number, number] | null =
    unc?.ci_95 ??
    (unc?.lower != null && unc?.upper != null ? [unc.lower, unc.upper] : null);

  const se: number | null = unc?.se ?? diag?.slope_se_per_decade ?? null;
  const tStat: number | null = diag?.t_statistic ?? null;
  const df: number | null = diag?.degrees_of_freedom ?? null;
  const theilSen = diag?.theil_sen ?? null;
  const caveats = primaryResult?.caveats ?? [];
  const contrast = evidence?.contrast ?? null;
  const summaryStats = evidence?.summary_stats ?? null;

  const isWarming = slope != null && slope > 0;
  const isCooling = slope != null && slope < 0;

  // Export CSV
  const handleExportCSV = () => {
    if (annualRecords.length === 0) return;
    const header = `Year,Observed_${variableName.replace(/\s+/g, "_")},Fitted_Trend,Anomaly_From_Mean,Coverage_Fraction\n`;
    const rows = annualRecords
      .map(
        (r) =>
          `${r.year},${r.value?.toFixed(3)},${r.fitted.toFixed(3)},${r.anomaly.toFixed(3)},${r.coverage}`,
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `terra_odyssey_${variableName.toLowerCase().replace(/\s+/g, "_")}_time_series.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Minimized floating pill
  if (minimized) {
    return (
      <div
        role="region"
        aria-label="Trend evidence summary"
        className={cn(
          "pointer-events-auto absolute right-5 top-[76px] z-40 flex items-center gap-2.5 rounded-full border border-[var(--border-strong)] bg-[var(--bg-surface-2)]/95 px-3.5 py-1.5 shadow-lg backdrop-blur-xl transition-all text-[var(--text-primary)] animate-in fade-in slide-in-from-right-3",
          className,
        )}
      >
        <div className="flex items-center gap-1.5 font-mono text-[10.5px]">
          <span className="font-semibold text-[var(--text-secondary)]">Trend:</span>
          <span
            className={cn(
              "font-bold",
              isWarming
                ? "text-rose-600"
                : isCooling
                ? "text-cyan-700"
                : "text-[var(--text-primary)]",
            )}
          >
            {slope != null ? `${slope > 0 ? "+" : ""}${slope.toFixed(3)}` : "—"}{" "}
            {unitPerDecade}
          </span>
          {isSupported && (
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[8.5px] font-bold uppercase text-emerald-800">
              Significant
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="ml-1 flex h-5 w-5 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--bg-surface-2)] hover:text-[var(--text-primary)]"
          title="Expand evidence panel"
          aria-label="Expand evidence panel"
        >
          <ChevronDown className="h-3 w-3" />
        </button>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-5 w-5 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--bg-surface-2)] hover:text-rose-600"
            title="Close evidence panel"
            aria-label="Close evidence panel"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }

  // Expanded card
  return (
    <div
      role="region"
      aria-label="Scientific evidence card"
      style={
        isMaximized
          ? {
              width: "min(720px, calc(100vw - 32px))",
              height: "calc(100vh - var(--dock-h,280px) - 96px)",
            }
          : {
              width: `min(${cardWidth}px, calc(100vw - 32px))`,
              height: `min(${cardHeight}px, calc(100vh - var(--dock-h,280px) - 96px))`,
            }
      }
      className={cn(
        "pointer-events-auto absolute right-3 top-[76px] z-40 flex flex-col overflow-hidden rounded-2xl border border-[var(--border-strong)]/80 bg-[var(--bg-surface-2)]/98 text-[var(--text-primary)] shadow-[0_20px_50px_rgba(15,23,42,0.18)] backdrop-blur-2xl transition-[width,height] duration-75 select-none animate-in fade-in slide-in-from-right-4",
        isResizing && "transition-none",
        className,
      )}
    >
      {/* Resizer grip */}
      <div
        onPointerDown={handleResizeStart}
        title="Drag corner to resize evidence panel"
        className="absolute bottom-0 left-0 z-50 flex h-4 w-4 cursor-sw-resize items-end justify-start p-0.5 text-[var(--text-muted)] hover:text-cyan-600"
      >
        <svg viewBox="0 0 6 6" className="h-2.5 w-2.5 fill-current">
          <circle cx="1" cy="5" r="0.75" />
          <circle cx="3" cy="5" r="0.75" />
          <circle cx="5" cy="5" r="0.75" />
          <circle cx="1" cy="3" r="0.75" />
          <circle cx="3" cy="3" r="0.75" />
          <circle cx="1" cy="1" r="0.75" />
        </svg>
      </div>

      {/* Header */}
      <div className="flex h-9 flex-shrink-0 items-center justify-between border-b border-[var(--border-default)] bg-[var(--bg-surface-2)] px-2.5">
        <div className="flex items-center gap-2">
          <div>
            <div className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-[var(--text-primary)] leading-none">
              Scientific Evidence
            </div>
            <div className="text-[7.5px] font-mono text-[var(--text-muted)] leading-none mt-0.5">
              Observed · Statistical
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsMaximized((m) => !m)}
            className="flex h-5 w-5 items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--bg-surface-2)] text-[var(--text-secondary)] shadow-2xs hover:bg-[var(--bg-surface-2)] hover:text-[var(--text-primary)]"
            title={isMaximized ? "Restore standard size" : "Maximize card"}
          >
            {isMaximized ? <Minimize2 className="h-2.5 w-2.5" /> : <Maximize2 className="h-2.5 w-2.5" />}
          </button>

          <button
            type="button"
            onClick={() => setMinimized(true)}
            className="flex h-5 w-5 items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--bg-surface-2)] text-[var(--text-secondary)] shadow-2xs hover:bg-[var(--bg-surface-2)] hover:text-[var(--text-primary)]"
            title="Minimize to floating pill"
            aria-label="Minimize evidence panel"
          >
            <ChevronUp className="h-3 w-3" />
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-5 w-5 items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--bg-surface-2)] text-[var(--text-secondary)] shadow-2xs hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
              title="Close evidence panel"
              aria-label="Close evidence panel"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Three-zone scroll surface */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2.5 space-y-2 select-text">
        {isComputing || isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 px-4 text-center">
            <Loader2 className="h-4 w-4 animate-spin text-cyan-600 shrink-0" />
            <span className="text-xs font-medium text-slate-600">Calculating trend...</span>
          </div>
        ) : primaryResult ? (
          <>
            {/* ZONE 1 — OBSERVED MEASUREMENT (primary metric at top) */}
            <section
              aria-labelledby="evidence-zone-observed"
              className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface-2)] p-2.5 shadow-2xs"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span id="evidence-zone-observed" className="typo-eyebrow text-[var(--text-muted)]">
                  Observed Measurement
                </span>
                <StatusPill
                  kind={isSupported ? "ready" : isInconclusive ? "partial" : "info"}
                  label={
                    isSupported
                      ? "Verified"
                      : isInconclusive
                      ? "Inconclusive"
                      : "Insufficient"
                  }
                />
              </div>

              {/* Primary metric — direction-neutral wording so non-temperature
                  variables don't show a misleading "Warming rate" label. */}
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-1.5">
                  <span
                    className={cn(
                      "font-mono text-[24px] font-bold leading-none tabular-nums",
                      slope == null
                        ? "text-[var(--text-muted)]"
                        : slope > 0
                        ? "text-rose-600"
                        : slope < 0
                        ? "text-cyan-700"
                        : "text-[var(--text-primary)]",
                    )}
                  >
                    {slope != null
                      ? `${slope > 0 ? "+" : ""}${slope.toFixed(3)}`
                      : "—"}
                  </span>
                  <span className="font-mono text-[10px] font-semibold text-[var(--text-secondary)]">
                    {unitPerDecade}
                  </span>
                </div>
                {slope != null && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 typo-micro font-bold",
                      slope > 0 ? "text-rose-600" : "text-cyan-700",
                    )}
                  >
                    {slope > 0 ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    {slope > 0 ? "positive" : slope < 0 ? "negative" : "flat"}
                  </span>
                )}
              </div>

              {/* CI sparkline */}
              {ci95 && slope != null && (
                <div className="mt-1.5 flex items-center gap-2">
                  <svg
                    viewBox="0 0 100 28"
                    width="100"
                    height="28"
                    className="overflow-visible flex-shrink-0"
                    aria-hidden="true"
                  >
                    <line x1="0" x2="100" y1="14" y2="14" stroke="#cbd5e1" strokeWidth="0.8" />
                    {(() => {
                      const pad = 0.5;
                      const min = Math.min(ci95[0], ci95[1], slope) - pad;
                      const max = Math.max(ci95[0], ci95[1], slope) + pad;
                      const x = (v: number) => 6 + ((v - min) / (max - min)) * (100 - 12);
                      const y = 14;
                      return (
                        <g>
                          <line
                            x1={x(ci95[0])}
                            x2={x(ci95[1])}
                            y1={y}
                            y2={y}
                            stroke="#0891b2"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                          <line
                            x1={x(ci95[0])}
                            x2={x(ci95[0])}
                            y1={y - 3}
                            y2={y + 3}
                            stroke="#0891b2"
                            strokeWidth="1.5"
                          />
                          <line
                            x1={x(ci95[1])}
                            x2={x(ci95[1])}
                            y1={y - 3}
                            y2={y + 3}
                            stroke="#0891b2"
                            strokeWidth="1.5"
                          />
                          <circle
                            cx={x(slope)}
                            cy={y}
                            r="2.5"
                            fill={slope > 0 ? "#e11d48" : "#0e7490"}
                          />
                        </g>
                      );
                    })()}
                  </svg>
                  <span className="font-mono text-[9.5px] text-[var(--text-secondary)] tabular-nums">
                    [{ci95[0] > 0 ? "+" : ""}
                    {ci95[0].toFixed(3)}, {ci95[1] > 0 ? "+" : ""}
                    {ci95[1].toFixed(3)}]
                  </span>
                </div>
              )}

              {/* Subtitle row */}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 typo-micro text-[var(--text-secondary)]">
                <span className="font-semibold text-[var(--text-primary)] truncate max-w-[150px]">{datasetTitle}</span>
                <span aria-hidden="true">·</span>
                <span className="truncate max-w-[130px]">{variableName}</span>
                <span aria-hidden="true">·</span>
                {invRegionA?.name ? (
                  <span
                    className="inline-flex max-w-[180px] items-center rounded border border-cyan-300 bg-cyan-50/90 px-1.5 py-0.5 font-semibold text-cyan-900 shadow-2xs"
                    title={`Analysis bounded specifically to: ${invRegionA.name}`}
                  >
                    <span className="truncate">{invRegionA.name}</span>
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center rounded border border-slate-200 bg-slate-100/90 px-1.5 py-0.5 font-medium text-slate-700 shadow-2xs"
                    title="Analysis covering the entire global Earth domain"
                  >
                    <span className="truncate">Entire Earth (Global)</span>
                  </span>
                )}
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {invPeriod.start_year}–{invPeriod.end_year}
                </span>
                {selectedYear != null ? (
                  <span className="ml-auto rounded border border-cyan-300 bg-cyan-50 px-1 py-0.5 font-bold text-cyan-900 text-[8px]">
                    Year: {selectedYear}
                  </span>
                ) : null}
              </div>
            </section>

            {/* ZONE 2 — STATISTICAL ANALYSIS */}
            <section
              aria-labelledby="evidence-zone-statistical"
              className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface-2)] p-2.5 shadow-2xs"
            >
              <span
                id="evidence-zone-statistical"
                className="typo-eyebrow text-[var(--text-muted)] block mb-1.5"
              >
                Statistical Analysis
              </span>

              <div className="grid grid-cols-2 gap-1.5">
                <MetricTile
                  eyebrow="95% CI"
                  value={
                    ci95
                      ? `[${ci95[0] > 0 ? "+" : ""}${ci95[0].toFixed(3)}, ${ci95[1] > 0 ? "+" : ""}${ci95[1].toFixed(3)}]`
                      : "—"
                  }
                  subline="HAC serial robust"
                />
                <MetricTile
                  eyebrow="Significance (p)"
                  value={
                    pValue != null
                      ? pValue < 0.0001
                        ? "p < 1e-4"
                        : `p = ${pValue.toFixed(4)}`
                      : "—"
                  }
                  subline="FDR α = 0.05"
                />
                <MetricTile
                  eyebrow="Cumulative Δ"
                  value={
                    fittedChange != null
                      ? `${fittedChange > 0 ? "+" : ""}${fittedChange.toFixed(3)} ${unit}`
                      : "—"
                  }
                  subline="End-to-end fit"
                />
                <MetricTile
                  eyebrow="Sample"
                  value={`${annualRecords.length || "—"} yrs`}
                  subline="Area-weighted · WGS-84"
                />
              </div>

              {/* Paired contrast (sibling of statistical, never above observed) */}
              {contrast && (
                <div className="mt-2 rounded-lg border border-purple-200 bg-purple-50/60 p-2">
                  <div className="flex items-center justify-between">
                    <span className="typo-eyebrow text-purple-800">
                      Paired Contrast · H₀: β_A − β_B = 0
                    </span>
                    <span className="rounded-full border border-purple-300 bg-[var(--bg-surface-2)] px-1.5 py-0.2 typo-micro text-purple-800 font-bold uppercase">
                      {contrast.contrast_status === "opposite_trend_pair"
                        ? "Opposite Pair"
                        : "Paired"}
                    </span>
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-2 typo-meta font-mono">
                    <div>
                      <div className="typo-eyebrow text-purple-700">Δβ</div>
                      <div className="font-bold text-purple-900">
                        {contrast.contrast_slope > 0 ? "+" : ""}
                        {contrast.contrast_slope.toFixed(3)} {contrast.units}
                      </div>
                    </div>
                    <div>
                      <div className="typo-eyebrow text-purple-700">p-value</div>
                      <div className="font-bold text-purple-900">
                        {contrast.contrast_p_value < 0.001
                          ? "< 0.001"
                          : contrast.contrast_p_value.toFixed(4)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Diagnostics disclosure — summary inline, full details
                  collapsed by default to keep Zone 2 dense. */}
              <details className="group mt-2">
                <summary className="cursor-pointer list-none inline-flex items-center gap-1 typo-micro font-bold text-cyan-800 transition hover:text-cyan-900 select-none">
                  <ChevronDown className="h-3 w-3 transition group-open:rotate-180" />
                  Show statistical diagnostics
                </summary>
                <div className="mt-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-2)] p-2 space-y-1.5">
                  <div>
                    <div className="typo-eyebrow text-[var(--text-secondary)] mb-0.5">
                      Observed Extremes
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 typo-meta font-mono">
                      <div className="rounded border border-rose-200 bg-rose-50/70 p-1.5">
                        <div className="typo-eyebrow text-rose-700">Max</div>
                        <div className="font-bold text-rose-900">
                          {summaryStats
                            ? `${summaryStats.max_year} (${summaryStats.max_value.toFixed(2)})`
                            : "—"}
                        </div>
                      </div>
                      <div className="rounded border border-cyan-200 bg-cyan-50/70 p-1.5">
                        <div className="typo-eyebrow text-cyan-700">Min</div>
                        <div className="font-bold text-cyan-900">
                          {summaryStats
                            ? `${summaryStats.min_year} (${summaryStats.min_value.toFixed(2)})`
                            : "—"}
                        </div>
                      </div>
                    </div>
                    {summaryStats && (
                      <div className="mt-1 grid grid-cols-2 gap-1.5 typo-micro font-mono text-[var(--text-secondary)]">
                        <div>
                          Mean:{" "}
                          <strong className="text-[var(--text-primary)]">
                            {summaryStats.mean_value.toFixed(2)} {unit}
                          </strong>
                        </div>
                        <div>
                          σ:{" "}
                          <strong className="text-[var(--text-primary)]">
                            {summaryStats.std_value.toFixed(2)} {unit}
                          </strong>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-0.5 border-t border-[var(--border-default)] pt-1.5 typo-micro font-mono text-[var(--text-secondary)]">
                    <div className="flex justify-between">
                      <span>OLS SE</span>
                      <strong className="text-[var(--text-primary)]">
                        {se != null ? `±${se.toFixed(4)}` : "—"}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>t-stat</span>
                      <strong className="text-[var(--text-primary)]">
                        {tStat != null ? tStat.toFixed(3) : "—"}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>df</span>
                      <strong className="text-[var(--text-primary)]">{df != null ? df : "—"}</strong>
                    </div>
                    {theilSen && theilSen.slope_per_decade != null && (
                      <div className="flex justify-between">
                        <span>Theil–Sen</span>
                        <strong className="text-[var(--text-primary)]">
                          {theilSen.slope_per_decade > 0 ? "+" : ""}
                          {theilSen.slope_per_decade.toFixed(3)}
                        </strong>
                      </div>
                    )}
                  </div>
                </div>
              </details>

              {/* Methodology & caveats (always visible — load-bearing) */}
              <div className="mt-2 border-t border-[var(--border-default)] pt-1.5">
                <div className="typo-eyebrow text-[var(--text-secondary)] mb-0.5">
                  Methodology & Caveats
                </div>
                <ul className="space-y-0.5 typo-micro text-[var(--text-secondary)]">
                  {caveats.map((c, i) => (
                    <li key={i} className="flex items-start gap-1">
                      <span className="text-[var(--text-muted)]" aria-hidden="true">·</span>
                      <span>{c}</span>
                    </li>
                  ))}
                  <li className="flex items-start gap-1 text-[var(--text-muted)]">
                    <span className="text-[var(--text-muted)]" aria-hidden="true">·</span>
                    <span>
                      Correlation does not imply causal Earth system attribution.
                    </span>
                  </li>
                </ul>
              </div>
            </section>

            {/* ZONE 3 — Conclusion (deterministic, model-free summary) */}
            <section
              aria-labelledby="evidence-zone-conclusion"
              className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface-2)] p-2.5 shadow-2xs"
            >
              <div className="mb-1">
                <span id="evidence-zone-conclusion" className="typo-eyebrow text-[var(--text-secondary)]">
                  Conclusion
                </span>
              </div>
              <p className="typo-meta leading-snug text-[var(--text-secondary)]">
                Area-weighted regional mean of{" "}
                <strong className="text-[var(--text-primary)]">{variableName}</strong>{" "}
                exhibits a linear slope of{" "}
                <strong className="text-[var(--text-primary)] font-mono">
                  {slope != null
                    ? `${slope > 0 ? "+" : ""}${slope.toFixed(3)} ${unitPerDecade}`
                    : "—"}
                </strong>
                . 95% HAC CI:{" "}
                <span className="font-mono font-semibold">
                  {ci95 ? `[${ci95[0].toFixed(3)}, ${ci95[1].toFixed(3)}]` : "—"}
                </span>
                ; p ={" "}
                <span className="font-mono font-semibold">
                  {pValue != null
                    ? pValue < 0.001
                      ? "< 0.001"
                      : pValue.toFixed(4)
                    : "—"}
                </span>
                .
              </p>
              <p className="mt-1 typo-micro leading-relaxed text-[var(--text-secondary)]">
                {isSupported
                  ? "HAC CI excludes zero and p < 0.05 — empirical evidence supports a non-zero secular trend."
                  : "CI crosses zero (or p ≥ 0.05) — the null hypothesis of zero secular trend cannot be rejected."}
              </p>
            </section>

            {/* Secondary disclosures */}
            <Disclosure
              open={showPerYearTable}
              onToggle={() => setShowPerYearTable((v) => !v)}
              label={`Per-year table (${annualRecords.length})`}
              rightSlot={
                annualRecords.length > 0 ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExportCSV();
                    }}
                    className="inline-flex items-center gap-1 typo-micro font-semibold text-cyan-800 hover:text-cyan-900"
                    title="Export real NASA annual observations as CSV"
                  >
                    <Download className="h-3 w-3" aria-hidden="true" />
                    CSV
                  </button>
                ) : null
              }
            >
              {annualRecords.length === 0 ? (
                <EmptyState
                  title="No per-year observations"
                  description="Once a series arrives from the backend, this table renders rows for each year."
                />
              ) : (
                <div className="overflow-x-auto rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-2)]">
                  <table className="w-full text-left typo-micro font-mono divide-y divide-[var(--border-default)]">
                    <thead className="bg-[var(--bg-surface-2)] text-[var(--text-secondary)] typo-eyebrow">
                      <tr>
                        <th className="px-2.5 py-1.5">Year</th>
                        <th className="px-2.5 py-1.5">Observed</th>
                        <th className="px-2.5 py-1.5">Fitted</th>
                        <th className="px-2.5 py-1.5">Anomaly</th>
                        <th className="px-2.5 py-1.5 text-right">Coverage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-default)]">
                      {annualRecords.map((r) => {
                        const isSelectedYear = selectedYear === r.year;
                        return (
                          <tr
                            key={r.year}
                            className={cn(
                              "transition",
                              isSelectedYear ? "bg-cyan-50/70" : "hover:bg-[var(--bg-surface-2)]",
                            )}
                          >
                            <td className="px-2.5 py-1 font-bold text-[var(--text-primary)]">
                              {r.year}
                              {isSelectedYear ? (
                                <span className="ml-1 rounded bg-cyan-200 px-1 text-[7.5px] font-bold uppercase text-cyan-900">
                                  selected
                                </span>
                              ) : null}
                            </td>
                            <td className="px-2.5 py-1 text-[var(--text-primary)]">
                              {r.value != null ? r.value.toFixed(2) : "—"}
                            </td>
                            <td className="px-2.5 py-1 text-[var(--text-muted)]">
                              {r.fitted.toFixed(2)}
                            </td>
                            <td className="px-2.5 py-1">
                              <span
                                className={cn(
                                  "rounded px-1 py-0.2 font-bold",
                                  r.anomaly > 0
                                    ? "bg-rose-50 text-rose-700"
                                    : "bg-cyan-50 text-cyan-700",
                                )}
                              >
                                {r.anomaly > 0 ? "+" : ""}
                                {r.anomaly.toFixed(2)}
                              </span>
                            </td>
                            <td className="px-2.5 py-1 text-right text-[var(--text-muted)]">
                              {(r.coverage * 100).toFixed(0)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Disclosure>

            <Disclosure
              open={showActivityLog}
              onToggle={() => setShowActivityLog((v) => !v)}
              label={`Session activity (${log.length})`}
            >
              {log.length === 0 ? (
                <EmptyState
                  title="No actions recorded"
                  description="Selecting a dataset, drawing a region, or changing the period will populate this log."
                />
              ) : (
                <div className="space-y-1.5">
                  {log.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-2)] p-2 typo-meta"
                    >
                      <div>
                        <div className="font-semibold text-[var(--text-primary)]">{entry.label}</div>
                        {entry.prevLabel && (
                          <div className="typo-micro text-[var(--text-muted)] font-mono">
                            Prev: {entry.prevLabel}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onUndo(entry)}
                        className="inline-flex items-center gap-1 rounded border border-[var(--border-default)] bg-[var(--bg-surface-2)] px-2 py-0.5 typo-micro font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-2)]"
                      >
                        <RotateCcw className="h-2.5 w-2.5 text-cyan-600" aria-hidden="true" />
                        Undo
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Disclosure>
          </>
        ) : (
          <EmptyState
            title="Awaiting analytical results"
            description="Pick a dataset and region — the trend estimate and statistical diagnostics will populate here once the investigation completes."
          />
        )}
      </div>
    </div>
  );
}

interface MetricTileProps {
  eyebrow: string;
  value: string;
  subline?: string;
}
function MetricTile({ eyebrow, value, subline }: MetricTileProps) {
  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-2)] p-1.5">
      <div className="typo-micro text-[var(--text-muted)] uppercase tracking-wider font-bold">{eyebrow}</div>
      <div className="mt-0.5 font-mono text-[10.5px] font-bold text-[var(--text-primary)] tabular-nums leading-tight">
        {value}
      </div>
      {subline ? (
        <div className="mt-0.5 text-[8.5px] text-[var(--text-muted)] font-mono leading-tight">{subline}</div>
      ) : null}
    </div>
  );
}

interface DisclosureProps {
  open: boolean;
  onToggle: () => void;
  label: string;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}
function Disclosure({ open, onToggle, label, rightSlot, children }: DisclosureProps) {
  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-2)]">
      <div className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 hover:bg-[var(--bg-surface-2)]">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="inline-flex flex-1 items-center gap-1.5 text-left typo-micro font-semibold text-[var(--text-secondary)]"
        >
          {open ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
          {label}
        </button>
        {rightSlot}
      </div>
      {open && <div className="border-t border-[var(--border-default)] p-2.5">{children}</div>}
    </div>
  );
}
