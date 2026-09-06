import { computed, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from "vue";
import type { FlatGeoZone, FlatGeoZonesResponse } from "~~/shared/contracts/flatGeo";
import { mapColor } from "~/utils/flats/mapContent";

const EMPTY_RESPONSE: FlatGeoZonesResponse = {
  districtZones: [],
  microdistrictMarkers: [],
  quartalMarkers: [],
  areaZones: [],
  metroStations: [],
  parks: [],
  shoppingMalls: [],
  universities: [],
  cityZone: null,
};

const CACHE_TTL_MS = 5 * 60_000;
const CACHE_MAX_ENTRIES = 12;
type CatalogEntry = { data: Ref<FlatGeoZonesResponse>; loadedAt: number; pending?: Promise<void> };
const cache = new Map<string, CatalogEntry>();

function emptyResponse(): FlatGeoZonesResponse {
  return {
    districtZones: [],
    microdistrictMarkers: [],
    quartalMarkers: [],
    areaZones: [],
    metroStations: [],
    parks: [],
    shoppingMalls: [],
    universities: [],
    cityZone: null,
  };
}

function validBoundary(value: unknown): FlatGeoZone["boundary"] {
  if (!value || typeof value !== "object") return null;
  const boundary = value as { type?: unknown; coordinates?: unknown };
  if (boundary.type !== "Polygon" && boundary.type !== "MultiPolygon") return null;
  const validRing = (ring: unknown): boolean => Array.isArray(ring) && ring.length >= 4
    && ring.every((point) => Array.isArray(point) && point.length >= 2
      && typeof point[0] === "number" && Number.isFinite(point[0]) && Math.abs(point[0]) <= 180
      && typeof point[1] === "number" && Number.isFinite(point[1]) && Math.abs(point[1]) <= 90)
    && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];
  const validPolygon = (polygon: unknown): boolean => Array.isArray(polygon) && polygon.length > 0 && polygon.every(validRing);
  const valid = boundary.type === "Polygon" ? validPolygon(boundary.coordinates)
    : Array.isArray(boundary.coordinates) && boundary.coordinates.length > 0 && boundary.coordinates.every(validPolygon);
  if (!valid) return null;
  return { type: boundary.type, coordinates: boundary.coordinates };
}

function normalizeZone(value: unknown): FlatGeoZone | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const name = String(raw.name || "").trim();
  const lat = raw.lat;
  const lng = raw.lng;
  if (!name || typeof lat !== "number" || typeof lng !== "number"
    || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return {
    id: String(raw.id || `${raw.type || "zone"}:${name}`),
    parentId: raw.parentId == null ? null : String(raw.parentId),
    type: String(raw.type || ""),
    name,
    label: String(raw.label || name),
    lat,
    lng,
    radiusM: typeof raw.radiusM === "number" && Number.isFinite(raw.radiusM) && raw.radiusM > 0 ? raw.radiusM : 400,
    color: mapColor(raw.color),
    boundary: validBoundary(raw.boundary),
  };
}

function normalizeGroup(value: unknown): FlatGeoZone[] {
  return Array.isArray(value)
    ? value.map(normalizeZone).filter((zone): zone is FlatGeoZone => Boolean(zone))
    : [];
}

function normalizeResponse(value: unknown): FlatGeoZonesResponse {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    districtZones: normalizeGroup(raw.districtZones),
    microdistrictMarkers: normalizeGroup(raw.microdistrictMarkers),
    quartalMarkers: normalizeGroup(raw.quartalMarkers),
    areaZones: normalizeGroup(raw.areaZones),
    metroStations: normalizeGroup(raw.metroStations),
    parks: normalizeGroup(raw.parks),
    shoppingMalls: normalizeGroup(raw.shoppingMalls),
    universities: normalizeGroup(raw.universities),
    cityZone: normalizeZone(raw.cityZone),
  };
}

function cacheKey(country: string, city: string, locale: string): string {
  return `${country}\u0000${city}\u0000${locale}`;
}

function getEntry(key: string) {
  const existing = cache.get(key);
  if (existing) {
    cache.delete(key);
    cache.set(key, existing);
    return existing;
  }
  const entry: CatalogEntry = { data: ref<FlatGeoZonesResponse>(emptyResponse()), loadedAt: 0 };
  cache.set(key, entry);
  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  return entry;
}

function load(key: string, country: string, city: string, locale: string): void {
  const entry = getEntry(key);
  if (entry.pending || (entry.loadedAt > 0 && Date.now() - entry.loadedAt < CACHE_TTL_MS)) return;
  // Unit consumers can use the filter state without a Nuxt runtime. In that
  // context the backend fetch auto-import is absent, so leave the DTO empty
  // instead of creating an unhandled asynchronous rejection.
  if (typeof $fetch !== "function") return;

  entry.pending = $fetch<FlatGeoZonesResponse>("/flats-geo-city", {
    params: { country, city, ...(locale ? { locale } : {}) },
    timeout: 15_000,
  })
    .then((value) => {
      entry.data.value = normalizeResponse(value);
      entry.loadedAt = Date.now();
    })
    .catch(() => {
      entry.data.value = EMPTY_RESPONSE;
    })
    .finally(() => {
      entry.pending = undefined;
    });
}

export function useGeoCityCatalog(
  country: MaybeRefOrGetter<string>,
  city: MaybeRefOrGetter<string>,
  locale: MaybeRefOrGetter<string> = "",
) {
  const countryValue = computed(() => String(toValue(country) || "").trim().toUpperCase());
  const cityValue = computed(() => String(toValue(city) || "").trim());
  const localeValue = computed(() => String(toValue(locale) || "").trim());
  const key = computed(() => cacheKey(countryValue.value, cityValue.value, localeValue.value));

  watch(
    [countryValue, cityValue, localeValue],
    () => {
      if (!countryValue.value || !cityValue.value) return;
      load(key.value, countryValue.value, cityValue.value, localeValue.value);
    },
    { immediate: true },
  );

  const data = computed(() => getEntry(key.value).data.value);
  const allZones = computed(() => [
    ...data.value.districtZones,
    ...data.value.microdistrictMarkers,
    ...data.value.quartalMarkers,
    ...data.value.areaZones,
    ...data.value.metroStations,
    ...data.value.parks,
    ...data.value.shoppingMalls,
    ...data.value.universities,
  ]);

  return {
    data,
    allZones,
    districtZones: computed(() => data.value.districtZones),
    microdistrictMarkers: computed(() => data.value.microdistrictMarkers),
    quartalMarkers: computed(() => data.value.quartalMarkers),
    areaZones: computed(() => data.value.areaZones),
    metroStations: computed(() => data.value.metroStations),
    universityZones: computed(() => data.value.universities),
    shoppingMallZones: computed(() => data.value.shoppingMalls),
    parkZones: computed(() => data.value.parks),
    cityZone: computed(() => data.value.cityZone),
  };
}
