// Auto-calculated experience from the first job (ITSUA, 2020-05).
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

export function calcExperienceYM(startDate: Date): { years: number; months: number } {
  const now = new Date();
  let years = now.getFullYear() - startDate.getFullYear();
  let months = now.getMonth() - startDate.getMonth();
  if (now.getDate() < startDate.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months };
}

const CAREER_START = new Date("2020-05-01"); // first job (ITSUA) from the CV

export function useExperienceYears() {
  const { locale } = useI18n();

  const years = computed(() => calcExperienceYears(CAREER_START));
  const labelRu = computed(() => `${years.value} ${pluralizeYears(years.value)}`);
  const labelEn = computed(() => `${years.value} year${years.value === 1 ? "" : "s"}`);
  const label = computed(() => (locale.value === "en" ? labelEn.value : labelRu.value));

  // Years + months, e.g. "6 лет 3 мес." / "6 yr 3 mo" (months omitted at 0).
  const labelYM = computed(() => {
    const { years: y, months: m } = calcExperienceYM(CAREER_START);
    const en = locale.value === "en";
    const yStr = en ? `${y} yr` : `${y} ${pluralizeYears(y)}`;
    if (m <= 0) return yStr;
    return en ? `${yStr} ${m} mo` : `${yStr} ${m} мес.`;
  });

  return { years, label, labelRu, labelEn, labelYM };
}
