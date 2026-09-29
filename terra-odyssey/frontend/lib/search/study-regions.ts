/**
 * Curated gazetteer of well-known scientific study regions relevant to
 * Earth-system trend investigations. The list is intentionally compact
 * and offline — these regions show up in the search bar even when the
 * Photon geocoder is unavailable.
 *
 * Each bbox follows the canonical [minLon, minLat, maxLon, maxLat]
 * tuple used throughout Terra Odyssey.
 */

export interface StudyRegion {
  id: string;
  name: string;
  detail: string;
  /** [minLon, minLat, maxLon, maxLat] in EPSG:4326. */
  bbox: [number, number, number, number];
  aliases: string[];
}

export const STUDY_REGIONS: StudyRegion[] = [
  {
    id: "arctic-amplification",
    name: "Arctic amplification zone",
    detail: "High-latitude band where warming exceeds the global mean.",
    bbox: [-180, 67, 180, 85],
    aliases: ["arctic", "polar", "north pole", "high latitude"],
  },
  {
    id: "barents-kara",
    name: "Barents-Kara Sea",
    detail: "Arctic seas north of Russia with strong recent warming.",
    bbox: [30, 68, 90, 82],
    aliases: ["barents", "kara", "russia arctic"],
  },
  {
    id: "sahel",
    name: "Sahel",
    detail: "Transitional semi-arid band south of the Sahara.",
    bbox: [-18, 10, 40, 20],
    aliases: ["sahel", "sahara south", "africa transition"],
  },
  {
    id: "sahara",
    name: "Sahara Desert",
    detail: "Largest hot desert; reference for drying trends.",
    bbox: [-18, 18, 40, 32],
    aliases: ["sahara", "north africa desert"],
  },
  {
    id: "mediterranean",
    name: "Mediterranean basin",
    detail: "Mediterranean climate zone; widely cited drying region.",
    bbox: [-10, 30, 40, 46],
    aliases: ["mediterranean", "med", "southern europe"],
  },
  {
    id: "amazon-basin",
    name: "Amazon basin",
    detail: "Tropical rainforest with strong hydrological cycle.",
    bbox: [-82, -20, -50, 5],
    aliases: ["amazon", "rainforest", "tropical forest"],
  },
  {
    id: "tibetan-plateau",
    name: "Tibetan Plateau",
    detail: "High-elevation Asian plateau sensitive to cryospheric change.",
    bbox: [73, 27, 105, 40],
    aliases: ["tibet", "tibetan", "qinghai", "high asia"],
  },
  {
    id: "equatorial-pacific",
    name: "Equatorial Pacific",
    detail: "ENSO-sensitive equatorial Pacific Ocean strip.",
    bbox: [-170, -10, -110, 10],
    aliases: ["pacific", "enso", "el nino", "equatorial"],
  },
  {
    id: "california-central-valley",
    name: "California Central Valley",
    detail: "Highly managed agricultural basin in California.",
    bbox: [-122.5, 35, -118.5, 39.5],
    aliases: ["california", "central valley", "usa agriculture"],
  },
  {
    id: "us-gulf-coast",
    name: "US Gulf Coastal Plain",
    detail: "Gulf of Mexico coastal plain with hurricane exposure.",
    bbox: [-94, 28, -82, 32],
    aliases: ["gulf coast", "usa gulf", "mexico gulf"],
  },
  {
    id: "antarctica",
    name: "Antarctica",
    detail: "Antarctic continent and surrounding Southern Ocean.",
    bbox: [-180, -90, 180, -60],
    aliases: ["antarctica", "south pole", "southern ocean"],
  },
  {
    id: "greenland",
    name: "Greenland ice sheet",
    detail: "Major contributor to sea-level rise.",
    bbox: [-55, 60, -20, 84],
    aliases: ["greenland", "ice sheet", "greenland melt"],
  },
  {
    id: "indian-subcontinent",
    name: "Indian subcontinent",
    detail: "Monsoon-driven South Asia.",
    bbox: [68, 6, 98, 36],
    aliases: ["india", "south asia", "monsoon"],
  },
  {
    id: "east-africa",
    name: "East African Rift",
    detail: "Volcanic rift valley with diverse climate zones.",
    bbox: [28, -15, 42, 12],
    aliases: ["east africa", "rift", "horn of africa"],
  },
  {
    id: "south-east-asia",
    name: "Southeast Asia",
    detail: "Maritime continent with high rainfall variability.",
    bbox: [95, -10, 145, 25],
    aliases: ["sea", "southeast asia", "maritime continent"],
  },
  {
    id: "australia",
    name: "Australian continent",
    detail: "Drier continent with strong recent climate signals.",
    bbox: [112, -45, 154, -10],
    aliases: ["australia", "oceania"],
  },
  {
    id: "western-europe",
    name: "Western Europe",
    detail: "Temperate Europe with strong summer warming.",
    bbox: [-10, 42, 20, 60],
    aliases: ["europe", "western europe", "eu"],
  },
  {
    id: "north-america",
    name: "Continental North America",
    detail: "Continental USA, Canada, and Alaska.",
    bbox: [-170, 25, -50, 80],
    aliases: ["north america", "usa", "canada"],
  },
  {
    id: "south-america",
    name: "Continental South America",
    detail: "South American continent.",
    bbox: [-82, -56, -34, 12],
    aliases: ["south america", "latin america"],
  },
  {
    id: "european-russia",
    name: "European Russia",
    detail: "Western Russian plains with strong recent warming.",
    bbox: [20, 50, 60, 70],
    aliases: ["russia", "european russia", "russian plains"],
  },
];

/**
 * Score-based substring search mirroring `searchUniversalIndex` so the
 * study-regions section integrates naturally with the rest of the
 * search bar.
 */
export function searchStudyRegions(query: string, limit = 4): StudyRegion[] {
  const terms = query
    .toLocaleLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (terms.length === 0) return STUDY_REGIONS.slice(0, limit);

  return STUDY_REGIONS.map((region) => {
    const name = region.name.toLocaleLowerCase();
    const searchable = `${name} ${region.detail} ${region.aliases.join(" ")}`.toLocaleLowerCase();
    const score = terms.reduce((total, term) => {
      if (name.startsWith(term)) return total + 5;
      if (name.includes(term)) return total + 3;
      if (searchable.includes(term)) return total + 1;
      return total;
    }, 0);
    return { region, score };
  })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.region.name.localeCompare(b.region.name))
    .slice(0, limit)
    .map(({ region }) => region);
}
