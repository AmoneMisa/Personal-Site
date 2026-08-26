import type { SelectOption, SearchFilterBlock, SearchFilterValue } from "~/types/search";
import type { useJobFilters } from "~/composables/jobs/useJobFilters";

type Model<T = SearchFilterValue> = { value: T };
type OptionSource = { readonly value: Array<SelectOption | string> };

export function useJobFilterBlocks(options: {
  t: (key: string) => string;
  filters: ReturnType<typeof useJobFilters>;
  workModeSelect: Model<string>;
  relocationSelect: Model<string>;
  employmentKindSelect: Model<string>;
  languageSelect: Model<string>;
  languageLevelSelect: Model<string>;
  countryItems: OptionSource;
  currencyItems: OptionSource;
  periodItems: OptionSource;
  workModeItems: OptionSource;
  relocationItems: OptionSource;
  employmentKindItems: OptionSource;
  languageItems: OptionSource;
  levelItems: OptionSource;
  excludeLanguageItems: OptionSource;
  periodLabel: (period: string) => string;
  scheduleLoad: () => void;
  submit: () => void;
}) {
  const {
    countries, cities, salaryMin, displayCurrency, displayPeriod, hasSalary,
    maxExperience, noExperience, foreignerOnly, language, excludeLanguages,
    skills, hideRisky, includeRu, includeBy,
  } = options.filters;
  const update = <T>(target: Model<T>) => (value: SearchFilterValue) => { target.value = value as T; };
  const commit = () => options.scheduleLoad();

  return computed<SearchFilterBlock[]>(() => [
    {
      id: "location", title: options.t("filterLocation"), icon: "i-lucide-map-pin",
      fields: [
        { id: "countries", control: "multi-select", label: options.t("country"), value: countries.value, options: options.countryItems.value, placeholder: options.t("countryPlaceholder"), onUpdate: update(countries), onCommit: commit },
        { id: "cities", control: "text", class: "jobs__field_wide", label: options.t("cities"), value: cities.value, placeholder: options.t("citiesPlaceholder"), onUpdate: update(cities), onCommit: commit, onEnter: options.submit },
      ],
    },
    {
      id: "salary", title: options.t("filterSalary"), icon: "i-lucide-circle-dollar-sign",
      fields: [
        { id: "salary-min", control: "number", label: `${options.t("salaryMin")} (${displayCurrency.value}/${options.periodLabel(displayPeriod.value)})`, value: salaryMin.value, min: 0, onUpdate: update(salaryMin), onCommit: commit },
        { id: "currency", control: "select", label: options.t("currency"), value: displayCurrency.value, options: options.currencyItems.value, onUpdate: update(displayCurrency), onCommit: () => { if (salaryMin.value) options.scheduleLoad(); } },
        { id: "period", control: "select", label: options.t("period"), value: displayPeriod.value, options: options.periodItems.value, searchable: false, onUpdate: update(displayPeriod), onCommit: () => { if (salaryMin.value) options.scheduleLoad(); } },
        { id: "has-salary", control: "checkbox", label: options.t("hasSalary"), value: hasSalary.value, onUpdate: update(hasSalary), onCommit: commit },
      ],
    },
    {
      id: "work", title: options.t("filterWork"), icon: "i-lucide-briefcase-business",
      fields: [
        { id: "work-mode", control: "select", label: options.t("workMode"), value: options.workModeSelect.value, options: options.workModeItems.value, searchable: false, onUpdate: update(options.workModeSelect), onCommit: commit },
        { id: "relocation", control: "select", label: options.t("relocation"), value: options.relocationSelect.value, options: options.relocationItems.value, searchable: false, onUpdate: update(options.relocationSelect), onCommit: commit },
        { id: "employment", control: "select", label: options.t("employment"), value: options.employmentKindSelect.value, options: options.employmentKindItems.value, searchable: false, onUpdate: update(options.employmentKindSelect), onCommit: commit },
        { id: "max-experience", control: "number", label: options.t("experienceMax"), value: maxExperience.value, placeholder: options.t("experienceMaxPlaceholder"), min: 0, max: 40, onUpdate: update(maxExperience), onCommit: commit, onEnter: options.submit },
        { id: "no-experience", control: "checkbox", label: options.t("noExperience"), value: noExperience.value, onUpdate: update(noExperience), onCommit: commit },
        { id: "foreigner", control: "checkbox", label: options.t("foreigner"), value: foreignerOnly.value, onUpdate: update(foreignerOnly), onCommit: commit },
      ],
    },
    {
      id: "skills", title: options.t("filterSkills"), icon: "i-lucide-languages",
      fields: [
        { id: "language", control: "select", label: options.t("language"), value: options.languageSelect.value, options: options.languageItems.value, onUpdate: update(options.languageSelect), onCommit: commit },
        { id: "language-level", control: "select", label: options.t("languageLevel"), value: options.languageLevelSelect.value, options: options.levelItems.value, searchable: false, disabled: !language.value, onUpdate: update(options.languageLevelSelect), onCommit: commit },
        { id: "exclude-language", control: "multi-select", label: options.t("excludeLanguage"), value: excludeLanguages.value, options: options.excludeLanguageItems.value, placeholder: options.t("excludeLangPlaceholder"), onUpdate: update(excludeLanguages), onCommit: commit },
        { id: "skills-query", control: "text", class: "jobs__field_wide", label: options.t("skills"), value: skills.value, placeholder: options.t("skillsPlaceholder"), onUpdate: update(skills), onEnter: options.submit },
      ],
    },
    {
      id: "coverage", title: options.t("filterCoverage"), icon: "i-lucide-shield-alert",
      fields: [
        { id: "hide-risky", control: "checkbox", label: options.t("hideRisky"), title: options.t("hideRiskyHint"), value: hideRisky.value, onUpdate: update(hideRisky), onCommit: commit },
        { id: "include-ru", control: "checkbox", label: options.t("includeRu"), value: includeRu.value, onUpdate: update(includeRu), onCommit: commit },
        { id: "include-by", control: "checkbox", label: options.t("includeBy"), value: includeBy.value, onUpdate: update(includeBy), onCommit: commit },
      ],
    },
  ]);
}
