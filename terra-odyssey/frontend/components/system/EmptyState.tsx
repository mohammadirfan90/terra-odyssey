"use client";

import React from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** Optional action row, e.g. { label, onClick, ariaLabel }. */
  action?: { label: string; onClick: () => void; ariaLabel?: string };
  /** Optional secondary action. */
  secondary?: { label: string; onClick: () => void; ariaLabel?: string };
  className?: string;
}

/**
 * Standardized empty-state surface used by the chart, evidence panel,
 * and map toolbox. Communicates "nothing to display yet" without
 * implying failure.
 */
export function EmptyState({ title, description, action, secondary, className }: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-6 py-10 text-center",
        className,
      )}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-slate-500 shadow-sm">
        <Info className="h-4 w-4" aria-hidden="true" />
      </div>
      <p className="text-[12.5px] font-semibold text-slate-800">{title}</p>
      {description ? (
        <p className="max-w-[320px] text-[11.5px] leading-relaxed text-slate-600">
          {description}
        </p>
      ) : null}
      {(action || secondary) && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              aria-label={action.ariaLabel ?? action.label}
              className="inline-flex items-center gap-1.5 rounded-md border border-cyan-300 bg-cyan-50 px-3 py-1.5 text-[11px] font-semibold text-cyan-800 transition hover:border-cyan-400 hover:bg-cyan-100 shadow-sm"
            >
              {action.label}
            </button>
          )}
          {secondary && (
            <button
              type="button"
              onClick={secondary.onClick}
              aria-label={secondary.ariaLabel ?? secondary.label}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 shadow-sm"
            >
              {secondary.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
