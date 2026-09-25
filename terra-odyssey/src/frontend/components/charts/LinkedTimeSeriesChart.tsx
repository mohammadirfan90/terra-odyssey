"use client";

import React, { useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import {
  TimeSeriesDatum,
  computeLinearTrend,
  CHART_COLORS,
} from "@/lib/charts/d3-time-series";
import { CoverageBars } from "./CoverageBars";

interface LinkedTimeSeriesChartProps {
  data: TimeSeriesDatum[];
  unit: string;
  variableName: string;
  regionAName?: string;
  regionBName?: string;
}

export const LinkedTimeSeriesChart: React.FC<LinkedTimeSeriesChartProps> = ({
  data,
  unit,
  variableName,
  regionAName = "Region A",
  regionBName = "Region B",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredYear, setHoveredYear] = useState<number | null>(null);

  const hasRegionB = useMemo(
    () => data.some((d) => d.region_b_value !== undefined && d.region_b_value !== null),
    [data]
  );

  // Compute linear fits
  const trendA = useMemo(
    () => computeLinearTrend(data.map((d) => ({ year: d.year, val: d.region_a_value }))),
    [data]
  );

  const trendB = useMemo(() => {
    if (!hasRegionB) return null;
    return computeLinearTrend(
      data
        .filter((d) => d.region_b_value !== undefined && d.region_b_value !== null)
        .map((d) => ({ year: d.year, val: d.region_b_value! }))
    );
  }, [data, hasRegionB]);

  const trendDiff = useMemo(() => {
    if (!hasRegionB) return null;
    return computeLinearTrend(
      data
        .filter((d) => d.difference_value !== undefined && d.difference_value !== null)
        .map((d) => ({ year: d.year, val: d.difference_value! }))
    );
  }, [data, hasRegionB]);

  // Dimensions & Scales
  const width = 760;
  const topHeight = hasRegionB ? 200 : 280;
  const bottomHeight = hasRegionB ? 140 : 0;
  const margin = { top: 20, right: 30, bottom: 25, left: 55 };

  const innerWidth = width - margin.left - margin.right;
  const innerTopHeight = topHeight - margin.top - margin.bottom;
  const innerBottomHeight = bottomHeight > 0 ? bottomHeight - 15 - margin.bottom : 0;

  // X scale (Year)
  const years = data.map((d) => d.year);
  const minYear = d3.min(years) ?? 2000;
  const maxYear = d3.max(years) ?? 2024;
  const xScale = useMemo(
    () => d3.scaleLinear().domain([minYear, maxYear]).range([0, innerWidth]),
    [minYear, maxYear, innerWidth]
  );

  // Top Y scale (Region A & B values)
  const topYScale = useMemo(() => {
    const allVals: number[] = [];
    data.forEach((d) => {
      if (!isNaN(d.region_a_value)) allVals.push(d.region_a_value);
      if (d.region_b_value !== undefined && !isNaN(d.region_b_value)) allVals.push(d.region_b_value);
    });
    const [minV, maxV] = d3.extent(allVals);
    const pad = ((maxV ?? 1) - (minV ?? 0)) * 0.1 || 1.0;
    return d3
      .scaleLinear()
      .domain([(minV ?? 0) - pad, (maxV ?? 1) + pad])
      .range([innerTopHeight, 0])
      .nice();
  }, [data, innerTopHeight]);

  // Bottom Y scale (Difference values)
  const bottomYScale = useMemo(() => {
    if (!hasRegionB) return null;
    const diffs = data
      .map((d) => d.difference_value)
      .filter((v): v is number => v !== undefined && !isNaN(v));
    const maxAbs = d3.max(diffs, (v) => Math.abs(v)) || 1.0;
    const pad = maxAbs * 0.15;
    return d3
      .scaleLinear()
      .domain([-(maxAbs + pad), maxAbs + pad])
      .range([innerBottomHeight, 0])
      .nice();
  }, [data, hasRegionB, innerBottomHeight]);

  // Active hover datum
  const activeDatum = useMemo(() => {
    if (hoveredYear === null) return null;
    return data.find((d) => d.year === hoveredYear) ?? null;
  }, [hoveredYear, data]);

  // Mouse move handler for crosshair
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svgRect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - svgRect.left;
    const mouseX = clientX * (width / svgRect.width) - margin.left;

    if (mouseX >= 0 && mouseX <= innerWidth) {
      const year = Math.round(xScale.invert(mouseX));
      const clampedYear = Math.max(minYear, Math.min(maxYear, year));
      setHoveredYear(clampedYear);
    }
  };

  const handlePointerLeave = () => {
    setHoveredYear(null);
  };

  // Line generators
  const lineA = d3
    .line<TimeSeriesDatum>()
    .x((d) => xScale(d.year))
    .y((d) => topYScale(d.region_a_value))
    .curve(d3.curveMonotoneX);

  const lineB = hasRegionB
    ? d3
        .line<TimeSeriesDatum>()
        .defined((d) => d.region_b_value !== undefined && !isNaN(d.region_b_value))
        .x((d) => xScale(d.year))
        .y((d) => topYScale(d.region_b_value!))
        .curve(d3.curveMonotoneX)
    : null;

  const lineDiff = hasRegionB
    ? d3
        .line<TimeSeriesDatum>()
        .defined((d) => d.difference_value !== undefined && !isNaN(d.difference_value))
        .x((d) => xScale(d.year))
        .y((d) => bottomYScale!(d.difference_value!))
        .curve(d3.curveMonotoneX)
    : null;

  const yearTicks = xScale.ticks(Math.min(years.length, 10));

  return (
    <div
      ref={containerRef}
      className="bg-slate-900/90 rounded-lg p-4 border border-slate-800 text-slate-200 select-none"
    >
      {/* Chart Header & Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-800 text-xs">
        <div>
          <h4 className="font-semibold text-slate-100 text-sm">
            Regional Annual Time-Series &amp; Synchronous Difference
          </h4>
          <p className="text-slate-400 text-xs mt-0.5">
            Area-weighted annual mean of {variableName} ({unit}) with OLS + HAC trend lines
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          {/* Region A */}
          <div className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-full border border-amber-300"
              style={{ backgroundColor: CHART_COLORS.regionA }}
            />
            <span className="text-amber-300 font-semibold">{regionAName}</span>
            {trendA && (
              <span className="text-slate-400 text-[11px]">
                ({(trendA.slope_per_year * 10).toFixed(2)} {unit}/dec)
              </span>
            )}
          </div>

          {/* Region B */}
          {hasRegionB && (
            <div className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-[2px] border border-cyan-300"
                style={{ backgroundColor: CHART_COLORS.regionB }}
              />
              <span className="text-cyan-300 font-semibold">{regionBName}</span>
              {trendB && (
                <span className="text-slate-400 text-[11px]">
                  ({(trendB.slope_per_year * 10).toFixed(2)} {unit}/dec)
                </span>
              )}
            </div>
          )}

          {/* Difference */}
          {hasRegionB && (
            <div className="flex items-center gap-1.5">
              <span
                className="w-3 h-1 border-t-2 border-slate-400"
              />
              <span className="text-slate-300 font-semibold">Diff (A - B)</span>
              {trendDiff && (
                <span className="text-slate-400 text-[11px]">
                  ({(trendDiff.slope_per_year * 10).toFixed(2)} {unit}/dec)
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${topHeight + bottomHeight}`}
          className="w-full h-auto cursor-crosshair"
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          {/* TOP PANEL: REGION A & REGION B */}
          <g transform={`translate(${margin.left}, ${margin.top})`}>
            {/* Grid Lines */}
            {topYScale.ticks(5).map((tick) => (
              <g key={`top-grid-${tick}`} transform={`translate(0, ${topYScale(tick)})`}>
                <line x1={0} x2={innerWidth} stroke={CHART_COLORS.gridLines} strokeDasharray="2,2" />
                <text
                  x={-8}
                  y={4}
                  fill="#94a3b8"
                  fontSize={10}
                  fontFamily="monospace"
                  textAnchor="end"
                >
                  {tick.toFixed(1)}
                </text>
              </g>
            ))}

            {/* Region A Fitted Trend Line */}
            {trendA && (
              <line
                x1={xScale(trendA.start_point.year)}
                y1={topYScale(trendA.start_point.val)}
                x2={xScale(trendA.end_point.year)}
                y2={topYScale(trendA.end_point.val)}
                stroke={CHART_COLORS.regionATrend}
                strokeWidth={2}
                strokeDasharray="4,3"
                opacity={0.8}
              />
            )}

            {/* Region B Fitted Trend Line */}
            {trendB && (
              <line
                x1={xScale(trendB.start_point.year)}
                y1={topYScale(trendB.start_point.val)}
                x2={xScale(trendB.end_point.year)}
                y2={topYScale(trendB.end_point.val)}
                stroke={CHART_COLORS.regionBTrend}
                strokeWidth={2}
                strokeDasharray="4,3"
                opacity={0.8}
              />
            )}

            {/* Region A Line Path */}
            <path
              d={lineA(data) ?? ""}
              fill="none"
              stroke={CHART_COLORS.regionA}
              strokeWidth={2.5}
            />

            {/* Region B Line Path */}
            {lineB && (
              <path
                d={lineB(data) ?? ""}
                fill="none"
                stroke={CHART_COLORS.regionB}
                strokeWidth={2.5}
              />
            )}

            {/* Observed Points A */}
            {data.map((d) => (
              <circle
                key={`pt-a-${d.year}`}
                cx={xScale(d.year)}
                cy={topYScale(d.region_a_value)}
                r={hoveredYear === d.year ? 5 : 3.5}
                fill={CHART_COLORS.regionA}
                stroke="#0f172a"
                strokeWidth={1.5}
                className="transition-all"
              />
            ))}

            {/* Observed Points B */}
            {hasRegionB &&
              data.map((d) =>
                d.region_b_value !== undefined ? (
                  <rect
                    key={`pt-b-${d.year}`}
                    x={xScale(d.year) - (hoveredYear === d.year ? 4.5 : 3)}
                    y={topYScale(d.region_b_value) - (hoveredYear === d.year ? 4.5 : 3)}
                    width={hoveredYear === d.year ? 9 : 6}
                    height={hoveredYear === d.year ? 9 : 6}
                    fill={CHART_COLORS.regionB}
                    stroke="#0f172a"
                    strokeWidth={1.5}
                    className="transition-all"
                  />
                ) : null
              )}

            {/* Top Y Axis Label */}
            <text
              transform="rotate(-90)"
              x={-innerTopHeight / 2}
              y={-40}
              fill="#94a3b8"
              fontSize={11}
              textAnchor="middle"
              fontFamily="sans-serif"
            >
              Observed Value ({unit})
            </text>

            {/* Crosshair Vertical Line (Top) */}
            {hoveredYear !== null && (
              <line
                x1={xScale(hoveredYear)}
                y1={0}
                x2={xScale(hoveredYear)}
                y2={innerTopHeight}
                stroke={CHART_COLORS.crosshair}
                strokeWidth={1}
                strokeDasharray="3,3"
                opacity={0.6}
              />
            )}
          </g>

          {/* BOTTOM PANEL: SYNCHRONOUS DIFFERENCE D_t = Y_A - Y_B */}
          {hasRegionB && bottomYScale && (
            <g transform={`translate(${margin.left}, ${topHeight + 15})`}>
              {/* Zero-contrast reference horizontal line */}
              <line
                x1={0}
                y1={bottomYScale(0)}
                x2={innerWidth}
                y2={bottomYScale(0)}
                stroke={CHART_COLORS.zeroReference}
                strokeWidth={1.5}
                strokeDasharray="4,4"
              />
              <text
                x={innerWidth + 5}
                y={bottomYScale(0) + 3}
                fill="#64748b"
                fontSize={9}
                fontFamily="monospace"
              >
                0.0
              </text>

              {/* Grid Lines Bottom */}
              {bottomYScale.ticks(3).map((tick) => (
                <g key={`bot-grid-${tick}`} transform={`translate(0, ${bottomYScale(tick)})`}>
                  <line x1={0} x2={innerWidth} stroke={CHART_COLORS.gridLines} strokeDasharray="2,2" />
                  <text
                    x={-8}
                    y={3}
                    fill="#94a3b8"
                    fontSize={10}
                    fontFamily="monospace"
                    textAnchor="end"
                  >
                    {tick > 0 ? `+${tick.toFixed(1)}` : tick.toFixed(1)}
                  </text>
                </g>
              ))}

              {/* Difference Trend Line */}
              {trendDiff && (
                <line
                  x1={xScale(trendDiff.start_point.year)}
                  y1={bottomYScale(trendDiff.start_point.val)}
                  x2={xScale(trendDiff.end_point.year)}
                  y2={bottomYScale(trendDiff.end_point.val)}
                  stroke={CHART_COLORS.differenceTrend}
                  strokeWidth={2}
                  strokeDasharray="4,3"
                  opacity={0.9}
                />
              )}

              {/* Difference Line Path */}
              {lineDiff && (
                <path
                  d={lineDiff(data) ?? ""}
                  fill="none"
                  stroke={CHART_COLORS.difference}
                  strokeWidth={2}
                />
              )}

              {/* Difference Data Points */}
              {data.map((d) =>
                d.difference_value !== undefined ? (
                  <circle
                    key={`pt-diff-${d.year}`}
                    cx={xScale(d.year)}
                    cy={bottomYScale(d.difference_value)}
                    r={hoveredYear === d.year ? 4.5 : 3}
                    fill={d.difference_value >= 0 ? CHART_COLORS.regionA : CHART_COLORS.regionB}
                    stroke="#0f172a"
                    strokeWidth={1.2}
                  />
                ) : null
              )}

              {/* Bottom Y Axis Label */}
              <text
                transform="rotate(-90)"
                x={-innerBottomHeight / 2}
                y={-40}
                fill="#94a3b8"
                fontSize={11}
                textAnchor="middle"
                fontFamily="sans-serif"
              >
                &Delta; ({unit})
              </text>

              {/* X Axis Year Labels */}
              {yearTicks.map((yr) => (
                <g key={`x-tick-${yr}`} transform={`translate(${xScale(yr)}, ${innerBottomHeight + 15})`}>
                  <line y1={-5} y2={0} stroke="#475569" />
                  <text
                    y={10}
                    fill="#94a3b8"
                    fontSize={10}
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {yr}
                  </text>
                </g>
              ))}

              {/* Crosshair Vertical Line (Bottom) */}
              {hoveredYear !== null && (
                <line
                  x1={xScale(hoveredYear)}
                  y1={0}
                  x2={xScale(hoveredYear)}
                  y2={innerBottomHeight}
                  stroke={CHART_COLORS.crosshair}
                  strokeWidth={1}
                  strokeDasharray="3,3"
                  opacity={0.6}
                />
              )}
            </g>
          )}

          {/* Standalone X Axis if only Region A */}
          {!hasRegionB && (
            <g transform={`translate(${margin.left}, ${topHeight})`}>
              {yearTicks.map((yr) => (
                <g key={`single-x-tick-${yr}`} transform={`translate(${xScale(yr)}, 0)`}>
                  <line y1={0} y2={5} stroke="#475569" />
                  <text
                    y={16}
                    fill="#94a3b8"
                    fontSize={10}
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {yr}
                  </text>
                </g>
              ))}
            </g>
          )}
        </svg>

        {/* Floating Year Inspection Tooltip */}
        {activeDatum && (
          <div className="absolute top-2 right-4 bg-slate-950/95 border border-slate-700/80 rounded-md p-2.5 shadow-xl text-xs font-mono pointer-events-none z-20">
            <div className="text-slate-100 font-bold border-b border-slate-800 pb-1 mb-1">
              Year {activeDatum.year}
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-4">
                <span className="text-amber-400 font-medium">{regionAName}:</span>
                <span className="text-slate-200">
                  {activeDatum.region_a_value.toFixed(2)} {unit}
                </span>
              </div>

              {hasRegionB && activeDatum.region_b_value !== undefined && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-cyan-400 font-medium">{regionBName}:</span>
                  <span className="text-slate-200">
                    {activeDatum.region_b_value.toFixed(2)} {unit}
                  </span>
                </div>
              )}

              {hasRegionB && activeDatum.difference_value !== undefined && (
                <div className="flex items-center justify-between gap-4 border-t border-slate-800 pt-1">
                  <span className="text-slate-400 font-medium">Difference:</span>
                  <span
                    className={`font-semibold ${
                      activeDatum.difference_value >= 0 ? "text-amber-300" : "text-cyan-300"
                    }`}
                  >
                    {activeDatum.difference_value >= 0 ? "+" : ""}
                    {activeDatum.difference_value.toFixed(2)} {unit}
                  </span>
                </div>
              )}

              <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-800/60">
                Coverage: {(Math.min(activeDatum.coverage_fraction_a ?? 1, activeDatum.coverage_fraction_b ?? 1) * 100).toFixed(0)}%
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Coverage Bars below chart */}
      <CoverageBars
        data={data}
        selectedYear={hoveredYear}
        onHoverYear={setHoveredYear}
      />
    </div>
  );
};
