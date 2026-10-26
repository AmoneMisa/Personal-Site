export interface SearchRadiusCenter { lat: number; lng: number }

export const DEFAULT_SEARCH_RADIUS_M = 5000;
export const MIN_SEARCH_RADIUS_M = 500;
export const MAX_SEARCH_RADIUS_M = 30000;

function coordinate(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeSearchCenter(value: { lat?: unknown; lng?: unknown } | null | undefined): SearchRadiusCenter | null {
  const lat = coordinate(value?.lat);
  const lng = coordinate(value?.lng);
  return lat != null && lng != null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 ? { lat, lng } : null;
}

export function normalizeSearchRadius(value: unknown): number {
  const radius = coordinate(value);
  return radius != null && radius > 0
    ? Math.max(MIN_SEARCH_RADIUS_M, Math.min(MAX_SEARCH_RADIUS_M, Math.round(radius)))
    : DEFAULT_SEARCH_RADIUS_M;
}
