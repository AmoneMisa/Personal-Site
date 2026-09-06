import type { FlatGeoZone } from "~~/shared/contracts/flatGeo";

// Membership is supplied by the backend, never inferred from a nearby centroid.
export function districtForZone(zone: FlatGeoZone, zones: ReadonlyMap<string, FlatGeoZone>): string | null {
  const visited = new Set<string>();
  let current: FlatGeoZone | undefined = zone;
  while (current && !visited.has(current.id)) {
    if (current.type === "district") return current.name;
    visited.add(current.id);
    current = current.parentId ? zones.get(current.parentId) : undefined;
  }
  return null;
}
