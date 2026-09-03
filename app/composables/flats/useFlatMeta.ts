import { computed, ref, type Ref } from "vue";
import type { FlatCountryMeta } from "~/types/flats";
import type { SelectOption } from "~/types/search";
import { safeFetch } from "~/utils/safeFetch";

interface FlatMetaOptions {
  countries: Ref<string[]>;
  city: Ref<string>;
  t: (key: string) => string;
  locationLabel: (value: string, kind: "country" | "city" | "district" | "metro") => string;
  preferredCountry: () => string;
}

export function useFlatMeta(options: FlatMetaOptions) {
  const meta = ref<FlatCountryMeta[]>([]);
  const pickedCountries = computed(() => options.countries.value.length
    ? meta.value.filter((country) => options.countries.value.includes(country.code))
    : meta.value);
  const cityOptions = computed(() => [...new Set(pickedCountries.value.flatMap((country) => country.cities ?? []))].sort());
  const districtOptions = computed(() => {
    const values = new Set<string>();
    for (const country of pickedCountries.value) {
      for (const [cityName, location] of Object.entries(country.locations ?? {})) {
        if (options.city.value && cityName !== options.city.value) continue;
        for (const district of location?.districts ?? []) values.add(district);
      }
    }
    return [...values].sort();
  });
  const metroOptions = computed(() => {
    const values = new Set<string>();
    for (const country of pickedCountries.value) {
      for (const [cityName, location] of Object.entries(country.locations ?? {})) {
        if (options.city.value && cityName !== options.city.value) continue;
        for (const station of location?.metro ?? []) values.add(station);
      }
    }
    return [...values].sort();
  });
  const countryItems = computed<SelectOption[]>(() => meta.value.map((country) => ({
    value: country.code,
    label: options.locationLabel(country.code, "country"),
  })));
  const cityItems = computed<SelectOption[]>(() => [
    { label: options.t("cityAny"), value: "__any__" },
    ...cityOptions.value.map((city) => ({ label: options.locationLabel(city, "city"), value: city })),
  ]);
  const districtItems = computed<SelectOption[]>(() => [
    { label: options.t("districtAny"), value: "__any__" },
    ...districtOptions.value.map((district) => ({ label: options.locationLabel(district, "district"), value: district })),
  ]);
  // No "any" sentinel: metro is a multi-select, where an empty selection already
  // means every station, and an "Any" chip sitting among the chosen ones reads
  // as a contradiction.
  const metroItems = computed<SelectOption[]>(() =>
    metroOptions.value.map((metro) => ({ label: options.locationLabel(metro, "metro"), value: metro })));

  async function loadMeta() {
    const { data } = await safeFetch<FlatCountryMeta[]>("/flats-meta");
    if (!Array.isArray(data)) return;
    meta.value = data;
    if (options.countries.value.length) return;
    const preferred = options.preferredCountry();
    options.countries.value = [data.some((country) => country.code === preferred) ? preferred : "UA"];
  }

  return { meta, cityOptions, districtOptions, metroOptions, countryItems, cityItems, districtItems, metroItems, loadMeta };
}
