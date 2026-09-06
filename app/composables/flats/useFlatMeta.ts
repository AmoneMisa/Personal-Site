import { computed, ref, toValue, watch, onScopeDispose, type MaybeRefOrGetter, type Ref } from "vue";
import type { FlatCountryMeta } from "~/types/flats";
import type { SelectOption } from "~/types/search";
import { safeFetch } from "~/utils/safeFetch";
import { createFlatLocationLabeler, type FlatLocationLabeler } from "~/utils/flats/locationLabels";

interface FlatMetaOptions {
  countries: Ref<string[]>;
  city: Ref<string>;
  t: (key: string) => string;
  locale: MaybeRefOrGetter<string>;
  preferredCountry: () => string;
}

export function useFlatMeta(options: FlatMetaOptions) {
  const meta = ref<FlatCountryMeta[]>([]);
  const locale = computed(() => String(toValue(options.locale) || "").trim());
  const labels = computed(() => createFlatLocationLabeler(meta.value));
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

  const labelFor: FlatLocationLabeler = (
    value,
    kind = "any",
    countryCode = options.countries.value[0] || "",
    cityName = options.city.value,
  ) => labels.value(value, kind, countryCode, cityName);

  const countryItems = computed<SelectOption[]>(() => meta.value.map((country) => ({
    value: country.code,
    label: country.name || country.code,
  })));
  const cityItems = computed<SelectOption[]>(() => [
    { label: options.t("cityAny"), value: "__any__" },
    ...cityOptions.value.map((city) => ({ label: labelFor(city, "city"), value: city })),
  ]);
  const districtItems = computed<SelectOption[]>(() => [
    { label: options.t("districtAny"), value: "__any__" },
    ...districtOptions.value.map((district) => ({ label: labelFor(district, "district"), value: district })),
  ]);
  // No "any" sentinel: metro is a multi-select, where an empty selection already
  // means every station, and an "Any" chip sitting among the chosen ones reads
  // as a contradiction.
  const metroItems = computed<SelectOption[]>(() =>
    metroOptions.value.map((metro) => ({ label: labelFor(metro, "metro"), value: metro })));

  let requestId = 0;
  let controller: AbortController | undefined;
  let started = false;
  async function loadMeta() {
    started = true;
    const id = ++requestId;
    controller?.abort();
    controller = new AbortController();
    const { data } = await safeFetch<FlatCountryMeta[]>("/flats-meta", {
      params: locale.value ? { locale: locale.value } : undefined,
      signal: controller.signal,
    });
    if (id !== requestId || !Array.isArray(data)) return;
    meta.value = data;
    if (options.countries.value.length) return;
    const preferred = options.preferredCountry();
    const country = data.find((country) => country.code === preferred) || data[0];
    if (country) options.countries.value = [country.code];
  }
  watch(locale, () => {
    if (started) void loadMeta();
  }, { flush: "sync" });
  onScopeDispose(() => { requestId++; controller?.abort(); });

  return { meta, cityOptions, districtOptions, metroOptions, countryItems, cityItems, districtItems, metroItems, labelFor, loadMeta };
}
