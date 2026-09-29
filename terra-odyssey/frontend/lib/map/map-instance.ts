/**
 * Tiny singleton pub-sub for the live MapLibre instance so that the
 * universal search bar (which lives outside the map subtree) can
 * trigger flyTo / fitBounds on it without us touching the inner
 * `<Map>` component context.
 */

import type { Map as MapLibreMap } from "maplibre-gl";

type MapSubscriber = (map: MapLibreMap | null) => void;

let current: MapLibreMap | null = null;
const subscribers = new Set<MapSubscriber>();

export function publishMap(map: MapLibreMap | null): void {
  current = map;
  subscribers.forEach((subscriber) => {
    try {
      subscriber(map);
    } catch (error) {
      // Never let one subscriber's error block the others.
      // eslint-disable-next-line no-console
      console.error("[map-instance] subscriber threw", error);
    }
  });
}

export function getMap(): MapLibreMap | null {
  return current;
}

export function subscribeMap(subscriber: MapSubscriber): () => void {
  subscribers.add(subscriber);
  // Replay the current value so a late subscriber immediately sees
  // the map instance if it's already been published.
  subscriber(current);
  return () => {
    subscribers.delete(subscriber);
  };
}
