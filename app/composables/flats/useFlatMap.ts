import { computed, ref, type MaybeRefOrGetter } from "vue";
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

export function useFlatMap(listings: MaybeRefOrGetter<FlatListing[]>) {
  const drawnArea = ref<FlatMapAreaPoint[]>([]);

  function applyDrawnArea(items: FlatListing[]): FlatListing[] {
    if (drawnArea.value.length < 3) return items;
    if (!items.some((item) => item.lat != null && item.lng != null)) return items;
    return items.filter((item) => item.lat != null && item.lng != null
      && pointInFlatPolygon({ lat: item.lat, lng: item.lng }, drawnArea.value));
  }

  const listingsInArea = computed(() => applyDrawnArea(toValue(listings)));
  return { drawnArea, applyDrawnArea, listingsInArea };
}
