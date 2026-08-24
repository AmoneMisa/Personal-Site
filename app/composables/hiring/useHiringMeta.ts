import { computed, ref, type Ref } from "vue";
import type { HiringCountryMeta } from "~/types/hiring";
import type { SelectOption } from "~/types/search";
import { safeFetch } from "~/utils/safeFetch";

interface HiringMetaOptions {
  countries: Ref<string[]>;
  city: Ref<string>;
  locale: Ref<string>;
  t: (key: string) => string;
  cityLabel: (value: string) => string;
}

export function useHiringMeta(options: HiringMetaOptions) {
  const meta = ref<HiringCountryMeta[]>([]);
  const cityOptions = computed(() => {
    const picked = options.countries.value.length
      ? meta.value.filter((country) => options.countries.value.includes(country.code))
      : meta.value;
    return [...new Set(picked.flatMap((country) => country.cities ?? []))]
      .sort((a, b) => options.cityLabel(a).localeCompare(options.cityLabel(b), options.locale.value));
  });
  const countryItems = computed<SelectOption[]>(() =>
    meta.value.map((country) => ({ value: country.code, label: country.name })),
  );
  const cityItems = computed<SelectOption[]>(() => [
    { label: options.t("cityAny"), value: "__any__" },
    ...cityOptions.value.map((city) => ({ label: options.cityLabel(city), value: city })),
  ]);
  const salaryCurrencyItems = computed<SelectOption[]>(() => {
    const currencies = [...new Set(["USD", "EUR", ...meta.value.map((item) => item.currency).filter(Boolean)])];
    return currencies.map((value) => ({ value, label: value }));
  });

  async function loadMeta() {
    const { data } = await safeFetch<HiringCountryMeta[]>("/hiring-meta");
    if (!Array.isArray(data)) return;
    meta.value = data;
    if (!options.countries.value.length) options.countries.value = data.map((country) => country.code);
  }

  return { meta, cityOptions, countryItems, cityItems, salaryCurrencyItems, loadMeta };
}
