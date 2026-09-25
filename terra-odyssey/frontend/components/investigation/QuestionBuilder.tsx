"use client";

import React, { useState } from "react";
import type { DatasetMetadata, InvestigationRequest, CandidatePreset } from "@/lib/api/types";
import { DatasetCatalog } from "./DatasetCatalog";
import { PeriodSelector } from "./PeriodSelector";
import { PresetSelector } from "./PresetSelector";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Search, ChevronDown, ChevronUp, Play, Loader2 } from "lucide-react";

interface QuestionBuilderProps {
  datasets: DatasetMetadata[];
  presets: CandidatePreset[];
  isSubmitting: boolean;
  onSubmit: (req: InvestigationRequest) => void;
  activeJobId?: string | null;
  presetRequest?: { presetId: string; requestId: number } | null;
  regionRequest?: {
    regionA: [number, number, number, number];
    regionB: [number, number, number, number] | null;
    requestId: number;
  } | null;
  onPresetSelected?: (preset: CandidatePreset) => void;
}

export function QuestionBuilder({
  datasets,
  presets,
  isSubmitting,
  onSubmit,
  activeJobId,
  presetRequest,
  regionRequest,
  onPresetSelected,
}: QuestionBuilderProps) {
  const safeDatasets = Array.isArray(datasets) ? datasets : [];
  const [selectedDataset, setSelectedDataset] = useState<DatasetMetadata | null>(safeDatasets[0] || null);
  const [period, setPeriod] = useState<[number, number]>([2000, 2024]);
  const [activePresetId, setActivePresetId] = useState<string | undefined>(presets[0]?.id);

  // Sync selected dataset when dataset catalog finishes loading
  React.useEffect(() => {
    if (!selectedDataset && safeDatasets.length > 0) {
      setSelectedDataset(safeDatasets[0]);
    }
  }, [safeDatasets, selectedDataset]);

  // Region state
  const [regionA, setRegionA] = useState<[number, number, number, number]>(
    presets[0]?.region_a.bbox || [-122.5, 35.0, -118.5, 39.5]
  );
  const [regionB, setRegionB] = useState<[number, number, number, number] | null>(
    presets[0]?.region_b?.bbox || [-92.0, 30.0, -84.0, 34.0]
  );

  // Expert options
  const [showExpert, setShowExpert] = useState(false);
  const [estimatorFamily, setEstimatorFamily] = useState<"ols_hac">("ols_hac");
  const [executionMode, setExecutionMode] = useState<"auto" | "demo_sample" | "cached_only">("demo_sample");
  const [selectionStatus, setSelectionStatus] = useState<"predefined" | "exploratory_map_selected">("predefined");
  const lastAppliedRequest = React.useRef<number | null>(null);
  const lastAppliedRegionRequest = React.useRef<number | null>(null);

  const handleSelectPreset = (preset: CandidatePreset) => {
    setActivePresetId(preset.id);
    const targetDs = datasets.find((d) => d.dataset_id === preset.dataset_id);
    if (targetDs) setSelectedDataset(targetDs);
    setPeriod([preset.period.start_year, preset.period.end_year]);
    setRegionA(preset.region_a.bbox);
    setRegionB(preset.region_b?.bbox || null);
    setSelectionStatus("predefined");
    onPresetSelected?.(preset);
  };

  React.useEffect(() => {
    if (!presetRequest || lastAppliedRequest.current === presetRequest.requestId) return;
    const requestedPreset = presets.find((preset) => preset.id === presetRequest.presetId);
    if (!requestedPreset) return;

    lastAppliedRequest.current = presetRequest.requestId;
    setActivePresetId(requestedPreset.id);
    const targetDataset = datasets.find((dataset) => dataset.dataset_id === requestedPreset.dataset_id);
    if (targetDataset) setSelectedDataset(targetDataset);
    setPeriod([requestedPreset.period.start_year, requestedPreset.period.end_year]);
    setRegionA(requestedPreset.region_a.bbox);
    setRegionB(requestedPreset.region_b?.bbox || null);
    setSelectionStatus("predefined");
    onPresetSelected?.(requestedPreset);
  }, [presetRequest, presets, datasets, onPresetSelected]);

  React.useEffect(() => {
    if (!regionRequest || lastAppliedRegionRequest.current === regionRequest.requestId) return;
    lastAppliedRegionRequest.current = regionRequest.requestId;
    setRegionA(regionRequest.regionA);
    setRegionB(regionRequest.regionB);
    setActivePresetId(undefined);
    setSelectionStatus("exploratory_map_selected");
  }, [regionRequest]);

  const span = period[1] - period[0];
  const isEligible = span >= 20;

  const handleSubmit = () => {
    if (!isEligible || !selectedDataset) return;

    const req: InvestigationRequest = {
      dataset_id: selectedDataset.dataset_id,
      variable: selectedDataset.primary_variable,
      period: { start_year: period[0], end_year: period[1] },
      region_a: regionA,
      region_b: regionB || undefined,
      temporal_aggregation: "annual_mean",
      spatial_aggregation: "area_weighted",
      execution_mode: executionMode,
      estimator_family: estimatorFamily,
      selection_status: selectionStatus,
    };

    onSubmit(req);
  };

  return (
    <div className="flex flex-col space-y-4 w-full">
      {/* Top Banner / Core Question */}
      <div className="flex flex-col p-4 rounded-lg bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 border border-slate-800 shadow-md">
        <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono uppercase tracking-wider">
          <Search className="w-3.5 h-3.5" />
          <span>NASA Earth System Trend Detective</span>
        </div>
        <h1 className="text-lg md:text-xl font-bold tracking-tight text-white mt-1">
          Formulate Trend Investigation
        </h1>
        <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
          Select reviewed NASA Earth observations, configure a qualifying time period (≥ 20 years), and evaluate whether regional trends show statistically supported divergence under spatial autocorrelation control.
        </p>
      </div>

      {/* Preset candidate pairs */}
      {presets.length > 0 && (
        <PresetSelector
          presets={presets}
          activePresetId={activePresetId}
          onSelectPreset={handleSelectPreset}
        />
      )}

      {/* Step 1: NASA Dataset Picker */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-300">
          <span>1. NASA Reviewed Product</span>
          {selectedDataset && (
            <span className="font-mono text-cyan-400">
              Variable: {selectedDataset.primary_variable} ({selectedDataset.variables?.[selectedDataset.primary_variable]?.canonical_unit || ""})
            </span>
          )}
        </div>
        <DatasetCatalog
          datasets={datasets}
          selectedId={selectedDataset?.dataset_id || ""}
          onSelect={(ds) => {
            setSelectedDataset(ds);
            setActivePresetId(undefined);
          }}
        />
      </div>

      {/* Step 2: Time Period Slider */}
      <div className="flex flex-col space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">
          2. Temporal Interval (Consecutive Years)
        </div>
        <PeriodSelector
          minYear={selectedDataset?.temporal_bounds.start_year || 1980}
          maxYear={selectedDataset?.temporal_bounds.end_year || 2024}
          value={period}
          onChange={(val) => {
            setPeriod(val);
            setActivePresetId(undefined);
          }}
        />
      </div>

      {/* Step 3: Regional Coordinate Preview */}
      <div className="grid grid-cols-1 gap-3">
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="py-2.5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs text-amber-300">Region A (Target)</CardTitle>
              <Badge variant="regionA" className="text-[9px]">
                Primary
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="py-2 text-[11px] font-mono text-slate-400">
            [{regionA.map((c) => c.toFixed(2)).join(", ")}]
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="py-2.5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs text-cyan-300">Region B (Comparison)</CardTitle>
              <Badge variant="regionB" className="text-[9px]">
                Contrast
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="py-2 text-[11px] font-mono text-slate-400">
            {regionB ? `[${regionB.map((c) => c.toFixed(2)).join(", ")}]` : "Single Region Mode"}
          </CardContent>
        </Card>
      </div>

      {/* Expert Mode Controls */}
      <div className="border border-slate-800/80 rounded-md bg-slate-900/40">
        <button
          type="button"
          onClick={() => setShowExpert(!showExpert)}
          className="w-full flex items-center justify-between p-3 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        >
          <span className="font-semibold uppercase tracking-wider text-[11px]">
            {showExpert ? "Hide Expert Parameters" : "Show Expert Parameters (HAC, FDR, Acquisition)"}
          </span>
          {showExpert ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showExpert && (
          <div className="p-3 pt-0 border-t border-slate-800/60 grid grid-cols-1 gap-3 text-xs">
            <div>
              <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                Estimator & Covariance
              </label>
              <Select
                value={estimatorFamily}
                onChange={(e) => setEstimatorFamily(e.target.value as any)}
              >
                <option value="ols_hac">OLS + Newey-West HAC (L=2, Bartlett)</option>
              </Select>
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                Execution Mode
              </label>
              <Select
                value={executionMode}
                onChange={(e) => setExecutionMode(e.target.value as any)}
              >
                <option value="demo_sample">Demo Sample (Offline NASA Footprint)</option>
                <option value="cached_only">Cached Only (Strict Offline Granules)</option>
                <option value="auto">Auto (DAAC Acquisition with Fallback)</option>
              </Select>
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                Selection Status
              </label>
              <Select
                value={selectionStatus}
                onChange={(e) => setSelectionStatus(e.target.value as any)}
              >
                <option value="predefined">Predefined (A Priori Hypothesis)</option>
                <option value="exploratory_map_selected">Exploratory (Post-Screening Draw)</option>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Action / Launch Button */}
      <div className="flex items-center justify-between pt-2">
        <div className="text-[11px] text-slate-400">
          {activeJobId ? (
            <span className="font-mono text-cyan-400">Active Investigation: {activeJobId}</span>
          ) : (
            <span>Ready to submit investigation job to queue</span>
          )}
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!isEligible || isSubmitting}
          className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs tracking-wide uppercase font-mono shadow-lg shadow-cyan-950/40"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              Submitting Job...
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current mr-1.5" />
              Run Investigation
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
