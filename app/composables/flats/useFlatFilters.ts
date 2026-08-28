import { computed, ref, watch } from "vue";
import { findGeoEntities, resolveLexiconGeoEntity } from "@whiteslove/geo-catalog";
import type { FlatSort } from "~/types/flats";

const SOCIAL_LISTING_SOURCES = ["facebook", "threads", "custom"];
const MAP_ZONE_TYPES = new Set(["microdistrict", "mahalla", "local_area", "development_area"]);

export function useFlatFilters() {
  const selectedCountries = ref<string[]>([]);
  // The backend still accepts a `countries` CSV for compatibility, but the housing
  // UI is intentionally single-country. Keep the public ref array-shaped so the
  // existing route/meta contracts do not need a parallel API, while rejecting the
  // multi-select state Nuxt UI can otherwise produce.
  const countries = computed<string[]>({
    get: () => selectedCountries.value,
    set: (values) => {
      const normalized = [...new Set((values || []).map((value) => String(value).trim().toUpperCase()).filter(Boolean))];
      if (!normalized.length) return;
      const current = selectedCountries.value[0];
      const next = normalized.find((value) => value !== current) || normalized[0];
      selectedCountries.value = [next];
    },
  });
  const city = ref("");
  const district = ref("");
  const microdistrict = ref("");
  const quartal = ref("");
  const mapArea = ref("");
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

  function clearMapZones() {
    microdistrict.value = "";
    quartal.value = "";
    mapArea.value = "";
  }

  // A structured map zone is scoped by country/city/district. Clear it synchronously
  // when that scope changes so the next request cannot combine a zone from the old
  // location with the new selection. Synchronous clearing also keeps route restore
  // deterministic: deserialize sets the scope first, then restores its zone value.
  watch(selectedCountries, clearMapZones, { flush: "sync" });
  watch(city, clearMapZones, { flush: "sync" });
  watch(district, clearMapZones, { flush: "sync" });

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

  // FlatMap emits canonical geo names. The page's legacy handler writes non-district
  // selections into the free-text query ref, so absorb exact catalog zone names here
  // and convert them into structured filters before a feed request is built. This also
  // keeps shared URLs explicit (`microdistrict=`, `quartal=`, `area=`) instead of
  // accidentally routing a map click through Elasticsearch/full-text search.
  watch(query, (value) => {
    const name = value.trim();
    const country = countries.value[0];
    if (!name || !country || !city.value) return;
    const cityEntity = resolveLexiconGeoEntity({ country, type: "city", canonical: city.value });
    if (!cityEntity) return;
    const match = findGeoEntities({ country }).find((entity) =>
      MAP_ZONE_TYPES.has(entity.type)
      && entity.canonicalName.toLocaleLowerCase() === name.toLocaleLowerCase()
      && (entity.parentId === cityEntity.id || entity.id.startsWith(`${cityEntity.id}:`)),
    );
    if (!match) return;

    clearMapZones();
    if (match.type === "microdistrict") microdistrict.value = match.canonicalName;
    else if (match.type === "mahalla") quartal.value = match.canonicalName;
    else mapArea.value = match.canonicalName;
    query.value = "";
  }, { flush: "sync" });

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
    if (countries.value.length) params.countries = countries.value[0]!;
    if (city.value) params.city = city.value;
    if (district.value) params.district = district.value;
    if (microdistrict.value) params.microdistrict = microdistrict.value;
    if (quartal.value) params.quartal = quartal.value;
    if (mapArea.value) params.area = mapArea.value;
    if (propertyType.value !== "any") params.propertyType = propertyType.value;
    if (dealType.value !== "any") params.dealType = dealType.value === "roomRent" ? "longRent" : dealType.value;
    if (agency.value !== "any") params.agency = agency.value;
    if (priceMin.value != null) params.priceMin = String(priceMin.value);
    if (priceMax.value != null) params.priceMax = String(priceMax.value);
    if (priceMin.value != null || priceMax.value != null) params.priceCurrency = displayCurrency.value;
    if (dealType.value !== "longRent" && roomsMin.value != null) params.roomsMin = String(roomsMin.value);
    if (dealType.value !== "longRent" && roomsMax.value != null) params.roomsMax = String(roomsMax.value);
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
    clearMapZones();
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
    countries, city, district, microdistrict, quartal, mapArea, propertyType, dealType, agency,
    petFriendly, roomOnlyFilter, onlyWithPhotos, childrenRequired, newBuildingOnly,
    dishwasherOnly, airConditionerOnly, parkingOnly, internetOnly, gasOnly, balconyOnly,
    terraceOnly, privateYardOnly, sort, audience, metro, priceMin, priceMax, roomsMin, roomsMax,
    bedroomsMin, bedroomsMax, areaMin, areaMax, pricePerSqmMin, pricePerSqmMax, metroMaxM,
    nearbyKind, nearbyMaxM, floorMin, floorMax, totalFloorsMin, totalFloorsMax, yearMin, yearMax,
    maxAgeDays, displayCurrency, query, source, showAdvanced, buildFeedParams, resetValues,
  };
}
