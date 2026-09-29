"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type { StructuredGridMapResponse } from "@/lib/api/types";

function MapLoadingSkeleton() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100">
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-full bg-cyan-500/20" />
        <Loader2 className="relative h-10 w-10 text-cyan-600 animate-spin" />
      </div>
      <span className="text-[11px] font-mono text-slate-600 uppercase tracking-[0.18em]">
        Initializing WebGL MapLibre Engine…
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
  /**
   * Receives the live MapLibre instance once it's available (and `null`
   * when the map unmounts). Lets external UI like the search bar drive
   * the camera without coupling to the inner `<Map>` context.
   */
  onMapInstanceChange?: (map: import("maplibre-gl").Map | null) => void;
  className?: string;
  bottomOffset?: number;
  /**
   * When false (the default), the NASA GIBS satellite observation layer
   * and the active-region overlays stay hidden. Page flips this to true
   * only after the user has explicitly picked a dataset/variable so the
   * workspace loads in a clean "select a dataset to begin" state.
   */
  hasUserInitiated?: boolean;
}

export function EarthTrendMapWrapper(props: EarthTrendMapWrapperProps) {
  return <EarthTrendMapDynamic {...props} />;
}
