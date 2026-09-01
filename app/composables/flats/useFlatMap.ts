import { computed, ref, watch, type MaybeRefOrGetter } from "vue";
import { toValue } from "vue";
import type { FlatListing } from "~/types/flats";

export interface FlatMapAreaPoint { lat: number; lng: number }

export function pointInFlatPolygon(point: FlatMapAreaPoint, polygon: FlatMapAreaPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i]!.lng;
    const yi = polygon[i]!.lat;
    const xj = polygon[j]!.lng;
    const yj = polygon[j]!.lat;
    const intersects = ((yi > point.lat) !== (yj > point.lat))
      && point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function singleListingLocationScope(items: FlatListing[]): string {
  const scopes = new Set(
    items
      .filter((item) => item.country && item.city)
      .map((item) => `${item.country}:${item.city}`),
  );
  return scopes.size === 1 ? [...scopes][0]! : "";
}

export function useFlatMap(listings: MaybeRefOrGetter<FlatListing[]>) {
  const drawnArea = ref<FlatMapAreaPoint[]>([]);
  const lastLocationScope = ref("");

  // The polygon is a client-side location filter and is not part of useFlatFilters.
  // Keep the last non-empty feed scope so a transient `[]` while reloading does not
  // hide a real city transition. As soon as the replacement feed belongs to another
  // city/country, discard the old polygon before it can filter the new listings.
  watch(
    () => singleListingLocationScope(toValue(listings)),
    (scope) => {
      if (!scope) return;
      if (lastLocationScope.value && scope !== lastLocationScope.value) drawnArea.value = [];
      lastLocationScope.value = scope;
    },
    { flush: "sync" },
  );

  function applyDrawnArea(items: FlatListing[]): FlatListing[] {
    if (drawnArea.value.length < 3) return items;
    if (!items.some((item) => item.lat != null && item.lng != null)) return items;
    return items.filter((item) => item.lat != null && item.lng != null
      && pointInFlatPolygon({ lat: item.lat, lng: item.lng }, drawnArea.value));
  }

  const listingsInArea = computed(() => applyDrawnArea(toValue(listings)));
  return { drawnArea, applyDrawnArea, listingsInArea };
}
