/**
 * Curated "custom" listings are scraped from ~30 different real-estate sites
 * (krisha.kz, lun.ua, dom.ria.com, ...) but all share the generic `source:
 * "custom"` value -- the actual site lives in `customSourceUrl`, the exact
 * catalogue URL the listing was scraped from. Surface that domain instead of
 * the opaque "custom"/"Sites" label wherever a listing shows its source.
 */
export function customSiteDomain(customSourceUrl?: string | null): string | null {
  if (!customSourceUrl) return null;
  try {
    return new URL(customSourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function flatSourceLabel(
  source: string | undefined | null,
  customSourceUrl: string | undefined | null,
  sitesLabel: string,
): string {
  if (source === "olx") return "OLX";
  if (source === "telegram") return "Telegram";
  if (source === "custom") return customSiteDomain(customSourceUrl) || sitesLabel;
  return source || "";
}
