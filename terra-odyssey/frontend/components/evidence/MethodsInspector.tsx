"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight, ShieldCheck, Database, Sliders, Layers } from "lucide-react";

interface MethodsInspectorProps {
  datasetId: string;
  variableName: string;
  temporalAggregation?: string;
  spatialAggregation?: string;
  fdrMethod?: string;
  lag?: number;
}

export const MethodsInspector: React.FC<MethodsInspectorProps> = ({
  datasetId,
  variableName,
  temporalAggregation = "Annual Mean (calendar-hour weighted)",
  spatialAggregation = "Area-Weighted Geodesic (pyproj.Geod)",
  fdrMethod = "Benjamini-Yekutieli (arbitrary dependency)",
  lag = 2,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const isMerra = datasetId.toLowerCase().includes("merra") || datasetId.toLowerCase().includes("d1");

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg text-slate-200 overflow-hidden text-xs">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3.5 hover:bg-slate-800/60 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-slate-100">
            Scientific Protocol &amp; Methodology Specification
          </span>
          <span className="text-slate-500 font-mono text-[11px]">
            [OLS+HAC Lag={lag}, FDR={fdrMethod.split(" ")[0]}]
          </span>
        </div>
        <div className="flex items-center gap-1 text-slate-400">
          <span>{isOpen ? "Collapse" : "Expand Details"}</span>
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 pt-1 border-t border-slate-800 space-y-4 bg-slate-950/40">
          {/* Section 1: NASA Product Provenance */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-slate-300">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              1. NASA Earth Science Data Product &amp; Citation
            </div>
            {isMerra ? (
              <div className="pl-5 text-slate-400 space-y-1">
                <p>
                  <strong>Product:</strong> Modern-Era Retrospective Analysis for Research and Applications, Version 2 (MERRA-2)
                </p>
                <p>
                  <strong>Collection:</strong> M2TMNXSLV (v5.12.4), Monthly Mean 2-meter Air Temperature (T2M).
                </p>
                <p>
                  <strong>DOI:</strong>{" "}
                  <a
                    href="https://doi.org/10.5067/AP1B0BA5PD2K"
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 underline"
                  >
                    10.5067/AP1B0BA5PD2K
                  </a>
                </p>
                <p className="text-[11px] text-slate-500">
                  <em>Scientific Rule:</em> MERRA-2 is an atmospheric reanalysis synthesizing satellite observations with Goddard Earth Observing System (GEOS-5) numerical model integration; it is not a direct satellite measurement.
                </p>
              </div>
            ) : (
              <div className="pl-5 text-slate-400 space-y-1">
                <p>
                  <strong>Product:</strong> Global Precipitation Measurement (GPM) Integrated Multi-satellitE Retrievals for GPM (IMERG)
                </p>
                <p>
                  <strong>Collection:</strong> GPM_3IMERGM (v07B), Monthly Final Calibrated Precipitation (precipitationCal).
                </p>
                <p>
                  <strong>DOI:</strong>{" "}
                  <a
                    href="https://doi.org/10.5067/GPM/IMERG/3B-MONTH/07"
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 underline"
                  >
                    10.5067/GPM/IMERG/3B-MONTH/07
                  </a>
                </p>
                <p className="text-[11px] text-slate-500">
                  <em>Scientific Rule:</em> IMERG synthesizes passive microwave and infrared satellite radiometer retrievals with GPCC monthly rain-gauge calibration over land.
                </p>
              </div>
            )}
          </div>

          {/* Section 2: Spatial & Temporal Processing */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-slate-300">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              2. Spatial Weighting &amp; Temporal Integration
            </div>
            <div className="pl-5 text-slate-400 space-y-1">
              <p>
                <strong>Spatial Support:</strong> Exact spherical cell-boundary areas computed via WGS-84 ellipsoidal geometry (<code>pyproj.Geod</code>). Cells intersecting polygon boundaries are weighted by fractional polygon area overlap.
              </p>
              <p>
                <strong>Temporal Support:</strong> Aggregated from monthly to annual series via calendar-hour weighting (accounting for leap years and month lengths). Years with missing monthly granules are flagged and never silently interpolated.
              </p>
              <p>
                <strong>Eligibility Gate:</strong> Requires &ge;20 consecutive complete years of records and &ge;90% spatial valid cell coverage.
              </p>
            </div>
          </div>

          {/* Section 3: Trend Estimator & Multiplicity */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-slate-300">
              <Sliders className="w-3.5 h-3.5 text-purple-400" />
              3. Estimator &amp; Multiple-Testing Control
            </div>
            <div className="pl-5 text-slate-400 space-y-1">
              <p>
                <strong>Estimator:</strong> Ordinary Least Squares (OLS) with Newey-West Heteroskedasticity and Autocorrelation Consistent (HAC) covariance matrix.
              </p>
              <p>
                <strong>Lag Specification:</strong> Truncation lag parameter fixed at <em>L = {lag}</em> with a Bartlett triangular kernel and small-sample degrees-of-freedom correction <em>n / (n - 2)</em>. Reference distribution: two-sided Student-t with <em>df = n - 2</em>.
              </p>
              <p>
                <strong>Multiple Testing:</strong> Gridded screening maps control False Discovery Rate via <em>Benjamini-Yekutieli (2001)</em> under arbitrary spatial dependency. Sensitivity tests are cross-referenced with Benjamini-Hochberg (1995).
              </p>
              <p>
                <strong>Exploratory Disclosure:</strong> Regions drawn after inspecting the screening field are flagged as exploratory post-hoc hypotheses; their contrast p-value is unadjusted and disclosed honestly.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
