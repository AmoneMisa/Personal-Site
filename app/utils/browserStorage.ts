export function readStoredValue<T>(key: string): T | null {
  if (typeof localStorage === "undefined") return null;

  try {
    return JSON.parse(localStorage.getItem(key) || "null") as T | null;
  } catch {
    return null;
  }
}

export function writeStoredValue<T>(key: string, value: T): boolean {
  if (typeof localStorage === "undefined") return false;

  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function readStoredList<T>(key: string, limit = Number.POSITIVE_INFINITY): T[] {
  const stored = readStoredValue<unknown>(key);
  return Array.isArray(stored) ? stored.slice(0, limit) as T[] : [];
}

export function writeStoredList<T>(key: string, value: T[], limit = Number.POSITIVE_INFINITY): boolean {
  return writeStoredValue(key, value.slice(0, limit));
}
