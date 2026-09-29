"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useCapabilities,
  useCatalog,
  useCreateInvestigation,
  useInvestigationEvidence,
  useInvestigationMap,
  useInvestigationSeries,
  useInvestigationStatus,
} from "@/lib/api/client";
import type { DatasetMetadata } from "@/lib/api/types";
import { EarthTrendMapWrapper } from "@/components/map/EarthTrendMapWrapper";
import { UniversalQueryBar, type SelectedLocationPayload } from "@/components/search/UniversalQueryBar";
import { TopNavDeck } from "@/components/menu/TopNavDeck";
import { MenuPanel } from "@/components/menu/MenuPanel";
import { ActivityDock } from "@/components/dock/ActivityDock";
import { FloatingEvidenceCard } from "@/components/dock/FloatingEvidenceCard";
import { FooterStatusBar } from "@/components/telemetry/FooterStatusBar";
import { StatusStrip } from "@/components/system/StatusStrip";
import { publishMap } from "@/lib/map/map-instance";
import {
  getActivePlot,
  clearAllPlots,
  savePlot,
  setActivePlot,
  type PersistedPlot,
} from "@/lib/storage/plot-storage";
import { polygonAreaSqM, polygonPerimeterM } from "@/lib/map/draw-shapes";
import {
  markUndone,
  pushActivity,
  useActivityLog,
  type ActivityEntry,
  type ActivityKind,
} from "@/lib/state/activity-log";
import {
  useInvestigationState,
  getInvestigationStore,
  GLOBAL_EARTH_BBOX,
  GLOBAL_EARTH_NAME,
  type RegionState,
} from "@/lib/state/investigation";

// Default reference region: Entire Earth (Global)
const DEFAULT_REGION_A_BBOX: [number, number, number, number] = GLOBAL_EARTH_BBOX;
const DEFAULT_REGION_NAME = GLOBAL_EARTH_NAME;
const DEFAULT_PERIOD = { start_year: 2001, end_year: 2024 };

// Fallback dataset/variable used when the user triggers an investigation
// flow (place search, region draw, clear shapes, "run default") without
// having explicitly picked a dataset/variable yet. MERRA-2 2-Meter Air
// Temperature is the canonical "first look" reference for NASA Earth
// system trend investigations.
const FALLBACK_DATASET_ID = "merra2_t2m";
const FALLBACK_VARIABLE_NAME = "T2M";

function ensureDatasetSelected(): { dataset: string; variable: string } {
  const store = getInvestigationStore();
  let dataset = store.state.selectedDataset;
  let variable = store.state.selectedVariable;
  if (!dataset) {
    dataset = FALLBACK_DATASET_ID;
    store.setSelectedDataset(dataset);
  }
  if (!variable) {
    variable = FALLBACK_VARIABLE_NAME;
    store.setSelectedVariable(variable);
  }
  store.setCustomVariable(null);
  return { dataset, variable };
}

type BBox = [number, number, number, number];

function bboxOf(region: RegionState): BBox {
  return region.bbox;
}

export default function WorkspacePage() {
  const { data: capabilities } = useCapabilities();
  const { data: datasets } = useCatalog();

  const [menuOpen, setMenuOpen] = useState(false);

  // Read everything from the shared investigation-state hook.
  const {
    selectedDataset,
    selectedVariable,
    customVariable,
    period,
    setPeriod,
    regionA,
    setRegionA,
    regionB,
    setRegionB,
    selectedYear,
    mapDate,
    setMapDate,
    hasPendingRegion,
    setHasPendingRegion,
    regionAutoRun,
    setRegionAutoRun,
  } = useInvestigationState();

  // UI-only local state: active job ID, error banner, displayed region name, dock collapse state.
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [investigationError, setInvestigationError] = useState<string | null>(null);
  const [regionAName, setRegionAName] = useState<string>(DEFAULT_REGION_NAME);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [evidenceCardOpen, setEvidenceCardOpen] = useState(true);
  // Track whether the user has explicitly kicked off an investigation.
  // The evidence card and the trend grid map layer both depend on a
  // user gesture before they populate; until then we leave the workspace
  // in a clean "pick a dataset and variable to begin" state.
  const hasInitializedRef = useRef(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const markInitialized = useCallback(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      setHasInitialized(true);
    }
  }, []);

  const log = useActivityLog();
  const counts = useMemo(() => {
    const acc: Record<ActivityKind, number> = {
      dataset: 0,
      variable: 0,
      custom: 0,
      region: 0,
      shape: 0,
      period: 0,
      clear: 0,
    };
    for (const e of log) acc[e.kind] += 1;
    return acc;
  }, [log]);

  const handleUndo = useCallback((entry: ActivityEntry) => {
    entry.undo();
    markUndone(entry.id);
  }, []);

  const createInvestigation = useCreateInvestigation();
  const statusQuery = useInvestigationStatus(activeJobId);
  const isJobSucceeded = statusQuery.data?.job_status === "succeeded";
  const isJobRunning =
    statusQuery.data?.job_status === "submitted" ||
    statusQuery.data?.job_status === "running" ||
    createInvestigation.isPending;
  const isJobFailed = statusQuery.data?.job_status === "failed";

  const mapGridQuery = useInvestigationMap(activeJobId, 10000, isJobSucceeded);
  const seriesQuery = useInvestigationSeries(activeJobId, isJobSucceeded);
  const evidenceQuery = useInvestigationEvidence(activeJobId, isJobSucceeded);

  // Active dataset details
  const activeDatasetObj = useMemo(
    () => datasets?.find((d) => d.dataset_id === selectedDataset),
    [datasets, selectedDataset],
  );

  // Trigger an authoritative investigation
  const lastRunKeyRef = useRef<string>("");
  const prevDatasetRef = useRef(selectedDataset);
  const prevVarRef = useRef(selectedVariable);
  const prevRegionARef = useRef(regionA.bbox.join(","));

  const runInvestigation = useCallback(
    async (
      targetRegionA: BBox = bboxOf(regionA),
      targetRegionB: BBox | null = regionB ? bboxOf(regionB) : null,
      targetPeriod = period,
      targetDataset = selectedDataset,
      targetVar = selectedVariable,
    ) => {
      if (!targetDataset || !targetVar) {
        setActiveJobId(null);
        setInvestigationError(null);
        return;
      }

      const targetMeta = datasets?.find((d) => d.dataset_id === targetDataset);
      if (
        targetMeta &&
        targetMeta.capabilities &&
        !targetMeta.capabilities.trend_supported &&
        !targetMeta.capabilities.series_supported
      ) {
        setActiveJobId(null);
        setInvestigationError(null);
        return;
      }

      const runKey = `${targetDataset}|${targetVar}|${targetPeriod.start_year}-${targetPeriod.end_year}|${targetRegionA.join(",")}|${targetRegionB ? targetRegionB.join(",") : ""}`;
      if (runKey === lastRunKeyRef.current && activeJobId) {
        return;
      }
      lastRunKeyRef.current = runKey;
      prevDatasetRef.current = targetDataset;
      prevVarRef.current = targetVar;
      prevRegionARef.current = targetRegionA.join(",");

      markInitialized();
      setInvestigationError(null);
      try {
        const payload = {
          dataset_id: targetDataset,
          variable: targetVar,
          period: targetPeriod,
          region_a: targetRegionA,
          region_b: targetRegionB ?? undefined,
          temporal_aggregation: "annual_mean" as const,
          spatial_aggregation: "area_weighted" as const,
          execution_mode: "auto" as const,
          selection_status: "predefined" as const,
        };

        const res = await createInvestigation.mutateAsync(payload);
        setActiveJobId(res.job_id);
      } catch (err: any) {
        console.warn("Failed to start investigation:", err);
        setInvestigationError(err?.message || "Investigation failed to submit");
      }
    },
    [createInvestigation, datasets, period, regionA, regionB, selectedDataset, selectedVariable, activeJobId, markInitialized],
  );

  // Hydrate region A from a previously persisted study plot (if any), but
  // do NOT auto-run an investigation. The evidence card and the trend grid
  // map layer stay hidden until the user explicitly picks a dataset/variable
  // (or selects a place / draws a region).
  const hasHydratedRegionRef = useRef(false);
  useEffect(() => {
    if (hasHydratedRegionRef.current) return;
    hasHydratedRegionRef.current = true;
    getActivePlot()
      .then((plot) => {
        if (plot && plot.bbox && plot.bbox.length === 4) {
          setRegionA({ bbox: plot.bbox, name: plot.name || "Drawn region" });
          setRegionAName(plot.name || "Drawn region");
        }
      })
      .catch(() => {
        /* No persisted plot — leave region at default global bbox. */
      });
  }, [setRegionA, setRegionAName]);

  // Re-run investigation when user brushes/selects a new temporal period
  const prevPeriodRef = useRef(period);
  useEffect(() => {
    if (
      prevPeriodRef.current.start_year !== period.start_year ||
      prevPeriodRef.current.end_year !== period.end_year
    ) {
      prevPeriodRef.current = period;
      if (hasInitializedRef.current && selectedDataset && selectedVariable) {
        runInvestigation(bboxOf(regionA), regionB ? bboxOf(regionB) : null, period);
      }
    }
  }, [period, regionA, regionB, runInvestigation, selectedDataset, selectedVariable]);

  // Year cursor → map date coupling (display-only). When the user selects a
  // year on the chart or evidence panel, the basemap day jumps to mid-year
  // of that calendar year so the satellite layer matches the focused year.
  const lastSyncedYearRef = useRef<number | null>(null);
  const lastSyncedMapDateRef = useRef<string>(mapDate);
  useEffect(() => {
    if (selectedYear == null) {
      lastSyncedYearRef.current = null;
      return;
    }
    if (lastSyncedYearRef.current === selectedYear) return;
    lastSyncedYearRef.current = selectedYear;
    const candidate = `${selectedYear}-07-01`;
    if (candidate !== lastSyncedMapDateRef.current) {
      lastSyncedMapDateRef.current = candidate;
      setMapDate(candidate);
    }
  }, [selectedYear, setMapDate]);

  // Re-run investigation whenever selected dataset, variable, or region changes
  useEffect(() => {
    const datasetChanged = prevDatasetRef.current !== selectedDataset;
    const varChanged = prevVarRef.current !== selectedVariable;
    const regionChanged = prevRegionARef.current !== regionA.bbox.join(",");

    if (datasetChanged || varChanged || regionChanged) {
      prevDatasetRef.current = selectedDataset;
      prevVarRef.current = selectedVariable;
      prevRegionARef.current = regionA.bbox.join(",");

      // If no dataset is selected, do NOT run an investigation or force a fallback
      if (!selectedDataset) {
        return;
      }

      // First change after page-load flips the "user has initiated" gate
      // when the user selected a dataset.
      if (!hasInitializedRef.current) {
        hasInitializedRef.current = true;
        setHasInitialized(true);
      }

      const store = getInvestigationStore();
      runInvestigation(
        bboxOf(regionA),
        regionB ? bboxOf(regionB) : null,
        period,
        store.state.selectedDataset,
        store.state.selectedVariable,
      );
    }
  }, [selectedDataset, selectedVariable, regionA, regionB, period, runInvestigation]);

  const handleLocationSelected = useCallback(
    (loc: SelectedLocationPayload) => {
      let nextBbox: BBox;

      if (loc.bbox && loc.bbox.length === 4) {
        nextBbox = loc.bbox as BBox;
      } else if (loc.point) {
        const halfSize = 1.0;
        const minLon = Math.max(-180, loc.point.longitude - halfSize);
        const maxLon = Math.min(180, loc.point.longitude + halfSize);
        const minLat = Math.max(-90, loc.point.latitude - halfSize);
        const maxLat = Math.min(90, loc.point.latitude + halfSize);
        nextBbox = [minLon, minLat, maxLon, maxLat];
      } else {
        return;
      }

      // Avoid double run: set prevRegionARef so useEffect doesn't double-fire
      prevRegionARef.current = nextBbox.join(",");
      setRegionA({ bbox: nextBbox, name: loc.name });
      setRegionAName(loc.name);
      setRegionB(null);

      // Create and persist active study plot for the searched location
      const [minLon, minLat, maxLon, maxLat] = nextBbox;
      const ring: [number, number][] = [
        [minLon, minLat],
        [maxLon, minLat],
        [maxLon, maxLat],
        [minLon, maxLat],
        [minLon, minLat],
      ];
      const areaSqM = polygonAreaSqM(ring);
      const areaKm2 = Number((areaSqM / 1_000_000).toFixed(2));
      const perimeterM = polygonPerimeterM(ring);
      const perimeterKm = Number((perimeterM / 1_000).toFixed(2));

      const plotRecord: PersistedPlot = {
        id: `search-${Date.now()}`,
        name: loc.name,
        bbox: nextBbox,
        geometry:
          loc.geojson &&
          (loc.geojson.type === "Polygon" || loc.geojson.type === "MultiPolygon")
            ? (loc.geojson as any)
            : {
                type: "Polygon",
                coordinates: [ring],
              },
        measurements: {
          areaKm2,
          perimeterKm,
          centroid: [(minLon + maxLon) / 2, (minLat + maxLat) / 2],
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      savePlot(plotRecord).catch(() => {});
      setActivePlot(plotRecord);
      window.dispatchEvent(
        new CustomEvent("terra-odyssey:plot-saved", { detail: { plot: plotRecord } }),
      );
      window.dispatchEvent(
        new CustomEvent("terra-odyssey:active-plot-changed", { detail: { plot: plotRecord } }),
      );

      // Place searches initiate the authoritative investigation flow. If the user
      // hasn't yet picked a dataset/variable we fall back to the canonical
      // MERRA-2 2-Meter Air Temperature reference.
      const { dataset: launchDataset, variable: launchVariable } = ensureDatasetSelected();

      markInitialized();
      runInvestigation(nextBbox, null, period, launchDataset, launchVariable);
    },
    [period, runInvestigation, setRegionA, setRegionAName, setRegionB, markInitialized],
  );

  const handleSelectDataset = useCallback(
    (d: DatasetMetadata) => {
      const store = getInvestigationStore();
      store.setSelectedDataset(d.dataset_id);
      store.setSelectedVariable(d.primary_variable);
      store.setCustomVariable(null);

      // Clamp analysis period to dataset coverage window if specified
      let targetPeriod = period;
      const startYr = d.coverage_start
        ? parseInt(d.coverage_start.slice(0, 4), 10)
        : d.temporal_bounds?.start_year;
      const endYr = d.coverage_end
        ? parseInt(d.coverage_end.slice(0, 4), 10)
        : d.temporal_bounds?.end_year ?? 2024;
      if (startYr != null && endYr != null && !isNaN(startYr) && !isNaN(endYr)) {
        const clampedStart = Math.max(startYr, period.start_year);
        const clampedEnd = Math.min(endYr, period.end_year);
        if (clampedStart !== period.start_year || clampedEnd !== period.end_year) {
          targetPeriod = {
            start_year: clampedStart > clampedEnd ? startYr : clampedStart,
            end_year: clampedStart > clampedEnd ? endYr : clampedEnd,
          };
          store.setPeriod(targetPeriod);
          setPeriod(targetPeriod);
        }
      }

      const canAnalyze = d.capabilities
        ? (d.capabilities.trend_supported || d.capabilities.series_supported)
        : true;

      setInvestigationError(null);

      if (canAnalyze) {
        markInitialized();
        runInvestigation(
          bboxOf(regionA),
          regionB ? bboxOf(regionB) : null,
          targetPeriod,
          d.dataset_id,
          d.primary_variable,
        );
      } else {
        setActiveJobId(null);
      }
    },
    [regionA, regionB, period, runInvestigation, markInitialized, setPeriod],
  );

  const handlePlotComplete = useCallback(
    (bbox: BBox) => {
      setRegionA({ bbox, name: "Drawn region" });
      setRegionAName("Drawn region");
      setRegionB(null);
      // Drawing a region without a chosen dataset should still get a
      // meaningful investigation; fall back to MERRA-2/T2M.
      const { dataset, variable } = ensureDatasetSelected();
      markInitialized();
      runInvestigation(bbox, null, period, dataset, variable);
    },
    [period, runInvestigation, setRegionA, setRegionB, markInitialized],
  );

  const handleClearAnalysis = useCallback(() => {
    // 1. Reset all investigation store properties atomically (unloads dataset & variable)
    const store = getInvestigationStore();
    store.clearInvestigation();

    // 2. Clear active job, error banner, and initiation flags
    setActiveJobId(null);
    setInvestigationError(null);
    hasInitializedRef.current = false;
    setHasInitialized(false);
    setRegionAName(DEFAULT_REGION_NAME);
    setHasPendingRegion(false);
    setEvidenceCardOpen(false);

    // 3. Reset internal tracking refs to empty
    lastRunKeyRef.current = "";
    prevDatasetRef.current = "";
    prevVarRef.current = "";
    prevRegionARef.current = DEFAULT_REGION_A_BBOX.join(",");

    // 4. Clear all persistent study plots from storage and active plot
    clearAllPlots().catch(() => {});
    setActivePlot(null);

    // 5. Dispatch events to clear map layers and drawing metrics
    window.dispatchEvent(new CustomEvent("terra-odyssey:clear-shapes"));
    window.dispatchEvent(
      new CustomEvent("terra-odyssey:active-plot-changed", { detail: { plot: null } }),
    );
    window.dispatchEvent(
      new CustomEvent("terra-odyssey:live-drawing-metrics", { detail: null }),
    );

    // 6. Log activity entry
    pushActivity({
      kind: "clear",
      label: "Analysis cleared",
      prevLabel: "No dataset loaded · workspace empty",
      accent: "rose",
      undo: () => {},
    });
  }, [setRegionAName, setHasPendingRegion]);

  const handleClearShapes = useCallback(() => {
    clearAllPlots().catch(() => {});
    setActivePlot(null);
    setRegionA({ bbox: DEFAULT_REGION_A_BBOX, name: DEFAULT_REGION_NAME });
    setRegionAName(DEFAULT_REGION_NAME);
    setRegionB(null);
    setHasPendingRegion(false);
    window.dispatchEvent(new CustomEvent("terra-odyssey:clear-shapes"));
    window.dispatchEvent(
      new CustomEvent("terra-odyssey:active-plot-changed", { detail: { plot: null } }),
    );
  }, [setRegionA, setRegionAName, setRegionB, setHasPendingRegion]);

  useEffect(() => {
    const onClear = () => {
      setRegionA({ bbox: DEFAULT_REGION_A_BBOX, name: DEFAULT_REGION_NAME });
      setRegionAName(DEFAULT_REGION_NAME);
      setRegionB(null);
      setHasPendingRegion(false);
      const store = getInvestigationStore();
      const currentDataset = store.state.selectedDataset;
      const currentVar = store.state.selectedVariable;
      if (currentDataset && currentVar && hasInitializedRef.current) {
        runInvestigation(DEFAULT_REGION_A_BBOX, null, period, currentDataset, currentVar);
      }
    };
    window.addEventListener("terra-odyssey:clear-shapes", onClear);
    return () => window.removeEventListener("terra-odyssey:clear-shapes", onClear);
  }, [period, runInvestigation, setRegionA, setRegionAName, setRegionB, setHasPendingRegion]);

  useEffect(() => {
    window.addEventListener("terra-odyssey:clear-analysis", handleClearAnalysis);
    return () => window.removeEventListener("terra-odyssey:clear-analysis", handleClearAnalysis);
  }, [handleClearAnalysis]);

  // Region Card CTAs surfaced from inside the map component.
  useEffect(() => {
    const onRerun = (ev?: Event) => {
      const detail = (ev as CustomEvent<{ bbox?: BBox; name?: string; areaKm2?: number }> | undefined)?.detail;
      const store = getInvestigationStore();
      setHasPendingRegion(false);
      store.setHasPendingRegion(false);

      const targetBbox = detail?.bbox || bboxOf(regionA);
      const targetName = detail?.name
        ? `${detail.name}${detail.areaKm2 ? ` (${detail.areaKm2.toLocaleString()} km²)` : ""}`
        : regionAName;

      setRegionA({ bbox: targetBbox, name: targetName });
      setRegionAName(targetName);
      setRegionB(null);

      const dataset = store.state.selectedDataset;
      const variable = store.state.selectedVariable;
      if (!dataset || !variable) return;
      markInitialized();
      runInvestigation(targetBbox, null, period, dataset, variable);
    };

    const onAnalyzeSection = (ev: Event) => {
      const detail = (ev as CustomEvent<{ bbox: BBox; name?: string; areaKm2?: number }>).detail;
      if (!detail?.bbox) return;
      const store = getInvestigationStore();
      setHasPendingRegion(false);
      store.setHasPendingRegion(false);

      const targetName = detail.name
        ? `${detail.name}${detail.areaKm2 ? ` (${detail.areaKm2.toLocaleString()} km²)` : ""}`
        : "Selected section";

      setRegionA({ bbox: detail.bbox, name: targetName });
      setRegionAName(targetName);
      setRegionB(null);

      const dataset = store.state.selectedDataset;
      const variable = store.state.selectedVariable;
      if (!dataset || !variable) return;
      markInitialized();
      runInvestigation(detail.bbox, null, period, dataset, variable);
    };

    const onAnalyzeGlobal = () => {
      const store = getInvestigationStore();
      setHasPendingRegion(false);
      store.setHasPendingRegion(false);

      setRegionA({ bbox: DEFAULT_REGION_A_BBOX, name: DEFAULT_REGION_NAME });
      setRegionAName(DEFAULT_REGION_NAME);
      setRegionB(null);

      const dataset = store.state.selectedDataset;
      const variable = store.state.selectedVariable;
      if (!dataset || !variable) return;
      markInitialized();
      runInvestigation(DEFAULT_REGION_A_BBOX, null, period, dataset, variable);
    };

    const onEdit = () => {
      setHasPendingRegion(true);
    };
    const onAutoRun = (ev: Event) => {
      const enabled = (ev as CustomEvent<{ enabled: boolean }>).detail?.enabled ?? true;
      setRegionAutoRun(enabled);
      if (enabled) setHasPendingRegion(false);
    };

    window.addEventListener("terra-odyssey:rerun-investigation", onRerun as EventListener);
    window.addEventListener("terra-odyssey:analyze-section", onAnalyzeSection as EventListener);
    window.addEventListener("terra-odyssey:analyze-global", onAnalyzeGlobal);
    window.addEventListener("terra-odyssey:edit-region", onEdit);
    window.addEventListener("terra-odyssey:set-region-auto-run", onAutoRun as EventListener);

    return () => {
      window.removeEventListener("terra-odyssey:rerun-investigation", onRerun as EventListener);
      window.removeEventListener("terra-odyssey:analyze-section", onAnalyzeSection as EventListener);
      window.removeEventListener("terra-odyssey:analyze-global", onAnalyzeGlobal);
      window.removeEventListener("terra-odyssey:edit-region", onEdit);
      window.removeEventListener("terra-odyssey:set-region-auto-run", onAutoRun as EventListener);
    };
  }, [runInvestigation, markInitialized, setHasPendingRegion, setRegionAutoRun, regionA, regionAName, period]);

  return (
    <div className="app-shell">
      <StatusStrip />
      <main className="workspace-stage" id="workspace">
        <div className="map-layer" aria-label="Interactive Earth trend map">
          <EarthTrendMapWrapper
            className="!absolute !inset-0 !h-full !rounded-none !border-0"
            gridData={mapGridQuery.data}
            regionA={bboxOf(regionA)}
            regionB={regionB ? bboxOf(regionB) : null}
            bottomOffset={16}
            hasUserInitiated={hasInitialized && Boolean(selectedDataset)}
            onMapInstanceChange={publishMap}
            onUpdateRegions={(a, b) => {
              setRegionA({ bbox: a, name: "Drawn region" });
              setRegionAName("Drawn region");
              setRegionB(b ? { bbox: b, name: "Drawn region" } : null);

              // Auto-run on draw is gated by both `regionAutoRun` and the
              // explicit "pending region awaiting Analyze commit" flag. When
              // the user toggled Manual Mode via the Edit-selection CTA,
              // we hold the region and wait for them to click Analyze.
              const store = getInvestigationStore();
              if (store.state.hasPendingRegion) {
                setHasPendingRegion(false);
                return;
              }
              if (!store.state.regionAutoRun) {
                setHasPendingRegion(true);
                return;
              }

              const { dataset, variable } = ensureDatasetSelected();
              markInitialized();
              runInvestigation(a, b, period, dataset, variable);
            }}
          />
        </div>

        <header className="workspace-topbar" aria-label="Terra Odyssey navigation">
          <a className="workspace-brand" href="#workspace" aria-label="Terra Odyssey home">
            <img src="/terra-odyssey-logo.png" alt="Terra Odyssey" draggable={false} />
          </a>
          <UniversalQueryBar onLocationSelected={handleLocationSelected} />
          <div className="workspace-topbar-balance flex items-center justify-end">
            <TopNavDeck
              menuOpen={menuOpen}
              onToggleMenu={() => setMenuOpen((o) => !o)}
              onClearShapes={handleClearShapes}
            />
          </div>
        </header>

        <MenuPanel
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          onSelectDataset={handleSelectDataset}
          onPlotComplete={handlePlotComplete}
        />

        {/* Right-Side Floating Scientific Evidence Card */}
        <FloatingEvidenceCard
          open={evidenceCardOpen && hasInitialized && Boolean(selectedDataset)}
          onClose={() => setEvidenceCardOpen(false)}
          evidence={evidenceQuery.data ?? null}
          series={seriesQuery.data ?? null}
          isLoading={isJobRunning || evidenceQuery.isLoading}
          isComputing={isJobRunning}
          counts={counts}
          log={log}
          onUndo={handleUndo}
          datasetTitle={activeDatasetObj?.title}
          variableName={selectedVariable}
        />
      </main>

      <ActivityDock
        datasets={datasets}
        onSelectDataset={handleSelectDataset}
        series={seriesQuery.data ?? null}
        seriesLoading={isJobRunning || seriesQuery.isLoading}
        seriesError={
          isJobFailed || (isJobSucceeded && seriesQuery.isError)
        }
        evidence={evidenceQuery.data ?? null}
        jobStatus={statusQuery.data?.job_status ?? (createInvestigation.isPending ? "submitted" : "idle")}
        stage={statusQuery.data?.stage}
        progress={statusQuery.data?.progress ?? statusQuery.data?.progress_pct}
        errorMessage={
          investigationError ||
          (statusQuery.data?.error?.message as string) ||
          (seriesQuery.error ? "Failed to load series" : undefined)
        }
        onRetry={() => runInvestigation()}
        onRunDefault={() => {
          setRegionA({ bbox: DEFAULT_REGION_A_BBOX, name: DEFAULT_REGION_NAME });
          setRegionAName(DEFAULT_REGION_NAME);
          setRegionB(null);
          const { dataset, variable } = ensureDatasetSelected();
          markInitialized();
          runInvestigation(DEFAULT_REGION_A_BBOX, null, DEFAULT_PERIOD, dataset, variable);
        }}
        onClearAnalysis={handleClearAnalysis}
        collapsed={dockCollapsed}
        onToggleCollapse={() => setDockCollapsed((c) => !c)}
        evidenceCardOpen={evidenceCardOpen}
        onToggleEvidenceCard={() => setEvidenceCardOpen((o) => !o)}
      />

      <FooterStatusBar systemVersion={capabilities?.system_version || "0.1.0-mvp"} />
    </div>
  );
}
