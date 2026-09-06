import type { FlatCountryMeta } from "~/types/flats";

export type FlatLocationKind = "country" | "city" | "district" | "metro" | "microdistrict" | "quartal" | "area" | "any";
export type FlatLocationLabeler = (
  value: string | null | undefined,
  kind?: FlatLocationKind,
  country?: string,
  city?: string,
) => string;

const locationFields = {
  district: ["districts", "districtLabels"],
  metro: ["metro", "metroLabels"],
  microdistrict: ["microdistricts", "microdistrictLabels"],
  quartal: ["quartals", "quartalLabels"],
  area: ["areas", "areaLabels"],
} as const;

// Index only names/labels supplied by the backend. An unscoped collision stays
// untranslated, rather than borrowing another city's label for the same name.
export function createFlatLocationLabeler(countries: FlatCountryMeta[]): FlatLocationLabeler {
  const labels = new Map<string, string | null>();
  const key = (kind: FlatLocationKind, value: string, country = "", city = "") =>
    JSON.stringify([kind, value, country, city]);
  const add = (kind: FlatLocationKind, value: string, label: string, country = "", city = "") => {
    if (!value || typeof label !== "string" || !label.trim()) return;
    const scopes = new Set([key(kind, value, country, city), key(kind, value, country), key(kind, value)]);
    for (const scope of scopes) {
      labels.set(scope, labels.has(scope) && labels.get(scope) !== label ? null : label);
    }
  };
  for (const country of countries) {
    add("country", country.code, country.name || country.code);
    for (const city of country.cities || []) {
      add("city", city, country.cityLabels?.[city] || city, country.code);
    }
    for (const [city, location] of Object.entries(country.locations || {})) {
      for (const [kind, [valuesField, labelsField]] of Object.entries(locationFields)) {
        const backendLabels = location[labelsField] || {};
        const names = new Set([...(location[valuesField] || []), ...Object.keys(backendLabels)]);
        for (const name of names) {
          const label = backendLabels[name] || name;
          add(kind as FlatLocationKind, name, label, country.code, city);
          add("any", name, label, country.code, city);
        }
      }
    }
  }
  return (value, kind = "any", country = "", city = "") => {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    return labels.get(key(kind, raw, kind === "country" ? "" : country, kind === "city" || kind === "country" ? "" : city)) || raw;
  };
}
