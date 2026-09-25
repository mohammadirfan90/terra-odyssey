"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CheckCircle2, AlertTriangle, AlertCircle, HelpCircle } from "lucide-react";

export interface ContrastStats {
  dataset_id: string;
  variable: string;
  units: string;
  unit_per_decade: string;
  period: { start_year: number; end_year: number };
  status: "supported" | "inconclusive" | "ineligible";
  sub_status?: string;
  region_a: {
    name: string;
    slope_per_decade: number;
    slope_se_per_decade: number;
    ci_95: [number, number];
    p_value: number;
  };
  region_b?: {
    name: string;
    slope_per_decade: number;
    slope_se_per_decade: number;
    ci_95: [number, number];
    p_value: number;
  };
  difference?: {
    slope_per_decade: number;
    hac_se_per_decade: number;
    ci_95_hac: [number, number];
    raw_p_value: number;
    adjusted_p_value?: number | null;
  };
  selection_status?: "predefined" | "exploratory_map_selected";
  caveats?: string[];
  interpretation?: string;
}

interface ContrastCardProps {
  stats: ContrastStats;
}

export const ContrastCard: React.FC<ContrastCardProps> = ({ stats }) => {
  const isOpposite = stats.status === "supported";
  const isInconclusive = stats.status === "inconclusive";
  const isIneligible = stats.status === "ineligible";

  const isExploratory = stats.selection_status === "exploratory_map_selected";

  return (
    <Card className="bg-slate-900 border-slate-800 text-slate-200">
      <CardHeader className="pb-3 border-b border-slate-800/80">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base text-slate-100 font-semibold">
              Statistical Evidence &amp; Adjudication
            </CardTitle>
            <span className="text-xs text-slate-400 font-mono">
              ({stats.period.start_year}&ndash;{stats.period.end_year}, {stats.period.end_year - stats.period.start_year + 1} yrs)
            </span>
          </div>

          {/* Adjudication Badge */}
          {isOpposite && (
            <Badge variant="supported" className="px-3 py-1 text-xs gap-1.5 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Supported: Opposite-Trend Pair
            </Badge>
          )}

          {isInconclusive && (
            <Badge variant="inconclusive" className="px-3 py-1 text-xs gap-1.5 font-medium">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              Inconclusive: Contrasting Slopes Not Significant
            </Badge>
          )}

          {isIneligible && (
            <Badge variant="ineligible" className="px-3 py-1 text-xs gap-1.5 font-medium">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              Ineligible: Record Short (&lt;20 yrs) or Low Coverage
            </Badge>
          )}
        </div>

        {isExploratory && (
          <div className="mt-2 text-xs bg-amber-950/40 border border-amber-800/50 rounded px-2.5 py-1 text-amber-300">
            <strong>Exploratory Post-Screening Selection:</strong> Regions were chosen after examining the trend map. Contrast p-value is unadjusted; confirmation requires an independent validation record.
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Metric Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Region A Metric */}
          <div className="p-3 rounded-md bg-slate-950/60 border border-slate-800">
            <div className="text-xs font-medium text-amber-400 mb-1">
              {stats.region_a.name}
            </div>
            <div className="text-lg font-bold font-mono text-slate-100">
              {stats.region_a.slope_per_decade >= 0 ? "+" : ""}
              {stats.region_a.slope_per_decade.toFixed(2)}
              <span className="text-xs font-normal text-slate-400 ml-1">
                {stats.unit_per_decade}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-1">
              SE: &plusmn;{stats.region_a.slope_se_per_decade.toFixed(2)} | 95% CI: [
              {stats.region_a.ci_95[0].toFixed(2)}, {stats.region_a.ci_95[1].toFixed(2)}]
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
              p-value: {stats.region_a.p_value < 0.001 ? "< 0.001" : stats.region_a.p_value.toFixed(4)}
            </div>
          </div>

          {/* Region B Metric */}
          {stats.region_b && (
            <div className="p-3 rounded-md bg-slate-950/60 border border-slate-800">
              <div className="text-xs font-medium text-cyan-400 mb-1">
                {stats.region_b.name}
              </div>
              <div className="text-lg font-bold font-mono text-slate-100">
                {stats.region_b.slope_per_decade >= 0 ? "+" : ""}
                {stats.region_b.slope_per_decade.toFixed(2)}
                <span className="text-xs font-normal text-slate-400 ml-1">
                  {stats.unit_per_decade}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-1">
                SE: &plusmn;{stats.region_b.slope_se_per_decade.toFixed(2)} | 95% CI: [
                {stats.region_b.ci_95[0].toFixed(2)}, {stats.region_b.ci_95[1].toFixed(2)}]
              </div>
              <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                p-value: {stats.region_b.p_value < 0.001 ? "< 0.001" : stats.region_b.p_value.toFixed(4)}
              </div>
            </div>
          )}

          {/* Synchronous Difference Metric */}
          {stats.difference && (
            <div className="p-3 rounded-md bg-slate-950/60 border border-slate-800 ring-1 ring-slate-700">
              <div className="text-xs font-medium text-slate-300 mb-1">
                Synchronous Difference (&Delta; = A &minus; B)
              </div>
              <div className="text-lg font-bold font-mono text-slate-100">
                {stats.difference.slope_per_decade >= 0 ? "+" : ""}
                {stats.difference.slope_per_decade.toFixed(2)}
                <span className="text-xs font-normal text-slate-400 ml-1">
                  {stats.unit_per_decade}
                </span>
              </div>
              <div className="text-[11px] text-slate-300 font-mono mt-1">
                HAC SE: &plusmn;{stats.difference.hac_se_per_decade.toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                95% HAC CI: [{stats.difference.ci_95_hac[0].toFixed(2)},{" "}
                {stats.difference.ci_95_hac[1].toFixed(2)}]
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                Raw p: {stats.difference.raw_p_value < 0.001 ? "< 0.001" : stats.difference.raw_p_value.toFixed(4)}
                {stats.difference.adjusted_p_value !== undefined && stats.difference.adjusted_p_value !== null && (
                  <span className="ml-2 text-cyan-300">
                    BY-adj: {stats.difference.adjusted_p_value.toFixed(4)}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Interpretation Box */}
        {stats.interpretation && (
          <div className="p-3 rounded-md bg-slate-950/40 border border-slate-800 text-xs text-slate-300 leading-relaxed">
            <span className="text-slate-400 font-medium">Interpretation: </span>
            {stats.interpretation}
          </div>
        )}

        {/* Scientific Caveats */}
        {stats.caveats && stats.caveats.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-semibold text-slate-400 flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5" />
              Scientific Caveats &amp; Methodological Constraints:
            </div>
            <ul className="text-[11px] text-slate-400 list-disc list-inside space-y-0.5 pl-1">
              {stats.caveats.map((c, idx) => (
                <li key={idx}>{c}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
