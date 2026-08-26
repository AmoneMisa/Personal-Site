import { ref, watch } from "vue";
import type { FlatSort } from "~/types/flats";

const SOCIAL_LISTING_SOURCES = ["facebook", "threads", "custom"];

export function useFlatFilters() {
  const countries = ref<string[]>([]);
  const city = ref("");
  const district = ref("");
  const propertyType = ref("any");
  const dealType = ref("any");
  const agency = ref("any");
  const petFriendly = ref(false);
  const roomOnlyFilter = ref(false);
  const onlyWithPhotos = ref(false);
  const childrenRequired = ref(false);
  const newBuildingOnly = ref(false);
  const dishwasherOnly = ref(false);
  const airConditionerOnly = ref(false);
  const parkingOnly = ref(false);
  const internetOnly = ref(false);
  const gasOnly = ref(false);
  const balconyOnly = ref(false);
  const terraceOnly = ref(false);
  const privateYardOnly = ref(false);
  const sort = ref<FlatSort>("newest");
  const audience = ref("any");
  const metro = ref("");
  const priceMin = ref<number>();
  const priceMax = ref<number>();
  const roomsMin = ref<number>();
  const roomsMax = ref<number>();
  const bedroomsMin = ref<number>();
  const bedroomsMax = ref<number>();
  const areaMin = ref<number>();
  const areaMax = ref<number>();
  const pricePerSqmMin = ref<number>();
  const pricePerSqmMax = ref<number>();
  const metroMaxM = ref<number>();
  const nearbyKind = ref("");
  const nearbyMaxM = ref<number>();
  const floorMin = ref<number>();
  const floorMax = ref<number>();
  const totalFloorsMin = ref<number>();
  const totalFloorsMax = ref<number>();
  const yearMin = ref<number>();
  const yearMax = ref<number>();
  const maxAgeDays = ref<number>();
  const displayCurrency = ref("USD");
  const query = ref("");
  const source = ref("");
  const showAdvanced = ref(false);

  watch(dealType, (value) => {
    if (value === "sale") {
      audience.value = "any";
      petFriendly.value = false;
      childrenRequired.value = false;
      roomOnlyFilter.value = false;
      return;
    }
    if (value === "longRent" || value === "shortRent" || value === "roomRent") {
      pricePerSqmMin.value = undefined;
      pricePerSqmMax.value = undefined;
    }
  });

  function buildFeedParams(options: {
    limit: number;
    append: boolean;
    loadedCount: number;
    nextCursor: string | null;
    sources: string[];
  }): Record<string, string> {
    const params: Record<string, string> = { limit: String(options.limit) };
    const cursorSort = sort.value === "newest" || sort.value === "oldest";
    const saleOnly = dealType.value === "sale";
    const rentOnly = dealType.value === "longRent" || dealType.value === "shortRent" || dealType.value === "roomRent";
    if (options.append && cursorSort && options.nextCursor) params.cursor = options.nextCursor;
    else params.offset = String(options.append ? options.loadedCount : 0);
    if (countries.value.length) params.countries = countries.value.join(",");
    if (city.value) params.city = city.value;
    if (district.value) params.district = district.value;
    if (propertyType.value !== "any") params.propertyType = propertyType.value;
    if (dealType.value !== "any") params.dealType = dealType.value === "roomRent" ? "longRent" : dealType.value;
    if (agency.value !== "any") params.agency = agency.value;
    if (priceMin.value != null) params.priceMin = String(priceMin.value);
    if (priceMax.value != null) params.priceMax = String(priceMax.value);
    if (priceMin.value != null || priceMax.value != null) params.priceCurrency = displayCurrency.value;
    if (roomsMin.value != null) params.roomsMin = String(roomsMin.value);
    if (roomsMax.value != null) params.roomsMax = String(roomsMax.value);
    if (bedroomsMin.value != null) params.bedroomsMin = String(bedroomsMin.value);
    if (bedroomsMax.value != null) params.bedroomsMax = String(bedroomsMax.value);
    if (areaMin.value != null) params.areaMin = String(areaMin.value);
    if (areaMax.value != null) params.areaMax = String(areaMax.value);
    if (!rentOnly && pricePerSqmMin.value != null) params.pricePerSqmMin = String(pricePerSqmMin.value);
    if (!rentOnly && pricePerSqmMax.value != null) params.pricePerSqmMax = String(pricePerSqmMax.value);
    if (metroMaxM.value != null) params.metroMaxM = String(metroMaxM.value);
    if (nearbyKind.value) params.nearbyKind = nearbyKind.value;
    if (nearbyMaxM.value != null) params.nearbyMaxM = String(nearbyMaxM.value);
    if (floorMin.value != null) params.floorMin = String(floorMin.value);
    if (floorMax.value != null) params.floorMax = String(floorMax.value);
    if (totalFloorsMin.value != null) params.totalFloorsMin = String(totalFloorsMin.value);
    if (totalFloorsMax.value != null) params.totalFloorsMax = String(totalFloorsMax.value);
    if (yearMin.value != null) params.yearMin = String(yearMin.value);
    if (yearMax.value != null) params.yearMax = String(yearMax.value);
    if (maxAgeDays.value != null) params.maxAgeDays = String(maxAgeDays.value);
    if (metro.value) params.metro = metro.value;
    if (!saleOnly && audience.value !== "any") params.audience = audience.value;
    if (!saleOnly && petFriendly.value) params.pets = "1";
    if (!saleOnly && (roomOnlyFilter.value || dealType.value === "roomRent")) params.roomOnly = "1";
    if (onlyWithPhotos.value) params.withPhotos = "1";
    if (!saleOnly && childrenRequired.value) params.children = "1";
    if (newBuildingOnly.value) params.newBuilding = "1";
    if (dishwasherOnly.value) params.dishwasher = "1";
    if (airConditionerOnly.value) params.airConditioner = "1";
    if (parkingOnly.value) params.parking = "1";
    if (internetOnly.value) params.internet = "1";
    if (gasOnly.value) params.gas = "1";
    if (balconyOnly.value) params.balcony = "1";
    if (terraceOnly.value) params.terrace = "1";
    if (privateYardOnly.value) params.privateYard = "1";
    params.sort = sort.value;
    if (query.value.trim()) params.query = query.value.trim();
    const defaultSources = [...new Set([...options.sources, ...SOCIAL_LISTING_SOURCES])];
    params.sources = source.value || defaultSources.join(",");
    if (!options.append) params.includeStats = "1";
    return params;
  }

  function resetValues(defaultCountry: string) {
    countries.value = [defaultCountry];
    city.value = "";
    district.value = "";
    metro.value = "";
    propertyType.value = "any";
    dealType.value = "any";
    agency.value = "any";
    audience.value = "any";
    petFriendly.value = false;
    roomOnlyFilter.value = false;
    onlyWithPhotos.value = false;
    childrenRequired.value = false;
    newBuildingOnly.value = false;
    dishwasherOnly.value = false;
    airConditionerOnly.value = false;
    parkingOnly.value = false;
    internetOnly.value = false;
    gasOnly.value = false;
    balconyOnly.value = false;
    terraceOnly.value = false;
    privateYardOnly.value = false;
    sort.value = "newest";
    priceMin.value = undefined;
    priceMax.value = undefined;
    displayCurrency.value = "USD";
    roomsMin.value = undefined;
    roomsMax.value = undefined;
    bedroomsMin.value = undefined;
    bedroomsMax.value = undefined;
    areaMin.value = undefined;
    areaMax.value = undefined;
    pricePerSqmMin.value = undefined;
    pricePerSqmMax.value = undefined;
    metroMaxM.value = undefined;
    nearbyKind.value = "";
    nearbyMaxM.value = undefined;
    floorMin.value = undefined;
    floorMax.value = undefined;
    totalFloorsMin.value = undefined;
    totalFloorsMax.value = undefined;
    yearMin.value = undefined;
    yearMax.value = undefined;
    maxAgeDays.value = undefined;
    query.value = "";
    source.value = "";
  }

  return {
    countries, city, district, propertyType, dealType, agency, petFriendly, roomOnlyFilter,
    onlyWithPhotos, childrenRequired, newBuildingOnly, dishwasherOnly, airConditionerOnly,
    parkingOnly, internetOnly, gasOnly, balconyOnly, terraceOnly, privateYardOnly, sort,
    audience, metro, priceMin, priceMax, roomsMin, roomsMax, bedroomsMin, bedroomsMax,
    areaMin, areaMax, pricePerSqmMin, pricePerSqmMax, metroMaxM, nearbyKind, nearbyMaxM,
    floorMin, floorMax, totalFloorsMin, totalFloorsMax, yearMin, yearMax, maxAgeDays,
    displayCurrency, query, source, showAdvanced, buildFeedParams, resetValues,
  };
}
