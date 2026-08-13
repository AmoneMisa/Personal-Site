// Auto-calculated years of experience from the first job (ITSUA, 2020-05).
// Client + SSR safe (recomputes from the current date), never hardcoded.

export function pluralizeYears(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "год";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "года";
  return "лет";
}

export function calcExperienceYears(startDate: Date): number {
  const now = new Date();
  let years = now.getFullYear() - startDate.getFullYear();
  const monthDiff = now.getMonth() - startDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < startDate.getDate())) years--;
  return years;
}

const CAREER_START = new Date("2020-05-01"); // first job (ITSUA) from the CV

export function useExperienceYears() {
  const years = computed(() => calcExperienceYears(CAREER_START));
  const labelRu = computed(() => `${years.value} ${pluralizeYears(years.value)}`);
  const labelEn = computed(() => `${years.value} year${years.value === 1 ? "" : "s"}`);

  const { locale } = useI18n();
  const label = computed(() => (locale.value === "en" ? labelEn.value : labelRu.value));

  return { years, label, labelRu, labelEn };
}
