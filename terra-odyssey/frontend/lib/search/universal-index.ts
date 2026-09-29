export type UniversalSearchKind = "dataset" | "tool" | "method" | "concept";

export interface UniversalSearchItem {
  id: string;
  kind: UniversalSearchKind;
  title: string;
  detail: string;
  aliases: string[];
  suggestedQuestion: string;
}

export const UNIVERSAL_SEARCH_ITEMS: UniversalSearchItem[] = [
  {
    id: "merra2-temperature",
    kind: "dataset",
    title: "MERRA-2 air temperature",
    detail: "Monthly 2-meter air temperature from NASA's MERRA-2 atmospheric reanalysis.",
    aliases: ["T2M", "temperature", "warming", "M2TMNXSLV", "reanalysis"],
    suggestedQuestion: "How should I investigate temperature trends with MERRA-2?",
  },
  {
    id: "gpm-imerg-precipitation",
    kind: "dataset",
    title: "GPM IMERG precipitation",
    detail: "Monthly multi-satellite precipitation retrievals from NASA GPM IMERG Final V07.",
    aliases: ["rainfall", "precipitation", "GPM", "IMERG", "satellite"],
    suggestedQuestion: "How should I investigate precipitation trends with GPM IMERG?",
  },
  {
    id: "trend-map",
    kind: "tool",
    title: "Trend map",
    detail: "Explore spatial slope, uncertainty, coverage, and evidence layers on the map.",
    aliases: ["map", "layers", "spatial", "slope", "coverage"],
    suggestedQuestion: "How do I interpret the trend map and its evidence layers?",
  },
  {
    id: "region-comparison",
    kind: "tool",
    title: "Compare two regions",
    detail: "Define paired regions and test whether their estimated trends differ.",
    aliases: ["region A", "region B", "contrast", "opposite trends", "draw"],
    suggestedQuestion: "How do I compare the trends of two regions correctly?",
  },
  {
    id: "uncertainty",
    kind: "method",
    title: "Uncertainty and significance",
    detail: "Review effect sizes, HAC intervals, p-values, coverage, and scientific caveats.",
    aliases: ["confidence interval", "p-value", "HAC", "significance", "evidence"],
    suggestedQuestion: "What do the uncertainty and significance fields mean?",
  },
  {
    id: "data-provenance",
    kind: "concept",
    title: "Data provenance",
    detail: "Inspect product collection, version, units, temporal support, and measurement type.",
    aliases: ["source", "NASA", "version", "collection", "units", "metadata"],
    suggestedQuestion: "How can I verify the provenance of a Terra Odyssey result?",
  },
];

export const QUICK_QUESTIONS = [
  "What changed most on this map?",
  "Which dataset should I use?",
  "How do I compare two regions?",
];

export function searchUniversalIndex(query: string, limit = 5): UniversalSearchItem[] {
  const terms = query
    .toLocaleLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (terms.length === 0) return UNIVERSAL_SEARCH_ITEMS.slice(0, limit);

  return UNIVERSAL_SEARCH_ITEMS
    .map((item) => {
      const title = item.title.toLocaleLowerCase();
      const searchable = `${title} ${item.detail} ${item.aliases.join(" ")}`.toLocaleLowerCase();
      const score = terms.reduce((total, term) => {
        if (title.startsWith(term)) return total + 5;
        if (title.includes(term)) return total + 3;
        if (searchable.includes(term)) return total + 1;
        return total;
      }, 0);
      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
    .slice(0, limit)
    .map(({ item }) => item);
}
