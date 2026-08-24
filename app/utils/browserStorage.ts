export function readStoredList<T>(key: string, limit = Number.POSITIVE_INFINITY): T[] {
  if (typeof localStorage === "undefined") return [];

  try {
    const stored = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(stored) ? stored.slice(0, limit) : [];
  } catch {
    return [];
  }
}

export function writeStoredList<T>(key: string, value: T[], limit = Number.POSITIVE_INFINITY): boolean {
  if (typeof localStorage === "undefined") return false;

  try {
    localStorage.setItem(key, JSON.stringify(value.slice(0, limit)));
    return true;
  } catch {
    return false;
  }
}
