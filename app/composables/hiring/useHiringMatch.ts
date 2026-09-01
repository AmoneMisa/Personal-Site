import { computed, type Ref } from "vue";
import type { HiringCvProfile } from "~/types/hiring";
import { canonicalHiringSkill } from "~/utils/hiringMatch";
import { expandHiringProfessionFilters } from "~~/shared/hiringProfessionGroups";

interface HiringMatchFilters {
  countries: Ref<string[]>;
  city: Ref<string>;
  remote: Ref<string>;
  experienceMin: Ref<number | undefined>;
  ageMin: Ref<number | undefined>;
  ageMax: Ref<number | undefined>;
  gender: Ref<string>;
  professions: Ref<string[]>;
  seniority: Ref<string>;
  skills: Ref<string>;
  source: Ref<string>;
}

export function useHiringMatch(filters: HiringMatchFilters) {
  function canonicalSkillValues(): string[] {
    return [...new Set(filters.skills.value
      .split(",")
      .map(canonicalHiringSkill)
      .map((value) => value.trim())
      .filter(Boolean))];
  }

  function canonicalSkillQuery(): string {
    return canonicalSkillValues().join(",");
  }

  const candidateMatchFilters = computed(() => ({
    professions: filters.professions.value,
    skills: canonicalSkillValues(),
  }));

  function matchesLocally(profile: HiringCvProfile): boolean {
    if (filters.countries.value.length && !filters.countries.value.includes((profile.country || "").toUpperCase())) return false;
    if (filters.remote.value === "yes" && !profile.remote) return false;
    if (filters.remote.value === "no" && profile.remote) return false;
    if (filters.gender.value && (profile.gender || "unknown") !== filters.gender.value) return false;
    if (filters.seniority.value && (profile.seniority || "") !== filters.seniority.value) return false;
    if (filters.experienceMin.value != null && (profile.experienceYears == null || profile.experienceYears < filters.experienceMin.value)) return false;
    if (filters.ageMin.value != null && (profile.age == null || profile.age < filters.ageMin.value)) return false;
    if (filters.ageMax.value != null && (profile.age == null || profile.age > filters.ageMax.value)) return false;
    if (filters.city.value) {
      const needle = filters.city.value.trim().toLocaleLowerCase("ru");
      const haystack = `${profile.city || ""} ${profile.district || ""}`.toLocaleLowerCase("ru");
      if (!haystack.includes(needle)) return false;
    }
    if (filters.professions.value.length) {
      const owned = new Set([...(profile.professions || []), profile.role].filter(Boolean));
      if (!expandHiringProfessionFilters(filters.professions.value).some((profession) => owned.has(profession))) return false;
    }
    if (filters.source.value) {
      const origin = (profile.origin || "telegram").toLowerCase();
      const key = (profile.sourceKey || profile.source || "").toLowerCase();
      if (filters.source.value !== origin && filters.source.value !== key) return false;
    }
    return true;
  }

  return { canonicalSkillQuery, candidateMatchFilters, matchesLocally };
}
