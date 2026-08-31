import { computed, type MaybeRefOrGetter } from "vue";
import { toValue } from "vue";
import {
  convexHullPositions,
  distanceKm,
  getGeoDescendants,
  resolveLexiconGeoEntity,
  type GeoBoundaryGeometry,
  type GeoEntity,
} from "@whiteslove/geo-catalog";
import { zoneNameLabel } from "~/utils/locationLabels";

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

// Radius fitting is presentation behavior: avoid overlapping fallback circles
// when the catalog has no authoritative polygon for a particular entity.
function fitNonOverlappingRadii(zones: FlatMapZone[], min: number, max: number): FlatMapZone[] {
  return zones.map((zone, index) => {
    if (zone.boundary) return zone;
    let nearest = Infinity;
    for (let other = 0; other < zones.length; other += 1) {
      if (other === index) continue;
      const d = distanceKm(zone, zones[other]!) * 1000;
      if (d < nearest) nearest = d;
    }
    const neighborCap = Number.isFinite(nearest) ? (nearest / 2) * 0.9 : max;
    const radiusM = Math.max(min, Math.min(zone.radiusM, neighborCap, max));
    return { ...zone, radiusM };
  });
}

function zoneFromEntity(entity: GeoEntity, index: number, locale: string, cityName: string): FlatMapZone {
  return {
    id: entity.id,
    name: entity.canonicalName,
    label: zoneNameLabel(entity.canonicalName, locale, entity.country, cityName),
    lat: entity.center.lat,
    lng: entity.center.lng,
    radiusM: entity.accuracyM || 400,
    color: ZONE_PALETTE[index % ZONE_PALETTE.length]!,
    boundary: entity.boundary,
  };
}

// This is a presentation approximation only. The reusable convex-hull geometry
// itself is owned by geo-catalog; the site merely decides when to render it.
function cityHullZone(districtZones: FlatMapZone[], entity: GeoEntity | null, locale: string): FlatMapZone | null {
  if (!entity) return null;
  const points: [number, number][] = [];
  for (const zone of districtZones) {
    if (!zone.boundary) continue;
    const polygons = zone.boundary.type === "MultiPolygon" ? zone.boundary.coordinates : [zone.boundary.coordinates];
    for (const polygon of polygons) {
      const outer = polygon[0];
      if (outer) {
        for (const [lng, lat] of outer) points.push([lng!, lat!]);
      }
    }
  }
  if (points.length < 3) return null;
  const hull = convexHullPositions(points);
  if (hull.length < 3) return null;
  return {
    id: entity.id,
    name: entity.canonicalName,
    label: zoneNameLabel(entity.canonicalName, locale, entity.country, entity.canonicalName),
    lat: entity.center.lat,
    lng: entity.center.lng,
    radiusM: 0,
    color: "#f4f4f5",
    boundary: { type: "Polygon", coordinates: [[...hull, hull[0]!]] },
  };
}

function descendantsOf(cityId: string | null, country: string, type: GeoEntity["type"]): GeoEntity[] {
  if (!cityId) return [];
  return [...getGeoDescendants(cityId, { country, type })];
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

    const canonical = descendantsOf(cityEntity.value?.id ?? null, country.value, "district");
    const entities = canonical.length
      ? canonical
      : toValue(options.districtOptions)
          .map((name) => resolveLexiconGeoEntity({ country: country.value, city: cityName.value, type: "district", canonical: name }))
          .filter((entity): entity is GeoEntity => Boolean(entity));
    const zones = entities.map((entity, index) => zoneFromEntity(entity, index, locale.value, cityName.value));
    return fitNonOverlappingRadii(zones, 350, 1800);
  });

  const microdistrictMarkers = computed<FlatMapZone[]>(() => descendantsOf(cityEntity.value?.id ?? null, country.value, "microdistrict")
    .map((entity, index) => zoneFromEntity(entity, index, locale.value, cityName.value)));

  const quartalMarkers = computed<FlatMapZone[]>(() => descendantsOf(cityEntity.value?.id ?? null, country.value, "mahalla")
    .map((entity, index) => zoneFromEntity(entity, index, locale.value, cityName.value)));

  const metroStations = computed<FlatMapZone[]>(() => descendantsOf(cityEntity.value?.id ?? null, country.value, "metro")
    .map((entity, index) => zoneFromEntity(entity, index, locale.value, cityName.value)));

  const universityZones = computed<FlatMapZone[]>(() => descendantsOf(cityEntity.value?.id ?? null, country.value, "poi.university")
    .map((entity, index) => ({ ...zoneFromEntity(entity, index, locale.value, cityName.value), color: "#38bdf8" })));

  const shoppingMallZones = computed<FlatMapZone[]>(() => descendantsOf(cityEntity.value?.id ?? null, country.value, "poi.shopping_mall")
    .map((entity, index) => ({ ...zoneFromEntity(entity, index, locale.value, cityName.value), color: "#f97316" })));

  const parkZones = computed<FlatMapZone[]>(() => descendantsOf(cityEntity.value?.id ?? null, country.value, "poi.park")
    .map((entity, index) => ({ ...zoneFromEntity(entity, index, locale.value, cityName.value), color: "#22c55e" })));

  const areaZones = computed<FlatMapZone[]>(() => {
    const entities = [
      ...descendantsOf(cityEntity.value?.id ?? null, country.value, "local_area"),
      ...descendantsOf(cityEntity.value?.id ?? null, country.value, "development_area"),
    ];
    const zones = entities.map((entity, index) => zoneFromEntity(entity, index, locale.value, cityName.value));
    return fitNonOverlappingRadii(zones, 150, 700);
  });

  const cityZone = computed<FlatMapZone | null>(() => cityHullZone(districtZones.value, cityEntity.value, locale.value));

  return {
    districtZones, microdistrictMarkers, quartalMarkers, metroStations,
    universityZones, shoppingMallZones, parkZones, areaZones, cityZone,
  };
}
