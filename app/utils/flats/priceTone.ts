export type FlatPriceTone = "green" | "blue" | "pink" | "orange" | "yellow" | "red";

/** Card and popup both color a listing's price/ID by the same bands relative to the local median. */
export function priceToneFromRatio(ratio: number): FlatPriceTone {
  if (ratio >= 1.45) return "red";
  if (ratio >= 1.31) return "yellow";
  if (ratio >= 1.16) return "orange";
  if (ratio >= 0.85) return "pink";
  if (ratio >= 0.70) return "blue";
  return "green";
}

export function flatPriceTone(priceUsd: number | null | undefined, medianUsd: number | null | undefined): FlatPriceTone | null {
  if (medianUsd == null || medianUsd <= 0 || priceUsd == null || priceUsd <= 0) return null;
  return priceToneFromRatio(priceUsd / medianUsd);
}
