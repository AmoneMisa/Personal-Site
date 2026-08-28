import type { LocationQuery, Router } from "vue-router";
import { JOB_SALARY_PERIODS, type useJobFilters } from "~/composables/jobs/useJobFilters";
import type { SalaryPeriod } from "~/utils/search/money";
import { queryBoolean, queryString } from "~/utils/queryParams";
import { useSearchRouteState } from "../search/useSearchRouteState";

// Keys that identify a shared listing/page bookmark rather than a filter.
// They must never count toward "the URL carries search state" (see restore()
// below) and must survive every debounced filter-driven URL sync, the same
// way flats/hiring preserve their own non-filter keys.
const NON_FILTER_KEYS = new Set(["adv", "job", "page"]);

interface JobRouteStateOptions {
  router: Router;
  route: { query: LocationQuery };
  filters: ReturnType<typeof useJobFilters>;
  storageKey: string;
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

  function deserialize(params: LocationQuery | Record<string, unknown>) {
    query.value = queryString(params.q);
    source.value = queryString(params.source);
    const salaryMinRaw = queryString(params.salaryMin);
    salaryMin.value = salaryMinRaw ? Number(salaryMinRaw) : undefined;
    displayCurrency.value = queryString(params.currency) || "USD";
    const periodParam = queryString(params.period) as SalaryPeriod;
    displayPeriod.value = JOB_SALARY_PERIODS.includes(periodParam) ? periodParam : "month";
    sort.value = queryString(params.sort) || "date";
    const countryParam = queryString(params.country);
    countries.value = countryParam ? countryParam.split(",").filter(Boolean) : [];
    cities.value = queryString(params.cities);
    includeRu.value = queryBoolean(params.includeRu);
    includeBy.value = queryBoolean(params.includeBy);
    workMode.value = queryString(params.workMode);
    relocation.value = queryString(params.relocation);
    employmentKind.value = queryString(params.employment);
    hasSalary.value = queryBoolean(params.hasSalary);
    const maxExpRaw = queryString(params.maxExp);
    maxExperience.value = maxExpRaw ? Number(maxExpRaw) : undefined;
    foreignerOnly.value = queryBoolean(params.foreigner);
    hideRisky.value = queryString(params.hideRisky) !== "0";
    noExperience.value = queryBoolean(params.noExp);
    language.value = queryString(params.language);
    languageLevel.value = queryString(params.level);
    const exclLangParam = queryString(params.exclLang);
    excludeLanguages.value = exclLangParam ? exclLangParam.split(",").filter(Boolean) : [];
    skills.value = queryString(params.skills);
    if (sort.value === "ats") sort.value = "date";
  }

  function persistLocal() {
    if (!import.meta.client) return;
    try { localStorage.setItem(options.storageKey, JSON.stringify(serialize())); } catch { /* storage full or disabled */ }
  }

  const routeState = useSearchRouteState({
    router: options.router,
    serialize,
    deserialize,
    preserve: () => {
      const preserved: Record<string, string> = {};
      for (const key of NON_FILTER_KEYS) {
        const value = queryString(options.route.query[key]);
        if (value) preserved[key] = value;
      }
      return preserved;
    },
    debounceMs: 250,
  });

  // The URL query wins whenever it carries any real filter (so a search stays
  // shareable via the address bar); otherwise fall back to the last search
  // kept in localStorage, so a plain reload/return visit resumes where the
  // visitor left off instead of resetting to the defaults.
  function restore() {
    const hasUrlState = Object.keys(options.route.query).some((key) => !NON_FILTER_KEYS.has(key));
    if (hasUrlState) {
      deserialize(options.route.query);
      return;
    }
    if (!import.meta.client) return;
    try {
      const raw = localStorage.getItem(options.storageKey);
      if (raw) deserialize(JSON.parse(raw));
    } catch { /* corrupt state */ }
  }

  async function sync() {
    persistLocal();
    await routeState.sync();
  }

  function schedule(delay?: number) {
    persistLocal();
    routeState.schedule(delay);
  }

  return { ...routeState, sync, schedule, restore, serialize, deserialize };
}
