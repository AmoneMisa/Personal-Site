import {
  TASHKENT_METRO,
  canonicalTashkentMetro,
} from '@whiteslove/parsing-lexicon'

// Keep the package's public metro catalog immutable. This index is private to
// the presentation adapter and cannot mutate canonicalization for the process.
new Map(
  TASHKENT_METRO.map((station) => [station.name, station.labels]),
);

export function canonicalMetroValue(value: string): string {
  return canonicalTashkentMetro(value) || value
}
