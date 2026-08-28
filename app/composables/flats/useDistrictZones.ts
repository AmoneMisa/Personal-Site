import { computed, type MaybeRefOrGetter } from "vue";
import { toValue } from "vue";
import { findGeoEntities, resolveLexiconGeoEntity, type GeoBoundaryGeometry, type GeoEntity } from "@whiteslove/geo-catalog";
import { locationLabel } from "~/utils/locationLabels";

export interface FlatMapZone {
  id: string;
  name: string;
  label: string;
  lat: number;
  lng: number;
  radiusM: number;
  color: string;
  boundary?: GeoBoundaryGeometry;
}

const ZONE_PALETTE = ["#e0679a", "#24a7d6", "#10b981", "#d99a0b", "#8b5cf6"];
const EARTH_RADIUS_M = 6371000;

function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

// The catalog only gives us a center point + an "accuracyM" uncertainty radius (up to
// several km for districts), not a real boundary polygon. Drawing accuracyM directly
// produces circles that overlap into one giant blob at city zoom. Instead we shrink each
// circle to roughly half the distance to its nearest sibling, so same-layer zones read as
// distinct, non-overlapping regions like the reference map, capped to a sane min/max.
function fitNonOverlappingRadii(zones: FlatMapZone[], min: number, max: number): FlatMapZone[] {
  return zones.map((zone, index) => {
    let nearest = Infinity;
    for (let other = 0; other < zones.length; other += 1) {
      if (other === index) continue;
      const d = distanceM(zone, zones[other]!);
      if (d < nearest) nearest = d;
    }
    const neighborCap = Number.isFinite(nearest) ? (nearest / 2) * 0.9 : max;
    const radiusM = Math.max(min, Math.min(zone.radiusM, neighborCap, max));
    return { ...zone, radiusM };
  });
}

// locationLabel's "any" kind runs generic landmark/city lookups meant for free-text
// fields, not microdistrict/mahalla/local_area names — it has mis-translated names
// like "Tashkent City" into "город Ташкент" (treating it as a plain city reference).
// Only "district" has a real translation table in the shared lexicon; everything
// else is safer shown as its raw canonical name than silently mistranslated.
function zoneFromEntity(entity: GeoEntity, index: number, locale: string, kind: "district" | "any"): FlatMapZone {
  return {
    id: entity.id,
    name: entity.canonicalName,
    label: kind === "district" ? locationLabel(entity.canonicalName, locale, kind) : entity.canonicalName,
    lat: entity.center.lat,
    lng: entity.center.lng,
    radiusM: entity.accuracyM || 400,
    color: ZONE_PALETTE[index % ZONE_PALETTE.length]!,
    boundary: entity.boundary,
  };
}

function descendantsOf(cityId: string | null, country: string, type: GeoEntity["type"]): GeoEntity[] {
  if (!cityId) return [];
  const prefix = `${cityId}:`;
  return findGeoEntities({ country, type }).filter((entity) => entity.id.startsWith(prefix));
}

export interface UseDistrictZonesOptions {
  countries: MaybeRefOrGetter<string[]>;
  city: MaybeRefOrGetter<string>;
  districtOptions: MaybeRefOrGetter<string[]>;
  locale: MaybeRefOrGetter<string>;
}

export function useDistrictZones(options: UseDistrictZonesOptions) {
  const country = computed(() => toValue(options.countries)[0] || "");
  const cityName = computed(() => toValue(options.city));
  const locale = computed(() => toValue(options.locale));

  const cityEntity = computed(() => {
    if (!country.value || !cityName.value) return null;
    return resolveLexiconGeoEntity({ country: country.value, type: "city", canonical: cityName.value });
  });

  const districtZones = computed<FlatMapZone[]>(() => {
    if (!country.value || !cityName.value) return [];
    const zones = toValue(options.districtOptions)
      .map((name) => resolveLexiconGeoEntity({ country: country.value, city: cityName.value, type: "district", canonical: name }))
      .filter((entity): entity is GeoEntity => Boolean(entity))
      .map((entity, index) => zoneFromEntity(entity, index, locale.value, "district"));
    return fitNonOverlappingRadii(zones, 350, 1800);
  });

  const microdistrictMarkers = computed<FlatMapZone[]>(() => descendantsOf(cityEntity.value?.id ?? null, country.value, "microdistrict")
    .map((entity, index) => zoneFromEntity(entity, index, locale.value, "any")));

  const quartalMarkers = computed<FlatMapZone[]>(() => descendantsOf(cityEntity.value?.id ?? null, country.value, "mahalla")
    .map((entity, index) => zoneFromEntity(entity, index, locale.value, "any")));

  const areaZones = computed<FlatMapZone[]>(() => {
    const entities = [
      ...descendantsOf(cityEntity.value?.id ?? null, country.value, "local_area"),
      ...descendantsOf(cityEntity.value?.id ?? null, country.value, "development_area"),
    ];
    const zones = entities.map((entity, index) => zoneFromEntity(entity, index, locale.value, "any"));
    return fitNonOverlappingRadii(zones, 150, 700);
  });

  return { districtZones, microdistrictMarkers, quartalMarkers, areaZones };
}
