import type { SelectOption, SearchFilterBlock, SearchFilterValue } from "~/types/search";
import type { useHiringFilters } from "~/composables/hiring/useHiringFilters";

type Model<T = SearchFilterValue> = { value: T };
type OptionSource = { readonly value: Array<SelectOption | string> };

export function useHiringFilterBlocks(options: {
  t: (key: string) => string;
  filters: ReturnType<typeof useHiringFilters>;
  citySelect: Model<string>;
  genderSelect: Model<string>;
  senioritySelect: Model<string>;
  countryItems: OptionSource;
  cityItems: OptionSource;
  remoteItems: OptionSource;
  salaryCurrencyItems: OptionSource;
  genderItems: OptionSource;
  seniorityItems: OptionSource;
  scheduleLoad: (delay?: number) => void;
}) {
  const {
    countries, remote, salaryFrom, salaryTo, salaryCurrency, sort,
    experienceMin, ageMin, ageMax, skills,
  } = options.filters;
  const update = <T>(target: Model<T>) => (value: SearchFilterValue) => { target.value = value as T; };
  const commit = () => options.scheduleLoad();

  return computed<SearchFilterBlock[]>(() => [
    {
      id: "location", title: options.t("filterLocation"), icon: "i-lucide-map-pin",
      fields: [
        { id: "countries", control: "multi-select", label: options.t("country"), value: countries.value, options: options.countryItems.value, placeholder: options.t("countryAny"), onUpdate: update(countries), onCommit: commit },
        { id: "city", control: "select", label: options.t("city"), value: options.citySelect.value, options: options.cityItems.value, onUpdate: update(options.citySelect), onCommit: commit },
        { id: "remote", control: "select", label: options.t("remote"), value: remote.value, options: options.remoteItems.value, searchable: false, onUpdate: update(remote), onCommit: commit },
      ],
    },
    {
      id: "salary", title: options.t("filterSalary"), icon: "i-lucide-banknote",
      fields: [
        { id: "salary-from", control: "number", label: options.t("salaryFrom"), value: salaryFrom.value, min: 0, icon: "i-lucide-banknote", onUpdate: update(salaryFrom), onCommit: commit },
        { id: "salary-to", control: "number", label: options.t("salaryTo"), value: salaryTo.value, min: 0, icon: "i-lucide-banknote", onUpdate: update(salaryTo), onCommit: commit },
        { id: "salary-currency", control: "select", label: options.t("currency"), value: salaryCurrency.value, options: options.salaryCurrencyItems.value, searchable: false, onUpdate: update(salaryCurrency), onCommit: () => { if (salaryFrom.value != null || salaryTo.value != null || sort.value.startsWith("salary")) options.scheduleLoad(0); } },
      ],
    },
    {
      id: "candidate", title: options.t("filterCandidate"), icon: "i-lucide-user-round",
      fields: [
        { id: "experience-min", control: "number", label: options.t("experienceMin"), value: experienceMin.value, min: 0, icon: "i-lucide-briefcase", onUpdate: update(experienceMin), onCommit: commit },
        { id: "age-min", control: "number", label: options.t("ageFrom"), value: ageMin.value, min: 14, max: 99, icon: "i-lucide-user-round", onUpdate: update(ageMin), onCommit: commit },
        { id: "age-max", control: "number", label: options.t("ageTo"), value: ageMax.value, min: 14, max: 99, icon: "i-lucide-user-round", onUpdate: update(ageMax), onCommit: commit },
        { id: "gender", control: "select", label: options.t("gender"), value: options.genderSelect.value, options: options.genderItems.value, searchable: false, onUpdate: update(options.genderSelect), onCommit: commit },
        { id: "seniority", control: "select", label: options.t("seniority"), value: options.senioritySelect.value, options: options.seniorityItems.value, searchable: false, onUpdate: update(options.senioritySelect), onCommit: commit },
      ],
    },
    {
      id: "role", title: options.t("filterRoleSkills"), icon: "i-lucide-briefcase-business",
      fields: [
        { id: "professions", control: "custom", class: "hiring__field_wide" },
        { id: "skills", control: "text", class: "hiring__field_wide", label: options.t("skills"), value: skills.value, placeholder: options.t("skillsPlaceholder"), icon: "i-lucide-code", onUpdate: update(skills), onCommit: commit },
      ],
    },
  ]);
}
