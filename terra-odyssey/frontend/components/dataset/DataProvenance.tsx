"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, FileText } from "lucide-react";
import type { DatasetMetadata } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export interface DataProvenanceProps {
  dataset: DatasetMetadata | null | undefined;
  className?: string;
  defaultOpen?: boolean;
}

/**
 * Collapsible data-provenance disclosure for dataset pickers.
 *
 * Lists:
 *   • Source (provider)
 *   • Product / Collection
 *   • Version
 *   • Native + spatial resolution
 *   • Temporal coverage
 *   • Citation
 *   • License
 *
 * The DOI is rendered as a "View NASA metadata ↗" link to https://doi.org/<doi>.
 */
export function DataProvenance({ dataset, className, defaultOpen = false }: DataProvenanceProps) {
  const [open, setOpen] = useState(defaultOpen);
  if (!dataset) return null;

  const doi = dataset.doi;
  const doiHref = doi && doi.startsWith("http") ? doi : doi ? `https://doi.org/${doi}` : null;
  const lat = dataset.spatial_resolution?.lat_deg?.toFixed(3) ?? "—";
  const lon = dataset.spatial_resolution?.lon_deg?.toFixed(3) ?? "—";
  const temporal =
    dataset.temporal_bounds?.start_year && dataset.temporal_bounds?.end_year
      ? `${dataset.temporal_bounds.start_year}–${dataset.temporal_bounds.end_year}`
      : "—";
  const provider = dataset.provider ?? "NASA Earth Science";

  return (
    <div className={cn("rounded-lg border border-slate-200 bg-slate-50/80", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left transition hover:bg-slate-100"
      >
        <span className="inline-flex items-center gap-1.5">
          <FileText className="h-3 w-3 text-slate-500" aria-hidden="true" />
          <span className="typo-eyebrow text-slate-600">Data provenance</span>
        </span>
        {open ? (
          <ChevronUp className="h-3 w-3 text-slate-500" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-3 w-3 text-slate-500" aria-hidden="true" />
        )}
      </button>
      {open && (
        <dl className="space-y-1 border-t border-slate-200 px-2.5 py-2 typo-meta text-slate-700">
          <Row label="Source" value={provider} />
          {dataset.collection ? <Row label="Product" value={dataset.collection} /> : null}
          {dataset.version ? <Row label="Version" value={dataset.version} /> : null}
          <Row label="Native resolution" value={`${lat}° lat × ${lon}° lon`} />
          <Row label="Temporal coverage" value={temporal} />
          {dataset.citation_statement ? (
            <div className="mt-1.5 border-t border-slate-200 pt-1.5">
              <dt className="typo-eyebrow text-slate-500 mb-0.5">Citation</dt>
              <dd className="leading-snug">{dataset.citation_statement}</dd>
              {doiHref ? (
                <a
                  href={doiHref}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-1 inline-flex items-center gap-1 typo-micro font-semibold text-cyan-800 underline-offset-2 hover:underline"
                >
                  View {provider.includes("NASA") ? "NASA" : "source"} metadata
                  <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
                </a>
              ) : null}
            </div>
          ) : null}
        </dl>
      )}
    </div>
  );
}

interface RowProps {
  label: string;
  value: string;
}
function Row({ label, value }: RowProps) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="typo-eyebrow text-slate-500">{label}</dt>
      <dd className="text-right font-mono text-slate-800">{value}</dd>
    </div>
  );
}
