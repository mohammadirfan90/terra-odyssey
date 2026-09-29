/**
 * DockEvidenceCard — Statistical Evidence & Session Activity Card for ActivityDock.
 *
 * Provides a dual-mode instrument panel:
 *   1. "Evidence" (default): Authoritative Earth system trend statistics
 *      (Decadal slope, 95% CI, HAC p-value, fitted change, scientific caveats).
 *   2. "Session Log": Activity counts and interactive Undo history.
 *
 * Strictly adheres to `docs/SCIENTIFIC_RULES.md` and `docs/UX_SPEC.md`.
 */

"use client";

import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Database,
  Eraser,
  HelpCircle,
  History,
  RotateCcw,
  Scale,
  ShieldCheck,
  Sigma,
  SlidersHorizontal,
  Square,
  TrendingUp,
} from "lucide-react";
import type { EvidencePayload, ScientificResultItem } from "@/lib/api/types";
import {
  type ActivityAccent,
  type ActivityEntry,
  type ActivityKind,
} from "@/lib/state/activity-log";
import { cn } from "@/lib/utils";

export interface DockEvidenceCardProps {
  evidence: EvidencePayload | null | undefined;
  isLoading?: boolean;
  isComputing?: boolean;
  counts: Record<ActivityKind, number>;
  log: readonly ActivityEntry[];
  onUndo: (entry: ActivityEntry) => void;
  datasetTitle?: string;
  variableName?: string;
  className?: string;
}

export function DockEvidenceCard({
  evidence,
  isLoading = false,
  isComputing = false,
  counts,
  log,
  onUndo,
  datasetTitle,
  variableName,
  className,
}: DockEvidenceCardProps) {
  const [activeTab, setActiveTab] = useState<"evidence" | "activity">("evidence");

  const primaryResult: ScientificResultItem | null =
    evidence?.results && evidence.results.length > 0
      ? evidence.results[0]
      : null;

  const resultStatus = evidence?.result_status ?? null;
  const isSupported = resultStatus === "supported";
  const isInconclusive = resultStatus === "inconclusive";

  const slope = primaryResult?.effect?.estimate ?? null;
  const unitPerDecade = primaryResult?.effect?.unit_per_decade ?? "per decade";
  const fittedChange = primaryResult?.effect?.fitted_change ?? null;
  const pValue = primaryResult?.uncertainty?.p_value ?? null;
  const ci95 = primaryResult?.uncertainty?.ci_95 ?? null;
  const caveats = primaryResult?.caveats ?? [];

  const isWarming = slope != null && slope > 0;
  const isCooling = slope != null && slope < 0;

  return (
    <div className={cn("flex h-full min-h-0 min-w-0 flex-col", className)}>
      {/* ── Header with Tab Switcher ───────────────────────────────────── */}
      <div className="flex h-8 flex-shrink-0 items-center justify-between border-b border-white/[0.06] bg-[var(--bg-surface-2)] px-2.5">
        <div className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-md border border-emerald-400/40 bg-emerald-500/15 text-emerald-300">
            {activeTab === "evidence" ? (
              <Scale className="h-3 w-3" />
            ) : (
              <History className="h-3 w-3" />
            )}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
            {activeTab === "evidence" ? "Trend Evidence" : "Session Activity"}
          </span>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center rounded-lg border border-white/10 bg-[var(--bg-surface-2)] p-0.5">
          <button
            type="button"
            onClick={() => setActiveTab("evidence")}
            className={cn(
              "rounded-md px-2 py-0.5 text-[9.5px] font-semibold transition",
              activeTab === "evidence"
                ? "bg-emerald-500/20 text-emerald-200 shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
            )}
          >
            Evidence
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("activity")}
            className={cn(
              "flex items-center gap-1 rounded-md px-2 py-0.5 text-[9.5px] font-semibold transition",
              activeTab === "activity"
                ? "bg-cyan-500/20 text-cyan-200 shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
            )}
          >
            <span>Log</span>
            {log.length > 0 && (
              <span className="rounded-full bg-[var(--bg-elevated)] px-1 font-mono text-[8px] text-cyan-300">
                {log.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Tab Content: Scientific Evidence (Default) ──────────────────── */}
      {activeTab === "evidence" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2.5 py-1.5">
          {isComputing || isLoading ? (
            /* Computing state */
            <div className="flex h-full flex-col items-center justify-center space-y-2 p-2 text-center">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/10 text-emerald-300 animate-pulse">
                <Sigma className="h-3.5 w-3.5" />
              </div>
              <div className="text-[10px] font-semibold text-[var(--text-muted)]">
                Evaluating Statistical Estimand
              </div>
              <div className="text-[9px] text-[var(--text-muted)]">
                Running OLS with Newey-West HAC covariance...
              </div>
            </div>
          ) : primaryResult ? (
            /* Evidence available */
            <div className="space-y-1.5">
              {/* Primary Stat Banner */}
              <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-[var(--bg-surface-2)] p-2 shadow-sm">
                <div>
                  <div className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Decadal Slope (OLS · HAC)
                  </div>
                  <div className="mt-0.5 flex items-baseline gap-1.5">
                    <span
                      className={cn(
                        "font-mono text-base font-extrabold tracking-tight",
                        isWarming
                          ? "text-rose-300"
                          : isCooling
                            ? "text-cyan-300"
                            : "text-[var(--text-secondary)]",
                      )}
                    >
                      {slope != null
                        ? `${slope > 0 ? "+" : ""}${slope.toFixed(3)}`
                        : "—"}
                    </span>
                    <span className="text-[10px] font-medium text-[var(--text-muted)]">
                      {unitPerDecade}
                    </span>
                  </div>
                </div>

                {/* Verdict Badge */}
                <div className="flex flex-col items-end gap-1">
                  {isSupported ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      Significant
                    </span>
                  ) : isInconclusive ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">
                      <HelpCircle className="h-2.5 w-2.5" />
                      Inconclusive
                    </span>
                  ) : null}

                  {slope != null && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 text-[9px] font-semibold",
                        isWarming ? "text-rose-400" : "text-cyan-400",
                      )}
                    >
                      {isWarming ? (
                        <>
                          <ArrowUpRight className="h-3 w-3" /> Upward Trend
                        </>
                      ) : (
                        <>
                          <ArrowDownRight className="h-3 w-3" /> Downward Trend
                        </>
                      )}
                    </span>
                  )}
                </div>
              </div>

              {/* 4-Cell Telemetry Grid */}
              <div className="grid grid-cols-2 gap-1.5">
                {/* 95% Confidence Interval */}
                <div className="rounded-lg border border-white/[0.06] bg-[var(--bg-surface-2)] p-1.5">
                  <div className="text-[8.5px] uppercase tracking-wider text-[var(--text-muted)]">
                    95% Confidence Interval
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] font-bold text-[var(--text-secondary)]">
                    {ci95 ? `[${ci95[0].toFixed(2)}, ${ci95[1].toFixed(2)}]` : "—"}
                  </div>
                  <div className="text-[8px] text-[var(--text-muted)]">HAC serial robust</div>
                </div>

                {/* P-Value */}
                <div className="rounded-lg border border-white/[0.06] bg-[var(--bg-surface-2)] p-1.5">
                  <div className="text-[8.5px] uppercase tracking-wider text-[var(--text-muted)]">
                    Significance (p)
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] font-bold text-[var(--text-secondary)]">
                    {pValue != null
                      ? pValue < 0.001
                        ? "p < 0.001"
                        : `p = ${pValue.toFixed(4)}`
                      : "—"}
                  </div>
                  <div className="text-[8px] text-[var(--text-muted)]">FDR q=0.05 policy</div>
                </div>

                {/* Total Fitted Change */}
                <div className="rounded-lg border border-white/[0.06] bg-[var(--bg-surface-2)] p-1.5">
                  <div className="text-[8.5px] uppercase tracking-wider text-[var(--text-muted)]">
                    Total Fitted Change
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] font-bold text-[var(--text-secondary)]">
                    {fittedChange != null
                      ? `${fittedChange > 0 ? "+" : ""}${fittedChange.toFixed(2)}`
                      : "—"}
                  </div>
                  <div className="text-[8px] text-[var(--text-muted)]">Cumulative interval</div>
                </div>

                {/* Aggregation */}
                <div className="rounded-lg border border-white/[0.06] bg-[var(--bg-surface-2)] p-1.5">
                  <div className="text-[8.5px] uppercase tracking-wider text-[var(--text-muted)]">
                    Spatial Support
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[10px] font-bold text-[var(--text-secondary)]">
                    Area-weighted
                  </div>
                  <div className="text-[8px] text-[var(--text-muted)]">Cosine lat weighting</div>
                </div>
              </div>

              {/* Scientific Caveat Banner */}
              <div className="rounded-lg border border-white/[0.06] bg-[var(--bg-surface-2)] px-2 py-1 text-[8.5px] text-[var(--text-muted)]">
                <span className="font-semibold text-[var(--text-muted)]">Caveat:</span>{" "}
                {caveats.length > 0
                  ? caveats[0]
                  : "MERRA-2 Reanalysis is a model-data assimilation product, not a direct satellite measurement."}
              </div>
            </div>
          ) : (
            /* Idle: Declared Estimand Blueprint */
            <div className="space-y-1.5 text-left">
              <div className="rounded-xl border border-white/[0.07] bg-[var(--bg-surface-2)] p-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Investigation Estimand
                  </span>
                  <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-1 font-mono text-[8.5px] text-cyan-300">
                    HAC OLS
                  </span>
                </div>
                <div className="mt-1 text-[10px] text-[var(--text-muted)]">
                  Calculates decadal rate with autocorrelation-aware standard errors
                  over complete calendar years.
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1 text-[9px] text-[var(--text-muted)]">
                <div className="rounded-lg border border-white/[0.05] bg-[var(--bg-surface-2)] p-1.5">
                  <span className="text-[var(--text-muted)]">Temporal:</span> Annual Mean
                </div>
                <div className="rounded-lg border border-white/[0.05] bg-[var(--bg-surface-2)] p-1.5">
                  <span className="text-[var(--text-muted)]">Spatial:</span> Area-Weighted
                </div>
                <div className="rounded-lg border border-white/[0.05] bg-[var(--bg-surface-2)] p-1.5">
                  <span className="text-[var(--text-muted)]">FDR Family:</span> Declared
                </div>
                <div className="rounded-lg border border-white/[0.05] bg-[var(--bg-surface-2)] p-1.5">
                  <span className="text-[var(--text-muted)]">Null H₀:</span> β = 0
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── Tab Content: Session Activity & Undo ────────────────────────── */
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2.5 py-1.5 space-y-1.5">
          {/* Category Bars */}
          <div className="space-y-1">
            {ROWS.map((row) => {
              const max = Math.max(1, ...Object.values(counts));
              const value = counts[row.kind] ?? 0;
              const pct = Math.round((value / max) * 100);
              const accent = ACCENT_CLASS[row.accent];
              return (
                <div key={row.kind} className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border",
                      accent.chip,
                    )}
                    aria-hidden="true"
                  >
                    <row.Icon className="h-2.5 w-2.5" />
                  </span>
                  <span className="w-14 text-[9.5px] uppercase tracking-wider text-[var(--text-muted)]">
                    {row.label}
                  </span>
                  <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-[var(--bg-surface-2)]">
                    <div
                      className={cn("h-full rounded-full transition-all", accent.bar)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-4 text-right font-mono text-[9.5px] font-bold tabular-nums text-[var(--text-secondary)]">
                    {value}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Undo Log (Latest actions) */}
          <div className="border-t border-white/[0.06] pt-1">
            <div className="mb-1 text-[8.5px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Recent Actions & Undo
            </div>
            {log.length === 0 ? (
              <div className="text-[9px] text-[var(--text-muted)]">No session actions yet</div>
            ) : (
              <div className="max-h-20 space-y-1 overflow-y-auto">
                {log.slice(0, 4).map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-[var(--bg-surface-2)] px-2 py-0.5 text-[9px]"
                  >
                    <span className="truncate text-[var(--text-muted)]">{entry.label}</span>
                    <button
                      type="button"
                      onClick={() => onUndo(entry)}
                      className="ml-2 flex items-center gap-0.5 text-cyan-400 hover:text-cyan-200"
                      title="Undo this action"
                    >
                      <RotateCcw className="h-2.5 w-2.5" />
                      Undo
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const ROWS: {
  kind: ActivityKind;
  label: string;
  accent: ActivityAccent;
  Icon: typeof Database;
}[] = [
  { kind: "dataset", label: "Datasets", accent: "cyan", Icon: Database },
  { kind: "variable", label: "Variables", accent: "purple", Icon: Sigma },
  { kind: "custom", label: "Custom", accent: "amber", Icon: SlidersHorizontal },
  { kind: "region", label: "Regions", accent: "emerald", Icon: Square },
  { kind: "clear", label: "Clears", accent: "rose", Icon: Eraser },
];

const ACCENT_CLASS: Record<
  ActivityAccent,
  { chip: string; bar: string; ink: string }
> = {
  cyan: {
    chip: "border-cyan-400/40 bg-cyan-500/15 text-cyan-200",
    bar: "bg-gradient-to-r from-cyan-500/70 to-cyan-400",
    ink: "text-cyan-200",
  },
  purple: {
    chip: "border-purple-400/40 bg-purple-500/15 text-purple-200",
    bar: "bg-gradient-to-r from-purple-500/70 to-purple-400",
    ink: "text-purple-200",
  },
  amber: {
    chip: "border-amber-400/40 bg-amber-500/15 text-amber-200",
    bar: "bg-gradient-to-r from-amber-500/70 to-amber-400",
    ink: "text-amber-200",
  },
  rose: {
    chip: "border-rose-400/40 bg-rose-500/15 text-rose-200",
    bar: "bg-gradient-to-r from-rose-500/70 to-rose-400",
    ink: "text-rose-200",
  },
  emerald: {
    chip: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
    bar: "bg-gradient-to-r from-emerald-500/70 to-emerald-400",
    ink: "text-emerald-200",
  },
  slate: {
    chip: "border-[var(--border-strong)] bg-[var(--bg-surface-2)] text-[var(--text-muted)]",
    bar: "bg-gradient-to-r from-slate-600 to-slate-500",
    ink: "text-[var(--text-muted)]",
  },
};
