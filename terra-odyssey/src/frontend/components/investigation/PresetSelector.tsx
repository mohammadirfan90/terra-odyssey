"use client";

import React from "react";
import type { CandidatePreset } from "@/lib/api/types";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

interface PresetSelectorProps {
  presets: CandidatePreset[];
  activePresetId?: string;
  onSelectPreset: (preset: CandidatePreset) => void;
}

export function PresetSelector({ presets, activePresetId, onSelectPreset }: PresetSelectorProps) {
  return (
    <div className="flex flex-col space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300">
        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
        <span>Predefined Candidate Contrast Pairs</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {presets.map((preset) => {
          const isActive = preset.id === activePresetId;
          return (
            <div
              key={preset.id}
              onClick={() => onSelectPreset(preset)}
              className={`p-2.5 rounded-md border text-left cursor-pointer transition-all ${
                isActive
                  ? "border-cyan-500 bg-cyan-950/30 text-slate-100"
                  : "border-slate-800 bg-slate-900/50 hover:border-slate-700 text-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-200">{preset.title}</span>
                <Badge variant="outline" className="text-[9px] text-slate-400 font-mono py-0">
                  {preset.period.start_year}–{preset.period.end_year}
                </Badge>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 line-clamp-1 italic">
                "{preset.scientific_question}"
              </p>
              <div className="flex items-center gap-2 mt-2 text-[10px] font-mono">
                <span className="text-amber-400">A: {preset.region_a.name}</span>
                {preset.region_b && (
                  <>
                    <span className="text-slate-600">vs</span>
                    <span className="text-cyan-400">B: {preset.region_b.name}</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
