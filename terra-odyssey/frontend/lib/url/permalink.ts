/**
 * URL Permalink State Codec for Terra Odyssey
 *
 * Encodes and decodes investigation parameters as compact URL search params,
 * enabling shareable, reproducible investigation permalinks. The codec is
 * purely functional — it does not read or modify window.location itself so
 * it can be tested without a browser runtime.
 *
 * Permalink format (all params are optional; defaults applied on decode):
 *   ?ds=merra2_t2m&var=T2M&sy=2000&ey=2024
 *   &ax=-180&ay=-90&bx=180&by=90
 *   &bx2=-180&by2=-90&bx22=180&by22=90
 *   &est=ols_hac&sel=predefined
 */

export interface PermalinkRegion {
  /** [min_lon, min_lat, max_lon, max_lat] */
  bbox: [number, number, number, number];
}

export interface PermalinkState {
  datasetId: string;
  variable: string;
  startYear: number;
  endYear: number;
  regionA: PermalinkRegion | null;
  regionB: PermalinkRegion | null;
  estimator: "ols_hac" | "theil_sen" | "modified_mann_kendall" | "block_bootstrap";
  selectionStatus: "predefined" | "exploratory_map_selected";
}

const DEFAULTS: PermalinkState = {
  datasetId: "merra2_t2m",
  variable: "T2M",
  startYear: 2000,
  endYear: 2024,
  regionA: null,
  regionB: null,
  estimator: "ols_hac",
  selectionStatus: "predefined",
};

/** Encode a PermalinkState to a URLSearchParams string. */
export function encodePermalink(state: Partial<PermalinkState>): string {
  const s = { ...DEFAULTS, ...state };
  const params = new URLSearchParams();

  params.set("ds", s.datasetId);
  params.set("var", s.variable);
  params.set("sy", String(s.startYear));
  params.set("ey", String(s.endYear));
  params.set("est", s.estimator);
  params.set("sel", s.selectionStatus);

  if (s.regionA) {
    const [minLon, minLat, maxLon, maxLat] = s.regionA.bbox;
    params.set("ax", String(minLon));
    params.set("ay", String(minLat));
    params.set("ax2", String(maxLon));
    params.set("ay2", String(maxLat));
  }

  if (s.regionB) {
    const [minLon, minLat, maxLon, maxLat] = s.regionB.bbox;
    params.set("bx", String(minLon));
    params.set("by", String(minLat));
    params.set("bx2", String(maxLon));
    params.set("by2", String(maxLat));
  }

  return params.toString();
}

function parseCoord(params: URLSearchParams, key: string): number | null {
  const v = params.get(key);
  if (v === null) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function parseBbox(
  params: URLSearchParams,
  keys: [string, string, string, string]
): [number, number, number, number] | null {
  const coords = keys.map((k) => parseCoord(params, k));
  if (coords.some((c) => c === null)) return null;
  const [minLon, minLat, maxLon, maxLat] = coords as [number, number, number, number];
  if (
    minLon < -180 || maxLon > 180 || minLon >= maxLon ||
    minLat < -90 || maxLat > 90 || minLat >= maxLat
  ) return null;
  return [minLon, minLat, maxLon, maxLat];
}

/** Decode a URLSearchParams string (or URLSearchParams instance) into a PermalinkState. */
export function decodePermalink(
  input: string | URLSearchParams
): PermalinkState {
  const params = typeof input === "string" ? new URLSearchParams(input) : input;

  const startYear = parseInt(params.get("sy") ?? "", 10);
  const endYear = parseInt(params.get("ey") ?? "", 10);

  const rawEstimator = params.get("est") ?? DEFAULTS.estimator;
  const estimator: PermalinkState["estimator"] =
    (["ols_hac", "theil_sen", "modified_mann_kendall", "block_bootstrap"] as const).includes(
      rawEstimator as PermalinkState["estimator"]
    )
      ? (rawEstimator as PermalinkState["estimator"])
      : DEFAULTS.estimator;

  const rawSel = params.get("sel") ?? DEFAULTS.selectionStatus;
  const selectionStatus: PermalinkState["selectionStatus"] =
    rawSel === "exploratory_map_selected" ? "exploratory_map_selected" : "predefined";

  const bboxA = parseBbox(params, ["ax", "ay", "ax2", "ay2"]);
  const bboxB = parseBbox(params, ["bx", "by", "bx2", "by2"]);

  return {
    datasetId: params.get("ds") ?? DEFAULTS.datasetId,
    variable: params.get("var") ?? DEFAULTS.variable,
    startYear: isNaN(startYear) ? DEFAULTS.startYear : startYear,
    endYear: isNaN(endYear) ? DEFAULTS.endYear : endYear,
    regionA: bboxA ? { bbox: bboxA } : null,
    regionB: bboxB ? { bbox: bboxB } : null,
    estimator,
    selectionStatus,
  };
}

/** Build a full shareable URL from the current window location and state. */
export function buildShareableUrl(
  state: Partial<PermalinkState>,
  baseUrl?: string
): string {
  const base = baseUrl ?? (typeof window !== "undefined" ? window.location.origin + window.location.pathname : "");
  const qs = encodePermalink(state);
  return `${base}?${qs}`;
}
