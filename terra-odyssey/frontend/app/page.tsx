"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import brandLogo from "../LOGOs.png";
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
import type { CandidatePreset, InvestigationRequest } from "@/lib/api/types";
import { QuestionBuilder } from "@/components/investigation/QuestionBuilder";
import { EarthTrendMapWrapper } from "@/components/map/EarthTrendMapWrapper";
import { LinkedTimeSeriesChart } from "@/components/charts/LinkedTimeSeriesChart";
import { EvidenceDrawer } from "@/components/evidence/EvidenceDrawer";
import { ContrastStats } from "@/components/evidence/ContrastCard";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  FileText,
  Loader2,
  MapPinned,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

type AnalyticsTab = "timeline" | "evidence";
type PresetRequest = { presetId: string; requestId: number } | null;
type RegionRequest = {
  regionA: [number, number, number, number];
  regionB: [number, number, number, number] | null;
  requestId: number;
} | null;

function signed(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

function asBoundingBox(value: InvestigationRequest["region_a"] | InvestigationRequest["region_b"]) {
  return Array.isArray(value) && value.length === 4 && value.every((coordinate) => typeof coordinate === "number")
    ? value as [number, number, number, number]
    : null;
}

export default function WorkspacePage() {
  const { data: datasets = [], isLoading: isLoadingCatalog } = useCatalog();
  const { data: capabilities } = useCapabilities();
  const createMutation = useCreateInvestigation();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [regionA, setRegionA] = useState<[number, number, number, number] | null>([-122.5, 35.0, -118.5, 39.5]);
  const [regionB, setRegionB] = useState<[number, number, number, number] | null>([-92.0, 30.0, -84.0, 34.0]);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [informationOpen, setInformationOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>("timeline");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [presetRequest, setPresetRequest] = useState<PresetRequest>(null);
  const [regionRequest, setRegionRequest] = useState<RegionRequest>(null);

  const { data: jobStatus } = useInvestigationStatus(activeJobId);
  const { data: mapGridData } = useInvestigationMap(activeJobId);
  const { data: seriesPayload } = useInvestigationSeries(activeJobId);
  const { data: evidencePayload } = useInvestigationEvidence(activeJobId);

  const displaySeries = seriesPayload?.data && seriesPayload.data.length > 0
    ? seriesPayload.data
    : DEFAULT_SERIES;

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

  const matchingPresets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return CANDIDATE_PRESETS.filter((preset) => [
      preset.title,
      preset.scientific_question,
      preset.region_a.name,
      preset.region_b?.name,
      preset.dataset_id,
    ].filter(Boolean).join(" ").toLowerCase().includes(query)).slice(0, 4);
  }, [searchQuery]);

  const activeDataset = datasets.find((dataset) => dataset.dataset_id === displayStats.dataset_id) || datasets[0];

  const applySearchPreset = (preset: CandidatePreset) => {
    setPresetRequest((current) => ({
      presetId: preset.id,
      requestId: (current?.requestId ?? 0) + 1,
    }));
    setRegionA(preset.region_a.bbox);
    setRegionB(preset.region_b?.bbox || null);
    setRegionRequest(null);
    setSearchQuery(preset.title);
    setSearchOpen(false);
    setOptionsOpen(true);
  };

  const handleLaunchInvestigation = (req: InvestigationRequest) => {
    setRegionA(asBoundingBox(req.region_a));
    setRegionB(asBoundingBox(req.region_b));
    createMutation.mutate(req, {
      onSuccess: (data) => {
        setActiveJobId(data.job_id);
        setAnalyticsOpen(true);
      },
    });
  };

  const statusLabel = displayStats.status === "supported"
    ? "Supported contrast"
    : displayStats.status === "inconclusive"
      ? "Inconclusive result"
      : "Ineligible result";

  return (
    <div className={`app-shell ${analyticsOpen ? "has-expanded-analytics" : ""}`}>
      <header className="app-header">
        <div className="header-search-wrap">
          <div className="header-search">
            <Search aria-hidden="true" className="header-search-icon" />
            <input
              id="workspace-search"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setSearchOpen(false);
                if (event.key === "Enter" && matchingPresets[0]) applySearchPreset(matchingPresets[0]);
              }}
              placeholder="Find a reviewed question or region"
              autoComplete="off"
              aria-label="Search reviewed investigation questions and regions"
              aria-expanded={searchOpen && Boolean(searchQuery.trim())}
              aria-controls="preset-search-results"
            />
            {searchQuery && (
              <button className="search-clear" aria-label="Clear search" onClick={() => {
                setSearchQuery("");
                setSearchOpen(false);
              }}>
                <X size={15} />
              </button>
            )}
          </div>
          {searchOpen && searchQuery.trim() && (
            <div className="search-results" id="preset-search-results" role="listbox" aria-label="Reviewed investigation candidates">
              {matchingPresets.length > 0 ? matchingPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  role="option"
                  aria-selected="false"
                  className="search-result"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applySearchPreset(preset)}
                >
                  <span className="search-result-title">{preset.title}</span>
                  <span className="search-result-detail">{preset.region_a.name}{preset.region_b ? ` vs ${preset.region_b.name}` : ""} · {preset.period.start_year}–{preset.period.end_year}</span>
                </button>
              )) : (
                <div className="search-empty">
                  <strong>No reviewed question matched.</strong>
                  <span>Open Options to choose a NASA product and define an investigation.</span>
                  <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => {
                    setSearchOpen(false);
                    setOptionsOpen(true);
                  }}>Open Options</button>
                </div>
              )}
            </div>
          )}
        </div>

        <a className="brand-mark" href="#workspace" aria-label="Terra Odyssey workspace">
          <Image src={brandLogo} alt="Terra Odyssey" priority sizes="180px" />
        </a>

        <div className="header-meta">
          {jobStatus ? (
            <div className="job-chip" aria-live="polite">
              {jobStatus.job_status === "running" && <Loader2 size={15} className="status-running" />}
              {jobStatus.job_status === "succeeded" && <CheckCircle2 size={15} className="status-success" />}
              {jobStatus.job_status === "failed" && <AlertTriangle size={15} className="status-failed" />}
              <span>{jobStatus.stage}</span>
              <strong>{jobStatus.progress}%</strong>
            </div>
          ) : null}
          <Badge variant="outline" className="version-badge">v{capabilities?.system_version || "0.1.0-mvp"}</Badge>
        </div>
      </header>

      <main className="workspace-stage" id="workspace">
        <div className="map-layer" aria-label="Interactive Earth trend map">
          <EarthTrendMapWrapper
            className="!absolute !inset-0 !h-full !rounded-none !border-0"
            gridData={mapGridData}
            regionA={regionA}
            regionB={regionB}
            onUpdateRegions={(newA, newB) => {
              const hasValidRegionA = newA[2] > newA[0] && newA[3] > newA[1];
              if (hasValidRegionA) {
                setRegionRequest((current) => ({
                  regionA: newA,
                  regionB: newB,
                  requestId: (current?.requestId ?? 0) + 1,
                }));
              } else {
                setRegionRequest(null);
              }
              setRegionA(hasValidRegionA ? newA : null);
              setRegionB(newB);
            }}
          />
        </div>

        <div className="map-caption">
          <span className="map-caption-kicker"><MapPinned size={13} /> EARTH SYSTEM VIEW</span>
          <span className="map-caption-detail">Global overview <i /> Drag to compare regions</span>
        </div>

        <div className="map-tools">
          <button
            type="button"
            className={`floating-control ${optionsOpen ? "is-active" : ""}`}
            aria-expanded={optionsOpen}
            aria-controls="investigation-options"
            onClick={() => setOptionsOpen((open) => !open)}
          >
            <SlidersHorizontal size={16} />
            <span>Options</span>
            {optionsOpen ? <X size={14} className="control-end-icon" /> : <ChevronDown size={14} className="control-end-icon" />}
          </button>
          <button
            type="button"
            className={`floating-control information-toggle ${informationOpen ? "is-active" : ""}`}
            aria-expanded={informationOpen}
            aria-controls="map-information"
            onClick={() => setInformationOpen((open) => !open)}
          >
            <CircleHelp size={16} />
            <span>Information</span>
          </button>
        </div>

        {optionsOpen && (
          <section className="options-panel" id="investigation-options" aria-label="Investigation options">
            <div className="panel-heading">
              <div><span className="panel-eyebrow">WORKSPACE CONTROLS</span><h1>Investigation options</h1></div>
              <button className="panel-close" type="button" aria-label="Close options" onClick={() => setOptionsOpen(false)}><X size={17} /></button>
            </div>
            {isLoadingCatalog ? (
              <div className="catalog-loading"><Loader2 size={17} className="status-running" /> Loading NASA dataset catalog…</div>
            ) : (
              <QuestionBuilder
                datasets={datasets}
                presets={CANDIDATE_PRESETS}
                isSubmitting={createMutation.isPending}
                onSubmit={handleLaunchInvestigation}
                activeJobId={activeJobId}
                presetRequest={presetRequest}
                regionRequest={regionRequest}
                onPresetSelected={(preset) => {
                  setRegionA(preset.region_a.bbox);
                  setRegionB(preset.region_b?.bbox || null);
                  setRegionRequest(null);
                }}
              />
            )}
          </section>
        )}

        <aside className={`information-panel ${informationOpen ? "information-open" : ""}`} id="map-information" aria-label="Current evidence information">
          <div className="panel-heading info-heading">
            <div><span className="panel-eyebrow">{activeJobId ? "INVESTIGATION RESULT" : "CANDIDATE OVERVIEW"}</span><h2>Evidence snapshot</h2></div>
            <span className={`result-indicator result-${displayStats.status}`} aria-label={statusLabel} title={statusLabel} />
          </div>
          <div className="info-content">
            {!activeJobId && <div className="sample-note"><Activity size={13} /> Candidate example</div>}
            <div className="source-block">
              <span className="info-label">NASA PRODUCT</span>
              <strong>{activeDataset?.title || displayStats.dataset_id}</strong>
              <span className="source-release">{activeDataset?.collection || displayStats.dataset_id}{activeDataset?.version ? ` · v${activeDataset.version}` : ""}</span>
            </div>
            <div className="info-facts">
              <div><span>Variable</span><strong>{displayStats.variable} <small>({displayStats.units})</small></strong></div>
              <div><span>Interval</span><strong>{displayStats.period.start_year}–{displayStats.period.end_year}</strong></div>
              <div><span>Evidence</span><strong className={`status-copy status-copy-${displayStats.status}`}>{statusLabel}</strong></div>
            </div>
            <div className="trend-summary">
              <div className="trend-summary-heading"><span>REGIONAL TREND</span><span>{displayStats.unit_per_decade}</span></div>
              <div className="trend-row"><span><i className="region-marker region-marker-a" />{displayStats.region_a.name}</span><strong>{signed(displayStats.region_a.slope_per_decade)}</strong></div>
              {displayStats.region_b && <div className="trend-row"><span><i className="region-marker region-marker-b" />{displayStats.region_b.name}</span><strong>{signed(displayStats.region_b.slope_per_decade)}</strong></div>}
              {displayStats.difference && <div className="trend-difference"><span>Paired difference (A − B)</span><strong>{signed(displayStats.difference.slope_per_decade)}</strong></div>}
            </div>
            <p className="information-caveat">
              {mapGridData ? "Map colors show estimated trend direction and magnitude; statistical support is encoded separately." : "Run an investigation to overlay spatial trend estimates. A trend in one region alone does not establish a regional difference."}
            </p>
            <button type="button" className="open-evidence" onClick={() => {
              setAnalyticsTab("evidence");
              setAnalyticsOpen(true);
              setInformationOpen(false);
            }}>
              <FileText size={14} /> Review evidence and methods <ChevronDown size={14} />
            </button>
          </div>
        </aside>
      </main>

      <section className={`analytics-dock ${analyticsOpen ? "analytics-expanded" : ""}`} aria-label="Analytics and timeline">
        <div className="analytics-bar">
          <div className="analytics-title">
            <span className="analytics-icon"><Activity size={17} /></span>
            <div><strong>Analytics &amp; timeline</strong><span>{displayStats.period.start_year}–{displayStats.period.end_year} · {displaySeries.length} annual records</span></div>
          </div>
          <div className="analytics-tools">
            {analyticsOpen && (
              <div className="analytics-tabs" role="tablist" aria-label="Analytics view">
                <button type="button" role="tab" aria-selected={analyticsTab === "timeline"} className={analyticsTab === "timeline" ? "analytics-tab active" : "analytics-tab"} onClick={() => setAnalyticsTab("timeline")}>Timeline</button>
                <button type="button" role="tab" aria-selected={analyticsTab === "evidence"} className={analyticsTab === "evidence" ? "analytics-tab active" : "analytics-tab"} onClick={() => setAnalyticsTab("evidence")}>Evidence &amp; methods</button>
              </div>
            )}
            <button type="button" className="expand-analytics" aria-expanded={analyticsOpen} onClick={() => setAnalyticsOpen((open) => !open)}>
              <span>{analyticsOpen ? "Collapse" : "Expand analytics"}</span>{analyticsOpen ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
            </button>
          </div>
        </div>
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
