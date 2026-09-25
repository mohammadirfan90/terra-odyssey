"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Globe, Map as MapIcon } from "lucide-react";

interface ProjectionToggleProps {
  projection: "mercator" | "globe";
  onToggle: (proj: "mercator" | "globe") => void;
}

export function ProjectionToggle({ projection, onToggle }: ProjectionToggleProps) {
  return (
    <div className="flex items-center rounded-md bg-slate-900/90 border border-slate-800 p-0.5 shadow-md">
      <Button
        variant={projection === "mercator" ? "default" : "ghost"}
        size="sm"
        onClick={() => onToggle("mercator")}
        className={`h-7 px-2.5 text-[11px] gap-1.5 ${
          projection === "mercator" ? "bg-cyan-600 text-white" : "text-slate-400"
        }`}
      >
        <MapIcon className="w-3 h-3" />
        <span>2D Mercator</span>
      </Button>
      <Button
        variant={projection === "globe" ? "default" : "ghost"}
        size="sm"
        onClick={() => onToggle("globe")}
        className={`h-7 px-2.5 text-[11px] gap-1.5 ${
          projection === "globe" ? "bg-cyan-600 text-white" : "text-slate-400"
        }`}
      >
        <Globe className="w-3 h-3" />
        <span>3D Globe</span>
      </Button>
    </div>
  );
}
