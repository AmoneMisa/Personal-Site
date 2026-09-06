import { computed, ref, watch, toValue, type MaybeRefOrGetter } from "vue";

export interface GeoBoundaryGeometry {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
}

export interface GeoEntity {
  id: string;
  parentId?: string | null;
  type: string;
  country: string;
  canonicalName: string;
  label?: string;
  center: { lat: number; lng: number };
  accuracyM?: number | null;
  boundary?: GeoBoundaryGeometry;
}

interface GeoCityCatalogResponse {
  city: GeoEntity | null;
  descendants: GeoEntity[];
  resolvedDistricts: (GeoEntity | null)[];
}

const EMPTY_RESPONSE: GeoCityCatalogResponse = { city: null, descendants: [], resolvedDistricts: [] };

// Personal Site never reads the geo packages directly. This composable consumes
// the site's BFF route, which is a thin adapter over backend-platform's geo API.
export function useGeoCityCatalog(
  country: MaybeRefOrGetter<string>,
  city: MaybeRefOrGetter<string>,
  districtNames: MaybeRefOrGetter<string[]> = [],
  locale: MaybeRefOrGetter<string> = "",
) {
  const data = ref<GeoCityCatalogResponse>(EMPTY_RESPONSE);

  async function refresh() {
    const countryValue = toValue(country);
    const cityValue = toValue(city);
    if (!countryValue || !cityValue) {
      data.value = EMPTY_RESPONSE;
      return;
    }
    try {
      data.value = await $fetch<GeoCityCatalogResponse>("/flats-geo-city", {
        params: {
          country: countryValue,
          city: cityValue,
          districts: toValue(districtNames).map((name) => encodeURIComponent(name)).join(","),
          locale: toValue(locale),
        },
      });
    } catch {
      data.value = EMPTY_RESPONSE;
    }
  }

  watch(
    [
      () => toValue(country),
      () => toValue(city),
      () => toValue(districtNames).join("|"),
      () => toValue(locale),
    ],
    refresh,
    { immediate: true },
  );

  return {
    cityEntity: computed(() => data.value.city),
    descendants: computed(() => data.value.descendants),
    resolvedDistricts: computed(() => data.value.resolvedDistricts),
  };
}
