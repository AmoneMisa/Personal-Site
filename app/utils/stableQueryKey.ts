/**
 * Serializes a string query object independently of insertion order.
 * Cache keys must represent the request, not reactive property order.
 */
export function stableQueryKey(params: Record<string, string>): string {
  return new URLSearchParams(
    Object.entries(params).sort(([left], [right]) => left.localeCompare(right)),
  ).toString();
}
