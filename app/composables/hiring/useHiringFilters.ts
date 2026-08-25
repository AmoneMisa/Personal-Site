import { ref } from "vue";
import type { HiringSort } from "~/types/hiring";

export function useHiringFilters() {
  const countries = ref<string[]>([]);
  const city = ref("");
  const remote = ref("any");
  const experienceMin = ref<number>();
  const salaryFrom = ref<number>();
  const salaryTo = ref<number>();
  const salaryCurrency = ref("USD");
  const sort = ref<HiringSort>("recent");
  const ageMin = ref<number>();
  const ageMax = ref<number>();
  const gender = ref("");
  const professions = ref<string[]>([]);
  const professionValues = ref<string[]>([]);
  const query = ref("");
  const seniority = ref("");
  const skills = ref("");
  const source = ref("");
  const showAdvanced = ref(false);

  function buildFeedParams(options: { limit: number; offset: number; skillQuery?: string }): Record<string, string> {
    const params: Record<string, string> = { limit: String(options.limit), offset: String(options.offset) };
    if (countries.value.length) params.countries = countries.value.join(",");
    if (city.value) params.city = city.value;
    if (remote.value === "yes") params.remote = "1";
    if (remote.value === "no") params.remote = "0";
    if (experienceMin.value != null) params.experienceMin = String(experienceMin.value);
    if (salaryFrom.value != null) params.salaryFrom = String(salaryFrom.value);
    if (salaryTo.value != null) params.salaryTo = String(salaryTo.value);
    if (salaryFrom.value != null || salaryTo.value != null || sort.value.startsWith("salary")) params.salaryCurrency = salaryCurrency.value;
    if (sort.value !== "recent") params.sort = sort.value;
    if (ageMin.value != null) params.ageMin = String(ageMin.value);
    if (ageMax.value != null) params.ageMax = String(ageMax.value);
    if (gender.value) params.gender = gender.value;
    if (professions.value.length) params.professions = professions.value.join(",");
    if (query.value.trim()) params.query = query.value.trim();
    if (seniority.value) params.seniority = seniority.value;
    if (options.skillQuery) params.skills = options.skillQuery;
    if (source.value) params.sources = source.value;
    return params;
  }

  function resetValues() {
    countries.value = [];
    city.value = "";
    remote.value = "any";
    experienceMin.value = undefined;
    salaryFrom.value = undefined;
    salaryTo.value = undefined;
    salaryCurrency.value = "USD";
    sort.value = "recent";
    ageMin.value = undefined;
    ageMax.value = undefined;
    gender.value = "";
    professions.value = [];
    query.value = "";
    seniority.value = "";
    skills.value = "";
    source.value = "";
  }

  return {
    countries, city, remote, experienceMin, salaryFrom, salaryTo, salaryCurrency, sort,
    ageMin, ageMax, gender, professions, professionValues, query, seniority, skills, source,
    showAdvanced, buildFeedParams, resetValues,
  };
}
