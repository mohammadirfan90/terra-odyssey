"use client";

import React, { useState, useMemo } from "react";
import type { DatasetMetadata } from "@/lib/api/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Thermometer,
  CloudRain,
  ExternalLink,
  Search,
  CheckCircle,
  Eye,
  GitCompare,
  AlertTriangle,
  Globe2,
  Clock,
} from "lucide-react";
import { AgencyLogo } from "@/components/icons/AgencyLogos";
import {
  DOMAINS,
  SUB_TOPICS,
  USE_CASES,
  domainFromCategory,
  extractUseCasesFromCategories,
  isGlobalIndex,
  type Domain,
  type UseCase,
} from "@/lib/datasetTaxonomy";

interface DatasetCatalogProps {
  datasets: DatasetMetadata[];
  selectedId: string;
  onSelect: (dataset: DatasetMetadata) => void;
  className?: string;
}

const CURRENT_YEAR = new Date().getFullYear();

export function DatasetCatalog({
  datasets,
  selectedId,
  onSelect,
  className = "",
}: DatasetCatalogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<Domain>("All");
  const [selectedSubTopic, setSelectedSubTopic] = useState<string | null>(null);
  const [selectedUseCases, setSelectedUseCases] = useState<UseCase[]>([]);

  const safeDatasets = Array.isArray(datasets) ? datasets : [];

  // Domain pills – derive the set actually present so empty domains don't show.
  const presentDomains = useMemo(() => {
    const domains = new Set<Domain>();
    for (const d of safeDatasets) {
      for (const cat of d.categories ?? []) {
        const dom = domainFromCategory(cat);
        if (dom) domains.add(dom);
      }
    }
    return ["All", ...[...domains].sort()] as Domain[];
  }, [safeDatasets]);

  // Sub-topics for the currently selected domain (or empty if "All").
  const visibleSubTopics = useMemo(() => {
    if (selectedDomain === "All") return [];
    return SUB_TOPICS[selectedDomain] ?? [];
  }, [selectedDomain]);

  const filteredDatasets = useMemo(() => {
    return safeDatasets.filter((d) => {
      // Domain filter
      if (selectedDomain !== "All") {
        const domMatch = (d.categories ?? []).some((cat) => {
          const dom = domainFromCategory(cat);
          return dom === selectedDomain;
        });
        if (!domMatch) return false;
      }

      // Sub-topic filter (must be paired with active domain)
      if (selectedSubTopic) {
        const want = `${selectedDomain}:${selectedSubTopic}`;
        if (!(d.categories ?? []).includes(want)) return false;
      }

      // Use-case filter (any-of)
      if (selectedUseCases.length > 0) {
        const dUses = extractUseCasesFromCategories(d.categories);
        if (!selectedUseCases.some((u) => dUses.includes(u))) return false;
      }

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchTitle = (d.title || "").toLowerCase().includes(q);
      const matchId = (d.dataset_id || "").toLowerCase().includes(q);
      const matchVar = (d.primary_variable || "").toLowerCase().includes(q);
      const matchCollection = (d.collection || "").toLowerCase().includes(q);
      const matchProvider = (d.provider || "").toLowerCase().includes(q);
      const matchCat = (d.categories ?? []).join(" ").toLowerCase().includes(q);
      return matchTitle || matchId || matchVar || matchCollection || matchProvider || matchCat;
    });
  }, [safeDatasets, selectedDomain, selectedSubTopic, selectedUseCases, searchQuery]);

  const toggleUseCase = (uc: UseCase) => {
    setSelectedUseCases((prev) =>
      prev.includes(uc) ? prev.filter((u) => u !== uc) : [...prev, uc],
    );
  };

  return (
    <div className={`flex flex-col gap-3 w-full ${className}`}>
      {/* Search Bar */}
      <div className="relative w-full">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter datasets by name, variable, or collection…"
          className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-900/90 border border-slate-800 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 transition"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200"
          >
            ×
          </button>
        )}
      </div>

      {/* Row 1: Domain pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
        {presentDomains.map((domain) => {
          const isSelected = selectedDomain === domain;
          return (
            <button
              key={domain}
              type="button"
              onClick={() => {
                setSelectedDomain(domain);
                setSelectedSubTopic(null);
              }}
              className={`px-2.5 py-0.5 rounded-full border transition whitespace-nowrap ${
                isSelected
                  ? "bg-cyan-500/20 border-cyan-400/60 text-cyan-200 font-medium"
                  : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
              }`}
            >
              {domain}
            </button>
          );
        })}
      </div>

      {/* Row 2: Sub-topic chips (conditional) */}
      {visibleSubTopics.length > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-[10px]">
          <span className="text-slate-500 uppercase tracking-wider pr-1 shrink-0">
            {selectedDomain}:
          </span>
          <button
            type="button"
            onClick={() => setSelectedSubTopic(null)}
            className={`px-2 py-0.5 rounded-full border transition whitespace-nowrap ${
              selectedSubTopic === null
                ? "bg-slate-700 border-slate-600 text-slate-100"
                : "bg-slate-900/40 border-slate-800 text-slate-500 hover:text-slate-300"
            }`}
          >
            All
          </button>
          {visibleSubTopics.map((sub) => {
            const isSelected = selectedSubTopic === sub;
            return (
              <button
                key={sub}
                type="button"
                onClick={() => setSelectedSubTopic(isSelected ? null : sub)}
                className={`px-2 py-0.5 rounded-full border transition whitespace-nowrap ${
                  isSelected
                    ? "bg-cyan-500/15 border-cyan-400/50 text-cyan-200"
                    : "bg-slate-900/40 border-slate-800 text-slate-500 hover:text-slate-300"
                }`}
              >
                {sub}
              </button>
            );
          })}
        </div>
      )}

      {/* Row 3: Use-case chips (multi-select) */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-[10px]">
        <span className="text-slate-500 uppercase tracking-wider pr-1 shrink-0">
          Use case:
        </span>
        {USE_CASES.map((uc) => {
          const isSelected = selectedUseCases.includes(uc);
          return (
            <button
              key={uc}
              type="button"
              onClick={() => toggleUseCase(uc)}
              className={`px-2 py-0.5 rounded-full border transition whitespace-nowrap ${
                isSelected
                  ? "bg-emerald-500/15 border-emerald-400/50 text-emerald-200"
                  : "bg-slate-900/40 border-slate-800 text-slate-500 hover:text-slate-300"
              }`}
            >
              {uc}
            </button>
          );
        })}
        {selectedUseCases.length > 0 && (
          <button
            type="button"
            onClick={() => setSelectedUseCases([])}
            className="ml-1 px-2 py-0.5 text-slate-500 hover:text-slate-300"
          >
            clear
          </button>
        )}
      </div>

      {/* Dataset Grid */}
      {filteredDatasets.length === 0 ? (
        <div className="p-4 border border-slate-800 rounded-xl bg-slate-900/40 text-xs text-slate-400 text-center font-mono">
          No matching Earth system datasets found.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 w-full">
          {filteredDatasets.map((d) => {
            const isSelected = d.dataset_id === selectedId;
            const caps = d.capabilities;
            const isTrendReady = Boolean(caps?.trend_supported);
            const badges = caps?.badges || ["Browse"];
            const unsupportedReason = caps?.unsupported_reason;
            const isMerra =
              (d.dataset_id && d.dataset_id.includes("merra")) ||
              d.data_type === "reanalysis_model";
            const isIndex = isGlobalIndex(d);
            const coverageEnd = d.temporal_bounds?.end_year ?? CURRENT_YEAR;
            const isMissionEnded = coverageEnd < CURRENT_YEAR - 1;

            return (
              <Card
                key={d.dataset_id}
                onClick={() => onSelect(d)}
                className={`cursor-pointer transition-all duration-200 border rounded-xl overflow-hidden ${
                  isSelected
                    ? "border-cyan-400 bg-cyan-950/20 shadow-lg shadow-cyan-950/40"
                    : "border-slate-800/80 hover:border-slate-700 bg-slate-900/60"
                }`}
              >
                <CardHeader className="p-3 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`p-2 rounded-lg mt-0.5 shrink-0 ${
                          isMerra
                            ? "bg-amber-950/60 text-amber-400 border border-amber-800/40"
                            : isIndex
                              ? "bg-purple-950/60 text-purple-400 border border-purple-800/40"
                              : "bg-cyan-950/60 text-cyan-400 border border-cyan-800/40"
                        }`}
                      >
                        {isMerra ? (
                          <Thermometer className="w-4 h-4" />
                        ) : isIndex ? (
                          <Globe2 className="w-4 h-4" />
                        ) : (
                          <CloudRain className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-xs font-semibold text-slate-100">
                            {d.title || d.dataset_id}
                          </CardTitle>
                          {isSelected && (
                            <span className="flex h-2 w-2 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400" />
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <Badge
                            variant="outline"
                            className="text-[9px] py-0 px-1.5 border-slate-700 text-slate-300 font-mono"
                          >
                            {d.collection || "UNKNOWN"} v{d.version || "1.0"}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-[9px] py-0 px-1.5 border-slate-800 text-slate-400"
                          >
                            {d.topic || "Atmosphere"}
                          </Badge>
                          {isIndex && (
                            <Badge
                              variant="outline"
                              className="text-[9px] py-0 px-1.5 border-purple-700 text-purple-300"
                              title="Global climate index — time series only"
                            >
                              <Globe2 className="w-2.5 h-2.5 mr-0.5" /> Index
                            </Badge>
                          )}
                          {isMissionEnded && !isIndex && (
                            <Badge
                              variant="outline"
                              className="text-[9px] py-0 px-1.5 border-amber-800 text-amber-400"
                              title={`Mission ended ${coverageEnd}`}
                            >
                              <Clock className="w-2.5 h-2.5 mr-0.5" /> Ended {coverageEnd}
                            </Badge>
                          )}
                          <AgencyLogo
                            agency={d.provider || "NASA"}
                            size={16}
                            showLabel={true}
                          />
                        </div>
                        {/* Categories as a tiny meta strip */}
                        {d.categories && d.categories.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 mt-1.5">
                            {d.categories.slice(0, 3).map((cat) => (
                              <span
                                key={cat}
                                className="text-[9px] font-mono text-slate-500 bg-slate-800/40 px-1.5 py-px rounded border border-slate-800"
                              >
                                {cat}
                              </span>
                            ))}
                            {d.categories.length > 3 && (
                              <span className="text-[9px] font-mono text-slate-600">
                                +{d.categories.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Capability Badges */}
                    <div className="flex flex-wrap items-center justify-end gap-1 shrink-0">
                      {badges.map((b) => {
                        if (b === "Analyze") {
                          return (
                            <span
                              key={b}
                              className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                              title="Full quantitative trend analysis active"
                            >
                              <CheckCircle className="w-2.5 h-2.5" />
                              Analyze
                            </span>
                          );
                        }
                        if (b === "Compare") {
                          return (
                            <span
                              key={b}
                              className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30"
                              title="Paired regional contrast supported"
                            >
                              <GitCompare className="w-2.5 h-2.5" />
                              Compare
                            </span>
                          );
                        }
                        if (b === "View") {
                          return (
                            <span
                              key={b}
                              className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                              title="GIBS visual preview available"
                            >
                              <Eye className="w-2.5 h-2.5" />
                              View
                            </span>
                          );
                        }
                        return (
                          <span
                            key={b}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700"
                          >
                            Browse
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-3 pt-0 text-[11px] text-slate-400 space-y-2">
                  <p className="line-clamp-2 leading-relaxed text-slate-300/90">
                    {d.measurement_principle || "NASA Earth observation dataset."}
                  </p>

                  {/* Unavailable Notice if Not Trend Ready */}
                  {!isTrendReady && unsupportedReason && (
                    <div className="flex items-start gap-1.5 p-2 rounded-lg bg-amber-950/30 border border-amber-800/40 text-[10px] text-amber-300/90 leading-normal">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                      <span>{unsupportedReason}</span>
                    </div>
                  )}

                  {/* Metadata Footer */}
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-2 border-t border-slate-800/60">
                    <span>
                      Res: {d.native_resolution || `${d.spatial_resolution?.lat_deg ?? 0.5}° × ${d.spatial_resolution?.lon_deg ?? 0.625}°`}
                    </span>
                    <span>
                      Bounds: {d.temporal_bounds?.start_year ?? 1980}–{coverageEnd}
                    </span>
                    {d.doi && (
                      <a
                        href={d.doi}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-cyan-400 hover:underline"
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
      )}

      {/* Disclaimer footer */}
      <p className="text-[9.5px] text-slate-500 italic px-1 pt-1">
        Includes selected ESA Copernicus datasets distributed via NASA Earthdata Cloud.
      </p>
    </div>
  );
}
