import type { SelectOption, SearchFilterBlock, SearchFilterValue } from "~/types/search";
import type { useFlatFilters } from "~/composables/flats/useFlatFilters";

type Model<T = SearchFilterValue> = { value: T };
type OptionSource = { readonly value: Array<SelectOption | string> };

export function useFlatFilterBlocks(options: {
  t: (key: string) => string;
  filters: ReturnType<typeof useFlatFilters>;
  districtSelect: Model<string>;
  metroSelect: Model<string>;
  nearbyKindSelect: Model<string>;
  districtItems: OptionSource;
  metroItems: OptionSource;
  nearbyKindItems: OptionSource;
  audienceItems: OptionSource;
  propertyTypeItems: OptionSource;
  hasDistricts: () => boolean;
  hasMetro: () => boolean;
  scheduleLoad: () => void;
}) {
  const {
    metroMaxM, nearbyMaxM, roomsMin, roomsMax, bedroomsMin, bedroomsMax,
    areaMin, areaMax, pricePerSqmMin, pricePerSqmMax, floorMin, floorMax,
    totalFloorsMin, totalFloorsMax, yearMin, yearMax, audience, propertyType, maxAgeDays,
  } = options.filters;
  const update = <T>(target: Model<T>) => (value: SearchFilterValue) => { target.value = value as T; };
  const commit = () => options.scheduleLoad();

  return computed<SearchFilterBlock[]>(() => [
    {
      id: "quick", title: options.t("quickOptions"), icon: "i-lucide-sliders-horizontal", gridClass: "flat-filter-grid_single",
      fields: [{ id: "quick-options", control: "custom" }],
    },
    {
      id: "location", title: options.t("groupLocation"), icon: "i-lucide-map-pin", gridClass: "flat-filter-grid_single",
      fields: [
        { id: "district", control: "select", label: options.t("district"), value: options.districtSelect.value, options: options.districtItems.value, hidden: !options.hasDistricts(), onUpdate: update(options.districtSelect), onCommit: commit },
        { id: "metro", control: "select", label: options.t("metro"), value: options.metroSelect.value, options: options.metroItems.value, hidden: !options.hasMetro(), onUpdate: update(options.metroSelect), onCommit: commit },
        { id: "metro-distance", control: "number", label: options.t("metroWithin"), value: metroMaxM.value, min: 0, step: 100, inputmode: "numeric", onUpdate: update(metroMaxM), onCommit: commit },
        { id: "nearby-kind", control: "select", label: options.t("nearbyKind"), value: options.nearbyKindSelect.value, options: options.nearbyKindItems.value, onUpdate: update(options.nearbyKindSelect), onCommit: commit },
        { id: "nearby-distance", control: "number", label: options.t("nearbyWithin"), value: nearbyMaxM.value, min: 0, step: 100, inputmode: "numeric", onUpdate: update(nearbyMaxM), onCommit: commit },
      ],
    },
    {
      id: "apartment", title: options.t("groupApartment"), icon: "i-lucide-house",
      fields: [
        { id: "rooms-min", control: "number", label: `${options.t("rangeRooms")} · ${options.t("rangeFrom")}`, value: roomsMin.value, min: 0, onUpdate: update(roomsMin), onCommit: commit },
        { id: "rooms-max", control: "number", label: `${options.t("rangeRooms")} · ${options.t("rangeTo")}`, value: roomsMax.value, min: 0, onUpdate: update(roomsMax), onCommit: commit },
        { id: "bedrooms-min", control: "number", label: `${options.t("rangeBedrooms")} · ${options.t("rangeFrom")}`, value: bedroomsMin.value, min: 0, onUpdate: update(bedroomsMin), onCommit: commit },
        { id: "bedrooms-max", control: "number", label: `${options.t("rangeBedrooms")} · ${options.t("rangeTo")}`, value: bedroomsMax.value, min: 0, onUpdate: update(bedroomsMax), onCommit: commit },
        { id: "area-min", control: "number", label: `${options.t("rangeArea")} · ${options.t("rangeFrom")}`, value: areaMin.value, min: 0, onUpdate: update(areaMin), onCommit: commit },
        { id: "area-max", control: "number", label: `${options.t("rangeArea")} · ${options.t("rangeTo")}`, value: areaMax.value, min: 0, onUpdate: update(areaMax), onCommit: commit },
        { id: "sqm-min", control: "number", label: `${options.t("rangePricePerSqm")} · ${options.t("rangeFrom")}`, value: pricePerSqmMin.value, min: 0, inputmode: "numeric", onUpdate: update(pricePerSqmMin), onCommit: commit },
        { id: "sqm-max", control: "number", label: `${options.t("rangePricePerSqm")} · ${options.t("rangeTo")}`, value: pricePerSqmMax.value, min: 0, inputmode: "numeric", onUpdate: update(pricePerSqmMax), onCommit: commit },
      ],
    },
    {
      id: "building", title: options.t("groupBuilding"), icon: "i-lucide-building-2",
      fields: [
        { id: "floor-min", control: "number", label: `${options.t("rangeFloor")} · ${options.t("rangeFrom")}`, value: floorMin.value, min: 0, onUpdate: update(floorMin), onCommit: commit },
        { id: "floor-max", control: "number", label: `${options.t("rangeFloor")} · ${options.t("rangeTo")}`, value: floorMax.value, min: 0, onUpdate: update(floorMax), onCommit: commit },
        { id: "total-floors-min", control: "number", label: `${options.t("rangeTotalFloors")} · ${options.t("rangeFrom")}`, value: totalFloorsMin.value, min: 1, onUpdate: update(totalFloorsMin), onCommit: commit },
        { id: "total-floors-max", control: "number", label: `${options.t("rangeTotalFloors")} · ${options.t("rangeTo")}`, value: totalFloorsMax.value, min: 1, onUpdate: update(totalFloorsMax), onCommit: commit },
        { id: "year-min", control: "number", label: `${options.t("rangeYear")} · ${options.t("rangeFrom")}`, value: yearMin.value, min: 1800, max: new Date().getFullYear() + 2, onUpdate: update(yearMin), onCommit: commit },
        { id: "year-max", control: "number", label: `${options.t("rangeYear")} · ${options.t("rangeTo")}`, value: yearMax.value, min: 1800, max: new Date().getFullYear() + 2, onUpdate: update(yearMax), onCommit: commit },
      ],
    },
    {
      id: "listing", title: options.t("groupListing"), icon: "i-lucide-megaphone", gridClass: "flat-filter-grid_single",
      fields: [
        { id: "audience", control: "select", label: options.t("audience"), value: audience.value, options: options.audienceItems.value, searchable: false, onUpdate: update(audience), onCommit: commit },
        { id: "property-type", control: "select", label: options.t("propertyType"), value: propertyType.value, options: options.propertyTypeItems.value, searchable: false, onUpdate: update(propertyType), onCommit: commit },
        { id: "fresh-days", control: "number", label: options.t("freshDays"), value: maxAgeDays.value, min: 1, max: 21, onUpdate: update(maxAgeDays), onCommit: commit },
      ],
    },
  ]);
}
