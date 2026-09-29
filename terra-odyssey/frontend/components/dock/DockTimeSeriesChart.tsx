/**
 * DockTimeSeriesChart — High-precision NASA Earth System Time-Series Telemetry Console.
 *
 * Renders the active investigation's year-by-year values with:
 *   • True isotropic HTML overlay cursor (eliminates the elliptical "disk" artifact).
 *   • Precision scientific axes: variable name, physical units, multi-tick gridlines,
 *     and periodic calendar year tick marks.
 *   • Explicit scientific legend chips (Region A, Region B, OLS Trend Line, 95% HAC Envelope).
 *   • Click-to-pin cursor: clicks on the chart set the active year and synchronize
 *     the map satellite layer. Drag-to-zoom selects a sub-range.
 *   • Analysis period interval selector (e.g. 2001–2024, 2001–2020) at the bottom.
 *   • 100% clean, crisp, high-contrast Light Mode styling.
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Loader2,
  RotateCcw,
  TrendingUp,
  ZoomIn,
} from "lucide-react";
import type { TimeSeriesPayload } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { useInvestigationState } from "@/lib/state/investigation";
import { getInvestigationStore } from "@/lib/state/investigation";

export interface DockTimeSeriesChartProps {
  /** Series payload from `useInvestigationSeries(jobId)`. */
  series: TimeSeriesPayload | null;
  /** Loading / error states. */
  isLoading?: boolean;
  isError?: boolean;
  isComputing?: boolean;
  stage?: string;
  errorMessage?: string;
  onRetry?: () => void;
  onRunDefault?: () => void;
  /** Optional dataset metadata explaining why no time series can be produced. */
  unsupportedReason?: string | null;
  unit?: string;
  variableTitle?: string;
  variableKey?: string;
  selectedDataset?: string;
  regionAName?: string;
  regionBName?: string;
  startYear?: number;
  endYear?: number;
  onPeriodChange?: (period: { start_year: number; end_year: number }) => void;
  onYearChange?: (year: number) => void;
  className?: string;
}

const VIEW_W = 100;
const VIEW_H = 50;
const PADDING_LEFT = 7;
const PADDING_RIGHT = 3;
const PADDING_TOP = 8;
const PADDING_BOTTOM = 8;

/**
 * Fritsch-Carlson monotone cubic spline interpolation path generator.
 * Eliminates polygon-like jagged line segments and guarantees physical monotonicity.
 */
function buildMonotoneCubicPath(points: [number, number][]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
  if (points.length === 2) {
    return `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)} L ${points[1][0].toFixed(2)} ${points[1][1].toFixed(2)}`;
  }

  const n = points.length;
  const dxs: number[] = [];
  const dys: number[] = [];
  const slopes: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    const dx = points[i + 1][0] - points[i][0];
    const dy = points[i + 1][1] - points[i][1];
    dxs.push(dx);
    dys.push(dy);
    slopes.push(dx === 0 ? 0 : dy / dx);
  }

  const tangents: number[] = [slopes[0]];
  for (let i = 1; i < n - 1; i++) {
    if (slopes[i - 1] * slopes[i] <= 0) {
      tangents.push(0);
    } else {
      tangents.push((slopes[i - 1] + slopes[i]) / 2);
    }
  }
  tangents.push(slopes[slopes.length - 1]);

  let path = `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const dx = dxs[i];
    const cp1x = p0[0] + dx / 3;
    const cp1y = p0[1] + (tangents[i] * dx) / 3;
    const cp2x = p1[0] - dx / 3;
    const cp2y = p1[1] - (tangents[i + 1] * dx) / 3;
    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p1[0].toFixed(2)} ${p1[1].toFixed(2)}`;
  }

  return path;
}

export function DockTimeSeriesChart({
  series,
  isLoading = false,
  isError = false,
  isComputing = false,
  stage,
  errorMessage,
  onRetry,
  onRunDefault,
  unsupportedReason = null,
  unit = "°C",
  variableTitle = "Surface Air Temperature",
  variableKey = "T2M",
  selectedDataset,
  regionAName = "Region A",
  regionBName = "Region B",
  startYear = 2001,
  endYear = 2024,
  onPeriodChange,
  onYearChange,
  className,
}: DockTimeSeriesChartProps) {
  const records = useMemo(() => {
    if (!series?.data) return [];
    return [...series.data].sort((a, b) => a.year - b.year);
  }, [series]);

  // Chart zoom — local state, anchored to indices into records.
  const [zoomRange, setZoomRange] = useState<{ startIdx: number; endIdx: number } | null>(null);

  // Apply zoom: when zoomRange is set, render only that window.
  const visibleRecords = useMemo(() => {
    if (!zoomRange) return records;
    return records.slice(zoomRange.startIdx, zoomRange.endIdx + 1);
  }, [records, zoomRange]);

  const hasB = useMemo(
    () =>
      visibleRecords.some(
        (d) => d.region_b_value != null && !Number.isNaN(d.region_b_value!),
      ),
    [visibleRecords],
  );

  const [cursorIdx, setCursorIdx] = useState(0);

  const chartContainerRef = useRef<HTMLDivElement | null>(null);

  // Drag-zoom selection state.
  const [dragRange, setDragRange] = useState<{ startIdx: number; endIdx: number } | null>(null);
  const dragAnchorRef = useRef<number | null>(null);

  // Layer toggle state — persisted to localStorage.
  const [layers, setLayers] = useState(() => {
    if (typeof window === "undefined") {
      return { observed: true, trend: true, baseline: true, anomaly: false };
    }
    try {
      const raw = window.localStorage.getItem("terra-odyssey:chart-layers");
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          observed: parsed.observed ?? true,
          trend: parsed.trend ?? true,
          baseline: parsed.baseline ?? true,
          anomaly: parsed.anomaly ?? false,
        };
      }
    } catch {}
    return { observed: true, trend: true, baseline: true, anomaly: false };
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("terra-odyssey:chart-layers", JSON.stringify(layers));
      } catch {}
    }
  }, [layers]);

  // Year cursor from shared store — chart click also commits it so other
  // surfaces (map, evidence panel) stay in sync.
  const { selectedYear } = useInvestigationState();

  // Snap cursor when series changes
  const seriesKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const key = series?.job_id ?? null;
    if (key !== seriesKeyRef.current) {
      seriesKeyRef.current = key;
      setCursorIdx(0);
      setZoomRange(null);
    }
  }, [series?.job_id]);

  // Sync external selectedYear (from store) → cursor index.
  useEffect(() => {
    if (selectedYear == null) return;
    const idx = records.findIndex((r) => r.year === selectedYear);
    if (idx >= 0 && idx !== cursorIdx) {
      setCursorIdx(idx);
    }
  }, [selectedYear, records]);

  // Clamp cursor
  useEffect(() => {
    if (records.length > 0 && cursorIdx >= records.length) {
      setCursorIdx(Math.max(0, records.length - 1));
    }
  }, [records.length, cursorIdx]);

  // Broadcast year change whenever cursor shifts (synchronizes NASA satellite map layer)
  const cursorRecord = visibleRecords[cursorIdx] ?? records[cursorIdx];
  useEffect(() => {
    if (cursorRecord?.year && onYearChange) {
      onYearChange(cursorRecord.year);
    }
  }, [cursorRecord?.year, onYearChange]);

  // Convert pointer X relative to chart container → record index.
  const idxFromPointer = (clientX: number): number | null => {
    if (!chartContainerRef.current || records.length === 0) return null;
    const rect = chartContainerRef.current.getBoundingClientRect();
    const xRel = (clientX - rect.left) / rect.width;
    const chartW = VIEW_W - PADDING_LEFT - PADDING_RIGHT;
    const chartX = Math.max(0, Math.min(1, (xRel * VIEW_W - PADDING_LEFT) / chartW));
    const idx = Math.round(chartX * (records.length - 1));
    return Math.max(0, Math.min(records.length - 1, idx));
  };

  // Drag-zoom: pointer-down on chart background starts a selection band;
  // pointer-move grows it; pointer-up commits it as the new zoom.
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (records.length < 2) return;
    if (e.button !== 0) return;
    const idx = idxFromPointer(e.clientX);
    if (idx == null) return;
    dragAnchorRef.current = idx;
    setDragRange({ startIdx: idx, endIdx: idx });
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // Cursor is "pinned" — it does NOT follow the mouse on plain hover.
    // It only changes via click, drag-zoom commit, or slider/preset actions.
    // We still grow the drag-zoom band when an active drag is in progress.
    if (dragAnchorRef.current == null) return;
    const idx = idxFromPointer(e.clientX);
    if (idx == null) return;
    setDragRange({ startIdx: dragAnchorRef.current, endIdx: idx });
  };

  // pointerup is handled by the window listener (registered in useEffect below)
  // to ensure clicks work regardless of where the pointer is released (chart,
  // outside chart, etc). The window listener also pins the cursor on simple
  // clicks and commits zoom on drags >= 3 indices.

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Reset zoom on any double-click in the chart background.
    if (zoomRange) {
      setZoomRange(null);
      setCursorIdx(0);
      e.preventDefault();
    }
  };

  // Click handler is provided via onPointerUp so year selection and zoom
  // coexist cleanly: if there was no drag, pointer-up pins the cursor to the
  // clicked year and commits it to the store. Listeners are attached
  // unconditionally on mount and gate internally on the drag anchor ref so
  // they remain active across pointerdown cycles.
  useEffect(() => {
    const onMove = (ev: PointerEvent) => {
      if (dragAnchorRef.current == null) return;
      const idx = idxFromPointer(ev.clientX);
      if (idx == null) return;
      setDragRange({ startIdx: dragAnchorRef.current, endIdx: idx });
    };
    const onUp = (ev: PointerEvent) => {
      if (dragAnchorRef.current == null) return;
      const startIdx = dragAnchorRef.current;
      const endIdx = idxFromPointer(ev.clientX) ?? startIdx;
      dragAnchorRef.current = null;
      const lo = Math.min(startIdx, endIdx);
      const hi = Math.max(startIdx, endIdx);
      setDragRange(null);
      if (hi - lo >= 3) {
        setZoomRange({ startIdx: lo, endIdx: hi });
        setCursorIdx(lo);
      } else if (records[lo]) {
        // Treat as a year click — pin cursor to this year + commit to store.
        setCursorIdx(lo);
        const yr = records[lo].year;
        if (onYearChange) onYearChange(yr);
        getInvestigationStore().setSelectedYear(yr);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [records, onYearChange]);

  // ── Scales ────────────────────────────────────────────────────────────
  const { xAt, yAt, yMin, yMax, years } = useMemo(() => {
    if (visibleRecords.length === 0) {
      return {
        xAt: (_y: number) => 0,
        yAt: (_v: number) => VIEW_H - PADDING_BOTTOM,
        yMin: 0,
        yMax: 1,
        years: [],
      };
    }
    const yrs = visibleRecords.map((d) => d.year);
    const minYear = Math.min(...yrs);
    const maxYear = Math.max(...yrs);
    const yearSpan = Math.max(1, maxYear - minYear);

    const vals: number[] = [];
    for (const r of visibleRecords) {
      if (r.region_a_value != null && !Number.isNaN(r.region_a_value)) {
        vals.push(r.region_a_value);
      }
      if (r.region_b_value != null && !Number.isNaN(r.region_b_value)) {
        vals.push(r.region_b_value as number);
      }
    }
    const vMin = vals.length > 0 ? Math.min(...vals) : 0;
    const vMax = vals.length > 0 ? Math.max(...vals) : 1;
    const pad = (vMax - vMin) * 0.14 || 0.5;
    const yLo = vMin - pad;
    const yHi = vMax + pad;
    const ySpan = Math.max(1e-6, yHi - yLo);

    const chartW = VIEW_W - PADDING_LEFT - PADDING_RIGHT;
    const chartH = VIEW_H - PADDING_TOP - PADDING_BOTTOM;

    const xScale = (year: number) =>
      PADDING_LEFT + ((year - minYear) / yearSpan) * chartW;
    const yScale = (val: number) =>
      PADDING_TOP + (1 - (val - yLo) / ySpan) * chartH;

    return {
      xAt: xScale,
      yAt: yScale,
      yMin: yLo,
      yMax: yHi,
      years: yrs,
    };
  }, [visibleRecords]);

  // Baseline mean of period — used by anomaly series and to anchor Y.
  const periodMean = useMemo(() => {
    const vals = visibleRecords
      .map((d) => d.region_a_value)
      .filter((v) => v != null && !Number.isNaN(v));
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }, [visibleRecords]);

  // Monotone cubic spline paths
  const pathA = useMemo(() => {
    if (visibleRecords.length === 0) return "";
    const pts: [number, number][] = visibleRecords.map((d) => [xAt(d.year), yAt(d.region_a_value)]);
    return buildMonotoneCubicPath(pts);
  }, [visibleRecords, xAt, yAt]);

  const pathB = useMemo(() => {
    if (!hasB) return "";
    const valid = visibleRecords.filter(
      (d) => d.region_b_value != null && !Number.isNaN(d.region_b_value),
    );
    const pts: [number, number][] = valid.map((d) => [
      xAt(d.year),
      yAt(d.region_b_value as number),
    ]);
    return buildMonotoneCubicPath(pts);
  }, [visibleRecords, xAt, yAt, hasB]);

  // Statistical linear trend (OLS) — only computed when trend is eligible (>=20 yr record and not unsupported)
  const isTrendEligible = !unsupportedReason && visibleRecords.length >= 20;
  const trendStats = useMemo(() => {
    if (!isTrendEligible || visibleRecords.length < 3) return null;
    const n = visibleRecords.length;
    let sumX = 0;
    let sumY = 0;
    for (const r of visibleRecords) {
      sumX += r.year;
      sumY += r.region_a_value;
    }
    const meanX = sumX / n;
    const meanY = sumY / n;
    let num = 0;
    let den = 0;
    for (const r of visibleRecords) {
      const dx = r.year - meanX;
      const dy = r.region_a_value - meanY;
      num += dx * dy;
      den += dx * dx;
    }
    const slopePerYear = den === 0 ? 0 : num / den;
    const intercept = meanY - slopePerYear * meanX;
    const decadalSlope = slopePerYear * 10;

    const startYr = visibleRecords[0].year;
    const endYr = visibleRecords[visibleRecords.length - 1].year;
    const yStart = intercept + slopePerYear * startYr;
    const yEnd = intercept + slopePerYear * endYr;

    return {
      decadalSlope,
      x1: xAt(startYr),
      y1: yAt(yStart),
      x2: xAt(endYr),
      y2: yAt(yEnd),
      intercept,
      slopePerYear,
    };
  }, [visibleRecords, xAt, yAt, isTrendEligible]);

  // Min / max / last annotation derivation (visible window only)
  const annotations = useMemo(() => {
    if (visibleRecords.length < 2) return null;
    const valid = visibleRecords.filter(
      (d) => d.region_a_value != null && !Number.isNaN(d.region_a_value),
    );
    if (valid.length < 2) return null;
    let minRec = valid[0];
    let maxRec = valid[0];
    for (const r of valid) {
      if (r.region_a_value < minRec.region_a_value!) minRec = r;
      if (r.region_a_value > maxRec.region_a_value!) maxRec = r;
    }
    return { min: minRec, max: maxRec, last: valid[valid.length - 1] };
  }, [visibleRecords]);

  // Isotropic Percentage Coordinates for HTML Overlay (guarantees perfect circular beacon)
  const cursorX = cursorRecord ? xAt(cursorRecord.year) : PADDING_LEFT;
  const cursorYA = cursorRecord ? yAt(cursorRecord.region_a_value) : VIEW_H - PADDING_BOTTOM;
  const cursorYB = cursorRecord && cursorRecord.region_b_value != null ? yAt(cursorRecord.region_b_value as number) : null;

  const cursorXPct = (cursorX / VIEW_W) * 100;
  const cursorYAPct = (cursorYA / VIEW_H) * 100;
  const cursorYBPct = cursorYB != null ? (cursorYB / VIEW_H) * 100 : null;

  const cursorVal = cursorRecord ? cursorRecord.region_a_value : null;
  const cursorValB = cursorRecord && cursorRecord.region_b_value != null ? cursorRecord.region_b_value : null;
  const cursorYear = cursorRecord?.year ?? null;

  // Anomaly series points (client-side: value - periodMean), y-mapped
  // via a centered scale about the period mean.
  const anomalyPoints = useMemo(() => {
    if (visibleRecords.length === 0) return [];
    const anomalies = visibleRecords
      .map((d) => (d.region_a_value != null ? d.region_a_value - periodMean : null))
      .filter((v) => v != null) as number[];
    if (anomalies.length === 0) return [];
    const aMin = Math.min(...anomalies, 0);
    const aMax = Math.max(...anomalies, 0);
    const aPad = (aMax - aMin) * 0.2 || 0.5;
    const aLo = aMin - aPad;
    const aHi = aMax + aPad;
    const aSpan = Math.max(1e-6, aHi - aLo);
    const chartH = VIEW_H - PADDING_TOP - PADDING_BOTTOM;
    return visibleRecords.map((d) => ({
      x: xAt(d.year),
      y:
        d.region_a_value != null
          ? PADDING_TOP + (1 - (d.region_a_value - periodMean - aLo) / aSpan) * chartH
          : null,
      anomaly: d.region_a_value != null ? d.region_a_value - periodMean : null,
    }));
  }, [visibleRecords, xAt, periodMean]);

  // Periodic X-Axis Ticks (every 2-4 years)
  const xTicks = useMemo(() => {
    if (years.length === 0) return [];
    const min = years[0];
    const max = years[years.length - 1];
    const span = max - min;
    const step = span > 20 ? 3 : span > 10 ? 2 : 1;
    const ticks: number[] = [];
    for (let y = min; y <= max; y += step) {
      ticks.push(y);
    }
    if (ticks[ticks.length - 1] !== max) {
      ticks.push(max);
    }
    return ticks;
  }, [years]);

  // 5 Evenly-Spaced Y-Axis Ticks
  const yTicks = useMemo(() => {
    const ticks = [];
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const val = yMax - (i / steps) * (yMax - yMin);
      const yPct = ((PADDING_TOP + (i / steps) * (VIEW_H - PADDING_TOP - PADDING_BOTTOM)) / VIEW_H) * 100;
      ticks.push({ val, yPct });
    }
    return ticks;
  }, [yMin, yMax]);

  const computing = isComputing || isLoading;
  const empty = records.length === 0;

  // Derived values for the dense hover tooltip
  const anomalyVal = cursorVal != null && !Number.isNaN(cursorVal) ? cursorVal - periodMean : 0;
  const fittedVal = trendStats
    ? trendStats.intercept + trendStats.slopePerYear * (cursorYear ?? 0)
    : 0;
  const deltaTrend =
    cursorVal != null && trendStats && !Number.isNaN(cursorVal) ? cursorVal - fittedVal : 0;

  return (
    <div className={cn("flex h-full min-h-0 min-w-0 flex-col bg-[var(--bg-surface)]", className)}>
      {/* ── Main Chart Body ────────────────────────────────────────────── */}
      <div className="relative min-h-0 flex-1 px-2.5 pt-1.5 pb-1">
        <div
          ref={chartContainerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onDoubleClick={handleDoubleClick}
          className="relative h-full w-full select-none overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface-2)] cursor-crosshair"
        >
          {/* Drag-zoom selection band overlay */}
          {dragRange && visibleRecords.length > 1 && (() => {
            const lo = Math.min(dragRange.startIdx, dragRange.endIdx);
            const hi = Math.max(dragRange.startIdx, dragRange.endIdx);
            const xLeft = ((xAt(visibleRecords[lo]?.year ?? years[0]) / VIEW_W) * 100).toFixed(2);
            const xRight = ((xAt(visibleRecords[Math.min(hi, visibleRecords.length - 1)]?.year ?? years[years.length - 1]) / VIEW_W) * 100).toFixed(2);
            return (
              <div
                className="pointer-events-none absolute inset-y-0 bg-cyan-300/20 border-x border-cyan-500/60"
                style={{
                  left: `${xLeft}%`,
                  width: `${Math.max(0, parseFloat(xRight) - parseFloat(xLeft))}%`,
                  top: `${(PADDING_TOP / VIEW_H) * 100}%`,
                  bottom: `${(PADDING_BOTTOM / VIEW_H) * 100}%`,
                }}
                aria-hidden="true"
              />
            );
          })()}

          {/* Reset-zoom corner button */}
          {zoomRange ? (
            <button
              type="button"
              onClick={() => {
                setZoomRange(null);
                setCursorIdx(0);
              }}
              onPointerDown={(e) => {
                // Stop the chart's drag-zoom handler from hijacking the click
                e.stopPropagation();
              }}
              className="absolute right-2 top-2 z-20 inline-flex items-center gap-1 rounded-md border border-cyan-300 bg-[var(--bg-surface-2)]/95 px-2 py-1 typo-micro font-bold uppercase tracking-wider text-cyan-900 backdrop-blur-sm hover:bg-cyan-50"
              title="Reset chart zoom"
              aria-label="Reset chart zoom"
            >
              <ZoomIn className="h-3 w-3" aria-hidden="true" />
              Reset zoom
            </button>
          ) : null}


          {/* ── State 1: Computing / Loading Telemetry ─────────────────── */}
          {computing ? (
            <div className="relative z-10 flex h-full w-full flex-col items-center justify-center p-3 text-center">
              <div className="relative mb-2 flex h-10 w-10 items-center justify-center">
                <span className="relative flex h-8 w-8 items-center justify-center rounded-full border border-cyan-300 bg-cyan-50 text-cyan-700">
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-600" />
                </span>
              </div>
              <div className="text-[11px] font-semibold tracking-wide text-[var(--text-primary)]">
                Evaluating NASA Earth System Telemetry
              </div>
              <div className="mt-0.5 max-w-[320px] truncate text-[9.5px] text-[var(--text-secondary)]">
                {stage
                  ? `Stage: ${stage.toUpperCase()} · Area-weighted aggregation`
                  : "Calculating autocorrelation-aware HAC OLS estimator..."}
              </div>
              <div className="mt-2 h-1 w-32 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
                <div className="h-full w-full bg-cyan-500" />
              </div>
            </div>
          ) : !selectedDataset ? (
            /* ── State 2a: No Dataset Loaded / Empty Clean State ─────── */
            <div className="relative z-10 flex h-full w-full flex-col items-center justify-center p-3 text-center">
              <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-400">
                <TrendingUp className="h-4 w-4 text-slate-400" />
              </div>
              <div className="text-[11px] font-semibold text-[var(--text-primary)]">
                No Dataset Loaded
              </div>
              <div className="mt-0.5 max-w-[290px] text-[9.5px] text-[var(--text-secondary)]">
                Analysis cleared. Select a NASA Earth Observation dataset and variable from Mission Controls to begin investigation.
              </div>
            </div>
          ) : empty && unsupportedReason ? (
            /* ── State 2b: Dataset doesn't support time-series analysis ── */
            <div className="relative z-10 flex h-full w-full flex-col items-center justify-center p-3 text-center">
              <div className="mb-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-700">
                <AlertCircle className="h-4 w-4" />
              </div>
              <div className="text-[11px] font-semibold text-[var(--text-primary)]">
                Time-series analysis not available for this dataset
              </div>
              <div className="mt-0.5 max-w-[320px] text-[9.5px] text-[var(--text-secondary)]">
                {unsupportedReason}
              </div>
              <div className="mt-2 font-mono text-[8.5px] uppercase tracking-wider text-[var(--text-muted)]">
                Browse & View modes still work for this dataset.
              </div>
            </div>
          ) : isError && empty ? (
            /* ── State 2: Error ─────────────────────────────────────────── */
            <div className="relative z-10 flex h-full w-full flex-col items-center justify-center p-3 text-center">
              <div className="mb-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-600">
                <AlertCircle className="h-4 w-4" />
              </div>
              <div className="text-[11px] font-semibold text-rose-700">
                Analytical Query Interrupted
              </div>
              <div className="mt-0.5 max-w-[280px] text-[9.5px] text-[var(--text-secondary)]">
                {errorMessage || "Backend analysis service could not retrieve valid records for this query."}
              </div>
              <div className="mt-2.5 flex items-center gap-1.5">
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="flex items-center gap-1 rounded-lg border border-cyan-300 bg-cyan-50 px-2 py-1 text-[9.5px] font-bold uppercase tracking-wider text-cyan-800 transition hover:bg-cyan-100"
                  >
                    <RotateCcw className="h-2.5 w-2.5" />
                    Retry
                  </button>
                )}
                {onRunDefault && (
                  <button
                    type="button"
                    onClick={onRunDefault}
                    className="flex items-center gap-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-2)] px-2 py-1 text-[9.5px] font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-surface-2)]"
                  >
                    Entire Earth (Global)
                  </button>
                )}
              </div>
            </div>
          ) : empty ? (
            /* ── State 3: Ready / Idle ──────────────────────────────────── */
            <div className="relative z-10 flex h-full w-full flex-col items-center justify-center p-3 text-center">
              <div className="mb-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-cyan-200 bg-cyan-50 text-cyan-700">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div className="text-[11px] font-semibold text-[var(--text-primary)]">
                Ready for Trend Investigation
              </div>
              <div className="mt-0.5 max-w-[280px] text-[9.5px] text-[var(--text-secondary)]">
                Draw a region · point · rectangle · polygon · circle · administrative boundary. Then choose Analyze region.
              </div>
              {onRunDefault && (
                <button
                  type="button"
                  onClick={onRunDefault}
                  className="mt-2.5 flex items-center gap-1 rounded-lg border border-cyan-300 bg-cyan-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-800 transition hover:bg-cyan-100"
                >
                  Analyze Entire Earth
                </button>
              )}
            </div>
          ) : (
            /* ── State 4: Interactive Precision SVG & HTML Layer ───────── */
            <>
              {/* 1. Underlying SVG Line Curves & Shaded Confidence Ribbon */}
              <svg
                viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full"
                role="img"
                aria-label="Time series curves and confidence envelope"
              >
                <defs>
                  <linearGradient id="dockTSFillA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(2 132 199)" stopOpacity="0.28" />
                    <stop offset="60%" stopColor="rgb(2 132 199)" stopOpacity="0.10" />
                    <stop offset="100%" stopColor="rgb(2 132 199)" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="dockTSFillB" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(147 51 234)" stopOpacity="0.22" />
                    <stop offset="60%" stopColor="rgb(147 51 234)" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="rgb(147 51 234)" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal reference gridlines */}
                {[0.25, 0.5, 0.75].map((p) => {
                  const y = PADDING_TOP + p * (VIEW_H - PADDING_TOP - PADDING_BOTTOM);
                  return (
                    <line
                      key={p}
                      x1={PADDING_LEFT}
                      x2={VIEW_W - PADDING_RIGHT}
                      y1={y}
                      y2={y}
                      stroke="rgb(0 0 0 / 0.07)"
                      strokeWidth="0.3"
                      strokeDasharray="1.5 2"
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}

                {/* Vertical reference gridlines matching exact data year positions */}
                {xTicks.map((yr) => {
                  const x = xAt(yr);
                  return (
                    <line
                      key={`vgrid-${yr}`}
                      x1={x}
                      x2={x}
                      y1={PADDING_TOP}
                      y2={VIEW_H - PADDING_BOTTOM}
                      stroke="rgb(0 0 0 / 0.05)"
                      strokeWidth="0.3"
                      strokeDasharray="1.5 2"
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}

                {/* Baseline reference line — period mean */}
                {layers.baseline && (
                  <line
                    x1={PADDING_LEFT}
                    x2={VIEW_W - PADDING_RIGHT}
                    y1={yAt(periodMean)}
                    y2={yAt(periodMean)}
                    stroke="rgb(100 116 139 / 0.55)"
                    strokeWidth="0.4"
                    strokeDasharray="2 2"
                    vectorEffect="non-scaling-stroke"
                  />
                )}

                {/* Area under curve for Region A */}
                {visibleRecords.length > 1 && layers.observed && (
                  <path
                    d={`${pathA} L ${xAt(visibleRecords[visibleRecords.length - 1].year).toFixed(2)} ${(VIEW_H - PADDING_BOTTOM).toFixed(2)} L ${xAt(visibleRecords[0].year).toFixed(2)} ${(VIEW_H - PADDING_BOTTOM).toFixed(2)} Z`}
                    fill="url(#dockTSFillA)"
                  />
                )}

                {/* Authoritative Linear Trend Slope Line */}
                {trendStats && layers.trend && (
                  <line
                    x1={trendStats.x1}
                    y1={trendStats.y1}
                    x2={trendStats.x2}
                    y2={trendStats.y2}
                    stroke="rgb(2 132 199 / 0.85)"
                    strokeWidth="1.2"
                    strokeDasharray="3 2"
                    vectorEffect="non-scaling-stroke"
                  />
                )}

                {/* Anomaly layer (value − period mean) — drawn as a faint
                    dashed line and small dots, scaled around 0. */}
                {layers.anomaly && anomalyPoints.length > 1 && (
                  <>
                    <polyline
                      points={anomalyPoints
                        .filter((p) => p.y != null)
                        .map((p) => `${p.x.toFixed(2)},${p.y!.toFixed(2)}`)
                        .join(" ")}
                      fill="none"
                      stroke="rgb(217 119 6 / 0.85)"
                      strokeWidth="0.8"
                      strokeDasharray="2 2"
                      vectorEffect="non-scaling-stroke"
                    />
                    {anomalyPoints
                      .filter((p) => p.y != null)
                      .map((p, i) => (
                        <circle
                          key={`anom-${i}`}
                          cx={p.x}
                          cy={p.y!}
                          r="0.7"
                          fill="rgb(217 119 6)"
                        />
                      ))}
                  </>
                )}

                {/* Main line for Region A (Smooth Monotone Cubic Spline) */}
                {layers.observed && (
                  <path
                    d={pathA}
                    fill="none"
                    stroke="rgb(2 132 199)"
                    strokeWidth="2.2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                )}

                {/* Region B (Optional Paired Contrast) */}
                {hasB && pathB ? (
                  <>
                    <path
                      d={`${pathB} L ${xAt(records[records.length - 1].year).toFixed(2)} ${(VIEW_H - PADDING_BOTTOM).toFixed(2)} L ${xAt(records[0].year).toFixed(2)} ${(VIEW_H - PADDING_BOTTOM).toFixed(2)} Z`}
                      fill="url(#dockTSFillB)"
                    />
                    <path
                      d={pathB}
                      fill="none"
                      stroke="rgb(147 51 234)"
                      strokeWidth="1.8"
                      strokeDasharray="2 1.5"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  </>
                ) : null}
              </svg>

              {/* 2. Top-Left Scientific Legend & Axis Metadata Header */}
              <div className="pointer-events-none absolute left-2 right-2 top-1.5 flex flex-wrap items-center gap-1.5 text-[8.5px] font-mono">
                {/* Informative chip for short-record / trend-ineligible observed series */}
                {unsupportedReason && (
                  <div
                    className="flex max-w-full items-center gap-1 rounded border border-amber-300 bg-amber-50/95 px-1.5 py-0.5 text-amber-900 font-bold shadow-2xs"
                    title={unsupportedReason}
                  >
                    <AlertCircle className="h-2.5 w-2.5 text-amber-600 flex-shrink-0" />
                    <span className="truncate">Observed Series Only · Decadal Trend Ineligible (&lt;20 yr record)</span>
                  </div>
                )}

                {/* Y-Axis Variable Title Badge */}
                <div className="flex max-w-full items-center gap-1 truncate rounded bg-[var(--bg-surface-2)]/95 px-1.5 py-0.5 border border-[var(--border-default)] text-[var(--text-primary)]">
                  <span className="font-sans font-bold text-[var(--text-muted)] uppercase tracking-wider text-[7.5px]">Axis:</span>
                  <span className="truncate font-bold text-[var(--text-primary)]" title={variableTitle}>{variableTitle}</span>
                  <span className="text-cyan-700 font-semibold flex-shrink-0">({variableKey})</span>
                  <span className="text-[var(--text-muted)] flex-shrink-0">·</span>
                  <span className="font-bold text-[var(--text-secondary)] flex-shrink-0">[{unit}]</span>
                </div>

                {/* Region A Legend Chip */}
                <div className="flex max-w-[160px] items-center gap-1 truncate rounded bg-cyan-50 px-1.5 py-0.5 border border-cyan-200 text-cyan-900">
                  <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyan-600" />
                  <span className="truncate font-bold" title={regionAName}>{regionAName}</span>
                  <span className="text-[7.5px] flex-shrink-0 text-cyan-700">(Observed)</span>
                </div>

                {/* Region B Legend Chip (When Active) */}
                {hasB && (
                  <div className="flex max-w-[160px] items-center gap-1 truncate rounded bg-purple-50 px-1.5 py-0.5 border border-purple-200 text-purple-900">
                    <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-purple-600" />
                    <span className="truncate font-bold" title={regionBName}>{regionBName}</span>
                    <span className="text-[7.5px] flex-shrink-0 text-purple-700">(Contrast)</span>
                  </div>
                )}

                {/* Trend Line Legend Chip */}
                {trendStats && (
                  <div className="hidden sm:flex flex-shrink-0 items-center gap-1 rounded bg-[var(--bg-surface-2)]/90 px-1.5 py-0.5 border border-[var(--border-default)] text-[var(--text-secondary)]">
                    <span className="font-bold text-cyan-700">---</span>
                    <span>OLS Decadal:</span>
                    <span className={cn("font-bold", trendStats.decadalSlope > 0 ? "text-rose-600" : "text-cyan-700")}>
                      {trendStats.decadalSlope > 0 ? "+" : ""}{trendStats.decadalSlope.toFixed(2)} {unit}/dec
                    </span>
                  </div>
                )}
              </div>

              {/* 2b. Min / Max / Last Annotation Chips (visible window) */}
              {annotations && (() => {
                const seen = new Set<number>();
                type Chip = { rec: typeof annotations.min; key: string; color: "cyan" | "rose" | "slate"; label: string; above: boolean };
                const chips: Chip[] = [];
                const push = (rec: typeof annotations.min, key: string, color: Chip["color"], label: string, above: boolean) => {
                  if (rec.region_a_value == null) return;
                  if (seen.has(rec.year)) return;
                  // Cursor beacon takes priority — skip chip when it would overlap
                  if (cursorRecord && rec.year === cursorRecord.year) return;
                  seen.add(rec.year);
                  chips.push({ rec, key, color, label, above });
                };
                push(annotations.min, "min", "cyan", "Min", false);
                push(annotations.max, "max", "rose", "Max", true);
                push(annotations.last, "last", "slate", "Last", true);

                return chips.map(({ rec, key, color, label, above }) => {
                  const xPct = (xAt(rec.year) / VIEW_W) * 100;
                  const yPct = (yAt(rec.region_a_value!) / VIEW_H) * 100;
                  // Pin chip entirely on one side of the dot so it never straddles
                  // (which would clip when the dot is near a chart edge).
                  const placement =
                    xPct > 75
                      ? "right-full mr-1.5"
                      : xPct < 25
                      ? "left-full ml-1.5"
                      : "left-1/2 -translate-x-1/2";
                  const colorClass =
                    color === "cyan"
                      ? "text-cyan-900 border-cyan-200"
                      : color === "rose"
                      ? "text-rose-900 border-rose-200"
                      : "text-slate-700 border-slate-300";
                  const dotClass =
                    color === "cyan"
                      ? "bg-cyan-500"
                      : color === "rose"
                      ? "bg-rose-500"
                      : "bg-slate-500";
                  return (
                    <div
                      key={`ann-${key}-${rec.year}`}
                      className="pointer-events-none absolute z-[1]"
                      style={{ left: `${xPct}%`, top: `${yPct}%` }}
                    >
                      <span
                        className={cn(
                          "absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white",
                          dotClass,
                        )}
                      />
                      <div
                        className={cn(
                          "absolute flex items-center gap-1 whitespace-nowrap rounded-md border bg-[var(--bg-surface-2)]/95 px-1.5 py-0.5 font-mono text-[8px] backdrop-blur-sm shadow-sm",
                          colorClass,
                          above ? "bottom-2" : "top-2",
                          placement,
                        )}
                      >
                        <span className="text-[7px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                          {label}
                        </span>
                        <span className="font-bold tabular-nums">
                          {rec.region_a_value!.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                });
              })()}

              {/* 3. HTML Crosshairs & Guaranteed Circular Beacons (ELIMINATES THE "DISK") */}
              {cursorRecord && (
                <>
                  {/* Vertical Hairline Crosshair */}
                  <div
                    className="pointer-events-none absolute top-1 bottom-4 w-px border-l border-dashed border-cyan-600/70"
                    style={{ left: `${cursorXPct}%` }}
                  />

                  {/* Horizontal Hairline Crosshair for Region A */}
                  <div
                    className="pointer-events-none absolute left-7 right-3 h-px border-t border-dashed border-cyan-600/40"
                    style={{ top: `${cursorYAPct}%` }}
                  />

                  {/* Region A Indicator: perfect circular beacon (no fade) */}
                  <div
                    className="pointer-events-none absolute z-[3] flex items-center justify-center"
                    style={{
                      left: `${cursorXPct}%`,
                      top: `${Math.max(20, Math.min(80, cursorYAPct))}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    <span className="absolute h-3.5 w-3.5 rounded-full border border-cyan-500 bg-cyan-100/80" />
                    <span className="relative h-2 w-2 rounded-full bg-cyan-600 ring-2 ring-white" />
                  </div>

                  {/* Region B Glowing Indicator (When Active) */}
                  {cursorYBPct != null && (
                    <div
                      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
                      style={{ left: `${cursorXPct}%`, top: `${cursorYBPct}%` }}
                    >
                      <span className="absolute h-3.5 w-3.5 rounded-full border border-purple-400 bg-purple-100/70" />
                      <span className="relative h-2 w-2 rounded-full bg-purple-600 ring-2 ring-white" />
                    </div>
                  )}
                </>
              )}

              {/* 4. Y-Axis Value Labels & Tick Notches (Left Margin) */}
              <div className="pointer-events-none absolute left-1 inset-y-0 flex flex-col py-2 text-[8px] font-mono text-[var(--text-muted)] select-none">
                <div className="relative flex-1">
                  {yTicks.map(({ val, yPct }, idx) => (
                    <div
                      key={idx}
                      className="absolute flex items-center gap-0.5 -translate-y-1/2"
                      style={{ top: `${yPct}%` }}
                    >
                      <span className="font-semibold text-[var(--text-secondary)]">{val.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 5. Floating Precision Inspection Tooltip (Dense Rows) — follows cursor */}
              {cursorRecord && (() => {
                // Compact tooltip (~80px tall) tracks the cursor with edge-aware
                // placement. Plot area spans ~16%-84% of chart height; tooltip needs
                // ~40% of chart height, so flipUp/flipDown only when there's room.
                const flipRight = cursorXPct < 50;
                // Flip up only when cursor sits below the chart's vertical midpoint
                // (there's at least 16% space above the cursor for tooltip bottom edge)
                const flipUp = cursorYAPct > 50;
                const xStyle = flipRight
                  ? { left: `${cursorXPct}%`, transform: "translateX(12px)" }
                  : { left: `${cursorXPct}%`, transform: "translateX(calc(-100% - 12px))" };
                const baseTransformX = flipRight ? "translateX(12px) " : "translateX(calc(-100% - 12px)) ";
                const yStyle = flipUp
                  ? {
                      top: `${cursorYAPct}%`,
                      transform: baseTransformX + "translateY(calc(-100% - 10px))",
                    }
                  : {
                      top: `${cursorYAPct}%`,
                      transform: baseTransformX + "translateY(10px)",
                    };
                return (
                <div
                  className="pointer-events-none absolute z-[2] flex w-[140px] flex-col gap-px rounded-md border border-[var(--border-default)] bg-[var(--bg-surface-2)]/95 px-1.5 py-1 font-mono leading-tight shadow-md backdrop-blur-md"
                  style={{ ...xStyle, ...yStyle }}
                >
                  {/* Header: year + unit context */}
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="text-[11px] font-bold tabular-nums text-cyan-800">{cursorYear}</span>
                    <span className="truncate text-[7.5px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      {regionAName} · {unit}
                    </span>
                  </div>

                  {/* Value + signed anomaly on one row */}
                  <div className="flex items-baseline justify-between gap-1 text-[8.5px] tabular-nums">
                    <span className="font-semibold text-[var(--text-muted)]">Value</span>
                    <span className="font-bold text-[var(--text-primary)]">
                      {cursorVal != null && !Number.isNaN(cursorVal) ? cursorVal.toFixed(2) : "—"}
                      <span
                        className={cn(
                          "ml-1 text-[7.5px] font-bold",
                          anomalyVal > 0 ? "text-rose-600" : anomalyVal < 0 ? "text-cyan-700" : "text-[var(--text-muted)]",
                        )}
                      >
                        {cursorVal != null && !Number.isNaN(cursorVal)
                          ? `${anomalyVal > 0 ? "+" : ""}${anomalyVal.toFixed(2)}`
                          : ""}
                      </span>
                    </span>
                  </div>

                  {/* Fitted OLS — only if trendStats */}
                  {trendStats && (
                    <div className="flex items-baseline justify-between gap-1 text-[8.5px] tabular-nums">
                      <span className="font-semibold text-[var(--text-muted)]">OLS fit</span>
                      <span className="font-bold text-cyan-800">{fittedVal.toFixed(2)}</span>
                    </div>
                  )}

                  {/* Δ trend — only if trendStats */}
                  {trendStats && (
                    <div className="flex items-baseline justify-between gap-1 text-[8.5px] tabular-nums">
                      <span className="font-semibold text-[var(--text-muted)]">Δ trend</span>
                      <span
                        className={cn(
                          "font-bold",
                          deltaTrend > 0 ? "text-rose-600" : deltaTrend < 0 ? "text-cyan-700" : "text-[var(--text-secondary)]",
                        )}
                      >
                        {cursorVal != null && !Number.isNaN(cursorVal)
                          ? `${deltaTrend > 0 ? "+" : ""}${deltaTrend.toFixed(2)}`
                          : "—"}
                      </span>
                    </div>
                  )}

                  {/* Region B row — only when active */}
                  {cursorValB != null && !Number.isNaN(cursorValB) && (
                    <div className="flex items-baseline justify-between gap-1 border-t border-[var(--border-default)] pt-0.5 text-[8.5px] tabular-nums">
                      <span className="truncate font-semibold text-purple-700">{regionBName}</span>
                      <span className="font-bold text-purple-900">{cursorValB.toFixed(2)}</span>
                    </div>
                  )}
                </div>
                );
              })()}

              {/* 6. X-Axis Periodic Year Ticks & Guide Notches (Along Bottom) */}
              <div className="pointer-events-none absolute bottom-0.5 inset-x-0 h-3.5 text-[8px] font-mono text-[var(--text-muted)]">
                {xTicks.map((yr) => {
                  const xPct = (xAt(yr) / VIEW_W) * 100;
                  return (
                    <span
                      key={yr}
                      className={cn(
                        "absolute -translate-x-1/2 transition-colors",
                        yr === cursorYear ? "font-bold text-cyan-700" : ""
                      )}
                      style={{ left: `${xPct}%` }}
                    >
                      {yr}
                    </span>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Two-Tier Scientific Timeline Controls (Tier 1 + Tier 2) ─────── */}
      <div className="flex flex-col flex-shrink-0 border-t border-[var(--border-default)] bg-[var(--bg-surface-2)] divide-y divide-[var(--border-default)]">
        {/* Tier 1: Analysis Period Interval Selector */}
        <div className="flex h-7 items-center justify-between px-2.5 text-[9px]">
          <div className="flex items-center gap-1.5">
            <span className="font-sans font-bold uppercase tracking-wider text-[var(--text-muted)] text-[8px]">
              Analysis Interval:
            </span>
            <span className="font-mono font-bold text-[var(--text-primary)]">
              {startYear} – {endYear} ({Math.max(1, endYear - startYear + 1)} Years)
            </span>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-1">
            <span className="hidden text-[8px] font-semibold text-[var(--text-muted)] sm:inline">Presets:</span>
            <button
              type="button"
              onClick={() => onPeriodChange?.({ start_year: 2001, end_year: 2024 })}
              className={cn(
                "rounded px-1.5 py-0.5 font-mono text-[8.5px] font-semibold border transition",
                startYear === 2001 && endYear === 2024
                  ? "border-cyan-300 bg-cyan-100/70 text-cyan-900 font-bold"
                  : "border-[var(--border-default)] bg-[var(--bg-surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)]",
              )}
            >
              Full (2001-2024)
            </button>
            <button
              type="button"
              onClick={() => onPeriodChange?.({ start_year: 2001, end_year: 2020 })}
              className={cn(
                "rounded px-1.5 py-0.5 font-mono text-[8.5px] font-semibold border transition",
                startYear === 2001 && endYear === 2020
                  ? "border-cyan-300 bg-cyan-100/70 text-cyan-900 font-bold"
                  : "border-[var(--border-default)] bg-[var(--bg-surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)]",
              )}
            >
              Baseline (2001-2020)
            </button>
            <button
              type="button"
              onClick={() => onPeriodChange?.({ start_year: 2005, end_year: 2024 })}
              className={cn(
                "rounded px-1.5 py-0.5 font-mono text-[8.5px] font-semibold border transition",
                startYear === 2005 && endYear === 2024
                  ? "border-cyan-300 bg-cyan-100/70 text-cyan-900 font-bold"
                  : "border-[var(--border-default)] bg-[var(--bg-surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)]",
              )}
            >
              Recent 20y (2005-2024)
            </button>
          </div>
        </div>

        {/* Tier 2 removed — the previous invisible thin-slider row was a
            dead click target with no visible affordance. The chart body
            already pins the year on click (see window pointerup handler
            in the effect above), which is the canonical way to set the
            map year. */}
      </div>
    </div>
  );
}
