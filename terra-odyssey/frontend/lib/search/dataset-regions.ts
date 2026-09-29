/**
 * Builds searchable "dataset extent" items from the catalog data so
 * users can pivot from a dataset name straight to where that dataset
 * actually covers on the map.
 *
 * Each entry maps to a sensible world-wide bbox for the product family.
 * These are coarse scientific bounds, not the exact granule footprints.
 */

import type { DatasetMetadata } from "@/lib/api/types";

export interface DatasetRegion {
  id: string;
  name: string;
  detail: string;
  bbox: [number, number, number, number];
  /** Stable token used by the search bar's scoring. */
  searchKey: string;
  /** Year span surfaced alongside the result. */
  period?: { start_year: number; end_year: number };
}

/** Coarse spatial extents for the products the catalog exposes. */
const DATASET_EXTENT_OVERRIDES: Record<string, [number, number, number, number]> = {
  // Global reanalysis / satellite products.
  merra2: [-180, -90, 180, 90],
  gpm_imerg: [-180, -90, 180, 90],
  // IMERG's published coverage drops off sharply above ~60°N/S latitude,
  // but we keep the global extent here because the search bar should
  // always succeed and `fitBounds` will gracefully zoom to the data
  // when it loads.
  modis_ndvi: [-180, -90, 180, 90],
  default: [-180, -90, 180, 90],
};

export function buildDatasetRegions(catalog: DatasetMetadata[] | null | undefined): DatasetRegion[] {
  if (!catalog || catalog.length === 0) return [];

  return catalog.map((dataset) => {
    const extent =
      DATASET_EXTENT_OVERRIDES[dataset.dataset_id] ?? DATASET_EXTENT_OVERRIDES.default;

    return {
      id: `dataset:${dataset.dataset_id}`,
      name: `${dataset.title} coverage`,
      detail:
        dataset.temporal_bounds && (dataset.temporal_bounds.start_year || dataset.temporal_bounds.end_year)
          ? `Global · ${dataset.temporal_bounds.start_year ?? "…"} → ${dataset.temporal_bounds.end_year ?? "…"}`
          : "Global coverage",
      bbox: extent,
      searchKey: `${dataset.dataset_id} ${dataset.title} ${dataset.collection}`.toLocaleLowerCase(),
      period: dataset.temporal_bounds,
    } satisfies DatasetRegion;
  });
}

/**
 * Score-based search over the derived dataset regions. Mirrors the
 * scoring used elsewhere so the dropdown stays consistent.
 */
export function searchDatasetRegions(
  regions: DatasetRegion[],
  query: string,
  limit = 3,
): DatasetRegion[] {
  const terms = query
    .toLocaleLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (terms.length === 0) return regions.slice(0, limit);

  return regions
    .map((region) => {
      const name = region.name.toLocaleLowerCase();
      const searchable = `${name} ${region.detail} ${region.searchKey}`.toLocaleLowerCase();
      const score = terms.reduce((total, term) => {
        if (name.startsWith(term)) return total + 5;
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
