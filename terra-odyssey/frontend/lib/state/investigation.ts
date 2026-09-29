/**
 * Shared investigation state hook.
 *
 * React requires that the same hooks be called in the same order on every
 * render of every component that uses this hook. To honour that contract
 * we use `useSyncExternalStore` against a single module-scoped store, so
 * every consumer reads from the same backing state without introducing
 * per-component hook counts that drift across renders.
 *
 * Higher-level orchestration (running an investigation, handling selection
 * events) lives in `app/page.tsx`; this file remains a pure state container.
 */

"use client";

import { useSyncExternalStore } from "react";

export interface InvestigationPeriod {
  start_year: number;
  end_year: number;
}

export interface RegionState {
  bbox: [number, number, number, number];
  name: string;
}

export interface CustomVariable {
  /** Display name shown in the panel. */
  name: string;
  /** Optional units string shown next to the badge. */
  units?: string;
  /** Optional free-form expression / description. */
  description?: string;
}

export type DrawMode =
  | "idle"
  | "draw-rectangle-a"
  | "draw-polygon-a"
  | "draw-circle-a"
  | "draw-rectangle-b"
  | "draw-polygon-b"
  | "draw-circle-b"
  | "measure-line"
  | "measure-polygon"
  | "measure-circle";

export type MapType = "default" | "satellite";

export interface InvestigationSnapshot {
  selectedDataset: string;
  selectedVariable: string;
  customVariable: CustomVariable | null;
  period: InvestigationPeriod;
  regionA: RegionState;
  regionB: RegionState | null;
  mapType: MapType;
  mapDate: string;
  drawMode: DrawMode;
  /** A year the user has explicitly focused on a chart or evidence view. */
  selectedYear: number | null;
  /** True while a freshly drawn region is awaiting an explicit Analyze commit. */
  hasPendingRegion: boolean;
  /** Auto-run an analysis when a new region is finished drawing. */
  regionAutoRun: boolean;
}

export interface InvestigationState extends InvestigationSnapshot {
  setSelectedDataset: (id: string) => void;
  setSelectedVariable: (id: string) => void;
  setCustomVariable: (cv: CustomVariable | null) => void;
  setPeriod: (p: InvestigationPeriod) => void;
  setRegionA: (r: RegionState) => void;
  setRegionB: (r: RegionState | null) => void;
  setMapType: (t: MapType) => void;
  setMapDate: (d: string) => void;
  setDrawMode: (m: DrawMode) => void;
  setSelectedYear: (yr: number | null) => void;
  setHasPendingRegion: (v: boolean) => void;
  setRegionAutoRun: (v: boolean) => void;
}

export interface InvestigationStore {
  state: InvestigationSnapshot;
  setSelectedDataset: (id: string) => void;
  setSelectedVariable: (id: string) => void;
  setCustomVariable: (cv: CustomVariable | null) => void;
  setPeriod: (p: InvestigationPeriod) => void;
  setRegionA: (r: RegionState) => void;
  setRegionB: (r: RegionState | null) => void;
  setMapType: (t: MapType) => void;
  setMapDate: (d: string) => void;
  setDrawMode: (m: DrawMode) => void;
  setSelectedYear: (yr: number | null) => void;
  setHasPendingRegion: (v: boolean) => void;
  setRegionAutoRun: (v: boolean) => void;
}

/**
 * Compose a full state-with-setters object from the current snapshot and
 * the singleton's setter references. Used both by the hook and by the
 * imperative `getInvestigationStore()` accessor.
 */
function compose(snapshot: InvestigationSnapshot, s: InvestigationStore): InvestigationState {
  return {
    ...snapshot,
    setSelectedDataset: s.setSelectedDataset,
    setSelectedVariable: s.setSelectedVariable,
    setCustomVariable: s.setCustomVariable,
    setPeriod: s.setPeriod,
    setRegionA: s.setRegionA,
    setRegionB: s.setRegionB,
    setMapType: s.setMapType,
    setMapDate: s.setMapDate,
    setDrawMode: s.setDrawMode,
    setSelectedYear: s.setSelectedYear,
    setHasPendingRegion: s.setHasPendingRegion,
    setRegionAutoRun: s.setRegionAutoRun,
  };
}

export const GLOBAL_EARTH_BBOX: [number, number, number, number] = [
  -180.0, -85.0, 180.0, 85.0,
];
export const GLOBAL_EARTH_NAME = "Entire Earth (Global)";

export const DEFAULT_REGION_A_BBOX: [number, number, number, number] = GLOBAL_EARTH_BBOX;
export const DEFAULT_REGION_NAME = GLOBAL_EARTH_NAME;

const initialState: InvestigationSnapshot = {
  // Start unselected so the Dataset/Variable selectors render in their
  // empty "Select dataset" / "Select variable" placeholder state. The
  // page flips these via real user gestures (dataset pick, place
  // search, region draw) before any investigation is launched.
  selectedDataset: "",
  selectedVariable: "",
  customVariable: null,
  period: { start_year: 2001, end_year: 2024 },
  regionA: { bbox: GLOBAL_EARTH_BBOX, name: GLOBAL_EARTH_NAME },
  regionB: null,
  mapType: "satellite",
  mapDate: "2024-08-01",
  drawMode: "idle",
  // Year cursor stays null until the user clicks a point on the chart.
  selectedYear: null,
  // False on load — flips true the moment a region is drawn and awaits commit.
  hasPendingRegion: false,
  // Auto-analyse on draw by default; the Region Card exposes a toggle.
  regionAutoRun: true,
};

// Module-scoped singleton store. `useSyncExternalStore` below subscribes to
// changes from this object so every consumer reads a consistent value and
// re-renders when any setter mutates the state.
let currentState = initialState;
const setters = {
  setSelectedDataset(id: string) {
    currentState = { ...currentState, selectedDataset: id };
    notify();
  },
  setSelectedVariable(id: string) {
    currentState = { ...currentState, selectedVariable: id };
    notify();
  },
  setCustomVariable(cv: CustomVariable | null) {
    currentState = { ...currentState, customVariable: cv };
    notify();
  },
  setPeriod(p: InvestigationPeriod) {
    currentState = { ...currentState, period: p };
    notify();
  },
  setRegionA(r: RegionState) {
    currentState = { ...currentState, regionA: r };
    notify();
  },
  setRegionB(r: RegionState | null) {
    currentState = { ...currentState, regionB: r };
    notify();
  },
  setMapType(t: MapType) {
    currentState = { ...currentState, mapType: t };
    notify();
  },
  setMapDate(d: string) {
    currentState = { ...currentState, mapDate: d };
    notify();
  },
  setDrawMode(m: DrawMode) {
    currentState = { ...currentState, drawMode: m };
    notify();
  },
  setSelectedYear(yr: number | null) {
    if (currentState.selectedYear === yr) return;
    currentState = { ...currentState, selectedYear: yr };
    notify();
  },
  setHasPendingRegion(v: boolean) {
    if (currentState.hasPendingRegion === v) return;
    currentState = { ...currentState, hasPendingRegion: v };
    notify();
  },
  setRegionAutoRun(v: boolean) {
    if (currentState.regionAutoRun === v) return;
    currentState = { ...currentState, regionAutoRun: v };
    notify();
  },
};

// Backwards-compatible wrapper so external callers (`getInvestigationStore()`)
// continue to receive an object exposing the same setter surface as before.
const store: InvestigationStore = {
  get state() {
    return currentState;
  },
  ...setters,
};

// Tiny pub/sub so React can re-render subscribers when state mutates.
const listeners = new Set<() => void>();
function notify() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): InvestigationSnapshot {
  return currentState;
}

function getServerSnapshot(): InvestigationSnapshot {
  return initialState;
}

/**
 * Hook that returns the current shared investigation state. Every consumer
 * in the workspace tree reads from the same backing store, and React
 * guarantees a stable hook order because this hook only ever invokes
 * `useSyncExternalStore` — a single, unconditional hook call.
 */
export function useInvestigationState(): InvestigationState {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return compose(snapshot, store);
}

/**
 * Non-subscribing access to the live store. Useful for event handlers that
 * need to mutate state without triggering a render at the call site.
 */
export function getInvestigationStore(): InvestigationStore {
  return store;
}

/**
 * Helper: derive a `[minLon, minLat, maxLon, maxLat]` bbox for the API
 * payload from the current region state.
 */
export function regionBBox(r: RegionState): [number, number, number, number] {
  return r.bbox;
}
