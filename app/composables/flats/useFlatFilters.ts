import { ref } from "vue";
import type { FlatSort } from "~/types/flats";

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
    displayCurrency, query, source, showAdvanced, resetValues,
  };
}
