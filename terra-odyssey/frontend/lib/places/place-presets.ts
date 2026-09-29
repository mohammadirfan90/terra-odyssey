/**
 * Static place presets for the menu's "Places" section.
 * Each preset is a `bbox` ([minLon, minLat, maxLon, maxLat]) used to fly
 * the map to a region and seed regionA in the investigation flow.
 *
 * Sources are public-domain Natural Earth admin-0 / admin-1 boundaries
 * (NaturalEarthData.com — public domain) combined with continent-level
 * coordinates used widely in earth-observation catalogues.
 */

export interface PlacePreset {
  id: string;
  name: string;
  /** ISO-3166 alpha-2 country code; undefined for non-country entries. */
  iso?: string;
  /** Continent or category tag used to group presets in the menu. */
  category:
    | "global"
    | "country"
    | "continent"
    | "us-region"
    | "ocean"
    | "biome";
  bbox: [number, number, number, number];
}

/* eslint-disable @typescript-eslint/no-magic-numbers */
export const GLOBAL_PRESETS: PlacePreset[] = [
  { id: "global", name: "Entire Earth (Global)", category: "global", bbox: [-180.0, -85.0, 180.0, 85.0] },
];

export const COUNTRY_PRESETS: PlacePreset[] = [
  { id: "usa",          name: "United States",     iso: "US", category: "country", bbox: [-125.0, 24.5, -66.5, 49.5] },
  { id: "canada",       name: "Canada",           iso: "CA", category: "country", bbox: [-141.0, 41.7, -52.6, 83.1] },
  { id: "mexico",       name: "Mexico",           iso: "MX", category: "country", bbox: [-118.4, 14.5,  -86.7, 32.7] },
  { id: "brazil",       name: "Brazil",           iso: "BR", category: "country", bbox: [-73.99, -33.8, -34.7,  5.27] },
  { id: "argentina",    name: "Argentina",        iso: "AR", category: "country", bbox: [-73.6, -55.1, -53.5, -21.8] },
  { id: "china",        name: "China",            iso: "CN", category: "country", bbox: [73.5,  18.2, 134.8, 53.6] },
  { id: "india",        name: "India",            iso: "IN", category: "country", bbox: [68.2,   6.7, 97.4, 35.7] },
  { id: "japan",        name: "Japan",            iso: "JP", category: "country", bbox: [129.4, 31.0, 145.8, 45.5] },
  { id: "australia",    name: "Australia",        iso: "AU", category: "country", bbox: [112.9, -43.7, 153.6, -10.7] },
  { id: "russia",       name: "Russia",           iso: "RU", category: "country", bbox: [27.3, 41.2, 180.0, 81.9] },
  { id: "germany",      name: "Germany",          iso: "DE", category: "country", bbox: [5.9,  47.3, 15.0, 55.1] },
  { id: "france",       name: "France",           iso: "FR", category: "country", bbox: [-5.1, 41.3, 9.6,  51.1] },
  { id: "spain",        name: "Spain",            iso: "ES", category: "country", bbox: [-9.3, 27.6, 4.3,  43.8] },
  { id: "italy",        name: "Italy",            iso: "IT", category: "country", bbox: [6.6,  36.6, 18.5, 47.1] },
  { id: "uk",           name: "United Kingdom",   iso: "GB", category: "country", bbox: [-8.6, 49.9, 1.8,  60.8] },
  { id: "south-africa", name: "South Africa",     iso: "ZA", category: "country", bbox: [16.3, -34.8, 32.9, -22.1] },
  { id: "egypt",        name: "Egypt",            iso: "EG", category: "country", bbox: [24.7, 22.0, 36.9, 31.8] },
  { id: "kenya",        name: "Kenya",            iso: "KE", category: "country", bbox: [33.9, -4.7, 41.9,  4.6] },
  { id: "indonesia",    name: "Indonesia",        iso: "ID", category: "country", bbox: [95.0, -11.2, 141.0, 6.1] },
  { id: "saudi-arabia", name: "Saudi Arabia",     iso: "SA", category: "country", bbox: [34.5, 16.3, 55.7, 32.2] },
];

export const CONTINENT_PRESETS: PlacePreset[] = [
  { id: "africa",   name: "Africa",     category: "continent", bbox: [-17.5, -35.0, 51.4, 37.3] },
  { id: "asia",     name: "Asia",       category: "continent", bbox: [44.0,   5.0, 145.0, 55.0] },
  { id: "europe",   name: "Europe",     category: "continent", bbox: [-10.0, 36.0,  40.0, 71.0] },
  { id: "namerica", name: "N. America", category: "continent", bbox: [-170.0, 15.0, -50.0, 75.0] },
  { id: "samerica", name: "S. America", category: "continent", bbox: [-82.0, -56.0, -34.0, 12.0] },
  { id: "oceania",  name: "Oceania",    category: "continent", bbox: [110.0, -45.0, 180.0, 0.0] },
  { id: "antarctica", name: "Antarctica", category: "continent", bbox: [-180.0, -90.0, 180.0, -65.0] },
];

export const US_REGION_PRESETS: PlacePreset[] = [
  { id: "us-west",   name: "Western US",       category: "us-region", bbox: [-125.0, 31.0, -102.0, 49.0] },
  { id: "us-midwest", name: "Midwestern US",   category: "us-region", bbox: [-104.0, 36.0,  -82.0, 49.0] },
  { id: "us-south",  name: "Southern US",      category: "us-region", bbox: [-106.0, 25.0,  -75.0, 39.0] },
  { id: "us-east",   name: "Eastern US",       category: "us-region", bbox: [ -90.0, 25.0,  -67.0, 47.5] },
  { id: "us-pacific", name: "US Pacific NW",   category: "us-region", bbox: [-124.5, 42.0, -116.5, 49.0] },
  { id: "us-sierra", name: "Sierra Nevada",    category: "us-region", bbox: [-120.5, 35.0, -117.5, 40.0] },
];

export const OCEAN_PRESETS: PlacePreset[] = [
  { id: "pacific",   name: "Pacific Ocean",   category: "ocean", bbox: [120.0, -60.0, -100.0, 60.0] },
  { id: "atlantic",  name: "Atlantic Ocean",  category: "ocean", bbox: [-70.0, -60.0,  20.0, 60.0] },
  { id: "indian",    name: "Indian Ocean",    category: "ocean", bbox: [40.0, -50.0,  100.0, 30.0] },
  { id: "arctic",    name: "Arctic Ocean",    category: "ocean", bbox: [-180.0, 60.0, 180.0, 90.0] },
  { id: "southern",  name: "Southern Ocean",  category: "ocean", bbox: [-180.0, -90.0, 180.0, -60.0] },
];

export const BIOME_PRESETS: PlacePreset[] = [
  { id: "amazon",    name: "Amazon Basin",     category: "biome", bbox: [-79.0, -20.0, -49.0,  5.0] },
  { id: "congo",     name: "Congo Basin",      category: "biome", bbox: [11.0, -10.0,  31.0,  7.0] },
  { id: "sahara",    name: "Sahara Desert",    category: "biome", bbox: [-13.0, 15.0,   34.0, 30.0] },
  { id: "gobi",      name: "Gobi Desert",      category: "biome", bbox: [88.0, 39.0,   115.0, 49.0] },
  { id: "siberia",   name: "Siberian Taiga",   category: "biome", bbox: [60.0, 50.0,   160.0, 72.0] },
  { id: "himalaya",  name: "Himalayas",        category: "biome", bbox: [70.0, 26.0,   100.0, 36.0] },
];

export const ALL_PRESETS: PlacePreset[] = [
  ...GLOBAL_PRESETS,
  ...COUNTRY_PRESETS,
  ...CONTINENT_PRESETS,
  ...US_REGION_PRESETS,
  ...OCEAN_PRESETS,
  ...BIOME_PRESETS,
];

export const PRESET_CATEGORIES = [
  { id: "global",    label: "Global" },
  { id: "country",   label: "Countries" },
  { id: "us-region", label: "US regions" },
  { id: "continent", label: "Continents" },
  { id: "biome",     label: "Biomes" },
  { id: "ocean",     label: "Oceans" },
] as const;

export type PresetCategoryId = (typeof PRESET_CATEGORIES)[number]["id"];

export function presetsByCategory(category: PresetCategoryId): PlacePreset[] {
  return ALL_PRESETS.filter((p) => p.category === category);
}
