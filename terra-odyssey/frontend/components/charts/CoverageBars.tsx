"use client";

import React from "react";
import { TimeSeriesDatum, CHART_COLORS } from "@/lib/charts/d3-time-series";

interface CoverageBarsProps {
  data: TimeSeriesDatum[];
  selectedYear: number | null;
  onHoverYear?: (year: number | null) => void;
}

export const CoverageBars: React.FC<CoverageBarsProps> = ({
  data,
  selectedYear,
  onHoverYear,
}) => {
  if (!data || data.length === 0) return null;

  return (
    <div className="w-full mt-2 pt-2 border-t border-slate-800">
      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
        <span className="font-mono">Annual Valid Spatial Coverage</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
            &ge;90%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" />
            80-89%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block" />
            &lt;80%
          </span>
        </div>
      </div>

      <div className="flex items-center gap-0.5 h-4 w-full">
        {data.map((d) => {
          const covA = d.coverage_fraction_a ?? 1.0;
          const covB = d.coverage_fraction_b ?? 1.0;
          const minCov = Math.min(covA, covB);

          let bg = "bg-emerald-500/80";
          if (minCov < 0.8) {
            bg = "bg-rose-500/80";
          } else if (minCov < 0.9) {
            bg = "bg-amber-500/80";
          }

          const isSelected = selectedYear === d.year;

          return (
            <div
              key={d.year}
              className={`flex-1 h-full rounded-[1px] transition-all cursor-pointer ${bg} ${
                isSelected ? "ring-2 ring-white scale-y-125 z-10" : "hover:opacity-100 opacity-80"
              }`}
              title={`Year ${d.year}: Region A ${(covA * 100).toFixed(0)}%${
                d.region_b_value !== undefined ? `, Region B ${(covB * 100).toFixed(0)}%` : ""
              }`}
              onMouseEnter={() => onHoverYear?.(d.year)}
              onMouseLeave={() => onHoverYear?.(null)}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
        <span>{data[0]?.year}</span>
        <span>{data[data.length - 1]?.year}</span>
      </div>
    </div>
  );
};
