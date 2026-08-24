export type RegionalSearchCountry = "UA" | "UZ";

/** Default market shared by candidate and housing search pages. */
export function regionalSearchCountry(): RegionalSearchCountry {
  if (!import.meta.client) return "UA";
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  return timeZone.startsWith("Asia/") ? "UZ" : "UA";
}
