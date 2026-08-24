import type { LocationQuery, Router } from "vue-router";
import { HIRING_SORTS, type HiringSort } from "~/types/hiring";
import type { useHiringFilters } from "~/composables/hiring/useHiringFilters";
import { queryString } from "~/utils/queryParams";
import { normalizeHiringProfessionFilterSelections } from "~~/shared/hiringProfessionGroups";
import { useSearchRouteState } from "../search/useSearchRouteState";

export function useHiringRouteState(options: {
  router: Router;
  route: { query: LocationQuery };
  filters: ReturnType<typeof useHiringFilters>;
  skillQuery: () => string;
  defaultCountry: () => string;
}) {
  const {
    countries, city, remote, experienceMin, salaryFrom, salaryTo, salaryCurrency,
    sort, ageMin, ageMax, gender, professions, query, seniority, skills, source,
  } = options.filters;

  function serialize(): Record<string, string> {
    const state: Record<string, string> = {};
    if (countries.value.length) state.countries = countries.value.join(",");
    if (city.value) state.city = city.value;
    if (remote.value === "yes") state.remote = "1";
    if (remote.value === "no") state.remote = "0";
    if (experienceMin.value != null) state.experienceMin = String(experienceMin.value);
    if (salaryFrom.value != null) state.salaryFrom = String(salaryFrom.value);
    if (salaryTo.value != null) state.salaryTo = String(salaryTo.value);
    if (salaryCurrency.value !== "USD" || salaryFrom.value != null || salaryTo.value != null || sort.value.startsWith("salary")) state.salaryCurrency = salaryCurrency.value;
    if (sort.value !== "recent") state.sort = sort.value;
    if (ageMin.value != null) state.ageMin = String(ageMin.value);
    if (ageMax.value != null) state.ageMax = String(ageMax.value);
    if (gender.value) state.gender = gender.value;
    if (professions.value.length) state.professions = professions.value.join(",");
    if (query.value.trim()) state.query = query.value.trim();
    if (seniority.value) state.seniority = seniority.value;
    const canonicalSkills = options.skillQuery();
    if (canonicalSkills) state.skills = canonicalSkills;
    if (source.value) state.sources = source.value;
    return state;
  }

  function deserialize(params: LocationQuery | Record<string, unknown>) {
    const countryParam = queryString(params.countries);
    countries.value = countryParam ? countryParam.split(",").filter(Boolean) : [options.defaultCountry()];
    city.value = queryString(params.city);
    remote.value = params.remote === "1" ? "yes" : params.remote === "0" ? "no" : "any";
    experienceMin.value = Number(queryString(params.experienceMin)) || undefined;
    salaryFrom.value = Number(queryString(params.salaryFrom)) || undefined;
    salaryTo.value = Number(queryString(params.salaryTo)) || undefined;
    const requestedCurrency = queryString(params.salaryCurrency).toUpperCase();
    salaryCurrency.value = /^[A-Z]{3}$/.test(requestedCurrency) ? requestedCurrency : "USD";
    const requestedSort = queryString(params.sort) as HiringSort;
    sort.value = HIRING_SORTS.includes(requestedSort) ? requestedSort : "recent";
    ageMin.value = Number(queryString(params.ageMin)) || undefined;
    ageMax.value = Number(queryString(params.ageMax)) || undefined;
    gender.value = ["male", "female", "unknown"].includes(queryString(params.gender)) ? queryString(params.gender) : "";
    professions.value = normalizeHiringProfessionFilterSelections(queryString(params.professions).split(",").map((value) => value.trim()).filter(Boolean));
    query.value = queryString(params.query);
    seniority.value = ["junior", "middle", "senior", "lead"].includes(queryString(params.seniority)) ? queryString(params.seniority) : "";
    skills.value = queryString(params.skills);
    source.value = queryString(params.sources);
  }

  const routeState = useSearchRouteState({
    router: options.router,
    serialize,
    deserialize,
    preserve: () => {
      const preserved: Record<string, string> = {};
      for (const key of ["cv", "cvSource", "cvCountry"] as const) {
        const value = queryString(options.route.query[key]);
        if (value) preserved[key] = value;
      }
      return preserved;
    },
    debounceMs: 160,
  });

  return { ...routeState, serialize, deserialize };
}
