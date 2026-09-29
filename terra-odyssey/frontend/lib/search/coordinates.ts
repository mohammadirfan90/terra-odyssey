/**
 * Client-side parser for raw latitude/longitude input in the search bar.
 *
 * Accepted forms:
 *   "40.7, -74.0"            (decimal pair, lat first or lon first — ambiguous)
 *   "40.7 -74.0"             (whitespace separator)
 *   "40.7N 74.0W"            (hemisphere letters, lon / lat)
 *   "40.7°N 74.0°W"          (degree symbols)
 *   "40.7N, 74.0W"           (with comma)
 *
 * Returns `null` when the input cannot be unambiguously parsed into
 * valid coordinates, or when either value is out of range.
 */

export interface ParsedCoordinate {
  latitude: number;
  longitude: number;
  /** The original input — useful for display in the result row. */
  raw: string;
}

const HEMISPHERE_RE = /[NSEW]/i;
const DEGREE_RE = /[°]/g;

export function parseCoordinate(input: string): ParsedCoordinate | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (trimmed.length < 3) return null;

  // Strip degree symbols and extra whitespace, normalize separators.
  const normalized = trimmed
    .replace(DEGREE_RE, "")
    .replace(/[;,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Hemisphere-bearing form: "40.7N 74.0W" or "40.7 N 74.0 W"
  if (HEMISPHERE_RE.test(normalized)) {
    const tokens = normalized.split(" ").filter(Boolean);
    if (tokens.length === 4) {
      // ["40.7", "N", "74.0", "W"]
      const [latVal, latHem, lonVal, lonHem] = tokens;
      return buildHemi(latVal, latHem, lonVal, lonHem, trimmed);
    }
    if (tokens.length === 2) {
      // ["40.7N", "74.0W"]
      const [latPart, lonPart] = tokens;
      const latMatch = latPart.match(/^(-?\d+(?:\.\d+)?)([NS])$/i);
      const lonMatch = lonPart.match(/^(-?\d+(?:\.\d+)?)([EW])$/i);
      if (latMatch && lonMatch) {
        return buildHemi(latMatch[1], latMatch[2], lonMatch[1], lonMatch[2], trimmed);
      }
    }
    return null;
  }

  // Pure decimal form: "40.7, -74.0" / "40.7 -74.0"
  const decimalTokens = normalized.split(" ").filter(Boolean);
  if (decimalTokens.length !== 2) return null;
  const [aStr, bStr] = decimalTokens;
  const a = Number(aStr);
  const b = Number(bStr);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;

  // Heuristic: the more "latitude-looking" value (|x| <= 90) is the lat.
  if (Math.abs(a) <= 90 && Math.abs(b) <= 180) {
    return finalize(a, b, trimmed);
  }
  if (Math.abs(b) <= 90 && Math.abs(a) <= 180) {
    return finalize(b, a, trimmed);
  }
  return null;
}

function buildHemi(
  latStr: string,
  latHem: string,
  lonStr: string,
  lonHem: string,
  raw: string,
): ParsedCoordinate | null {
  const latValue = Number(latStr);
  const lonValue = Number(lonStr);
  if (!Number.isFinite(latValue) || !Number.isFinite(lonValue)) return null;

  const lat = latHem.toUpperCase() === "S" ? -Math.abs(latValue) : Math.abs(latValue);
  const lon = lonHem.toUpperCase() === "W" ? -Math.abs(lonValue) : Math.abs(lonValue);
  return finalize(lat, lon, raw);
}

function finalize(lat: number, lon: number, raw: string): ParsedCoordinate | null {
  if (lat < -90 || lat > 90) return null;
  if (lon < -180 || lon > 180) return null;
  return { latitude: lat, longitude: lon, raw };
}

/**
 * Format a coordinate as a compact "lat, lon" string with degree symbols.
 * Useful for the subtitle line of a coordinate search result.
 */
export function formatCoordinate(coord: ParsedCoordinate): string {
  const latDir = coord.latitude >= 0 ? "°N" : "°S";
  const lonDir = coord.longitude >= 0 ? "°E" : "°W";
  const lat = Math.abs(coord.latitude).toFixed(3);
  const lon = Math.abs(coord.longitude).toFixed(3);
  return `${lat}${latDir}, ${lon}${lonDir}`;
}
