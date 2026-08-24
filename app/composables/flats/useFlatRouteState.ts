import type { LocationQuery, Router } from "vue-router";
import type { useFlatFilters } from "~/composables/flats/useFlatFilters";
import type { FlatSort } from "~/types/flats";
import { queryBoolean, queryString } from "~/utils/queryParams";
import { useSearchRouteState } from "../search/useSearchRouteState";

const FLAT_SORTS: FlatSort[] = ["newest", "oldest", "priceAsc", "priceDesc", "titleAsc", "titleDesc"];

export function useFlatRouteState(options: {
  router: Router;
  route: { query: LocationQuery };
  filters: ReturnType<typeof useFlatFilters>;
  sources: readonly string[];
}) {
  const filters = options.filters;

  function serialize(): Record<string, string> {
    const q: Record<string, string> = {};
    const {
      countries, city, district, metro, propertyType, dealType, agency, audience,
      petFriendly, roomOnlyFilter, onlyWithPhotos, childrenRequired, newBuildingOnly,
      dishwasherOnly, airConditionerOnly, parkingOnly, internetOnly, gasOnly, balconyOnly,
      terraceOnly, privateYardOnly, sort, priceMin, priceMax, displayCurrency, roomsMin,
      roomsMax, bedroomsMin, bedroomsMax, areaMin, areaMax, pricePerSqmMin, pricePerSqmMax,
      metroMaxM, nearbyKind, nearbyMaxM, floorMin, floorMax, totalFloorsMin, totalFloorsMax,
      yearMin, yearMax, maxAgeDays, query, source,
    } = filters;
    if (countries.value.length) q.countries = countries.value.join(",");
    if (city.value) q.city = city.value;
    if (district.value) q.district = district.value;
    if (metro.value) q.metro = metro.value;
    if (propertyType.value !== "any") q.propertyType = propertyType.value;
    if (dealType.value !== "any") q.dealType = dealType.value;
    if (agency.value !== "any") q.agency = agency.value;
    if (audience.value !== "any") q.audience = audience.value;
    if (petFriendly.value) q.pets = "1";
    if (roomOnlyFilter.value) q.roomOnly = "1";
    if (onlyWithPhotos.value) q.withPhotos = "1";
    if (childrenRequired.value) q.children = "1";
    if (newBuildingOnly.value) q.newBuilding = "1";
    if (dishwasherOnly.value) q.dishwasher = "1";
    if (airConditionerOnly.value) q.airConditioner = "1";
    if (parkingOnly.value) q.parking = "1";
    if (internetOnly.value) q.internet = "1";
    if (gasOnly.value) q.gas = "1";
    if (balconyOnly.value) q.balcony = "1";
    if (terraceOnly.value) q.terrace = "1";
    if (privateYardOnly.value) q.privateYard = "1";
    if (sort.value !== "newest") q.sort = sort.value;
    for (const [key, value] of Object.entries({ priceMin: priceMin.value, priceMax: priceMax.value, roomsMin: roomsMin.value, roomsMax: roomsMax.value, bedroomsMin: bedroomsMin.value, bedroomsMax: bedroomsMax.value, areaMin: areaMin.value, areaMax: areaMax.value, pricePerSqmMin: pricePerSqmMin.value, pricePerSqmMax: pricePerSqmMax.value, metroMaxM: metroMaxM.value, nearbyMaxM: nearbyMaxM.value, floorMin: floorMin.value, floorMax: floorMax.value, totalFloorsMin: totalFloorsMin.value, totalFloorsMax: totalFloorsMax.value, yearMin: yearMin.value, yearMax: yearMax.value, maxAgeDays: maxAgeDays.value })) {
      if (value != null) q[key] = String(value);
    }
    if (displayCurrency.value !== "USD") q.currency = displayCurrency.value;
    if (nearbyKind.value) q.nearbyKind = nearbyKind.value;
    if (query.value.trim()) q.query = query.value.trim();
    if (source.value) q.sources = source.value;
    return q;
  }

  function deserialize(params: LocationQuery | Record<string, unknown>) {
    const countryParam = queryString(params.countries);
    if (countryParam) filters.countries.value = countryParam.split(",").filter(Boolean);
    filters.city.value = queryString(params.city);
    filters.district.value = queryString(params.district);
    filters.propertyType.value = ["flat", "house"].includes(queryString(params.propertyType)) ? queryString(params.propertyType) : "any";
    filters.dealType.value = ["sale", "longRent", "roomRent", "shortRent"].includes(queryString(params.dealType)) ? queryString(params.dealType) : "any";
    filters.agency.value = ["owner", "agency"].includes(queryString(params.agency)) ? queryString(params.agency) : "any";
    filters.audience.value = ["women", "men", "family"].includes(queryString(params.audience)) ? queryString(params.audience) : "any";
    filters.metro.value = queryString(params.metro);
    filters.petFriendly.value = queryBoolean(params.pets);
    filters.roomOnlyFilter.value = queryBoolean(params.roomOnly);
    filters.onlyWithPhotos.value = queryBoolean(params.withPhotos);
    filters.childrenRequired.value = queryBoolean(params.children);
    filters.newBuildingOnly.value = queryBoolean(params.newBuilding);
    filters.dishwasherOnly.value = queryBoolean(params.dishwasher);
    filters.airConditionerOnly.value = queryBoolean(params.airConditioner);
    filters.parkingOnly.value = queryBoolean(params.parking);
    filters.internetOnly.value = queryBoolean(params.internet);
    filters.gasOnly.value = queryBoolean(params.gas);
    filters.balconyOnly.value = queryBoolean(params.balcony);
    filters.terraceOnly.value = queryBoolean(params.terrace);
    filters.privateYardOnly.value = queryBoolean(params.privateYard);
    const sortParam = queryString(params.sort) as FlatSort;
    filters.sort.value = FLAT_SORTS.includes(sortParam) ? sortParam : "newest";
    for (const key of ["priceMin", "priceMax", "roomsMin", "roomsMax", "bedroomsMin", "bedroomsMax", "areaMin", "areaMax", "pricePerSqmMin", "pricePerSqmMax", "metroMaxM", "nearbyMaxM", "floorMin", "floorMax", "totalFloorsMin", "totalFloorsMax", "yearMin", "yearMax", "maxAgeDays"] as const) {
      filters[key].value = Number(queryString(params[key])) || undefined;
    }
    if (queryString(params.currency)) filters.displayCurrency.value = queryString(params.currency);
    filters.nearbyKind.value = queryString(params.nearbyKind);
    filters.query.value = queryString(params.query);
    const sourceParam = queryString(params.sources);
    filters.source.value = options.sources.includes(sourceParam) ? sourceParam : "";
  }

  const routeState = useSearchRouteState({
    router: options.router,
    serialize,
    deserialize,
    preserve: () => {
      const preserved: Record<string, string> = {};
      for (const key of ["flat", "flatSource", "flatCountry"] as const) {
        const value = queryString(options.route.query[key]);
        if (value) preserved[key] = value;
      }
      return preserved;
    },
    debounceMs: 200,
  });

  return { ...routeState, serialize, deserialize };
}
