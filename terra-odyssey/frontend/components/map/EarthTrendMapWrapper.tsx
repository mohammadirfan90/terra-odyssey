"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type { StructuredGridMapResponse } from "@/lib/api/types";

function MapLoadingSkeleton() {
  return (
    <div className="w-full h-[540px] rounded-lg border border-slate-800 bg-slate-950 flex flex-col items-center justify-center space-y-3">
      <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">
        Initializing WebGL MapLibre Engine...
      </span>
    </div>
  );
}

const EarthTrendMapDynamic = dynamic(() => import("./EarthTrendMap"), {
  ssr: false,
  loading: () => <MapLoadingSkeleton />,
});

interface EarthTrendMapWrapperProps {
  gridData?: StructuredGridMapResponse | null;
  regionA?: [number, number, number, number] | null;
  regionB?: [number, number, number, number] | null;
  onUpdateRegions?: (
    regionA: [number, number, number, number],
    regionB: [number, number, number, number] | null,
    selectionMeta: any
  ) => void;
  className?: string;
}

export function EarthTrendMapWrapper(props: EarthTrendMapWrapperProps) {
  return <EarthTrendMapDynamic {...props} />;
}
