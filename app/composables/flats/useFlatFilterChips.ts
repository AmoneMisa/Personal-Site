import { computed } from "vue";
import type { useFlatFilters } from "~/composables/flats/useFlatFilters";

export interface FlatFilterChip {
  key: string;
  label: string;
  icon?: string;
  clear: () => void;
}

type Filters = ReturnType<typeof useFlatFilters>;

/**
 * Summary of what is currently narrowing the list, one removable chip per
 * filter. Display only: every chip clears the same ref its control writes to,
 * and the labels come from the page's own i18n/lexicon-backed labelers.
 */
export function useFlatFilterChips(options: {
  t: (key: string) => string;
  filters: Filters;
  /** Localized label for a canonical zone/district name. */
  zoneLabel: (value: string) => string;
  /** Label of an option in a select list (deal type, audience, ...). */
  itemLabel: (group: "dealType" | "propertyType" | "agency" | "audience" | "nearbyKind", value: string) => string;
  sourceLabel: (value: string) => string;
  metroArcLabel: () => string;
  clearMetroArc: () => void;
  clearMetro: () => void;
  viewFilter: { value: boolean };
  drawnAreaPoints: () => number;
  clearDrawnArea: () => void;
  /** Re-run the search after a chip changed a server-side filter. */
  onChange: () => void;
}) {
  const { t, filters: f } = options;

  const flags: Array<[string, { value: boolean }, string, string]> = [
    ["trusted", f.trustedOnly, "trustedOnly", "i-lucide-shield-check"],
    ["hideDanger", f.hideDanger, "hideDanger", "i-lucide-shield-alert"],
    ["pets", f.petFriendly, "pets", "i-lucide-paw-print"],
    ["children", f.childrenRequired, "children", "i-lucide-baby"],
    ["roomOnly", f.roomOnlyFilter, "roomOnly", "i-lucide-door-open"],
    ["photos", f.onlyWithPhotos, "onlyWithPhotos", "i-lucide-images"],
    ["newBuilding", f.newBuildingOnly, "newBuilding", "i-lucide-building-2"],
    ["noElevator", f.noElevatorOnly, "noElevator", ""],
    ["noDeposit", f.noDepositOnly, "noDeposit", ""],
    ["communal", f.communalIncludedOnly, "communalIncluded", ""],
    ["euroLayout", f.euroLayoutOnly, "euroLayout", ""],
    ["noCommission", f.noCommissionOnly, "noCommission", ""],
    ["dishwasher", f.dishwasherOnly, "dishwasher", "i-lucide-sparkles"],
    ["ac", f.airConditionerOnly, "airConditioner", "i-lucide-snowflake"],
    ["parking", f.parkingOnly, "parking", "i-lucide-square-parking"],
    ["internet", f.internetOnly, "internet", "i-lucide-wifi"],
    ["gas", f.gasOnly, "gas", "i-lucide-flame"],
    ["balcony", f.balconyOnly, "balcony", "i-lucide-panel-top"],
    ["terrace", f.terraceOnly, "terrace", "i-lucide-sun"],
    ["yard", f.privateYardOnly, "privateYard", "i-lucide-tree-pine"],
    ["tv", f.tvOnly, "tv", "i-lucide-tv"],
    ["microwave", f.microwaveOnly, "microwave", "i-lucide-microwave"],
    ["oven", f.ovenOnly, "oven", "i-lucide-cooking-pot"],
    ["bidet", f.bidetOnly, "bidet", "i-lucide-shower-head"],
    ["walkInCloset", f.walkInClosetOnly, "walkInCloset", "i-lucide-shirt"],
    ["bathtub", f.bathtubOnly, "bathtub", "i-lucide-bath"],
    ["shower", f.showerOnly, "shower", "i-lucide-droplets"],
  ];

  const ranges: Array<[string, { value: number | undefined }, { value: number | undefined }, string, string]> = [
    ["price", f.priceMin, f.priceMax, "price", "$currency"],
    ["rooms", f.roomsMin, f.roomsMax, "rangeRooms", ""],
    ["bedrooms", f.bedroomsMin, f.bedroomsMax, "rangeBedrooms", ""],
    ["area", f.areaMin, f.areaMax, "rangeArea", ""],
    ["sqm", f.pricePerSqmMin, f.pricePerSqmMax, "rangePricePerSqm", ""],
    ["floor", f.floorMin, f.floorMax, "rangeFloor", ""],
    ["totalFloors", f.totalFloorsMin, f.totalFloorsMax, "rangeTotalFloors", ""],
    ["year", f.yearMin, f.yearMax, "rangeYear", ""],
    ["commissionPct", f.commissionPercentMin, f.commissionPercentMax, "rangeCommissionPercent", "%"],
  ];

  function rangeLabel(title: string, min: number | undefined, max: number | undefined, suffix: string): string {
    if (min != null && max != null) return `${title}: ${min}–${max}${suffix}`;
    if (min != null) return `${title} ${t("rangeFrom")} ${min}${suffix}`;
    return `${title} ${t("rangeTo")} ${max}${suffix}`;
  }

  return computed<FlatFilterChip[]>(() => {
    const chips: FlatFilterChip[] = [];
    const server = (key: string, label: string, clear: () => void, icon?: string) =>
      chips.push({ key, label, icon, clear: () => { clear(); options.onChange(); } });

    if (f.query.value.trim()) server("query", `«${f.query.value.trim()}»`, () => { f.query.value = ""; }, "i-lucide-search");
    if (f.source.value) server("source", options.sourceLabel(f.source.value), () => { f.source.value = ""; });
    if (f.customSites.value.length) server("sites", f.customSites.value.join(", "), () => { f.customSites.value = []; }, "i-lucide-globe");
    if (f.city.value) server("city", `${t("city")}: ${options.zoneLabel(f.city.value)}`, () => { f.city.value = ""; });
    if (f.dealType.value !== "any") server("dealType", options.itemLabel("dealType", f.dealType.value), () => { f.dealType.value = "any"; });
    if (f.propertyType.value !== "any") server("propertyType", options.itemLabel("propertyType", f.propertyType.value), () => { f.propertyType.value = "any"; });
    if (f.agency.value !== "any") server("agency", options.itemLabel("agency", f.agency.value), () => { f.agency.value = "any"; });
    if (f.audience.value !== "any") server("audience", `${t("audience")}: ${options.itemLabel("audience", f.audience.value)}`, () => { f.audience.value = "any"; });
    if (f.region.value) server("region", `${t("region")}: ${options.zoneLabel(f.region.value)}`, () => { f.region.value = ""; });
    if (f.district.value) server("district", `${t("district")}: ${options.zoneLabel(f.district.value)}`, () => { f.district.value = ""; });
    if (f.microdistrict.value) server("microdistrict", `${t("microdistrictsLayer")}: ${options.zoneLabel(f.microdistrict.value)}`, () => { f.microdistrict.value = ""; });
    if (f.quartal.value) server("quartal", `${t("quartalsLayer")}: ${options.zoneLabel(f.quartal.value)}`, () => { f.quartal.value = ""; });
    if (f.mapArea.value) server("area", `${t("areasLayer")}: ${options.zoneLabel(f.mapArea.value)}`, () => { f.mapArea.value = ""; });
    if (f.metro.value.length) server("metro", `${t("metro")}: ${f.metro.value.map(options.zoneLabel).join(", ")}`, options.clearMetro);
    if (options.metroArcLabel()) server("metroArc", `${t("metroDirection")}: ${options.metroArcLabel()}`, options.clearMetroArc);
    if (f.metroMaxM.value != null && f.metro.value.length) server("metroMax", `${t("metroWithin")} ${f.metroMaxM.value}`, () => { f.metroMaxM.value = undefined; });
    if (f.nearbyKind.value) server("nearby", `${options.itemLabel("nearbyKind", f.nearbyKind.value)}${f.nearbyMaxM.value != null ? ` ≤ ${f.nearbyMaxM.value}` : ""}`, () => { f.nearbyKind.value = ""; f.nearbyMaxM.value = undefined; });
    if (f.maxAgeDays.value != null) server("fresh", `${t("freshDays")}: ${f.maxAgeDays.value}`, () => { f.maxAgeDays.value = undefined; });
    for (const [key, min, max, titleKey, suffix] of ranges) {
      if (min.value == null && max.value == null) continue;
      server(key, rangeLabel(t(titleKey), min.value, max.value, suffix === "$currency" ? ` ${f.displayCurrency.value}` : suffix), () => { min.value = undefined; max.value = undefined; });
    }
    for (const [key, ref, labelKey, icon] of flags) {
      if (ref.value) server(key, t(labelKey), () => { ref.value = false; }, icon || undefined);
    }
    if (options.drawnAreaPoints() >= 3) chips.push({ key: "drawn", label: t("drawArea"), icon: "i-lucide-scan", clear: options.clearDrawnArea });
    if (options.viewFilter.value) chips.push({ key: "inView", label: t("mapFilterByView"), icon: "i-lucide-scan-search", clear: () => { options.viewFilter.value = false; } });
    return chips;
  });
}
