"use client";

import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Compass,
  Crosshair,
  Database,
  Globe2,
  Layers,
  Loader2,
  MapPin,
  Search,
  X,
} from "lucide-react";
import { useCatalog } from "@/lib/api/client";
import { searchPlaces, type PlaceSearchResult } from "@/lib/api/places";
import { parseCoordinate, formatCoordinate } from "@/lib/search/coordinates";
import {
  searchUniversalIndex,
  type UniversalSearchItem,
  type UniversalSearchKind,
} from "@/lib/search/universal-index";
import {
  searchStudyRegions,
  type StudyRegion,
} from "@/lib/search/study-regions";
import {
  buildDatasetRegions,
  searchDatasetRegions,
  type DatasetRegion,
} from "@/lib/search/dataset-regions";
import {
  highlightSearchedPlace,
  clearSearchedPlaceHighlight,
} from "@/lib/map/place-fly";
import { getMap } from "@/lib/map/map-instance";

const KIND_LABELS: Record<UniversalSearchKind, string> = {
  dataset: "Dataset",
  tool: "Tool",
  method: "Method",
  concept: "Guide",
};

function ResultIcon({ kind }: { kind: UniversalSearchKind }) {
  if (kind === "dataset") return <Database aria-hidden="true" />;
  if (kind === "tool") return <Layers aria-hidden="true" />;
  return <Compass aria-hidden="true" />;
}

type GeoKind = "place" | "coordinate" | "study-region" | "dataset-region";

const GEO_KIND_LABELS: Record<GeoKind, string> = {
  place: "Place",
  coordinate: "Coordinate",
  "study-region": "Region",
  "dataset-region": "Dataset",
};

function GeoResultIcon({ kind }: { kind: GeoKind }) {
  if (kind === "place") return <MapPin aria-hidden="true" />;
  if (kind === "coordinate") return <Crosshair aria-hidden="true" />;
  if (kind === "study-region") return <Compass aria-hidden="true" />;
  return <Globe2 aria-hidden="true" />;
}

interface GeoResult {
  id: string;
  kind: GeoKind;
  title: string;
  detail: string;
  meta?: string;
  point?: { longitude: number; latitude: number };
  bbox?: [number, number, number, number];
  geojson?: PlaceSearchResult["geojson"];
}

const PLACE_DEBOUNCE_MS = 180;

const QUICK_SUGGESTIONS = [
  { label: "Dhaka, Bangladesh", query: "Dhaka" },
  { label: "Amazon Basin", query: "Amazon Basin" },
  { label: "Greenland Ice Sheet", query: "Greenland" },
  { label: "Sahel Region", query: "Sahel" },
  { label: "MERRA-2 Air Temperature", query: "MERRA-2 air temperature" },
  { label: "GPM IMERG Precipitation", query: "GPM IMERG precipitation" },
];

export interface SelectedLocationPayload {
  name: string;
  point?: { longitude: number; latitude: number };
  bbox?: [number, number, number, number];
  geojson?: PlaceSearchResult["geojson"];
}

interface UniversalQueryBarProps {
  onLocationSelected?: (location: SelectedLocationPayload) => void;
}

export function UniversalQueryBar({ onLocationSelected }: UniversalQueryBarProps = {}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<UniversalSearchItem | null>(null);

  // Geographic-search state
  const [placeResults, setPlaceResults] = useState<PlaceSearchResult[]>([]);
  const [isPlacesLoading, setIsPlacesLoading] = useState(false);
  const placeRequestIdRef = useRef(0);

  // Catalog data for dataset regions
  const { data: catalogData } = useCatalog();
  const datasetRegions = useMemo(
    () => buildDatasetRegions((catalogData ?? []) as never),
    [catalogData],
  );

  const localResults = useMemo(() => searchUniversalIndex(query), [query]);
  const studyResults = useMemo(() => searchStudyRegions(query), [query]);
  const datasetResults = useMemo(
    () => searchDatasetRegions(datasetRegions, query),
    [datasetRegions, query],
  );
  const coordinateResult = useMemo(
    () => parseCoordinate(query),
    [query],
  );

  // Debounced geocoder lookup
  useEffect(() => {
    const clean = query.trim();
    const skipLookup = clean.length < 2 || coordinateResult !== null;
    if (skipLookup) {
      setPlaceResults([]);
      setIsPlacesLoading(false);
      return;
    }

    const requestId = ++placeRequestIdRef.current;
    setIsPlacesLoading(true);

    const timer = window.setTimeout(async () => {
      try {
        const result = await searchPlaces(clean, { limit: 8 });
        if (placeRequestIdRef.current !== requestId) return;
        setPlaceResults(result.results);
      } catch {
        if (placeRequestIdRef.current === requestId) {
          setPlaceResults([]);
        }
      } finally {
        if (placeRequestIdRef.current === requestId) {
          setIsPlacesLoading(false);
        }
      }
    }, PLACE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [query, coordinateResult]);

  // Global hotkeys
  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (event.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    const handlePointerDown = (event: globalThis.PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  // Assemble geographic results
  const geoResults = useMemo<GeoResult[]>(() => {
    const items: GeoResult[] = [];

    if (coordinateResult) {
      items.push({
        id: `coord:${coordinateResult.raw}`,
        kind: "coordinate",
        title: formatCoordinate(coordinateResult),
        detail: "Go to this exact coordinate on the map",
        meta: `lon ${coordinateResult.longitude.toFixed(3)}°, lat ${coordinateResult.latitude.toFixed(3)}°`,
        point: {
          longitude: coordinateResult.longitude,
          latitude: coordinateResult.latitude,
        },
      });
    }

    placeResults.forEach((place: PlaceSearchResult) => {
      const detailParts = [
        place.admin1 && place.admin1.toLowerCase() !== place.name.toLowerCase() ? place.admin1 : null,
        place.country && place.country.toLowerCase() !== place.name.toLowerCase() ? place.country : null,
      ].filter(Boolean);
      const detail =
        detailParts.join(", ") ||
        (place.kind && place.kind !== "place" && place.kind.toLowerCase() !== place.name.toLowerCase()
          ? place.kind
          : "");

      items.push({
        id: `place:${place.id}`,
        kind: "place",
        title: place.name,
        detail,
        meta: `${place.longitude.toFixed(3)}°, ${place.latitude.toFixed(3)}°`,
        point: { longitude: place.longitude, latitude: place.latitude },
        bbox: place.bbox,
        geojson: place.geojson,
      });
    });

    studyResults.forEach((region: StudyRegion) => {
      items.push({
        id: `study:${region.id}`,
        kind: "study-region",
        title: region.name,
        detail: region.detail,
        meta: `bbox [${region.bbox.map((v) => v.toFixed(1) + "°").join(", ")}]`,
        bbox: region.bbox,
      });
    });

    datasetResults.forEach((region: DatasetRegion) => {
      items.push({
        id: region.id,
        kind: "dataset-region",
        title: region.name,
        detail: region.detail,
        bbox: region.bbox,
      });
    });

    return items;
  }, [coordinateResult, placeResults, studyResults, datasetResults]);

  const navigateToGeo = (result: GeoResult) => {
    const map = getMap();
    highlightSearchedPlace(map, {
      name: result.title,
      point: result.point,
      bbox: result.bbox,
      geojson: result.geojson,
      detail: result.detail,
    });
    setQuery(result.title);
    setIsOpen(false);
    if (onLocationSelected) {
      onLocationSelected({
        name: result.title,
        point: result.point,
        bbox: result.bbox,
        geojson: result.geojson,
      });
    }
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setSelected(null);
    setIsOpen(true);
  };

  const selectResult = (item: UniversalSearchItem) => {
    setQuery(item.title);
    setSelected(item);
    setIsOpen(true);
  };

  const clearQuery = () => {
    setQuery("");
    setSelected(null);
    setPlaceResults([]);
    setIsOpen(true);
    inputRef.current?.focus();
    const map = getMap();
    clearSearchedPlaceHighlight(map);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (geoResults.length > 0) {
      navigateToGeo(geoResults[0]);
      return;
    }

    const clean = query.trim();
    if (clean.length >= 2) {
      setIsPlacesLoading(true);
      try {
        const res = await searchPlaces(clean, { limit: 1 });
        if (res.results.length > 0) {
          const place = res.results[0];
          const detailParts = [
            place.admin1 && place.admin1.toLowerCase() !== place.name.toLowerCase() ? place.admin1 : null,
            place.country && place.country.toLowerCase() !== place.name.toLowerCase() ? place.country : null,
          ].filter(Boolean);
          const detail =
            detailParts.join(", ") ||
            (place.kind && place.kind !== "place" && place.kind.toLowerCase() !== place.name.toLowerCase()
              ? place.kind
              : "");
          navigateToGeo({
            id: `place:${place.id}`,
            kind: "place",
            title: place.name,
            detail,
            point: { longitude: place.longitude, latitude: place.latitude },
            bbox: place.bbox,
            geojson: place.geojson,
          });
          return;
        }
      } catch {
        // ignore
      } finally {
        setIsPlacesLoading(false);
      }
    }

    if (localResults.length > 0) {
      selectResult(localResults[0]);
    }
  };

  const panelVisible = isOpen;

  return (
    <div className="header-search-wrap" ref={rootRef}>
      <form className="header-search" role="search" onSubmit={handleSubmit}>
        <Search className="header-search-icon" aria-hidden="true" />
        <label className="sr-only" htmlFor="universal-query">
          Search places, coordinates, datasets, or study regions
        </label>
        <input
          ref={inputRef}
          id="universal-query"
          type="search"
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder="Search places, coordinates, datasets, or study regions…"
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={panelVisible}
          aria-controls="universal-query-panel"
        />
        {query && (
          <button className="search-clear" type="button" onClick={clearQuery} aria-label="Clear query">
            <X aria-hidden="true" />
          </button>
        )}
        {!query && <kbd className="query-shortcut">Ctrl K</kbd>}
        <button
          className="query-submit"
          type="submit"
          disabled={!query.trim()}
          aria-label="Search"
          title="Search"
        >
          {isPlacesLoading ? (
            <Loader2 className="query-spinner" aria-hidden="true" />
          ) : (
            <Search aria-hidden="true" />
          )}
        </button>
      </form>

      {panelVisible && (
        <section
          className="search-results custom-scrollbar"
          id="universal-query-panel"
          aria-label="Search results"
          aria-live="polite"
        >
          {selected ? (
            <article className="query-selection">
              <div className={`query-result-icon query-result-icon-${selected.kind}`}>
                <ResultIcon kind={selected.kind} />
              </div>
              <div>
                <span className="query-kind">{KIND_LABELS[selected.kind]}</span>
                <strong>{selected.title}</strong>
                <p>{selected.detail}</p>
              </div>
            </article>
          ) : query.trim() ? (
            <>
              {geoResults.length > 0 && (
                <div className="query-section-group">
                  <div className="query-section-label">Locations &amp; Places</div>
                  {geoResults.map((result) => (
                    <button
                      type="button"
                      key={result.id}
                      className="search-result search-result-geo"
                      onClick={() => navigateToGeo(result)}
                    >
                      <span className={`query-result-icon query-result-icon-${result.kind}`}>
                        <GeoResultIcon kind={result.kind} />
                      </span>
                      <span className="query-result-copy">
                        <span className="search-result-title">{result.title}</span>
                        <span className="search-result-detail">{result.detail}</span>
                        {result.meta && (
                          <span className="search-result-geo-coord">{result.meta}</span>
                        )}
                      </span>
                      <span className="query-kind">
                        {GEO_KIND_LABELS[result.kind]}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {localResults.length > 0 && (
                <div className="query-section-group">
                  <div className="query-section-label">Datasets &amp; Investigation Tools</div>
                  {localResults.map((item) => (
                    <button
                      className="search-result"
                      type="button"
                      key={item.id}
                      onClick={() => selectResult(item)}
                    >
                      <span className={`query-result-icon query-result-icon-${item.kind}`}>
                        <ResultIcon kind={item.kind} />
                      </span>
                      <span className="query-result-copy">
                        <span className="search-result-title">{item.title}</span>
                        <span className="search-result-detail">{item.detail}</span>
                      </span>
                      <span className="query-kind">{KIND_LABELS[item.kind]}</span>
                    </button>
                  ))}
                </div>
              )}

              {isPlacesLoading && geoResults.length === 0 && (
                <div className="search-result text-slate-400 text-xs py-3 px-3 flex items-center gap-2">
                  <Loader2 className="query-spinner" aria-hidden="true" />
                  <span>Searching locations for &ldquo;{query.trim()}&rdquo;…</span>
                </div>
              )}

              {!isPlacesLoading && localResults.length === 0 && geoResults.length === 0 && (
                <div className="search-empty">
                  <strong>No places or datasets found for &ldquo;{query.trim()}&rdquo;</strong>
                  <span>Try searching a city, country, coordinates (lat, lon), or NASA dataset.</span>
                </div>
              )}
            </>
          ) : (
            <div className="query-starters">
              <div className="query-section-label">Quick Suggestions</div>
              {QUICK_SUGGESTIONS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleQueryChange(item.query)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
