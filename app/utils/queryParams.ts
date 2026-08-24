export function queryString(value: unknown): string {
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

export function queryBoolean(value: unknown): boolean {
  return ["1", "true"].includes(queryString(value).toLowerCase());
}
