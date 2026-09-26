"use client";

import React from "react";
import {
  useCapabilities,
  useInvestigationMap,
  useInvestigationSeries,
  useInvestigationEvidence,
  DEFAULT_SERIES,
  DEFAULT_CONTRAST_STATS,
} from "@/lib/api/client";
import { EarthTrendMapWrapper } from "@/components/map/EarthTrendMapWrapper";
import { LinkedTimeSeriesChart } from "@/components/charts/LinkedTimeSeriesChart";
import { EvidenceDrawer } from "@/components/evidence/EvidenceDrawer";
import { ContrastStats } from "@/components/evidence/ContrastCard";

export default function WorkspacePage() {
  const { data: capabilities } = useCapabilities();
  const activeJobId: string | null = null;
  const regionA: [number, number, number, number] | null = null;
  const regionB: [number, number, number, number] | null = null;
  const analyticsOpen = false;
  const analyticsTab: "timeline" | "evidence" = "timeline";

  const { data: mapGridData } = useInvestigationMap(activeJobId);
  const { data: seriesPayload } = useInvestigationSeries(activeJobId);
  const { data: evidencePayload } = useInvestigationEvidence(activeJobId);

  const displaySeries = seriesPayload?.data && seriesPayload.data.length > 0
    ? seriesPayload.data
    : DEFAULT_SERIES;

  const displayStats: ContrastStats = (() => {
    if (!evidencePayload?.results || evidencePayload.results.length === 0) {
      return DEFAULT_CONTRAST_STATS;
    }
    const rawRes: any = evidencePayload.results[0];
    const diag = rawRes.method?.diagnostics || {};
    const uncert = rawRes.uncertainty || {};
    const effect = rawRes.effect || {};
    const estimand = rawRes.estimand || {};

    return {
      dataset_id: estimand.dataset_id || "merra2_t2m",
      variable: estimand.variable || "T2M",
      units: estimand.units || "degC",
      unit_per_decade: effect.unit_per_decade || "degC/decade",
      period: {
        start_year: parseInt(estimand.period?.start?.slice(0, 4) || "2000", 10),
        end_year: parseInt(estimand.period?.end?.slice(0, 4) || "2024", 10),
      },
      status: evidencePayload.result_status || (rawRes.status as any) || "inconclusive",
      sub_status: diag.contrast_sub_status,
      region_a: {
        name: "Region A",
        slope_per_decade: effect.region_a_estimate ?? 0.0,
        slope_se_per_decade: diag.slope_se_per_decade_a ?? 0.1,
        ci_95: [diag.ci_lower_a ?? -0.2, diag.ci_upper_a ?? 0.2],
        p_value: diag.p_value_a ?? 0.05,
      },
      region_b: {
        name: "Region B",
        slope_per_decade: effect.region_b_estimate ?? 0.0,
        slope_se_per_decade: diag.slope_se_per_decade_b ?? 0.1,
        ci_95: [diag.ci_lower_b ?? -0.2, diag.ci_upper_b ?? 0.2],
        p_value: diag.p_value_b ?? 0.05,
      },
      difference: {
        slope_per_decade: effect.estimate ?? 0.0,
        hac_se_per_decade: diag.slope_se_per_decade ?? 0.1,
        ci_95_hac: [uncert.lower ?? -0.2, uncert.upper ?? 0.2],
        raw_p_value: rawRes.method?.raw_p_value ?? rawRes.method?.p_value ?? 0.05,
        adjusted_p_value: rawRes.method?.adjusted_p_value,
      },
      selection_status: rawRes.method?.selection_status,
      caveats: rawRes.caveats,
      interpretation: rawRes.interpretation?.text,
    };
  })();

  return (
    <div className={`app-shell ${analyticsOpen ? "has-expanded-analytics" : ""}`}>
      <main className="workspace-stage" id="workspace">
        <div className="map-layer" aria-label="Interactive Earth trend map">
          <EarthTrendMapWrapper
            className="!absolute !inset-0 !h-full !rounded-none !border-0"
            gridData={mapGridData}
            regionA={regionA}
            regionB={regionB}
          />
        </div>

        <div
          className="pointer-events-none absolute left-4 top-3 z-40 pt-2 sm:left-6"
          aria-hidden="true"
        >
          <img
            src="/terra-odyssey-logo.png"
            alt="Terra Odyssey"
            className="pointer-events-none h-9 w-auto select-none drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)] sm:h-10 md:h-11"
            draggable={false}
          />
        </div>
      </main>

      <section className={`analytics-dock ${analyticsOpen ? "analytics-expanded" : ""}`} aria-label="Analytics and timeline">
        {analyticsOpen && (
          <div className="analytics-content" role="tabpanel">
            {analyticsTab === "timeline" ? (
              <LinkedTimeSeriesChart
                data={displaySeries}
                unit={displayStats.units}
                variableName={displayStats.variable}
                regionAName={displayStats.region_a.name}
                regionBName={displayStats.region_b?.name}
              />
            ) : (
              <EvidenceDrawer
                jobId={activeJobId || "demo-candidate"}
                stats={displayStats}
                timeSeriesData={displaySeries}
                datasetId={displayStats.dataset_id}
                variableName={displayStats.variable}
                unit={displayStats.units}
              />
            )}
          </div>
        )}
      </section>

      <footer className="app-footer">
        <span>Terra Odyssey <i /> NASA Space Apps Challenge 2026</span>
        <span>NASA GES DISC / GMAO <i /> {capabilities?.system_version || "0.1.0-mvp"}</span>
      </footer>
    </div>
  );
}
