/**
 * Dual-Persistence Storage Coordinator for Terra Odyssey Study Regions.
 *
 * Implements a resilient two-tier architecture:
 *  - Tier 1 (Client Local-First): W3C IndexedDB (`terra_odyssey_db`) with synchronous
 *    localStorage caching for instant 0ms DOM rehydration and offline persistence.
 *  - Tier 2 (Authoritative Server-Side): SQLite database (`jobs.db` on disk) via `/api/plots`
 *    for session recovery, multi-tab synchronization, and NASA auditability.
 */

import {
  clearPlotsFromBackend,
  deletePlotFromBackend,
  fetchActivePlot,
  fetchPlots,
  savePlotToBackend,
  StudyPlotDto,
} from "@/lib/api/client";

export interface PersistedPlot {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  geometry: {
    type: "Polygon" | "LineString";
    coordinates: [number, number][][] | [number, number][];
  };
  bbox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  measurements: {
    areaKm2?: number;
    areaHa?: number;
    perimeterKm?: number;
    centroid?: [number, number];
    bounds?: {
      minLat: number;
      maxLat: number;
      minLon: number;
      maxLon: number;
    };
    vertexCount?: number;
    [key: string]: unknown;
  };
  datasetId?: string | null;
  variable?: string | null;
}

const DB_NAME = "terra_odyssey_db";
const DB_VERSION = 1;
const STORE_NAME = "study_plots";
const ACTIVE_PLOT_STORAGE_KEY = "terra-odyssey:active-plot";

let dbPromise: Promise<IDBDatabase> | null = null;

function getIndexedDB(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.reject(new Error("IndexedDB is not supported or running on server"));
  }
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
            store.createIndex("updatedAt", "updatedAt", { unique: false });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"));
      } catch (err) {
        reject(err);
      }
    });
  }
  return dbPromise;
}

// ── Fallback synchronous cache in localStorage for instant hydration ───────

function getActivePlotFromCache(): PersistedPlot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_PLOT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedPlot) : null;
  } catch {
    return null;
  }
}

function setActivePlotInCache(plot: PersistedPlot | null): void {
  if (typeof window === "undefined") return;
  try {
    if (plot) {
      window.localStorage.setItem(ACTIVE_PLOT_STORAGE_KEY, JSON.stringify(plot));
    } else {
      window.localStorage.removeItem(ACTIVE_PLOT_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota or disabled storage errors
  }
}

// ── Conversion helpers between DTO and PersistedPlot ────────────────────────

function dtoToPersisted(dto: StudyPlotDto): PersistedPlot {
  return {
    id: dto.plot_id,
    name: dto.name,
    createdAt: dto.created_at || new Date().toISOString(),
    updatedAt: dto.updated_at || new Date().toISOString(),
    geometry: {
      type: (dto.geometry_type as "Polygon" | "LineString") || "Polygon",
      coordinates: dto.coordinates as [number, number][][],
    },
    bbox: dto.bbox,
    measurements: dto.measurements || {},
    datasetId: dto.dataset_id,
  };
}

function persistedToDto(plot: PersistedPlot, isActive: boolean = true): StudyPlotDto {
  return {
    plot_id: plot.id,
    name: plot.name,
    is_active: isActive,
    geometry_type: plot.geometry.type,
    coordinates: plot.geometry.coordinates,
    bbox: plot.bbox,
    measurements: plot.measurements,
    dataset_id: plot.datasetId,
    created_at: plot.createdAt,
    updated_at: plot.updatedAt,
  };
}

// ── Public Plot Storage API ────────────────────────────────────────────────

/**
 * Save or update a study region plot across both IndexedDB and SQLite backend.
 */
export async function savePlot(plot: PersistedPlot): Promise<void> {
  // 1. Immediately mirror to synchronous localStorage cache for 0ms rehydration
  setActivePlotInCache(plot);

  // 2. Commit to IndexedDB
  try {
    const db = await getIndexedDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(plot);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (idbErr) {
    console.warn("IndexedDB write warning (falling back to cache):", idbErr);
  }

  // 3. Asynchronously sync to SQLite backend (fire-and-forget; local-first)
  try {
    savePlotToBackend(persistedToDto(plot, true)).catch((err) => {
      console.warn("Background SQLite sync skipped:", err);
    });
  } catch {
    // Non-fatal for offline usage
  }

  // 4. Notify app components
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("terra-odyssey:plot-saved", { detail: { plot } }),
    );
  }
}

/**
 * Get the currently active plot. Returns instant cache if available,
 * then reconciles from IndexedDB, and finally backend SQLite.
 */
export async function getActivePlot(): Promise<PersistedPlot | null> {
  // 1. Check synchronous cache first
  const cached = getActivePlotFromCache();

  // 2. Read from IndexedDB
  try {
    const db = await getIndexedDB();
    const idbPlot = await new Promise<PersistedPlot | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      if (cached?.id) {
        const req = store.get(cached.id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } else {
        const index = store.index("updatedAt");
        const req = index.openCursor(null, "prev");
        req.onsuccess = () => {
          const cursor = req.result;
          resolve(cursor ? (cursor.value as PersistedPlot) : null);
        };
        req.onerror = () => resolve(null);
      }
    });

    if (idbPlot) {
      setActivePlotInCache(idbPlot);
      return idbPlot;
    }
  } catch {
    // If IndexedDB unavailable, fall back to cache
  }

  if (cached) return cached;

  // 3. If neither client store has it, try backend SQLite
  try {
    const backendDto = await fetchActivePlot();
    if (backendDto) {
      const plot = dtoToPersisted(backendDto);
      setActivePlotInCache(plot);
      // Hydrate local IndexedDB
      savePlot(plot).catch(() => {});
      return plot;
    }
  } catch {
    // Backend unreachable
  }

  return null;
}

/**
 * List all saved plots from IndexedDB (or fallback to backend SQLite).
 */
export async function getAllPlots(): Promise<PersistedPlot[]> {
  try {
    const db = await getIndexedDB();
    const idbPlots = await new Promise<PersistedPlot[]>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as PersistedPlot[]) || []);
      req.onerror = () => resolve([]);
    });

    if (idbPlots && idbPlots.length > 0) {
      return idbPlots.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    }
  } catch {
    // IndexedDB failure
  }

  // Try backend SQLite
  try {
    const backendDtos = await fetchPlots();
    if (backendDtos && backendDtos.length > 0) {
      const plots = backendDtos.map(dtoToPersisted);
      // Backfill IndexedDB
      for (const p of plots) {
        savePlot(p).catch(() => {});
      }
      return plots;
    }
  } catch {
    // Ignore
  }

  const cached = getActivePlotFromCache();
  return cached ? [cached] : [];
}

/**
 * Set the active plot in local cache and notify listeners across the application.
 */
export function setActivePlot(plot: PersistedPlot | null): void {
  setActivePlotInCache(plot);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("terra-odyssey:active-plot-changed", { detail: { plot } }),
    );
  }
}

/**
 * Delete a specific plot by ID from IndexedDB and SQLite.
 */
export async function deletePlot(id: string): Promise<void> {
  const cached = getActivePlotFromCache();
  if (cached?.id === id) {
    setActivePlotInCache(null);
  }

  try {
    const db = await getIndexedDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("IndexedDB delete error:", err);
  }

  try {
    deletePlotFromBackend(id).catch(() => {});
  } catch {
    // Non-fatal
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("terra-odyssey:plot-deleted", { detail: { id } }),
    );
  }
}

/**
 * Clear all plots from IndexedDB, localStorage, and SQLite backend.
 */
export async function clearAllPlots(): Promise<void> {
  setActivePlotInCache(null);

  try {
    const db = await getIndexedDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("IndexedDB clear error:", err);
  }

  try {
    clearPlotsFromBackend().catch(() => {});
  } catch {
    // Non-fatal
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("terra-odyssey:clear-shapes"));
  }
}
