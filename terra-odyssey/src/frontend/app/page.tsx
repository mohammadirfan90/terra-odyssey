"use client";

import React, { useState } from "react";
import {
  useCatalog,
  useCapabilities,
  useCreateInvestigation,
  useInvestigationStatus,
  useInvestigationMap,
  useInvestigationSeries,
  useInvestigationEvidence,
  CANDIDATE_PRESETS,
  DEFAULT_SERIES,
  DEFAULT_CONTRAST_STATS,
} from "@/lib/api/client";
import { QuestionBuilder } from "@/components/investigation/QuestionBuilder";
import { EarthTrendMapWrapper } from "@/components/map/EarthTrendMapWrapper";
import { LinkedTimeSeriesChart } from "@/components/charts/LinkedTimeSeriesChart";
import { EvidenceDrawer } from "@/components/evidence/EvidenceDrawer";
import { ContrastStats } from "@/components/evidence/ContrastCard";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Globe, Compass, BarChart3, FileText, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

export default function WorkspacePage() {
  const { data: datasets = [], isLoading: isLoadingCatalog } = useCatalog();
  const { data: capabilities } = useCapabilities();
  const createMutation = useCreateInvestigation();

  const [activeTab, setActiveTab] = useState<string>("question");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [regionA, setRegionA] = useState<[number, number, number, number] | null>([-122.5, 35.0, -118.5, 39.5]);
  const [regionB, setRegionB] = useState<[number, number, number, number] | null>([-92.0, 30.0, -84.0, 34.0]);

  // Poll status of active job
  const { data: jobStatus } = useInvestigationStatus(activeJobId);
  const { data: mapGridData } = useInvestigationMap(activeJobId);
  const { data: seriesPayload } = useInvestigationSeries(activeJobId);
  const { data: evidencePayload } = useInvestigationEvidence(activeJobId);

  // Derive series data (live job or candidate demo fallback)
  const displaySeries = seriesPayload?.data && seriesPayload.data.length > 0
    ? seriesPayload.data
    : DEFAULT_SERIES;

  // Derive contrast stats (live job or candidate demo fallback)
  let displayStats: ContrastStats = DEFAULT_CONTRAST_STATS;
  if (evidencePayload?.results && evidencePayload.results.length > 0) {
    const rawRes: any = evidencePayload.results[0];
    const diag = rawRes.method?.diagnostics || {};
    const uncert = rawRes.uncertainty || {};
    const effect = rawRes.effect || {};
    const estimand = rawRes.estimand || {};

    displayStats = {
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
  }

  const handleLaunchInvestigation = (req: any) => {
    createMutation.mutate(req, {
      onSuccess: (data) => {
        setActiveJobId(data.job_id);
      },
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Instrument Panel Top Navigation */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400" />
            <span className="font-bold text-sm tracking-tight text-white font-mono">
              TERRA ODYSSEY
            </span>
          </div>
          <Badge variant="outline" className="hidden sm:inline-flex text-[9px] text-cyan-400 border-cyan-800/60 bg-cyan-950/40">
            v{capabilities?.system_version || "0.1.0-mvp"}
          </Badge>
          <span className="text-slate-600 text-xs hidden md:inline">|</span>
          <span className="text-xs text-slate-400 hidden md:inline font-mono">
            Earth System Trend Detective
          </span>
        </div>

        {/* Global Job Status Indicator */}
        <div className="flex items-center gap-3">
          {jobStatus && (
            <div className="flex items-center gap-2 bg-slate-950/80 px-2.5 py-1 rounded border border-slate-800 text-xs font-mono">
              {jobStatus.job_status === "running" && (
                <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
              )}
              {jobStatus.job_status === "succeeded" && (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              )}
              {jobStatus.job_status === "failed" && (
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              )}
              <span className="text-slate-400">Job:</span>
              <span className="text-slate-200">{jobStatus.job_id}</span>
              <span className="text-slate-600">•</span>
              <span className="text-cyan-400 uppercase text-[10px]">{jobStatus.stage} ({jobStatus.progress}%)</span>
            </div>
          )}

          <Badge variant="secondary" className="text-[10px] font-mono py-0.5">
            NASA GES DISC / GMAO
          </Badge>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="flex-1 p-4 max-w-7xl mx-auto w-full flex flex-col space-y-4">
        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-slate-900 border-slate-800 h-9 p-1">
            <TabsTrigger value="question" className="gap-1.5 text-xs">
              <Compass className="w-3.5 h-3.5" />
              <span>1. Formulate Question</span>
            </TabsTrigger>
            <TabsTrigger value="map" className="gap-1.5 text-xs">
              <Globe className="w-3.5 h-3.5" />
              <span>2. Spatial Trend Map</span>
            </TabsTrigger>
            <TabsTrigger value="charts" className="gap-1.5 text-xs">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>3. Linked Time-Series</span>
            </TabsTrigger>
            <TabsTrigger value="evidence" className="gap-1.5 text-xs">
              <FileText className="w-3.5 h-3.5" />
              <span>4. Evidence & Export</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Question Builder */}
          <TabsContent value="question" className="pt-2">
            {isLoadingCatalog ? (
              <div className="flex items-center justify-center p-12 text-slate-500 font-mono text-xs">
                <Loader2 className="w-4 h-4 animate-spin mr-2 text-cyan-400" />
                Loading NASA dataset catalog...
              </div>
            ) : (
              <QuestionBuilder
                datasets={datasets}
                presets={CANDIDATE_PRESETS}
                isSubmitting={createMutation.isPending}
                onSubmit={handleLaunchInvestigation}
                activeJobId={activeJobId}
              />
            )}
          </TabsContent>

          {/* Tab 2: Spatial Trend Map */}
          <TabsContent value="map" className="pt-2">
            <div className="flex flex-col space-y-3">
              <EarthTrendMapWrapper
                gridData={mapGridData}
                regionA={regionA}
                regionB={regionB}
                onUpdateRegions={(newA, newB) => {
                  setRegionA(newA);
                  setRegionB(newB);
                }}
              />
            </div>
          </TabsContent>

          {/* Tab 3: Linked Time-Series Chart */}
          <TabsContent value="charts" className="pt-2">
            <div className="space-y-4">
              {!activeJobId && (
                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-md text-xs text-slate-400 flex items-center justify-between">
                  <span>Displaying demonstration candidate contrast series ({displayStats.region_a.name} vs {displayStats.region_b?.name}). Launch an investigation in Tab 1 to run on live/cached NASA data.</span>
                  <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-800">Demo Record</Badge>
                </div>
              )}
              <LinkedTimeSeriesChart
                data={displaySeries}
                unit={displayStats.units}
                variableName={displayStats.variable}
                regionAName={displayStats.region_a.name}
                regionBName={displayStats.region_b?.name}
              />
            </div>
          </TabsContent>

          {/* Tab 4: Evidence & Export Drawer */}
          <TabsContent value="evidence" className="pt-2">
            <div className="space-y-4">
              {!activeJobId && (
                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-md text-xs text-slate-400 flex items-center justify-between">
                  <span>Displaying candidate contrast evidence record ({displayStats.region_a.name} vs {displayStats.region_b?.name}).</span>
                  <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-800">Demo Record</Badge>
                </div>
              )}
              <EvidenceDrawer
                jobId={activeJobId || "demo-candidate"}
                stats={displayStats}
                timeSeriesData={displaySeries}
                datasetId={displayStats.dataset_id}
                variableName={displayStats.variable}
                unit={displayStats.units}
              />
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="py-2.5 px-4 border-t border-slate-800/80 bg-slate-900/60 text-[10px] text-slate-500 flex items-center justify-between font-mono">
        <span>Terra Odyssey • NASA Space Apps Challenge 2026</span>
        <span>Built with Next.js, MapLibre GL, D3 & FastAPI</span>
      </footer>
    </div>
  );
}
