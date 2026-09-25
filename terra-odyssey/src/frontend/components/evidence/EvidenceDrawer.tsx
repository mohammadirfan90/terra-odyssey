"use client";

import React from "react";
import { ContrastCard, ContrastStats } from "./ContrastCard";
import { MethodsInspector } from "./MethodsInspector";
import { ExportButton } from "./ExportButton";
import { LinkedTimeSeriesChart } from "../charts/LinkedTimeSeriesChart";
import { TimeSeriesDatum } from "@/lib/charts/d3-time-series";

interface EvidenceDrawerProps {
  jobId: string;
  stats: ContrastStats;
  timeSeriesData: TimeSeriesDatum[];
  datasetId: string;
  variableName: string;
  unit: string;
}

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({
  jobId,
  stats,
  timeSeriesData,
  datasetId,
  variableName,
  unit,
}) => {
  return (
    <div className="space-y-6">
      {/* 1. Contrast Evidence Card */}
      <ContrastCard stats={stats} />

      {/* 2. Linked Time-Series & Difference Chart */}
      <LinkedTimeSeriesChart
        data={timeSeriesData}
        unit={unit}
        variableName={variableName}
        regionAName={stats.region_a.name}
        regionBName={stats.region_b?.name}
      />

      {/* 3. Export Bundle Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="font-semibold text-slate-100 text-sm">
            Reproducibility &amp; Data Artifacts
          </div>
          <div className="text-slate-400 text-xs mt-0.5">
            Cryptographically sealed analysis records, normalized regional series, and provenance manifests.
          </div>
        </div>
        <ExportButton jobId={jobId} />
      </div>

      {/* 4. Detailed Methods & Scientific Constraints Inspector */}
      <MethodsInspector
        datasetId={datasetId}
        variableName={variableName}
      />
    </div>
  );
};
