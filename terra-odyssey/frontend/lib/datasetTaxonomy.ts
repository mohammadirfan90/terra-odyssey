/**
 * Curated taxonomy mirrored from backend/src/data/topics.py.
 * Kept in lockstep — if you add a domain or sub-topic here, add it there too.
 */

export const DOMAINS = [
  "All",
  "Atmosphere",
  "Ocean",
  "Cryosphere",
  "Land",
  "Hydrology",
  "Biosphere",
  "Radiation",
  "Solid Earth",
] as const;

export type Domain = (typeof DOMAINS)[number];

export const SUB_TOPICS: Record<Exclude<Domain, "All">, string[]> = {
  Atmosphere: ["Temperature", "Precipitation", "Composition", "Air Quality", "Aerosols", "Wind"],
  Ocean: ["Sea Surface Temperature", "Salinity", "Sea Level", "Sea Ice", "Ocean Color"],
  Cryosphere: ["Sea Ice", "Snow", "Glaciers", "Permafrost"],
  Land: ["Land Cover", "Vegetation", "Fire", "Land Surface Temp", "Snow"],
  Hydrology: ["Soil Moisture", "Groundwater", "Surface Water", "Terrestrial Water Storage"],
  Biosphere: ["Biomass", "Carbon Cycle", "Ecosystems", "Vegetation"],
  Radiation: ["TOA Fluxes", "Surface Fluxes", "Albedo", "Shortwave"],
  "Solid Earth": ["Gravity", "Land Surface"],
};

export const USE_CASES = [
  "Climate Monitoring",
  "Air Quality & Health",
  "Water Resources",
  "Agriculture & Food",
  "Disasters",
  "Energy",
] as const;

export type UseCase = (typeof USE_CASES)[number];

/**
 * Returns the domain of a `<Domain>:<Sub-topic>` pair, or null if the string
 * is a use-case rather than a domain:sub-topic pair.
 */
export function domainFromCategory(cat: string): Domain | null {
  if (!cat.includes(":")) return null;
  const domain = cat.split(":", 1)[0];
  if ((DOMAINS as readonly string[]).includes(domain)) {
    return domain as Domain;
  }
  return null;
}

/** Returns the use-case portion of `categories`, or [] if none. */
export function extractUseCasesFromCategories(cats: string[] | undefined): UseCase[] {
  if (!cats) return [];
  return cats.filter(
    (c): c is UseCase => (USE_CASES as readonly string[]).includes(c),
  );
}

export const useCasesFromCategories = extractUseCasesFromCategories;

/** True when the dataset is a global climate index (no spatial extent). */
export function isGlobalIndex(d: { categories?: string[]; gibs_layer?: string | null }): boolean {
  if (d.categories?.includes("Climate Monitoring") && d.gibs_layer == null) {
    // Climate indices: serial climate-monitoring rows with no GIBS layer
    return true;
  }
  return false;
}
