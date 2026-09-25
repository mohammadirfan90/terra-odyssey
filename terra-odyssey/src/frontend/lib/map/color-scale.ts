/**
 * Zero-centred diverging color scales for signed climate trend fields.
 * Viridis is sequential and strictly prohibited for signed trends.
 */

// ColorBrewer RdBu (9-step diverging: cool cyan-blue for cooling, warm rust-red for warming)
export const RDBU_COLORS = [
  "#2166ac", // strong cooling
  "#4393c3",
  "#92c5de",
  "#d1e5f0",
  "#f7f7f7", // neutral zero
  "#fddbc7",
  "#f4a582",
  "#d6604d",
  "#b2182b", // strong warming
];

// ColorBrewer BrBG (Brown-BlueGreen: ideal for hydroclimate/precipitation)
export const BRBG_COLORS = [
  "#8c510a", // strong drying / deficit
  "#bf812d",
  "#dfc27d",
  "#f6e8c3",
  "#f5f5f5", // neutral zero
  "#c7eae5",
  "#80cdc1",
  "#35978f",
  "#01665e", // strong wetting / surplus
];

export interface ColorScaleConfig {
  min: number;
  center: number;
  max: number;
  palette: "RdBu" | "BrBG";
}

export function parseHexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/**
 * Maps a signed slope value to an RGBA tuple using a frozen zero-centred symmetric scale [-maxAbs, +maxAbs].
 */
export function getDivergingColorRgba(
  value: number | null | undefined,
  maxAbsValue: number,
  palette: "RdBu" | "BrBG" = "RdBu"
): [number, number, number, number] {
  if (value === null || value === undefined || isNaN(value)) {
    // Muted dark transparent for masked / missing data
    return [30, 41, 59, 140];
  }

  const colors = palette === "BrBG" ? BRBG_COLORS : RDBU_COLORS;
  const clampedMax = Math.max(0.001, maxAbsValue);

  // Normalize [-maxAbs, +maxAbs] to [0, 1]
  const normalized = Math.max(0, Math.min(1, (value + clampedMax) / (2 * clampedMax)));

  // Map to index across color palette steps
  const step = 1 / (colors.length - 1);
  const lowerIndex = Math.floor(normalized / step);
  const upperIndex = Math.min(colors.length - 1, lowerIndex + 1);
  const factor = (normalized - lowerIndex * step) / step;

  const [r1, g1, b1] = parseHexToRgb(colors[lowerIndex]);
  const [r2, g2, b2] = parseHexToRgb(colors[upperIndex]);

  const r = Math.round(r1 + factor * (r2 - r1));
  const g = Math.round(g1 + factor * (g2 - g1));
  const b = Math.round(b1 + factor * (b2 - b1));

  return [r, g, b, 230]; // 90% opacity for satellite map backdrop visibility
}
