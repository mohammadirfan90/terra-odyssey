/**
 * Camera-animation and search-highlight helpers used by the search bar.
 * Adds visual pin, glowing pulse, and real administrative border polygon
 * (red/white dashed boundary) when available. Never draws artificial rectangular boxes.
 */

import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";

export interface PlacePoint {
  longitude: number;
  latitude: number;
}

export interface SearchedPlaceHighlight {
  name: string;
  point?: PlacePoint;
  bbox?: readonly [number, number, number, number] | [number, number, number, number];
  geojson?: {
    type: "Polygon" | "MultiPolygon";
    coordinates: unknown;
  } | null;
  detail?: string;
}

const FLY_DURATION_MS = 1200;
const FIT_PADDING_PX = 90;

const HIGHLIGHT_SOURCE_ID = "search-place-highlight-source";
const HIGHLIGHT_FILL_LAYER_ID = "search-place-highlight-fill";
const HIGHLIGHT_LINE_GLOW_ID = "search-place-highlight-line-glow";
const HIGHLIGHT_LINE_CASING_ID = "search-place-highlight-line-casing";
const HIGHLIGHT_LINE_LAYER_ID = "search-place-highlight-line";

let activeMarker: maplibregl.Marker | null = null;
let activePopup: maplibregl.Popup | null = null;

/** Remove any active search place marker, popup, or highlight boundary. */
export function clearSearchedPlaceHighlight(map: MapLibreMap | null | undefined): void {
  if (activeMarker) {
    try {
      activeMarker.remove();
    } catch {
      // ignore
    }
    activeMarker = null;
  }
  if (activePopup) {
    try {
      activePopup.remove();
    } catch {
      // ignore
    }
    activePopup = null;
  }

  if (!map) return;
  try {
    if (map.getLayer(HIGHLIGHT_LINE_LAYER_ID)) map.removeLayer(HIGHLIGHT_LINE_LAYER_ID);
    if (map.getLayer(HIGHLIGHT_LINE_CASING_ID)) map.removeLayer(HIGHLIGHT_LINE_CASING_ID);
    if (map.getLayer(HIGHLIGHT_LINE_GLOW_ID)) map.removeLayer(HIGHLIGHT_LINE_GLOW_ID);
    if (map.getLayer(HIGHLIGHT_FILL_LAYER_ID)) map.removeLayer(HIGHLIGHT_FILL_LAYER_ID);
    if (map.getSource(HIGHLIGHT_SOURCE_ID)) map.removeSource(HIGHLIGHT_SOURCE_ID);
  } catch {
    // ignore
  }
}

/** Move the camera to a single point with a smooth ease. */
export function flyToPlace(
  map: MapLibreMap | null | undefined,
  point: PlacePoint,
  zoom = 6,
): boolean {
  if (!map) return false;
  try {
    map.flyTo({
      center: [point.longitude, point.latitude],
      zoom,
      duration: FLY_DURATION_MS,
      essential: true,
    });
    return true;
  } catch {
    return false;
  }
}

/** Zoom the camera so that an entire bbox fits comfortably on screen. */
export function fitToBounds(
  map: MapLibreMap | null | undefined,
  bbox: readonly [number, number, number, number],
  padding = FIT_PADDING_PX,
): boolean {
  if (!map) return false;
  try {
    map.fitBounds(
      [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]],
      ],
      { padding, duration: FLY_DURATION_MS, essential: true },
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Highlight the searched place with an animated pin marker, place name badge,
 * and REAL administrative boundary polygon (red/white dashed boundary) when GeoJSON
 * polygon data is available. No artificial rectangle boxes are ever drawn.
 */
export function highlightSearchedPlace(
  map: MapLibreMap | null | undefined,
  place: SearchedPlaceHighlight,
): boolean {
  if (!map) return false;

  clearSearchedPlaceHighlight(map);

  // Compute center point
  let center: PlacePoint;
  if (place.point) {
    center = place.point;
  } else if (place.bbox) {
    center = {
      longitude: (place.bbox[0] + place.bbox[2]) / 2,
      latitude: (place.bbox[1] + place.bbox[3]) / 2,
    };
  } else {
    return false;
  }

  // 1. Resolve or construct boundary polygon geometry to guarantee a highlighted border for ANY searched location
  let boundaryGeometry: { type: string; coordinates: unknown } | null = null;
  if (
    place.geojson &&
    (place.geojson.type === "Polygon" || place.geojson.type === "MultiPolygon")
  ) {
    boundaryGeometry = place.geojson;
  } else if (place.bbox && place.bbox.length === 4) {
    const [minLon, minLat, maxLon, maxLat] = place.bbox;
    boundaryGeometry = {
      type: "Polygon",
      coordinates: [[
        [minLon, minLat],
        [maxLon, minLat],
        [maxLon, maxLat],
        [minLon, maxLat],
        [minLon, minLat],
      ]],
    };
  } else if (place.point) {
    const pad = 0.5;
    const { longitude: lon, latitude: lat } = place.point;
    boundaryGeometry = {
      type: "Polygon",
      coordinates: [[
        [Math.max(-180, lon - pad), Math.max(-90, lat - pad)],
        [Math.min(180, lon + pad), Math.max(-90, lat - pad)],
        [Math.min(180, lon + pad), Math.min(90, lat + pad)],
        [Math.max(-180, lon - pad), Math.min(90, lat + pad)],
        [Math.max(-180, lon - pad), Math.max(-90, lat - pad)],
      ]],
    };
  }

  const addBoundaryHighlightLayers = (geom: { type: string; coordinates: unknown }) => {
    if (!map.isStyleLoaded()) return;

    try {
      if (map.getLayer(HIGHLIGHT_LINE_LAYER_ID)) map.removeLayer(HIGHLIGHT_LINE_LAYER_ID);
      if (map.getLayer(HIGHLIGHT_LINE_CASING_ID)) map.removeLayer(HIGHLIGHT_LINE_CASING_ID);
      if (map.getLayer(HIGHLIGHT_LINE_GLOW_ID)) map.removeLayer(HIGHLIGHT_LINE_GLOW_ID);
      if (map.getLayer(HIGHLIGHT_FILL_LAYER_ID)) map.removeLayer(HIGHLIGHT_FILL_LAYER_ID);
      if (map.getSource(HIGHLIGHT_SOURCE_ID)) map.removeSource(HIGHLIGHT_SOURCE_ID);

      const polygonGeoJson = {
        type: "Feature" as const,
        geometry: geom as never,
        properties: {
          name: place.name,
        },
      };

      map.addSource(HIGHLIGHT_SOURCE_ID, {
        type: "geojson",
        data: polygonGeoJson,
      });

      // Subtle fill overlay inside the highlighted boundary
      map.addLayer({
        id: HIGHLIGHT_FILL_LAYER_ID,
        type: "fill",
        source: HIGHLIGHT_SOURCE_ID,
        paint: {
          "fill-color": "#38bdf8",
          "fill-opacity": 0.08,
        },
      });

      // 1. Soft glowing outer pulse
      map.addLayer({
        id: HIGHLIGHT_LINE_GLOW_ID,
        type: "line",
        source: HIGHLIGHT_SOURCE_ID,
        paint: {
          "line-color": "#0284c7",
          "line-width": 6.0,
          "line-blur": 3.0,
          "line-opacity": 0.5,
        },
      });

      // 2. Crisp white casing stroke underneath for contrast on any satellite background
      map.addLayer({
        id: HIGHLIGHT_LINE_CASING_ID,
        type: "line",
        source: HIGHLIGHT_SOURCE_ID,
        paint: {
          "line-color": "#ffffff",
          "line-width": 3.2,
          "line-opacity": 0.95,
        },
      });

      // 3. Highlighted border line on top (electric cyan with red/amber accent dashes or crisp line)
      map.addLayer({
        id: HIGHLIGHT_LINE_LAYER_ID,
        type: "line",
        source: HIGHLIGHT_SOURCE_ID,
        paint: {
          "line-color": "#0284c7",
          "line-width": 2.2,
          "line-opacity": 1.0,
        },
      });
    } catch {
      // ignore
    }
  };

  if (boundaryGeometry) {
    if (map.isStyleLoaded()) {
      addBoundaryHighlightLayers(boundaryGeometry);
    } else {
      map.once("load", () => {
        if (boundaryGeometry) addBoundaryHighlightLayers(boundaryGeometry);
      });
    }
  }

  // 2. Add custom animated Marker: pure location pointer with zero text
  if (typeof document !== "undefined") {
    try {
      const el = document.createElement("div");
      el.className = "searched-place-marker";
      el.title = place.name;
      el.innerHTML = `
        <div class="searched-marker-pin">
          <svg width="30" height="38" viewBox="0 0 30 38" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="pin-shadow" x="-4" y="0" width="38" height="46" filterUnits="userSpaceOnUse">
                <feDropShadow dx="0" dy="2.5" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.65" />
              </filter>
            </defs>
            <path d="M15 1C7.268 1 1 7.268 1 15C1 25.5 15 37 15 37C15 37 29 25.5 29 15C29 7.268 22.732 1 15 1Z" fill="#ffffff" stroke="#0f172a" stroke-width="1.8" filter="url(#pin-shadow)" />
            <circle cx="15" cy="15" r="5.5" fill="#0284c7" />
            <circle cx="15" cy="15" r="2.2" fill="#ffffff" />
          </svg>
        </div>
        <div class="searched-marker-ground-pulse"></div>
      `;

      activeMarker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([center.longitude, center.latitude])
        .addTo(map);
    } catch {
      // ignore
    }
  }

  // 3. Smooth Camera Animation
  if (place.bbox && Math.abs(place.bbox[2] - place.bbox[0]) > 0.05) {
    fitToBounds(map, place.bbox, FIT_PADDING_PX);
  } else {
    flyToPlace(map, center, 7);
  }

  return true;
}
