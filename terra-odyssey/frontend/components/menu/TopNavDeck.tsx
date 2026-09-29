/**
 * TopNavDeck — Unified top-right navigation & control deck.
 *
 * Provides:
 *  - Single Plot button with Shapes icon (activates polygon study region drawing)
 *  - Clear action when a custom study region is plotted
 *  - Proportional, full-size Menu button matching topbar height (48px)
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Menu,
  Shapes,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useInvestigationState } from "@/lib/state/investigation";
import { getActivePlot } from "@/lib/storage/plot-storage";
import { cn } from "@/lib/utils";

export interface TopNavDeckProps {
  menuOpen: boolean;
  onToggleMenu: () => void;
  onClearShapes?: () => void;
  className?: string;
}

export function TopNavDeck({
  menuOpen,
  onToggleMenu,
  className,
}: TopNavDeckProps) {
  const { drawMode, setDrawMode } = useInvestigationState();
  const [hasActivePlot, setHasActivePlot] = useState(false);

  useEffect(() => {
    getActivePlot().then((p) => setHasActivePlot(Boolean(p)));

    const handleActivePlot = (e: Event) => {
      const customEvent = e as CustomEvent<{ plot: unknown }>;
      setHasActivePlot(Boolean(customEvent.detail?.plot));
    };
    const handleClear = () => setHasActivePlot(false);

    window.addEventListener("terra-odyssey:active-plot-changed", handleActivePlot);
    window.addEventListener("terra-odyssey:plot-saved", handleActivePlot);
    window.addEventListener("terra-odyssey:clear-shapes", handleClear);

    return () => {
      window.removeEventListener("terra-odyssey:active-plot-changed", handleActivePlot);
      window.removeEventListener("terra-odyssey:plot-saved", handleActivePlot);
      window.removeEventListener("terra-odyssey:clear-shapes", handleClear);
    };
  }, []);

  const isPlotting = drawMode !== "idle";

  // Cancel drawing with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isPlotting) {
        setDrawMode("idle");
        window.dispatchEvent(new CustomEvent("terra-odyssey:clear-shapes"));
        window.dispatchEvent(
          new CustomEvent("terra-odyssey:live-drawing-metrics", { detail: null }),
        );
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlotting, setDrawMode]);

  const handleTogglePlot = useCallback(() => {
    if (isPlotting) {
      setDrawMode("idle");
      window.dispatchEvent(new CustomEvent("terra-odyssey:clear-shapes"));
      window.dispatchEvent(
        new CustomEvent("terra-odyssey:live-drawing-metrics", { detail: null }),
      );
    } else {
      setDrawMode("draw-polygon-a");
    }
  }, [isPlotting, setDrawMode]);

  return (
    <div
      className={cn(
        "pointer-events-auto relative inline-flex h-12 items-center gap-1 rounded-full border border-slate-200/90 bg-white/95 px-1.5 py-1 text-slate-800 shadow-[0_8px_24px_rgba(15,23,42,0.12)] backdrop-blur-xl transition",
        className,
      )}
      role="toolbar"
      aria-label="Workspace top controls deck"
    >
      {/* ── Draw Study Region Button ── */}
      <button
        type="button"
        onClick={handleTogglePlot}
        aria-pressed={isPlotting}
        aria-label={isPlotting ? "Cancel drawing (Esc)" : "Draw study region"}
        title={isPlotting ? "Cancel drawing (Esc)" : "Draw study region"}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full border transition-all",
          isPlotting
            ? "border-cyan-400 bg-cyan-50 text-cyan-700 shadow-xs hover:bg-cyan-100"
            : hasActivePlot
              ? "border-cyan-200 bg-cyan-50/60 text-cyan-700 hover:bg-cyan-100"
              : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-900",
        )}
      >
        {isPlotting ? (
          <X className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Shapes className="h-4 w-4" aria-hidden="true" />
        )}
      </button>

      {/* ── Divider ───────────────────────────────────────────── */}
      <span className="mx-0.5 h-5 w-px bg-slate-200" aria-hidden="true" />

      {/* ── Proportional full-size Menu button ─────────────────── */}
      <button
        type="button"
        onClick={onToggleMenu}
        aria-expanded={menuOpen}
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        title={menuOpen ? "Close menu" : "Open menu"}
        className={cn(
          "flex h-9 items-center gap-2 rounded-full border px-3.5 text-xs font-semibold uppercase tracking-wider transition-all",
          menuOpen
            ? "border-cyan-300 bg-cyan-50 text-cyan-800 shadow-sm"
            : "border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-900",
        )}
      >
        <span
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded-full transition",
            menuOpen
              ? "bg-cyan-100 text-cyan-800"
              : "bg-slate-100 text-slate-700",
          )}
          aria-hidden="true"
        >
          {menuOpen ? (
            <SlidersHorizontal className="h-3 w-3" />
          ) : (
            <Menu className="h-3 w-3" />
          )}
        </span>
        <span>Menu</span>
      </button>
    </div>
  );
}
