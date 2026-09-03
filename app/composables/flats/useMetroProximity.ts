import type { FlatListing } from "~/types/flats";

/**
 * Metro proximity as a *client-side* filter: "within N metres of any selected
 * station, and only in this compass arc".
 *
 * The upstream flat API understands a single `metro` station plus a plain
 * `metroMaxM` radius and nothing else — there is no bearing or multi-station
 * parameter — so the directional wedge and the union over several stations are
 * evaluated here, against listings the feed already returned. buildFeedParams
 * still hands the server everything it *can* narrow (see the comment there), so
 * this only ever trims an already-narrowed set.
 *
 * Bearings are degrees clockwise from north, the convention the map's drag
 * handles and the `metroArc` query parameter both use.
 */

export interface MetroPoint { name: string; lat: number; lng: number }

export interface MetroProximity {
  stations: MetroPoint[];
  /** Undefined means "no distance limit", matching an unset metroMaxM. */
  maxM?: number;
  /** Both undefined means the full circle. */
  bearingFrom?: number;
  bearingTo?: number;
}

const EARTH_RADIUS_M = 6371008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

export function normalizeBearing(deg: number): number {
  const wrapped = deg % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

export function metresBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLat = lat2 - lat1;
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial great-circle bearing from `origin` to `target`, in [0, 360). */
export function bearingBetween(origin: { lat: number; lng: number }, target: { lat: number; lng: number }): number {
  const lat1 = toRad(origin.lat);
  const lat2 = toRad(target.lat);
  const dLng = toRad(target.lng - origin.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return normalizeBearing(toDeg(Math.atan2(y, x)));
}

/** Point at `distanceM` from `origin` along `bearing`. Used to draw the wedge. */
export function destinationPoint(
  origin: { lat: number; lng: number },
  bearing: number,
  distanceM: number,
): { lat: number; lng: number } {
  const angular = distanceM / EARTH_RADIUS_M;
  const lat1 = toRad(origin.lat);
  const lng1 = toRad(origin.lng);
  const theta = toRad(bearing);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(theta));
  const lng2 = lng1 + Math.atan2(
    Math.sin(theta) * Math.sin(angular) * Math.cos(lat1),
    Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
  );
  return { lat: toDeg(lat2), lng: normalizeBearing(toDeg(lng2) + 180) - 180 };
}

/**
 * Arc containment, wrap-safe. An arc is stored as the clockwise sweep from
 * `from` to `to`, so 340→20 is the 40° wedge straddling north rather than the
 * 320° one going the long way round.
 */
export function bearingWithinArc(bearing: number, from: number, to: number): boolean {
  const sweep = normalizeBearing(to - from);
  // A zero-width arc would silently reject everything; treat it as the full
  // circle, which is what "the handles have not been separated yet" means.
  if (sweep === 0) return true;
  return normalizeBearing(bearing - from) <= sweep;
}

/**
 * The traced wedge outline: station → arc → station. Fed to Leaflet as a polygon
 * and also usable as a plain point-in-polygon area if the shape ever needs to be
 * handed to the drawn-area filter.
 */
export function sectorPolygon(
  station: { lat: number; lng: number },
  radiusM: number,
  from?: number,
  to?: number,
  segments = 48,
): Array<{ lat: number; lng: number }> {
  const full = from == null || to == null;
  const start = full ? 0 : normalizeBearing(from);
  const sweep = full ? 360 : (normalizeBearing(to - from) || 360);
  const steps = Math.max(2, Math.round((segments * sweep) / 360));
  const arc = Array.from({ length: steps + 1 }, (_, index) =>
    destinationPoint(station, start + (sweep * index) / steps, radiusM));
  // A full circle closes on itself; a wedge closes through its apex.
  return full ? arc : [{ lat: station.lat, lng: station.lng }, ...arc];
}

/** True when the filter is inert and every listing should pass untouched. */
export function metroProximityIsEmpty(proximity: MetroProximity): boolean {
  if (!proximity.stations.length) return true;
  const hasArc = proximity.bearingFrom != null && proximity.bearingTo != null;
  return proximity.maxM == null && !hasArc;
}

function matchesStation(
  listing: { lat: number; lng: number },
  station: MetroPoint,
  proximity: MetroProximity,
): boolean {
  if (proximity.maxM != null && metresBetween(station, listing) > proximity.maxM) return false;
  if (proximity.bearingFrom == null || proximity.bearingTo == null) return true;
  return bearingWithinArc(bearingBetween(station, listing), proximity.bearingFrom, proximity.bearingTo);
}

/**
 * Keeps listings near *any* selected station — a union, not an intersection:
 * picking two stations means "either is fine", which is how a rider reads it.
 *
 * Listings without coordinates are kept rather than dropped. The upstream feed
 * has its own `metro` field and geocodes better than the browser can, so a
 * missing lat/lng is a gap in the map data, not evidence the flat is far away.
 */
export function applyMetroProximity<T extends Pick<FlatListing, "lat" | "lng">>(
  items: T[],
  proximity: MetroProximity,
): T[] {
  if (metroProximityIsEmpty(proximity)) return items;
  return items.filter((item) => {
    if (item.lat == null || item.lng == null) return true;
    const point = { lat: Number(item.lat), lng: Number(item.lng) };
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return true;
    return proximity.stations.some((station) => matchesStation(point, station, proximity));
  });
}

/** The radius a freshly picked station starts at, before any drag. */
export const DEFAULT_METRO_RADIUS_M = 500;

const COMPASS_POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export type CompassPoint = typeof COMPASS_POINTS[number];

/** The 8-point compass name for an arc, taken from its midpoint. */
export function compassPointFor(from: number, to: number): CompassPoint {
  const middle = normalizeBearing(from + normalizeBearing(to - from) / 2);
  return COMPASS_POINTS[Math.round(middle / 45) % 8]!;
}

/** The arc a compass point stands for: its 45-degree slice, centred on the point. */
export function arcForCompassPoint(point: CompassPoint): { from: number; to: number } {
  const centre = COMPASS_POINTS.indexOf(point) * 45;
  return { from: normalizeBearing(centre - 22.5), to: normalizeBearing(centre + 22.5) };
}

export const COMPASS_ORDER: readonly CompassPoint[] = COMPASS_POINTS;
