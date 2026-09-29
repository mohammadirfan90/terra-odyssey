/**
 * Compact horizontal area-tool picker used inside the ActivityDock.
 *
 * Re-encodes `components/menu/sections/AreaSection.tsx` as a flat strip:
 * three shape buttons (rectangle / polygon / circle) and a Plot / Measure
 * toggle. When the user is actively drawing, the shape buttons highlight
 * and a "Stop" chip appears at the end of the strip.
 *
 * Reuses the same store field (`useInvestigationState().drawMode`) and
 * dispatches the same window events (`terra-odyssey:clear-shapes`) that
 * the menu version did, so existing handlers in `app/page.tsx` keep
 * working without any change.
 */

"use client";

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

const PLOT_CHOICES: Record<PlotKind, { id: DrawMode; Icon: typeof Square; label: string }> = {
  rectangle: { id: "draw-rectangle-a", Icon: Square, label: "Rect" },
  polygon: { id: "draw-polygon-a", Icon: Pentagon, label: "Poly" },
  circle: { id: "draw-circle-a", Icon: CircleIcon, label: "Circ" },
};

const MEASURE_CHOICES: Record<PlotKind, { id: DrawMode; Icon: typeof Square; label: string }> = {
  rectangle: { id: "measure-line", Icon: Ruler, label: "Line" },
  polygon: { id: "measure-polygon", Icon: Pencil, label: "Area" },
  circle: { id: "measure-circle", Icon: CircleIcon, label: "Rad" },
};

export interface DockAreaToolsProps {
  className?: string;
}

export function DockAreaTools({ className }: DockAreaToolsProps) {
  const { drawMode, setDrawMode } = useInvestigationState();

  // Infer mode/kind from current drawMode.
  let mode: Mode = "plot";
  let kind: PlotKind = "rectangle";
  if (drawMode.startsWith("measure-")) {
    mode = "measure";
    if (drawMode === "measure-line") kind = "rectangle";
    else if (drawMode === "measure-polygon") kind = "polygon";
    else kind = "circle";
  } else if (drawMode !== "idle") {
    mode = "plot";
    if (drawMode === "draw-polygon-a") kind = "polygon";
    else if (drawMode === "draw-circle-a") kind = "circle";
    else kind = "rectangle";
  }

  const isDrawing = drawMode !== "idle";

  const handlePickShape = (nextKind: PlotKind) => {
    const id =
      mode === "plot"
        ? PLOT_CHOICES[nextKind].id
        : MEASURE_CHOICES[nextKind].id;
    setDrawMode(id);
  };

  const handlePickMode = (nextMode: Mode) => {
    const id =
      nextMode === "plot"
        ? PLOT_CHOICES[kind].id
        : MEASURE_CHOICES[kind].id;
    setDrawMode(id);
  };

  const handleCancel = () => {
    setDrawMode("idle");
    window.dispatchEvent(new CustomEvent("terra-odyssey:clear-shapes"));
    window.dispatchEvent(
      new CustomEvent("terra-odyssey:live-drawing-metrics", { detail: null }),
    );
  };

  const ring = mode === "plot" ? "border-cyan-300" : "border-amber-300";
  const activeBg =
    mode === "plot"
      ? "border-cyan-400 bg-cyan-50 text-cyan-700 shadow-sm"
      : "border-amber-400 bg-amber-50 text-amber-700 shadow-sm";

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {/* Mode toggle */}
      <div
        role="radiogroup"
        aria-label="Area tool mode"
        className="flex items-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface-2)]/90 p-0.5 shadow-inner"
      >
        <ModeChip
          active={mode === "plot"}
          onClick={() => handlePickMode("plot")}
          label="Plot"
        />
        <ModeChip
          active={mode === "measure"}
          onClick={() => handlePickMode("measure")}
          label="Measure"
        />
      </div>

      {/* Shape buttons */}
      <div className="flex items-center gap-0.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface-2)]/90 p-0.5 shadow-inner">
        {(Object.keys(PLOT_CHOICES) as PlotKind[]).map((k) => {
          const choice =
            mode === "plot" ? PLOT_CHOICES[k] : MEASURE_CHOICES[k];
          const active = kind === k && isDrawing;
          const Icon = choice.Icon;
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={choice.label}
              onClick={() => handlePickShape(k)}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-lg border transition",
                active
                  ? activeBg
                  : cn(
                      "border-transparent text-[var(--text-secondary)] hover:border-[var(--border-default)] hover:bg-[var(--bg-surface-2)] hover:text-[var(--text-primary)]",
                    ),
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          );
        })}
      </div>

      {/* Status / Stop */}
      <div className={cn("flex h-7 items-center rounded-lg border px-2", ring, "border-dashed bg-[var(--bg-surface-2)] text-[10px] text-[var(--text-muted)] shadow-sm")}>
        {isDrawing ? (
          <button
            type="button"
            onClick={handleCancel}
            className="flex items-center gap-1 rounded-md border border-rose-300 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 transition hover:bg-rose-100 hover:text-rose-900"
            aria-label="Stop drawing"
          >
            <X className="h-3 w-3" aria-hidden="true" />
            Stop
          </button>
        ) : (
          <span>Idle</span>
        )}
      </div>
    </div>
  );
}

function ModeChip({
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
        "rounded-lg px-2.5 py-1 text-[10.5px] font-semibold transition",
        active
          ? "bg-[var(--bg-surface-2)] text-cyan-800 shadow-sm border border-[var(--border-default)]/80"
          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)]/50",
      )}
    >
      {label}
    </button>
  );
}