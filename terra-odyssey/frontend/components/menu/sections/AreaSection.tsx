/**
 * Area tools — one customizable picker. The main button opens a small
 * menu where the user can choose a shape (Rectangle / Polygon / Circle)
 * and toggle whether the shape is a "plot" (sets region + re-runs) or a
 * "measure" (read-only readout).
 *
 * The actual map interaction is driven by `useInvestigationState().drawMode`,
 * which the Map component listens for.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import {
  Circle as CircleIcon,
  Pencil,
  Pentagon,
  Ruler,
  Square,
  X,
} from "lucide-react";
import {
  type DrawMode,
  useInvestigationState,
} from "@/lib/state/investigation";
import { cn } from "@/lib/utils";

type PlotKind = "rectangle" | "polygon" | "circle";
type Mode = "plot" | "measure";

interface Choice {
  id: DrawMode;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const PLOT_CHOICES: Record<PlotKind, Choice> = {
  rectangle: {
    id: "draw-rectangle-a",
    label: "Rectangle",
    Icon: Square,
  },
  polygon: {
    id: "draw-polygon-a",
    label: "Polygon",
    Icon: Pentagon,
  },
  circle: {
    id: "draw-circle-a",
    label: "Circle",
    Icon: CircleIcon,
  },
};

const MEASURE_CHOICES: Record<PlotKind, Choice> = {
  rectangle: { id: "measure-line", label: "Line (2 clicks)", Icon: Ruler },
  polygon: { id: "measure-polygon", label: "Polygon area", Icon: Pencil },
  circle: { id: "measure-circle", label: "Circle radius", Icon: CircleIcon },
};

export interface AreaSectionProps {
  /** Called when the user finishes drawing a plot shape. */
  onPlotComplete: (bbox: [number, number, number, number], target: "A" | "B") => void;
  /** Called when the user finishes a measure shape. */
  onMeasureComplete?: (mode: DrawMode) => void;
}

export function AreaSection({
  onPlotComplete,
  onMeasureComplete,
}: AreaSectionProps) {
  const drawMode = useInvestigationState().drawMode;
  const setDrawMode = useInvestigationState().setDrawMode;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("plot");
  const [kind, setKind] = useState<PlotKind>("rectangle");
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close picker on outside click.
  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        popoverRef.current?.contains(target) ||
        buttonRef.current?.contains(target)
      ) {
        return;
      }
      setPickerOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pickerOpen]);

  const activeChoice: Choice =
    mode === "plot" ? PLOT_CHOICES[kind] : MEASURE_CHOICES[kind];

  const handlePickShape = (nextKind: PlotKind) => {
    setKind(nextKind);
    const id =
      mode === "plot" ? PLOT_CHOICES[nextKind].id : MEASURE_CHOICES[nextKind].id;
    setDrawMode(id);
    setPickerOpen(false);
  };

  const handlePickMode = (nextMode: Mode) => {
    setMode(nextMode);
    const id =
      nextMode === "plot" ? PLOT_CHOICES[kind].id : MEASURE_CHOICES[kind].id;
    setDrawMode(id);
  };

  const handleCancel = () => {
    setDrawMode("idle");
    setPickerOpen(false);
    window.dispatchEvent(new CustomEvent("terra-odyssey:clear-shapes"));
    window.dispatchEvent(
      new CustomEvent("terra-odyssey:live-drawing-metrics", { detail: null }),
    );
  };

  const isDrawing = drawMode !== "idle";
  const ActiveIcon = activeChoice.Icon;

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          aria-expanded={pickerOpen}
          aria-haspopup="dialog"
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-xl border bg-slate-900/60 px-2.5 py-2 text-left transition",
            isDrawing
              ? mode === "plot"
                ? "border-cyan-400/60 bg-cyan-500/10 text-cyan-100 ring-1 ring-cyan-400/30"
                : "border-amber-400/60 bg-amber-500/10 text-amber-100 ring-1 ring-amber-400/30"
              : "border-white/10 hover:border-white/25 hover:bg-slate-900/80",
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border",
                isDrawing
                  ? mode === "plot"
                    ? "border-cyan-400/40 bg-cyan-500/20 text-cyan-200"
                    : "border-amber-400/40 bg-amber-500/20 text-amber-200"
                  : "border-white/10 bg-slate-800 text-slate-300",
              )}
              aria-hidden="true"
            >
              <ActiveIcon className="h-3 w-3" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-[11px] font-semibold text-slate-100">
                {isDrawing ? activeChoice.label : "Choose shape"}
              </div>
              <div className="mt-0.5 truncate text-[10px] text-slate-500">
                {isDrawing
                  ? mode === "plot"
                    ? "Drawing — sets region"
                    : "Measuring — read-only"
                  : "Draw to set area or measure"}
              </div>
            </div>
          </div>
          {isDrawing && (
            <div
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                handleCancel();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  handleCancel();
                }
              }}
              className="flex items-center gap-1 rounded-md border border-rose-500/60 bg-rose-500/25 px-2 py-0.5 text-[10px] font-semibold text-rose-200 transition hover:bg-rose-500/40 hover:text-white"
              title="Stop plotting"
            >
              <X className="h-3 w-3" />
              <span>Stop</span>
            </div>
          )}
        </button>

        {pickerOpen ? (
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Area tool picker"
            className="absolute left-0 right-0 top-[calc(100%+4px)] z-40 space-y-1.5 rounded-xl border border-white/10 bg-slate-950/95 p-2 shadow-2xl backdrop-blur-2xl"
          >
            <div>
              <h4 className="mb-1 px-1 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Mode
              </h4>
              <div
                role="radiogroup"
                aria-label="Area tool mode"
                className="grid grid-cols-2 gap-0.5 rounded-xl border border-white/[0.07] bg-slate-900/40 p-0.5"
              >
                <ModeOption
                  active={mode === "plot"}
                  onClick={() => handlePickMode("plot")}
                  label="Plot"
                />
                <ModeOption
                  active={mode === "measure"}
                  onClick={() => handlePickMode("measure")}
                  label="Measure"
                />
              </div>
            </div>

            <div>
              <h4 className="mb-1 px-1 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Shape
              </h4>
              <div className="grid grid-cols-3 gap-1">
                {(Object.keys(PLOT_CHOICES) as PlotKind[]).map((k) => {
                  const choice =
                    mode === "plot" ? PLOT_CHOICES[k] : MEASURE_CHOICES[k];
                  const active = kind === k;
                  const Icon = choice.Icon;
                  return (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => handlePickShape(k)}
                      className={cn(
                        "flex flex-col items-center gap-0.5 rounded-lg border px-1.5 py-1.5 text-[10px] font-medium transition",
                        active
                          ? mode === "plot"
                            ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-200 shadow-inner"
                            : "border-amber-400/60 bg-amber-500/15 text-amber-200 shadow-inner"
                          : "border-white/[0.07] bg-slate-900/50 text-slate-300 hover:border-white/20 hover:bg-slate-900/80",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{choice.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end pt-0.5">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-md px-2 py-1 text-[10px] font-semibold text-slate-400 hover:bg-white/5 hover:text-slate-200"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ModeOption({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "rounded-full px-1.5 py-1 text-[10.5px] font-semibold transition-all",
        active
          ? "bg-cyan-500/20 text-cyan-200 shadow-inner"
          : "text-slate-300 hover:bg-white/[0.04] hover:text-slate-100",
      )}
    >
      {label}
    </button>
  );
}
