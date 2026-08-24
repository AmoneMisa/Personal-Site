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
  const showAdvanced = ref(true);

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
    showAdvanced, resetValues,
  };
}
