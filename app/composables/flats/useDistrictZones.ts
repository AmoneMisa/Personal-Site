import { computed, type MaybeRefOrGetter } from "vue";
import { toValue } from "vue";
import { useGeoCityCatalog, type GeoBoundaryGeometry, type GeoEntity } from "./useGeoCityCatalog";

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
const EARTH_RADIUS_KM = 6371;

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

// Radius fitting is presentation-only. Canonical centers/boundaries come from
// the backend and are never inferred or canonicalized in the browser.
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

function zoneFromEntity(entity: GeoEntity, index: number): FlatMapZone {
  return {
    id: entity.id,
    name: entity.canonicalName,
    label: entity.label || entity.canonicalName,
    lat: entity.center.lat,
    lng: entity.center.lng,
    radiusM: entity.accuracyM || 400,
    color: ZONE_PALETTE[index % ZONE_PALETTE.length]!,
    boundary: entity.boundary,
  };
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

  const { cityEntity, descendants, resolvedDistricts } = useGeoCityCatalog(
    country,
    cityName,
    options.districtOptions,
    locale,
  );

  function descendantsOf(type: string): GeoEntity[] {
    return descendants.value.filter((entity) => entity.type === type);
  }

  const districtZones = computed<FlatMapZone[]>(() => {
    if (!country.value || !cityName.value) return [];
    const canonical = descendantsOf("district");
    const entities = canonical.length
      ? canonical
      : resolvedDistricts.value.filter((entity): entity is GeoEntity => Boolean(entity));
    return fitNonOverlappingRadii(entities.map(zoneFromEntity), 350, 1800);
  });

  const microdistrictMarkers = computed<FlatMapZone[]>(() => descendantsOf("microdistrict").map(zoneFromEntity));
  const quartalMarkers = computed<FlatMapZone[]>(() => descendantsOf("mahalla").map(zoneFromEntity));
  const metroStations = computed<FlatMapZone[]>(() => descendantsOf("metro").map(zoneFromEntity));
  const universityZones = computed<FlatMapZone[]>(() => descendantsOf("poi.university")
    .map((entity, index) => ({ ...zoneFromEntity(entity, index), color: "#38bdf8" })));
  const shoppingMallZones = computed<FlatMapZone[]>(() => descendantsOf("poi.shopping_mall")
    .map((entity, index) => ({ ...zoneFromEntity(entity, index), color: "#f97316" })));
  const parkZones = computed<FlatMapZone[]>(() => descendantsOf("poi.park")
    .map((entity, index) => ({ ...zoneFromEntity(entity, index), color: "#22c55e" })));
  const areaZones = computed<FlatMapZone[]>(() => fitNonOverlappingRadii([
    ...descendantsOf("local_area"),
    ...descendantsOf("development_area"),
  ].map(zoneFromEntity), 150, 700));

  const cityZone = computed<FlatMapZone | null>(() => cityEntity.value
    ? { ...zoneFromEntity(cityEntity.value, 0), color: "#f4f4f5" }
    : null);

  function districtForPoint(point: { lat: number; lng: number }): string | null {
    let nearest: FlatMapZone | null = null;
    let nearestDistance = Infinity;
    for (const zone of districtZones.value) {
      const distance = distanceKm(point, zone);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = zone;
      }
    }
    return nearest?.name ?? null;
  }

  return {
    districtZones, microdistrictMarkers, quartalMarkers, metroStations,
    universityZones, shoppingMallZones, parkZones, areaZones, cityZone,
    districtForPoint,
  };
}
