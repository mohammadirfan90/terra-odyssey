"use client";

import React from "react";
import type { CellInspectionResult } from "@/lib/map/cell-index";
import { Badge } from "@/components/ui/badge";
import { MapPin, X } from "lucide-react";

interface CellInspectorProps {
  inspection: CellInspectionResult | null;
  units: string;
  onClose?: () => void;
}

export function CellInspector({ inspection, units, onClose }: CellInspectorProps) {
  if (!inspection) return null;

  const isSupported = inspection.evidence_code === "supported" && inspection.is_fdr_discovery;

  return (
    <div className="absolute bottom-4 left-4 z-30 w-72 rounded-lg bg-slate-900/95 border border-slate-800 p-3 shadow-xl backdrop-blur-md text-xs font-sans">
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
        <div className="flex items-center gap-1.5 text-cyan-400 font-mono text-[11px]">
          <MapPin className="w-3.5 h-3.5" />
          <span>
            {inspection.latitude.toFixed(2)}°, {inspection.longitude.toFixed(2)}°
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="mt-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Slope:</span>
          <span className="font-mono font-medium text-slate-200">
            {inspection.slope_per_decade !== null
              ? `${inspection.slope_per_decade > 0 ? "+" : ""}${inspection.slope_per_decade.toFixed(3)} ${units}`
              : "No Data"}
          </span>
        </div>

        {inspection.slope_se_per_decade !== null && (
          <div className="flex items-center justify-between">
            <span className="text-slate-400">HAC Std Error:</span>
            <span className="font-mono text-slate-300">
              ±{inspection.slope_se_per_decade.toFixed(3)} {units}
            </span>
          </div>
        )}

        {inspection.ci_lower_per_decade !== null && inspection.ci_upper_per_decade !== null && (
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">95% HAC CI:</span>
            <span className="font-mono text-slate-300">
              [{inspection.ci_lower_per_decade.toFixed(2)}, {inspection.ci_upper_per_decade.toFixed(2)}]
            </span>
          </div>
        )}

        <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
          <span className="text-slate-400">Raw p-value:</span>
          <span className="font-mono text-slate-300">
            {inspection.raw_p_value !== null ? inspection.raw_p_value.toFixed(4) : "—"}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-400">BY-Adjusted p:</span>
          <span className="font-mono text-slate-300">
            {inspection.adjusted_p_value !== null ? inspection.adjusted_p_value.toFixed(4) : "—"}
          </span>
        </div>

        <div className="flex items-center justify-between pt-1.5">
          <span className="text-slate-400">Evidence:</span>
          <Badge
            variant={isSupported ? "supported" : "inconclusive"}
            className="text-[9px] py-0 font-mono"
          >
            {isSupported ? "FDR Discovery (BY ≤ 0.05)" : "Inconclusive"}
          </Badge>
        </div>
      </div>
    </div>
  );
}
