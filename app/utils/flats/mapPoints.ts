interface PointIdentity {
  id: string;
  source?: string;
  country?: string;
}

const keyOf = (point: PointIdentity) => `${point.source || ""}:${point.country || ""}:${point.id}`;

export function selectFlatMapPoints<T extends PointIdentity>(remote: T[], supplied: T[], options: {
  mode: "search" | "collection";
  excludedIds: ReadonlySet<string>;
}): T[] {
  if (options.mode === "collection") return supplied;
  const merged = new Map<string, T>();
  const remoteByIdentity = new Map<string, T>();
  for (const point of remote) {
    merged.set(keyOf(point), point);
    remoteByIdentity.set(`${point.source || ""}:${point.id}`, point);
  }
  for (const point of supplied) {
    if (point.country || !point.source) {
      merged.set(keyOf(point), point);
      continue;
    }
    const original = remoteByIdentity.get(`${point.source}:${point.id}`);
    merged.set(original ? keyOf(original) : keyOf(point), { ...original, ...point });
  }
  return [...merged.values()].filter((point) => !options.excludedIds.has(point.id));
}
