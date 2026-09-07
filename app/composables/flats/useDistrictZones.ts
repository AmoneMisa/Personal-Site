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
  const {
    districtZones, regionZones, microdistrictMarkers, mahallaMarkers, quarterMarkers, quartalMarkers, metroStations,
    universityZones, shoppingMallZones, parkZones, schoolZones,
    residentialComplexZones, airportZones, railwayStationZones, busStationZones,
    transportStopZones, parkingZones, areaZones, zoneMarkers, cityZone, allZones,
  } = useGeoCityCatalog(
    country,
    city,
    options.locale,
  );

  return {
    districtZones, regionZones, microdistrictMarkers, mahallaMarkers, quarterMarkers, quartalMarkers, metroStations,
    universityZones, shoppingMallZones, parkZones, schoolZones,
    residentialComplexZones, airportZones, railwayStationZones, busStationZones,
    transportStopZones, parkingZones, areaZones, zoneMarkers, cityZone,
    allZones,
  };
}
