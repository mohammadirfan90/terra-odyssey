/**
 * Activity log — module-scoped ring buffer for the ActivityDock card.
 *
 * Follows the same single-`useSyncExternalStore`-hook pattern as
 * `lib/state/investigation.ts` so consumers get a stable hook order and
 * every consumer sees the same in-memory log.
 *
 * The log captures *changes* the user has made during this session so they
 * can be reviewed and undone. Each entry closes over a snapshot of the
 * previous value, so undo is just `entry.undo()`.
 */

"use client";

import { useSyncExternalStore } from "react";

export type ActivityKind =
  | "dataset"
  | "variable"
  | "custom"
  | "region"
  | "shape"
  | "period"
  | "clear";

export type ActivityAccent =
  | "cyan"
  | "purple"
  | "amber"
  | "rose"
  | "emerald"
  | "slate";

export interface ActivityEntry {
  /** Stable id for React keying. */
  id: string;
  /** What kind of change this is. */
  kind: ActivityKind;
  /** Primary label, e.g. "Dataset → GPM IMERG". */
  label: string;
  /** Optional prior value label, e.g. "Dataset → MERRA-2". */
  prevLabel?: string;
  /** Accent for the icon chip + chart bucket. */
  accent: ActivityAccent;
  /** When this change happened (ms since epoch). */
  timestamp: number;
  /** Restores the prior state. */
  undo: () => void;
  /** Whether undo has already been called (visual only). */
  undone?: boolean;
}

const MAX_ENTRIES = 60;

// Module-scoped singleton log. We deliberately store entries inside an
// array and replace it on every push so React's `useSyncExternalStore`
// `getSnapshot` returns a fresh reference (required for re-renders).
let currentLog: ActivityEntry[] = [];
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ActivityEntry[] {
  return currentLog;
}

// `useSyncExternalStore` requires the server snapshot to be a stable
// reference — returning a fresh `[]` each call would trigger an infinite
// re-render loop on the client because React compares by identity.
const SERVER_SNAPSHOT: ReadonlyArray<ActivityEntry> = Object.freeze(
  [] as ActivityEntry[],
);

function getServerSnapshot(): ReadonlyArray<ActivityEntry> {
  return SERVER_SNAPSHOT;
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `act-${Date.now().toString(36)}-${counter.toString(36)}`;
}

/** Append a new entry to the front of the log (newest first). */
export function pushActivity(entry: Omit<ActivityEntry, "id" | "timestamp">): void {
  const full: ActivityEntry = {
    ...entry,
    id: nextId(),
    timestamp: Date.now(),
  };
  const next = [full, ...currentLog];
  if (next.length > MAX_ENTRIES) next.length = MAX_ENTRIES;
  currentLog = next;
  notify();
}

/** Mark an entry as undone (visual only — the entry stays in the log). */
export function markUndone(id: string): void {
  let mutated = false;
  const next = currentLog.map((e) => {
    if (e.id === id && !e.undone) {
      mutated = true;
      return { ...e, undone: true };
    }
    return e;
  });
  if (mutated) {
    currentLog = next;
    notify();
  }
}

/** Drop the entire log (used by the global "Clear" button). */
export function resetActivity(): void {
  currentLog = [];
  notify();
}

/**
 * Hook returning the current activity log. Single `useSyncExternalStore`
 * call → guaranteed stable hook order on every render.
 */
export function useActivityLog(): ReadonlyArray<ActivityEntry> {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
