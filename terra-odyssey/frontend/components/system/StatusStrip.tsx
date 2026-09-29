"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AlertCircle, Clock, Globe, Inbox, MapPin, RefreshCw, Server, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  subscribeErrors,
  TerraErrorEvent,
  TerraErrorKind,
} from "@/lib/telemetry/error-events";

interface ActiveBanner {
  event: TerraErrorEvent;
  visible: boolean;
}

const KIND_VISUAL: Record<
  TerraErrorKind,
  { container: string; icon: React.ReactNode; label: string }
> = {
  network: {
    container: "border-rose-300 bg-rose-50/95 text-rose-900",
    icon: <Globe className="h-3.5 w-3.5" aria-hidden="true" />,
    label: "Network",
  },
  timeout: {
    container: "border-amber-300 bg-amber-50/95 text-amber-900",
    icon: <Clock className="h-3.5 w-3.5" aria-hidden="true" />,
    label: "Timeout",
  },
  http_4xx: {
    container: "border-amber-300 bg-amber-50/95 text-amber-900",
    icon: <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />,
    label: "Request rejected",
  },
  http_5xx: {
    container: "border-rose-300 bg-rose-50/95 text-rose-900",
    icon: <Server className="h-3.5 w-3.5" aria-hidden="true" />,
    label: "Server error",
  },
  processing: {
    container: "border-slate-300 bg-slate-100/95 text-slate-800",
    icon: <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />,
    label: "Processing",
  },
  analysis_failed: {
    container: "border-rose-300 bg-rose-50/95 text-rose-900",
    icon: <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />,
    label: "Analysis failed",
  },
  tile_unavailable: {
    container: "border-slate-300 bg-slate-100/95 text-slate-800",
    icon: <MapPin className="h-3.5 w-3.5" aria-hidden="true" />,
    label: "Map tile",
  },
  no_observations: {
    container: "border-slate-300 bg-slate-100/95 text-slate-800",
    icon: <Inbox className="h-3.5 w-3.5" aria-hidden="true" />,
    label: "No data",
  },
};

/**
 * Listens to module-scoped `emitError` events and surfaces each as a
 * dismissible banner. Banners auto-collapse when the user closes them;
 * the strip is intentionally non-modal so it doesn't block investigation
 * flow during transient backend blips.
 *
 * Renders nothing when there are no active events, so mounting it once
 * at the top of the workspace is free until something goes wrong.
 */
export function StatusStrip() {
  const [banners, setBanners] = useState<ActiveBanner[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeErrors((event) => {
      setBanners((prev) => {
        // Dedupe by id: replace the existing entry so retries refresh in place.
        const filtered = prev.filter((b) => b.event.id !== event.id);
        return [...filtered, { event, visible: true }];
      });
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const handleDismiss = useCallback((id: string) => {
    setBanners((prev) => prev.filter((b) => b.event.id !== id));
  }, []);

  const handleRetry = useCallback(
    async (banner: ActiveBanner) => {
      if (!banner.event.retry) {
        handleDismiss(banner.event.id);
        return;
      }
      try {
        await banner.event.retry();
      } catch {
        // Retry handler may throw — leave the banner visible so the user sees
        // the failure rather than the banner silently disappearing.
      }
    },
    [handleDismiss],
  );

  if (banners.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="System status notifications"
      className="pointer-events-none fixed left-1/2 top-3 z-[60] flex w-full max-w-2xl -translate-x-1/2 flex-col gap-2 px-4"
    >
      {banners.map((banner) => (
        <BannerRow
          key={banner.event.id}
          banner={banner}
          onDismiss={handleDismiss}
          onRetry={handleRetry}
        />
      ))}
    </div>
  );
}

interface BannerRowProps {
  banner: ActiveBanner;
  onDismiss: (id: string) => void;
  onRetry: (banner: ActiveBanner) => void;
}

function BannerRow({ banner, onDismiss, onRetry }: BannerRowProps) {
  const [expanded, setExpanded] = useState(false);
  const visual = KIND_VISUAL[banner.event.kind];

  return (
    <div
      role={banner.event.kind === "http_5xx" || banner.event.kind === "network" ? "alert" : "status"}
      aria-live={banner.event.kind === "http_5xx" || banner.event.kind === "network" ? "assertive" : "polite"}
      className={cn(
        "pointer-events-auto rounded-lg border px-3 py-2 shadow-md backdrop-blur-sm",
        visual.container,
      )}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white/70 text-current">
          {visual.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider">
              {visual.label}
            </span>
            <p className="text-[12.5px] font-semibold leading-snug">{banner.event.message}</p>
          </div>
          {banner.event.detail ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-0.5 text-[10.5px] font-medium underline-offset-2 hover:underline"
              aria-expanded={expanded}
            >
              {expanded ? "Hide details" : "Show details"}
            </button>
          ) : null}
          {banner.event.detail && expanded ? (
            <pre className="mt-1 max-h-32 overflow-auto rounded bg-white/60 px-2 py-1.5 font-mono text-[10.5px] leading-relaxed text-slate-800">
              {banner.event.detail}
            </pre>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {banner.event.retry ? (
            <button
              type="button"
              onClick={() => onRetry(banner)}
              className="inline-flex items-center gap-1 rounded border border-current/30 bg-white/70 px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition hover:bg-white"
              aria-label={`Retry: ${banner.event.message}`}
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              Retry
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onDismiss(banner.event.id)}
            className="inline-flex h-6 w-6 items-center justify-center rounded text-current/70 transition hover:bg-white/60 hover:text-current"
            aria-label="Dismiss notification"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}