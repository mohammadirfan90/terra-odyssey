"use client";

import React from "react";
import { RangeSlider } from "@/components/ui/slider";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface PeriodSelectorProps {
  minYear: number;
  maxYear: number;
  value: [number, number];
  onChange: (val: [number, number]) => void;
}

export function PeriodSelector({ minYear, maxYear, value, onChange }: PeriodSelectorProps) {
  const [start, end] = value;
  const span = end - start;
  const isValid = span >= 20;

  return (
    <div className="flex flex-col space-y-2 p-3 rounded-md bg-slate-900/60 border border-slate-800">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
          Investigation Interval
        </label>
        <div className="flex items-center gap-1.5">
          {isValid ? (
            <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
              <CheckCircle2 className="w-3.5 h-3.5" /> {span} yrs (Eligible)
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-rose-400 font-mono">
              <AlertCircle className="w-3.5 h-3.5" /> {span} yrs (Must be ≥ 20 yrs)
            </span>
          )}
        </div>
      </div>

      <RangeSlider
        min={minYear}
        max={maxYear}
        value={value}
        onValueChange={onChange}
      />

      <p className="text-[10px] text-slate-400 italic">
        NASA Space Apps standard: trend inference requires at least 20 consecutive annual observations to detect climatic shifts from interannual modes.
      </p>
    </div>
  );
}
