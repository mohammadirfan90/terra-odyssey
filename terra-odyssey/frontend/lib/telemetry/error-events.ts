/**
 * Module-scoped error event emitter.
 *
 * Used by `lib/api/client.ts` to publish transport / processing errors and
 * by `<StatusStrip />` to surface them as dismissible banners. Listeners are
 * stored in a `Set` so subscribers can be added or removed without affecting
 * one another. Each event is `{ id, kind, message, detail?, retry? }` —
 * the `retry` callback is invoked when the user clicks the Retry CTA.
 */

export type TerraErrorKind =
  | "network"
  | "timeout"
  | "http_4xx"
  | "http_5xx"
  | "processing"
  | "analysis_failed"
  | "tile_unavailable"
  | "no_observations";

export interface TerraErrorEvent {
  /** Stable identifier so duplicates can be deduplicated. */
  id: string;
  kind: TerraErrorKind;
  /** Short, user-visible message — phrased without developer jargon. */
  message: string;
  /** Optional expanded detail that appears under a disclosure. */
  detail?: string;
  /** Optional retry. When present, the strip renders a Retry button. */
  retry?: () => void | Promise<void>;
  /** Timestamp for ordering. */
  ts: number;
}

const listeners = new Set<(e: TerraErrorEvent) => void>();

export function emitError(event: Omit<TerraErrorEvent, "ts" | "id"> & { id?: string }) {
  const full: TerraErrorEvent = {
    id: event.id ?? `${event.kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    ...event,
  };
  for (const cb of listeners) cb(full);
}

export function subscribeErrors(cb: (e: TerraErrorEvent) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Clear all currently-active banners (used by StatusStrip "dismiss all"). */
export function clearAllErrors(): void {
  // We don't have a "current errors" list — listeners are free-form. StatusStrip owns its own list.
}
