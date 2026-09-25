"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Square, Trash2, Check, AlertCircle } from "lucide-react";

interface RegionDrawControlsProps {
  drawingTarget: "A" | "B" | null;
  onStartDrawing: (target: "A" | "B") => void;
  onClear: () => void;
  onConfirm: () => void;
  hasRegionA: boolean;
  hasRegionB: boolean;
  isExploratory: boolean;
}

export function RegionDrawControls({
  drawingTarget,
  onStartDrawing,
  onClear,
  onConfirm,
  hasRegionA,
  hasRegionB,
  isExploratory,
}: RegionDrawControlsProps) {
  return (
    <div className="absolute top-4 left-4 z-30 flex flex-col space-y-2 bg-slate-900/90 border border-slate-800 p-2 rounded-lg shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
        <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-300">
          Spatial Region Drawing
        </span>
        {isExploratory && (
          <Badge variant="exploratory" className="text-[9px] py-0">
            Exploratory Draw
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant={drawingTarget === "A" ? "default" : "outline"}
          size="sm"
          onClick={() => onStartDrawing("A")}
          className={`h-7 px-2.5 text-xs gap-1.5 ${
            drawingTarget === "A"
              ? "bg-amber-600 text-white"
              : hasRegionA
              ? "border-amber-500/50 text-amber-300"
              : "text-slate-300"
          }`}
        >
          <Square className="w-3 h-3" />
          <span>Draw Region A</span>
          {hasRegionA && <span className="ml-1 text-[9px] text-amber-400 font-mono font-bold">✓</span>}
        </Button>

        <Button
          variant={drawingTarget === "B" ? "default" : "outline"}
          size="sm"
          onClick={() => onStartDrawing("B")}
          className={`h-7 px-2.5 text-xs gap-1.5 ${
            drawingTarget === "B"
              ? "bg-cyan-600 text-white"
              : hasRegionB
              ? "border-cyan-500/50 text-cyan-300"
              : "text-slate-300"
          }`}
        >
          <Square className="w-3 h-3" />
          <span>Draw Region B</span>
          {hasRegionB && <span className="ml-1 text-[9px] text-cyan-400 font-mono font-bold">✓</span>}
        </Button>

        {(hasRegionA || hasRegionB) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-7 w-7 p-0 text-slate-400 hover:text-rose-400"
            title="Clear Drawn Regions"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {isExploratory && (
        <div className="flex items-start gap-1 text-[10px] text-purple-300/90 max-w-[280px] leading-tight pt-1">
          <AlertCircle className="w-3 h-3 shrink-0 mt-0.5 text-purple-400" />
          <span>
            Post-screening draw: paired contrast p-value will be reported without multiple-testing adjustment.
          </span>
        </div>
      )}
    </div>
  );
}
