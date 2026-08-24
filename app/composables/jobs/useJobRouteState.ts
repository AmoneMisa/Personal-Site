import { JOB_SALARY_PERIODS, type useJobFilters } from "~/composables/jobs/useJobFilters";
import type { SalaryPeriod } from "~/utils/search/money";

interface JobRouteStateOptions {
  storageKey: string;
  filters: ReturnType<typeof useJobFilters>;
  extraQuery?: () => Record<string, string>;
  ignoredUrlKeys?: string[];
}

export function useJobRouteState(options: JobRouteStateOptions) {
  const {
    query, source, salaryMin, displayCurrency, displayPeriod, sort, countries, cities,
    includeRu, includeBy, workMode, relocation, employmentKind, hasSalary, maxExperience,
    foreignerOnly, hideRisky, noExperience, language, languageLevel, excludeLanguages, skills,
  } = options.filters;

  function serialize(): Record<string, string> {
    const state: Record<string, string> = {};
    if (query.value.trim()) state.q = query.value.trim();
    if (source.value) state.source = source.value;
    if (salaryMin.value != null) state.salaryMin = String(salaryMin.value);
    if (displayCurrency.value !== "USD") state.currency = displayCurrency.value;
    if (displayPeriod.value !== "month") state.period = displayPeriod.value;
    if (sort.value !== "date") state.sort = sort.value;
    if (countries.value.length) state.country = countries.value.join(",");
    if (cities.value.trim()) state.cities = cities.value.trim();
    if (includeRu.value) state.includeRu = "1";
    if (includeBy.value) state.includeBy = "1";
    if (workMode.value) state.workMode = workMode.value;
    if (relocation.value) state.relocation = relocation.value;
    if (employmentKind.value) state.employment = employmentKind.value;
    if (hasSalary.value) state.hasSalary = "1";
    if (maxExperience.value != null) state.maxExp = String(maxExperience.value);
    if (foreignerOnly.value) state.foreigner = "1";
    if (!hideRisky.value) state.hideRisky = "0";
    if (noExperience.value) state.noExp = "1";
    if (language.value) state.language = language.value;
    if (languageLevel.value) state.level = languageLevel.value;
    if (excludeLanguages.value.length) state.exclLang = excludeLanguages.value.join(",");
    if (skills.value.trim()) state.skills = skills.value.trim();
    return state;
  }

  function deserialize(state: Record<string, string>) {
    if (!state || typeof state !== "object") return;
    query.value = state.q ?? "";
    source.value = state.source ?? "";
    salaryMin.value = state.salaryMin ? Number(state.salaryMin) : undefined;
    displayCurrency.value = state.currency ?? "USD";
    displayPeriod.value = JOB_SALARY_PERIODS.includes(state.period as SalaryPeriod) ? state.period as SalaryPeriod : "month";
    sort.value = state.sort ?? "date";
    countries.value = state.country ? state.country.split(",").filter(Boolean) : [];
    cities.value = state.cities ?? "";
    includeRu.value = state.includeRu === "1";
    includeBy.value = state.includeBy === "1";
    workMode.value = state.workMode ?? "";
    relocation.value = state.relocation ?? "";
    employmentKind.value = state.employment ?? "";
    hasSalary.value = state.hasSalary === "1";
    maxExperience.value = state.maxExp ? Number(state.maxExp) : undefined;
    foreignerOnly.value = state.foreigner === "1";
    hideRisky.value = state.hideRisky !== "0";
    noExperience.value = state.noExp === "1";
    language.value = state.language ?? "";
    languageLevel.value = state.level ?? "";
    excludeLanguages.value = state.exclLang ? state.exclLang.split(",").filter(Boolean) : [];
    skills.value = state.skills ?? "";
    if (sort.value === "ats") sort.value = "date";
  }

  function persist() {
    if (!import.meta.client) return;
    const state = serialize();
    try { localStorage.setItem(options.storageKey, JSON.stringify(state)); } catch { /* storage full or disabled */ }
    const queryState = { ...state, ...(options.extraQuery?.() || {}) };
    const search = new URLSearchParams(queryState).toString();
    window.history.replaceState(window.history.state, "", search ? `?${search}` : window.location.pathname);
  }

  function restore() {
    if (!import.meta.client) return;
    const fromUrl = new URLSearchParams(window.location.search);
    const ignored = new Set(options.ignoredUrlKeys || []);
    if ([...fromUrl.keys()].some((key) => !ignored.has(key))) {
      deserialize(Object.fromEntries(fromUrl.entries()));
      return;
    }
    try {
      const raw = localStorage.getItem(options.storageKey);
      if (raw) deserialize(JSON.parse(raw));
    } catch { /* corrupt state */ }
  }

  return { persist, restore, serialize, deserialize };
}
