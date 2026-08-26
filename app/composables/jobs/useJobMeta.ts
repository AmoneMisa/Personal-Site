export const JOB_SOURCE_OPTIONS = [
  { value: "", labelKey: "all" },
  { value: "rss", label: "DOU.ua" },
  { value: "jooble", label: "Jooble" },
  { value: "themuse", label: "The Muse" },
  { value: "jobicy", label: "Jobicy" },
  { value: "remotive", label: "Remotive" },
  { value: "remoteok", label: "RemoteOK" },
  { value: "arbeitnow", label: "Arbeitnow" },
  { value: "adzuna", label: "Adzuna" },
  { value: "companies", labelKey: "sourceCompanies" },
  { value: "devkg", label: "DevKG (Kyrgyzstan)" },
  { value: "itjobsuz", label: "IT-Jobs.uz" },
  { value: "ishgo", label: "ishGO.uz" },
  { value: "telegram", label: "Telegram" },
  { value: "olx", label: "OLX" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "facebook", label: "Facebook" },
  { value: "threads", label: "Threads" },
] as const;

export const JOB_COUNTRY_OPTIONS = [
  { value: "", labelKey: "any" },
  { value: "UZ", label: "Uzbekistan" }, { value: "UA", label: "Ukraine" },
  { value: "KZ", label: "Kazakhstan" }, { value: "GE", label: "Georgia" },
  { value: "AZ", label: "Azerbaijan" }, { value: "AM", label: "Armenia" },
  { value: "KG", label: "Kyrgyzstan" }, { value: "MD", label: "Moldova" },
  { value: "RO", label: "Romania" }, { value: "TJ", label: "Tajikistan" },
  { value: "TM", label: "Turkmenistan" }, { value: "PL", label: "Poland" },
  { value: "DE", label: "Germany" }, { value: "GB", label: "UK" },
  { value: "US", label: "USA" }, { value: "CN", label: "China" },
  { value: "JP", label: "Japan" }, { value: "KR", label: "South Korea" },
  { value: "TW", label: "Taiwan" },
] as const;

export const JOB_LANGUAGE_OPTIONS = ["English", "German", "Russian", "Ukrainian", "Uzbek", "Kazakh", "French", "Spanish", "Polish", "Turkish", "Japanese"] as const;
export const JOB_LANGUAGE_LEVEL_OPTIONS = ["A1", "A2", "B1", "B2", "C1", "C2", "Intermediate", "Upper-Intermediate", "Advanced", "Fluent", "Native"] as const;

export function useJobMeta() {
  return {
    sourceOptions: JOB_SOURCE_OPTIONS,
    countryOptions: JOB_COUNTRY_OPTIONS,
    languageOptions: JOB_LANGUAGE_OPTIONS,
    levelOptions: JOB_LANGUAGE_LEVEL_OPTIONS,
  };
}
