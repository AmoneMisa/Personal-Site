import { ref } from "vue";
import type { SalaryPeriod } from "~/utils/search/money";

export const JOB_SALARY_PERIODS = ["hour", "month", "year"] as const;

export function useJobFilters() {
  const query = ref("");
  const source = ref("");
  const salaryMin = ref<number>();
  const displayCurrency = ref("USD");
  const displayPeriod = ref<SalaryPeriod>("month");
  const sort = ref("date");
  const countries = ref<string[]>([]);
  const cities = ref("");
  const includeRu = ref(false);
  const includeBy = ref(false);
  const workMode = ref("");
  const relocation = ref("");
  const employmentKind = ref("");
  const hasSalary = ref(false);
  const maxExperience = ref<number>();
  const foreignerOnly = ref(false);
  const hideRisky = ref(true);
  const noExperience = ref(false);
  const language = ref("");
  const languageLevel = ref("");
  const excludeLanguages = ref<string[]>([]);
  const skills = ref("");
  const showAdvanced = ref(true);

  function resetValues() {
    countries.value = [];
    cities.value = "";
    includeRu.value = false;
    includeBy.value = false;
    workMode.value = "";
    relocation.value = "";
    employmentKind.value = "";
    hasSalary.value = false;
    maxExperience.value = undefined;
    foreignerOnly.value = false;
    hideRisky.value = true;
    noExperience.value = false;
    language.value = "";
    languageLevel.value = "";
    excludeLanguages.value = [];
    skills.value = "";
  }

  return {
    query, source, salaryMin, displayCurrency, displayPeriod, sort, countries, cities,
    includeRu, includeBy, workMode, relocation, employmentKind, hasSalary, maxExperience,
    foreignerOnly, hideRisky, noExperience, language, languageLevel, excludeLanguages,
    skills, showAdvanced, resetValues,
  };
}
