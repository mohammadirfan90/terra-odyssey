/**
 * Front-end API client for the `/api/search/places` geocoder endpoint.
 *
 * The backend wraps Photon (Komoot) and normalizes its response. This
 * module adds a small fetch wrapper with a 6-second client-side timeout
 * and graceful degradation — on any failure it resolves to an empty
 * results array so the search bar can keep working.
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

export interface PlaceSearchResult {
  id: string;
  name: string;
  kind: string;
  country: string | null;
  admin1: string | null;
  longitude: number;
  latitude: number;
  /** [minLon, minLat, maxLon, maxLat] in EPSG:4326. */
  bbox: [number, number, number, number];
  geojson?: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  } | null;
  source: string;
}

export interface PlaceSearchResponse {
  query: string;
  results: PlaceSearchResult[];
  cached: boolean;
}

const CLIENT_TIMEOUT_MS = 6_000;
const DEFAULT_LIMIT = 8;

export async function searchPlaces(
  query: string,
  options: { signal?: AbortSignal; limit?: number } = {},
): Promise<PlaceSearchResponse> {
  const clean = query.trim();
  if (clean.length < 2) {
    return { query: clean, results: [], cached: false };
  }

  const url = new URL(`${API_BASE}/search/places`);
  url.searchParams.set("q", clean);
  url.searchParams.set("limit", String(options.limit ?? DEFAULT_LIMIT));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
  // Forward the caller's signal (e.g. component unmount) so we don't
  // waste a request once the user has navigated away.
  const externalSignal = options.signal;
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      return { query: clean, results: [], cached: false };
    }

    const body = (await response.json()) as PlaceSearchResponse;
    if (!body || !Array.isArray(body.results)) {
      return { query: clean, results: [], cached: false };
    }
    return body;
  } catch (error) {
    if ((error as { name?: string })?.name === "AbortError") {
      return { query: clean, results: [], cached: false };
    }
    // eslint-disable-next-line no-console
    console.warn("[places] search failed", error);
    return { query: clean, results: [], cached: false };
  } finally {
    clearTimeout(timeout);
  }
}
