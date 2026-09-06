import { computed, type MaybeRefOrGetter } from "vue";
import { toValue } from "vue";
import type { FlatGeoZone } from "~~/shared/contracts/flatGeo";
import { useGeoCityCatalog } from "./useGeoCityCatalog";

export type FlatMapZone = FlatGeoZone;

export interface UseDistrictZonesOptions {
  countries: MaybeRefOrGetter<string[]>;
  city: MaybeRefOrGetter<string>;
  locale: MaybeRefOrGetter<string>;
}

export function useDistrictZones(options: UseDistrictZonesOptions) {
  const country = computed(() => toValue(options.countries)[0] || "");
  const city = computed(() => toValue(options.city));
  const { districtZones, microdistrictMarkers, quartalMarkers, metroStations,
    universityZones, shoppingMallZones, parkZones, areaZones, cityZone, allZones } = useGeoCityCatalog(
    country,
    city,
    options.locale,
  );

  return {
    districtZones, microdistrictMarkers, quartalMarkers, metroStations,
    universityZones, shoppingMallZones, parkZones, areaZones, cityZone,
    allZones,
  };
}
