"use client";

import React from "react";
import { AlertCircle, CheckCircle2, Info, Loader2, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusPillKind = "loading" | "ready" | "error" | "empty" | "partial" | "info";

export interface StatusPillProps {
  kind: StatusPillKind;
  label: string;
  detail?: string;
  /** Optional retry handler — pill renders a Retry chip when present. */
  onRetry?: () => void;
  /** Renders the pill slightly larger (used in panel headers). */
  size?: "sm" | "md";
  className?: string;
}

const KIND_STYLES: Record<
  StatusPillKind,
  { container: string; icon: React.ReactNode; ariaRole: "status" | "alert" | "progressbar" }
> = {
  loading: {
    container:
      "border-cyan-200 bg-cyan-50 text-cyan-900",
    icon: <Loader2 className="h-3 w-3 animate-spin text-cyan-600" aria-hidden="true" />,
    ariaRole: "progressbar",
  },
  ready: {
    container: "border-emerald-300/70 bg-emerald-50/90 text-emerald-900",
    icon: <CheckCircle2 className="h-3 w-3" aria-hidden="true" />,
    ariaRole: "status",
  },
  empty: {
    container: "border-slate-300 bg-slate-100/90 text-slate-700",
    icon: <Info className="h-3 w-3" aria-hidden="true" />,
    ariaRole: "status",
  },
  partial: {
    container: "border-amber-300/70 bg-amber-50/90 text-amber-900",
    icon: <TriangleAlert className="h-3 w-3" aria-hidden="true" />,
    ariaRole: "status",
  },
  error: {
    container: "border-rose-300 bg-rose-50/95 text-rose-900",
    icon: <AlertCircle className="h-3 w-3" aria-hidden="true" />,
    ariaRole: "alert",
  },
  info: {
    container: "border-slate-300 bg-slate-100/90 text-slate-700",
    icon: <Info className="h-3 w-3" aria-hidden="true" />,
    ariaRole: "status",
  },
};

export function StatusPill({
  kind,
  label,
  detail,
  onRetry,
  size = "sm",
  className,
}: StatusPillProps) {
  const style = KIND_STYLES[kind];
  const iconSize = size === "md" ? "h-3.5 w-3.5" : "h-3 w-3";
  return (
    <div
      role={style.ariaRole}
      aria-live={kind === "loading" || kind === "error" ? "polite" : "off"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-mono font-semibold tracking-wide",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]",
        style.container,
        className,
      )}
    >
      <span className={cn("inline-flex items-center justify-center", iconSize)}>
        {React.cloneElement(
          style.icon as React.ReactElement<{ className?: string }>,
          {
            className: cn(
              ((style.icon as React.ReactElement<{ className?: string }>).props.className ?? ""),
              iconSize,
            ),
          },
        )}
      </span>
      <span className="whitespace-nowrap">{label}</span>
      {detail ? (
        <span className="font-sans font-normal opacity-80">· {detail}</span>
      ) : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="ml-1 inline-flex items-center gap-0.5 rounded border border-current/20 bg-white/50 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider transition hover:bg-white/80"
          aria-label={`Retry ${label}`}
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
