/**
 * Intelligent Algorithmic Magnetic Snapping Engine for Earth System GIS Drawing.
 *
 * Provides:
 *  1. Origin Magnet (Close Polygon): 22px magnetic attraction to vertex 0.
 *  2. Intermediate Vertex Magnet: 16px magnetic attraction to existing vertices.
 *  3. 90° Orthogonal / Cardinal Magnet: Snaps to North, South, East, West (±6° cone).
 *  4. 45° Isometric Diagonal Magnet: Snaps to diagonal angles (±4.5° cone).
 */

import type * as maplibregl from "maplibre-gl";

export type MagneticSnapType =
  | "origin"
  | "vertex"
  | "orthogonal"
  | "diagonal"
  | "none";

export interface MagneticSnapResult {
  lng: number;
  lat: number;
  isSnapped: boolean;
  type: MagneticSnapType;
  label?: string;
  screenPos?: { x: number; y: number };
  targetVertexIndex?: number;
}

export function computeIntelligentSnap(
  map: maplibregl.Map,
  cursorLl: [number, number],
  vertices: [number, number][],
  mode: string,
): MagneticSnapResult {
  const isPolygon = mode === "draw-polygon-a" || mode === "measure-polygon";
  const isLine = mode === "measure-line";

  if (!isPolygon && !isLine) {
    return { lng: cursorLl[0], lat: cursorLl[1], isSnapped: false, type: "none" };
  }

  const cursorScreen = map.project(cursorLl);

  // ── 1. Priority: Origin Magnet (Close Polygon) ───────────────────
  if (isPolygon && vertices.length >= 3) {
    const p0 = map.project(vertices[0]);
    const dist0 = Math.hypot(p0.x - cursorScreen.x, p0.y - cursorScreen.y);
    if (dist0 < 22) {
      return {
        lng: vertices[0][0],
        lat: vertices[0][1],
        isSnapped: true,
        type: "origin",
        label: "Close Polygon (Origin)",
        screenPos: { x: p0.x, y: p0.y },
        targetVertexIndex: 0,
      };
    }
  }

  // ── 2. Intermediate Vertices Magnet (for shared boundaries) ──────
  if (vertices.length >= 2) {
    for (let i = 1; i < vertices.length - 1; i++) {
      const pi = map.project(vertices[i]);
      const distI = Math.hypot(pi.x - cursorScreen.x, pi.y - cursorScreen.y);
      if (distI < 16) {
        return {
          lng: vertices[i][0],
          lat: vertices[i][1],
          isSnapped: true,
          type: "vertex",
          label: `Vertex ${i + 1}`,
          screenPos: { x: pi.x, y: pi.y },
          targetVertexIndex: i,
        };
      }
    }
  }

  // ── 3. Orthogonal & Diagonal Angular Magnetism ──────────────────
  if (vertices.length >= 1) {
    const lastV = vertices[vertices.length - 1];
    const pLast = map.project(lastV);
    const dx = cursorScreen.x - pLast.x;
    const dy = cursorScreen.y - pLast.y;
    const dist = Math.hypot(dx, dy);

    // Only engage angular magnet if cursor has moved away from last vertex (> 24px)
    if (dist > 24) {
      let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (angleDeg < 0) angleDeg += 360;

      // 3A. Check orthogonal (0°, 90°, 180°, 270°) with 6° magnetic snap cone
      const orthoAngles = [0, 90, 180, 270, 360];
      for (const target of orthoAngles) {
        const diff = Math.abs(angleDeg - target);
        if (diff <= 6.0) {
          const snappedRad = (target % 360) * (Math.PI / 180);
          const snappedX = pLast.x + dist * Math.cos(snappedRad);
          const snappedY = pLast.y + dist * Math.sin(snappedRad);
          const snappedLl = map.unproject([snappedX, snappedY]);

          const axisName =
            target === 0 || target === 360
              ? "East (0°)"
              : target === 90
                ? "South (90°)"
                : target === 180
                  ? "West (180°)"
                  : "North (270°)";

          return {
            lng: snappedLl.lng,
            lat: snappedLl.lat,
            isSnapped: true,
            type: "orthogonal",
            label: `90° Orthogonal (${axisName})`,
            screenPos: { x: snappedX, y: snappedY },
          };
        }
      }

      // 3B. Check diagonal (45°, 135°, 225°, 315°) with 4.5° magnetic snap cone
      const diagAngles = [45, 135, 225, 315];
      for (const target of diagAngles) {
        const diff = Math.abs(angleDeg - target);
        if (diff <= 4.5) {
          const snappedRad = target * (Math.PI / 180);
          const snappedX = pLast.x + dist * Math.cos(snappedRad);
          const snappedY = pLast.y + dist * Math.sin(snappedRad);
          const snappedLl = map.unproject([snappedX, snappedY]);

          return {
            lng: snappedLl.lng,
            lat: snappedLl.lat,
            isSnapped: true,
            type: "diagonal",
            label: "45° Diagonal Snap",
            screenPos: { x: snappedX, y: snappedY },
          };
        }
      }
    }
  }

  return {
    lng: cursorLl[0],
    lat: cursorLl[1],
    isSnapped: false,
    type: "none",
  };
}
