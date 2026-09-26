/**
 * Open-source basemap styles. We rely on OpenFreeMap's hosted vector styles
 * (positron for light, dark for dark) — they are free, no API key, no rate
 * limits for non-commercial use. We expose them under `OPEN_FREE_MAP_STYLES`
 * so the rest of the app can pass them straight into <Map styles={...} />.
 */

import type * as maplibregl from "maplibre-gl";

export const OPEN_FREE_MAP_STYLES = {
  light: "https://tiles.openfreemap.org/styles/positron" as unknown as maplibregl.StyleSpecification,
  dark: "https://tiles.openfreemap.org/styles/dark" as unknown as maplibregl.StyleSpecification,
} as const;
