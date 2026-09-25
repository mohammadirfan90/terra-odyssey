"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SliderProps {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onValueChange: (val: [number, number]) => void;
  className?: string;
  disabled?: boolean;
}

export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onValueChange,
  className,
  disabled = false,
}: SliderProps) {
  const [start, end] = value;

  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = Math.min(Number(e.target.value), end - 1);
    onValueChange([newStart, end]);
  };

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEnd = Math.max(Number(e.target.value), start + 1);
    onValueChange([start, newEnd]);
  };

  return (
    <div className={cn("flex flex-col space-y-2 w-full", className)}>
      <div className="flex justify-between items-center text-xs font-mono text-slate-300">
        <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700">{start}</span>
        <span className="text-[10px] text-slate-500 uppercase tracking-widest">{end - start} Year Span</span>
        <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700">{end}</span>
      </div>
      <div className="relative h-6 flex items-center">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={start}
          disabled={disabled}
          onChange={handleStartChange}
          className="absolute w-full accent-cyan-500 bg-transparent pointer-events-auto cursor-pointer"
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={end}
          disabled={disabled}
          onChange={handleEndChange}
          className="absolute w-full accent-cyan-500 bg-transparent pointer-events-auto cursor-pointer"
        />
      </div>
    </div>
  );
}
