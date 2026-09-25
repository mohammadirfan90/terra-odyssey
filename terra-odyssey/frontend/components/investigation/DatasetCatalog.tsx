"use client";

import React from "react";
import type { DatasetMetadata } from "@/lib/api/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Thermometer, CloudRain, ExternalLink } from "lucide-react";

interface DatasetCatalogProps {
  datasets: DatasetMetadata[];
  selectedId: string;
  onSelect: (dataset: DatasetMetadata) => void;
}

export function DatasetCatalog({ datasets, selectedId, onSelect }: DatasetCatalogProps) {
  const safeDatasets = Array.isArray(datasets) ? datasets : [];

  if (safeDatasets.length === 0) {
    return (
      <div className="p-4 border border-slate-800 rounded bg-slate-900/40 text-xs text-slate-400 font-mono">
        No datasets available.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 w-full">
      {safeDatasets.map((d) => {
        const isSelected = d.dataset_id === selectedId;
        const isMerra = (d.dataset_id && d.dataset_id.includes("merra")) || d.data_type === "reanalysis_model";

        return (
          <Card
            key={d.dataset_id}
            onClick={() => onSelect(d)}
            className={`cursor-pointer transition-all duration-200 border ${
              isSelected
                ? "border-cyan-500 bg-cyan-950/20 shadow-lg shadow-cyan-950/30"
                : "border-slate-800 hover:border-slate-700 bg-slate-900/60"
            }`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`p-1.5 rounded-md ${
                      isMerra ? "bg-amber-950/60 text-amber-400" : "bg-cyan-950/60 text-cyan-400"
                    }`}
                  >
                    {isMerra ? <Thermometer className="w-4 h-4" /> : <CloudRain className="w-4 h-4" />}
                  </div>
                  <div>
                    <CardTitle className="text-xs text-slate-200">{d.title || d.dataset_id}</CardTitle>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className="text-[9px] py-0 px-1 text-slate-400">
                        {d.collection || "UNKNOWN"} v{d.version || "1.0"}
                      </Badge>
                      <Badge
                        variant={d.data_type === "satellite_retrieval" ? "supported" : "secondary"}
                        className="text-[9px] py-0 px-1"
                      >
                        {d.data_type === "satellite_retrieval" ? "Retrieved" : "Reanalysis Model"}
                      </Badge>
                    </div>
                  </div>
                </div>
                {isSelected && (
                  <span className="flex h-2 w-2 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400" />
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0 text-[11px] text-slate-400 space-y-1.5">
              <p className="line-clamp-2 leading-relaxed">{d.measurement_principle || "NASA Earth observation dataset."}</p>
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-800/60">
                <span>
                  Res: {d.spatial_resolution?.lat_deg ?? 0.5}° × {d.spatial_resolution?.lon_deg ?? 0.625}°
                </span>
                <span>
                  Bounds: {d.temporal_bounds?.start_year ?? 1980}–{d.temporal_bounds?.end_year ?? 2024}
                </span>
                {d.doi && (
                  <a
                    href={d.doi}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-0.5 text-cyan-400 hover:underline"
                  >
                    DOI <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
