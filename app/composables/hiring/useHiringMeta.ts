import { computed, ref, type Ref } from "vue";
import type { HiringCountryMeta } from "~/types/hiring";
import type { SelectOption } from "~/types/search";
import { safeFetch } from "~/utils/safeFetch";

interface HiringMetaOptions {
  countries: Ref<string[]>;
  city: Ref<string>;
  locale: Ref<string>;
  t: (key: string) => string;
  preferredCountry: () => string;
}

export function useHiringMeta(options: HiringMetaOptions) {
  const meta = ref<HiringCountryMeta[]>([]);
  // Labels are localized by the server (hiring-meta); an unknown city shows as is.
  const cityLabels = computed(() => Object.assign({}, ...meta.value.map((country) => country.cityLabels ?? {})) as Record<string, string>);
  const cityLabel = (value: string) => cityLabels.value[value] ?? value;
  const cityOptions = computed(() => {
    const picked = options.countries.value.length
      ? meta.value.filter((country) => options.countries.value.includes(country.code))
      : meta.value;
    return [...new Set(picked.flatMap((country) => country.cities ?? []))]
      .sort((a, b) => cityLabel(a).localeCompare(cityLabel(b), options.locale.value));
  });
  const countryItems = computed<SelectOption[]>(() =>
    meta.value.map((country) => ({ value: country.code, label: country.name })),
  );
  const cityItems = computed<SelectOption[]>(() => [
    { label: options.t("cityAny"), value: "__any__" },
    ...cityOptions.value.map((city) => ({ label: cityLabel(city), value: city })),
  ]);
  const salaryCurrencyItems = computed<SelectOption[]>(() => {
    const currencies = [...new Set(["USD", "EUR", ...meta.value.map((item) => item.currency).filter(Boolean)])];
    return currencies.map((value) => ({ value, label: value }));
  });

  async function loadMeta() {
    const { data } = await safeFetch<HiringCountryMeta[]>("/hiring-meta", { params: { locale: options.locale.value } });
    if (!Array.isArray(data)) return;
    meta.value = data;
    if (!options.countries.value.length) {
      const preferred = options.preferredCountry();
      options.countries.value = [data.some((country) => country.code === preferred) ? preferred : "UA"];
    }
  }

  return { meta, cityLabel, cityOptions, countryItems, cityItems, salaryCurrencyItems, loadMeta };
}
