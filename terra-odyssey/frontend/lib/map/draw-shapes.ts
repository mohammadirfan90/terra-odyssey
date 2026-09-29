/**
 * Pure-math helpers for the map drawing & measure tools.
 * No React or maplibre dependencies — safe to import from anywhere.
 */

const EARTH_RADIUS_KM = 6371.0088;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/**
 * Convert decimal degrees to radians.
 */
export function toRadians(deg: number): number {
  return deg * DEG_TO_RAD;
}

/**
 * Convert radians to decimal degrees.
 */
export function toDegrees(rad: number): number {
  return rad * RAD_TO_DEG;
}

/**
 * Great-circle (haversine) distance between two lon/lat points in kilometres.
 */
export function haversineKm(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
): number {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const dPhi = toRadians(lat2 - lat1);
  const dLambda = toRadians(lon2 - lon1);

  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Vincenty inverse formula — accurate distance between two lon/lat points
 * on the WGS-84 ellipsoid, in metres. Returns a positive distance.
 */
export function vincentyMetres(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
): number {
  const a = 6378137.0; // WGS-84 semi-major axis (m)
  const b = 6356752.314245; // semi-minor axis
  const f = 1 / 298.257223563;
  const L = toRadians(lon2 - lon1);
  const U1 = Math.atan((1 - f) * Math.tan(toRadians(lat1)));
  const U2 = Math.atan((1 - f) * Math.tan(toRadians(lat2)));
  const sinU1 = Math.sin(U1);
  const cosU1 = Math.cos(U1);
  const sinU2 = Math.sin(U2);
  const cosU2 = Math.cos(U2);

  let lambda = L;
  let lambdaP = 0;
  let iterLimit = 100;
  let sinLambda = 0;
  let cosLambda = 0;
  let sinSigma = 0;
  let cosSigma = 0;
  let sigma = 0;
  let sinAlpha = 0;
  let cosSqAlpha = 0;
  let cos2SigmaM = 0;
  let C = 0;

  do {
    sinLambda = Math.sin(lambda);
    cosLambda = Math.cos(lambda);
    sinSigma = Math.sqrt(
      (cosU2 * sinLambda) ** 2 +
        (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) ** 2,
    );
    if (sinSigma === 0) return 0; // coincident points
    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
    sigma = Math.atan2(sinSigma, cosSigma);
    sinAlpha = (cosU1 * cosU2 * sinLambda) / sinSigma;
    cosSqAlpha = 1 - sinAlpha ** 2;
    if (cosSqAlpha === 0) {
      cos2SigmaM = 0; // equatorial line
    } else {
      cos2SigmaM = cosSigma - (2 * sinU1 * sinU2) / cosSqAlpha;
    }
    C = (f / 16) * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
    lambdaP = lambda;
    lambda =
      L +
      (1 - C) *
        f *
        sinAlpha *
        (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM ** 2)));
  } while (Math.abs(lambda - lambdaP) > 1e-12 && --iterLimit > 0);

  if (iterLimit === 0) return NaN;

  const uSq = cosSqAlpha * ((a ** 2 - b ** 2) / b ** 2);
  const A = 1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const B = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  const deltaSigma =
    B *
    sinSigma *
    (cos2SigmaM +
      (B / 4) *
        (cosSigma * (-1 + 2 * cos2SigmaM ** 2) -
          (A / 6) *
            cos2SigmaM *
            (-3 + 4 * sinSigma ** 2) *
            (-3 + 4 * cos2SigmaM ** 2)));
  return b * A * (sigma - deltaSigma);
}

/**
 * Spherical-excess area of a polygon expressed as a closed ring of
 * [lon, lat] vertices (in degrees). Returns square metres.
 *
 * Handles antimeridian-wrapped rings by splitting at |dλ| > 180°.
 * Returns 0 for invalid input.
 */
export function polygonAreaSqM(ring: ReadonlyArray<[number, number]>): number {
  if (ring.length < 3) return 0;
  const R = EARTH_RADIUS_KM * 1000;
  let total = 0;

  for (let i = 0; i < ring.length; i++) {
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[(i + 1) % ring.length];
    let dLon = lon2 - lon1;
    if (dLon > 180) dLon -= 360;
    if (dLon < -180) dLon += 360;
    total += toRadians(dLon) * (2 + Math.sin(toRadians(lat1)) + Math.sin(toRadians(lat2)));
  }
  return Math.abs((total * R * R) / 2);
}

/**
 * Perimeter (sum of segment distances) of a closed ring in metres.
 */
export function polygonPerimeterM(ring: ReadonlyArray<[number, number]>): number {
  if (ring.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < ring.length; i++) {
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[(i + 1) % ring.length];
    total += vincentyMetres(lon1, lat1, lon2, lat2);
  }
  return total;
}

/**
 * Distance from one point to another in metres.
 */
export function distanceM(
  a: [number, number],
  b: [number, number],
): number {
  return vincentyMetres(a[0], a[1], b[0], b[1]);
}

/**
 * Area of an axis-aligned rectangle defined by two diagonal corners
 * (in metres²), using Vincenty distance for both sides.
 */
export function rectangleAreaSqM(
  a: [number, number],
  c: [number, number],
): number {
  const [lonA, latA] = a;
  const [lonC, latC] = c;
  const b: [number, number] = [lonC, latA];
  const d: [number, number] = [lonA, latC];
  const width = vincentyMetres(lonA, latA, lonC, latA);
  const height = vincentyMetres(lonA, latA, lonA, latC);
  return width * height;
}

/**
 * Convert a rectangle's two diagonal corners into a 4-vertex polygon ring.
 */
export function rectangleRing(
  a: [number, number],
  c: [number, number],
): [number, number][] {
  const [lonA, latA] = a;
  const [lonC, latC] = c;
  return [
    [lonA, latA],
    [lonC, latA],
    [lonC, latC],
    [lonA, latC],
    [lonA, latA],
  ];
}

/**
 * Area of a circle given its centre + a point on the perimeter (km²).
 */
export function circleAreaSqKm(
  center: [number, number],
  edge: [number, number],
): number {
  const radiusKm = haversineKm(center[0], center[1], edge[0], edge[1]);
  return Math.PI * radiusKm ** 2;
}

/**
 * Approximate circle as a closed 64-vertex polygon ring for visualization.
 */
export function circleRing(
  center: [number, number],
  radiusKm: number,
  segments = 64,
): [number, number][] {
  const [lon, lat] = center;
  const ring: [number, number][] = [];
  const latRad = toRadians(lat);
  const kmPerDegLat = 111.32;
  const kmPerDegLon = 111.32 * Math.cos(latRad);

  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * 2 * Math.PI;
    const dx = (radiusKm * Math.sin(theta)) / kmPerDegLon;
    const dy = (radiusKm * Math.cos(theta)) / kmPerDegLat;
    ring.push([lon + dx, lat + dy]);
  }
  return ring;
}

/**
 * Tight axis-aligned bbox that contains every point in `ring`.
 * Returns `[minLon, minLat, maxLon, maxLat]`.
 */
export function bboxOfRing(
  ring: ReadonlyArray<[number, number]>,
): [number, number, number, number] {
  if (ring.length === 0) return [0, 0, 0, 0];
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of ring) {
    if (lon < minLon) minLon = lon;
    if (lat < minLat) minLat = lat;
    if (lon > maxLon) maxLon = lon;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLon, minLat, maxLon, maxLat];
}

/**
 * Compute the bbox of a circle (centre + edge point).
 */
export function circleBBox(
  center: [number, number],
  edge: [number, number],
): [number, number, number, number] {
  const radiusKm = haversineKm(center[0], center[1], edge[0], edge[1]);
  const latRad = toRadians(center[1]);
  const dLat = toDegrees(radiusKm / 111.32);
  const dLon = toDegrees(radiusKm / (111.32 * Math.cos(latRad) || 1));
  return [
    center[0] - dLon,
    center[1] - dLat,
    center[0] + dLon,
    center[1] + dLat,
  ];
}

export type DrawShape =
  | { kind: "rectangle"; a: [number, number]; c: [number, number] }
  | { kind: "polygon"; ring: [number, number][] }
  | { kind: "circle"; center: [number, number]; edge: [number, number] }
  | { kind: "line"; points: [number, number][] };

/**
 * Get the bbox that fully contains the given shape.
 */
export function shapeBBox(shape: DrawShape): [number, number, number, number] {
  switch (shape.kind) {
    case "rectangle":
      return bboxOfRing(rectangleRing(shape.a, shape.c));
    case "polygon":
      return bboxOfRing(shape.ring);
    case "circle":
      return circleBBox(shape.center, shape.edge);
    case "line":
      return bboxOfRing(shape.points);
  }
}

/**
 * Convert any shape into a closed polygon ring (used for area calc &
 * maplibre fill rendering).
 */
export function shapeToRing(shape: DrawShape): [number, number][] {
  switch (shape.kind) {
    case "rectangle":
      return rectangleRing(shape.a, shape.c);
    case "polygon":
      return shape.ring.length > 0 &&
        shape.ring[0][0] === shape.ring[shape.ring.length - 1][0] &&
        shape.ring[0][1] === shape.ring[shape.ring.length - 1][1]
        ? shape.ring
        : [...shape.ring, shape.ring[0]];
    case "circle": {
      const radiusKm = haversineKm(
        shape.center[0],
        shape.center[1],
        shape.edge[0],
        shape.edge[1],
      );
      return circleRing(shape.center, radiusKm);
    }
    case "line":
      return shape.points;
  }
}

/**
 * Compute the measure values for a shape.
 */
export interface MeasureResult {
  /** Length in metres (only for line / polygon). */
  lengthM?: number;
  /** Area in metres² (only for rectangle / polygon / circle). */
  areaSqM?: number;
  /** Width in metres (rectangles only). */
  widthM?: number;
  /** Height in metres (rectangles only). */
  heightM?: number;
  /** Radius in metres (circles only). */
  radiusM?: number;
}

export function measureShape(shape: DrawShape): MeasureResult {
  switch (shape.kind) {
    case "rectangle": {
      const widthM = vincentyMetres(
        shape.a[0],
        shape.a[1],
        shape.c[0],
        shape.a[1],
      );
      const heightM = vincentyMetres(
        shape.a[0],
        shape.a[1],
        shape.a[0],
        shape.c[1],
      );
      return {
        widthM,
        heightM,
        areaSqM: widthM * heightM,
      };
    }
    case "polygon": {
      const ring = shape.ring;
      if (ring.length < 3) {
        return { lengthM: polygonPerimeterM(ring) };
      }
      return {
        lengthM: polygonPerimeterM(ring),
        areaSqM: polygonAreaSqM(ring),
      };
    }
    case "circle": {
      const radiusM = vincentyMetres(
        shape.center[0],
        shape.center[1],
        shape.edge[0],
        shape.edge[1],
      );
      return {
        radiusM,
        areaSqM: Math.PI * radiusM ** 2,
      };
    }
    case "line":
      return {
        lengthM: polygonPerimeterM(shape.points),
      };
  }
}

/**
 * Format a distance in metres as a human-readable string (m or km).
 */
export function formatDistance(metres: number): string {
  if (!Number.isFinite(metres)) return "—";
  if (metres < 1000) return `${metres.toFixed(1)} m`;
  return `${(metres / 1000).toFixed(2)} km`;
}

/**
 * Format an area in metres² as a human-readable string.
 */
export function formatArea(sqM: number): string {
  if (!Number.isFinite(sqM)) return "—";
  if (sqM < 10_000) return `${sqM.toFixed(1)} m²`;
  if (sqM < 1_000_000) return `${(sqM / 10_000).toFixed(2)} ha`;
  return `${(sqM / 1_000_000).toFixed(2)} km²`;
}
