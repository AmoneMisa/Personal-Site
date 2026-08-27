import { ref } from "vue";
import type { DisplaySalaryPeriod } from "~/utils/search/money";

export const JOB_SALARY_PERIODS = ["hour", "month", "year"] as const;

export function useJobFilters() {
  const query = ref("");
  const source = ref("");
  const salaryMin = ref<number>();
  const displayCurrency = ref("USD");
  const displayPeriod = ref<DisplaySalaryPeriod>("month");
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
  const showAdvanced = ref(false);

  function buildFeedParams(options: {
    page: number;
    pageSize: number;
    cvReady: boolean;
    convertCurrency: (amount: number, from: string, to: string) => number | undefined;
    convertPeriod: (amount: number, from: DisplaySalaryPeriod, to: DisplaySalaryPeriod) => number | undefined;
  }): Record<string, string> {
    const params: Record<string, string> = {
      page: String(options.page),
      pageSize: String(options.cvReady ? 50 : options.pageSize),
      sort: sort.value === "ats" ? "date" : sort.value,
    };
    if (query.value) params.q = query.value;
    if (source.value) params.source = source.value;
    if (salaryMin.value) {
      const inUsd = options.convertCurrency(salaryMin.value, displayCurrency.value, "USD");
      if (inUsd) {
        const annual = options.convertPeriod(inUsd, displayPeriod.value, "year");
        if (annual !== undefined) params.salaryMin = String(annual);
      }
    }
    if (countries.value.length) params.country = countries.value.join(",");
    if (cities.value.trim()) params.cities = cities.value.trim();
    if (includeRu.value) params.includeRu = "true";
    if (includeBy.value) params.includeBy = "true";
    if (workMode.value) params.workMode = workMode.value;
    if (relocation.value) params.relocation = relocation.value;
    if (employmentKind.value) params.employmentKind = employmentKind.value;
    if (hasSalary.value) params.hasSalary = "true";
    if (maxExperience.value != null) params.maxExperienceYears = String(maxExperience.value);
    if (foreignerOnly.value) params.foreignerFriendly = "true";
    if (!hideRisky.value) params.hideRiskyIndustries = "false";
    if (noExperience.value) params.noExperience = "true";
    if (language.value) params.language = language.value;
    if (languageLevel.value) params.languageLevel = languageLevel.value;
    if (excludeLanguages.value.length) params.excludeLanguage = excludeLanguages.value.join(",");
    if (skills.value.trim()) params.skills = skills.value.trim();
    return params;
  }

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
    skills, showAdvanced, buildFeedParams, resetValues,
  };
}