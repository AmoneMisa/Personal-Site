import { computed, ref, watch, toValue, type MaybeRefOrGetter } from "vue";
import type { GeoEntity } from "@whiteslove/geo-catalog";

interface GeoCityCatalogResponse {
  city: GeoEntity | null;
  descendants: GeoEntity[];
  resolvedDistricts: (GeoEntity | null)[];
}

const EMPTY_RESPONSE: GeoCityCatalogResponse = { city: null, descendants: [], resolvedDistricts: [] };

// geo-catalog's encrypted data can only be decrypted server-side (see
// server/routes/flats-geo-city.get.ts), so this composable fetches already-resolved
// entities instead of importing @whiteslove/geo-catalog's catalog functions directly
// — that import would drag the Node-only decryption path into the client bundle.
// The map itself only renders client-side, so a plain $fetch (rather than useFetch's
// SSR payload machinery) costs nothing here.
export function useGeoCityCatalog(
  country: MaybeRefOrGetter<string>,
  city: MaybeRefOrGetter<string>,
  districtNames: MaybeRefOrGetter<string[]> = [],
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
        },
      });
    } catch {
      data.value = EMPTY_RESPONSE;
    }
  }

  watch(
    [() => toValue(country), () => toValue(city), () => toValue(districtNames).join("|")],
    refresh,
    { immediate: true },
  );

  return {
    cityEntity: computed(() => data.value.city),
    descendants: computed(() => data.value.descendants),
    resolvedDistricts: computed(() => data.value.resolvedDistricts),
  };
}
