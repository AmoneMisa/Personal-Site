import type { LocationQuery, Router } from "vue-router";
import type { useFlatFilters } from "~/composables/flats/useFlatFilters";
import type { FlatSort } from "~/types/flats";
import { queryBoolean, queryString } from "~/utils/queryParams";
import { useSearchRouteState } from "../search/useSearchRouteState";

const FLAT_SORTS: FlatSort[] = ["newest", "oldest", "priceAsc", "priceDesc", "titleAsc", "titleDesc"];
const SOCIAL_FLAT_SOURCES = ["facebook", "threads"];

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
      countries, city, district, microdistrict, quartal, mapArea, metro, propertyType, dealType, agency, audience,
      petFriendly, roomOnlyFilter, onlyWithPhotos, childrenRequired, newBuildingOnly,
      dishwasherOnly, airConditionerOnly, parkingOnly, internetOnly, gasOnly, balconyOnly,
      terraceOnly, privateYardOnly, noElevatorOnly, noDepositOnly, communalIncludedOnly, noCommissionOnly,
      tvOnly, microwaveOnly, ovenOnly, bidetOnly, walkInClosetOnly, bathtubOnly, showerOnly, euroLayoutOnly,
      commissionPercentMin, commissionPercentMax, sort, priceMin, priceMax, displayCurrency, roomsMin,
      roomsMax, bedroomsMin, bedroomsMax, areaMin, areaMax, pricePerSqmMin, pricePerSqmMax,
      metroMaxM, nearbyKind, nearbyMaxM, floorMin, floorMax, totalFloorsMin, totalFloorsMax,
      yearMin, yearMax, maxAgeDays, query, source,
    } = filters;
    if (countries.value.length) q.countries = countries.value[0]!;
    if (city.value) q.city = city.value;
    if (district.value) q.district = district.value;
    if (microdistrict.value) q.microdistrict = microdistrict.value;
    if (quartal.value) q.quartal = quartal.value;
    if (mapArea.value) q.area = mapArea.value;
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
    if (noElevatorOnly.value) q.noElevator = "1";
    if (noDepositOnly.value) q.noDeposit = "1";
    if (communalIncludedOnly.value) q.communalIncluded = "1";
    if (tvOnly.value) q.tv = "1";
    if (microwaveOnly.value) q.microwave = "1";
    if (ovenOnly.value) q.oven = "1";
    if (bidetOnly.value) q.bidet = "1";
    if (walkInClosetOnly.value) q.walkInCloset = "1";
    if (bathtubOnly.value) q.bathtub = "1";
    if (showerOnly.value) q.shower = "1";
    if (euroLayoutOnly.value) q.euroLayout = "1";
    if (noCommissionOnly.value) q.noCommission = "1";
    if (sort.value !== "newest") q.sort = sort.value;
    for (const [key, value] of Object.entries({ priceMin: priceMin.value, priceMax: priceMax.value, roomsMin: roomsMin.value, roomsMax: roomsMax.value, bedroomsMin: bedroomsMin.value, bedroomsMax: bedroomsMax.value, areaMin: areaMin.value, areaMax: areaMax.value, pricePerSqmMin: pricePerSqmMin.value, pricePerSqmMax: pricePerSqmMax.value, metroMaxM: metroMaxM.value, nearbyMaxM: nearbyMaxM.value, floorMin: floorMin.value, floorMax: floorMax.value, totalFloorsMin: totalFloorsMin.value, totalFloorsMax: totalFloorsMax.value, yearMin: yearMin.value, yearMax: yearMax.value, maxAgeDays: maxAgeDays.value, commissionPercentMin: commissionPercentMin.value, commissionPercentMax: commissionPercentMax.value })) {
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
    if (countryParam) filters.countries.value = [countryParam.split(",").find(Boolean) || countryParam];
    filters.city.value = queryString(params.city);
    filters.district.value = queryString(params.district);
    filters.microdistrict.value = queryString(params.microdistrict);
    filters.quartal.value = queryString(params.quartal);
    filters.mapArea.value = queryString(params.area);
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
    filters.noElevatorOnly.value = queryBoolean(params.noElevator);
    filters.noDepositOnly.value = queryBoolean(params.noDeposit);
    filters.communalIncludedOnly.value = queryBoolean(params.communalIncluded);
    filters.tvOnly.value = queryBoolean(params.tv);
    filters.microwaveOnly.value = queryBoolean(params.microwave);
    filters.ovenOnly.value = queryBoolean(params.oven);
    filters.bidetOnly.value = queryBoolean(params.bidet);
    filters.walkInClosetOnly.value = queryBoolean(params.walkInCloset);
    filters.bathtubOnly.value = queryBoolean(params.bathtub);
    filters.showerOnly.value = queryBoolean(params.shower);
    filters.euroLayoutOnly.value = queryBoolean(params.euroLayout);
    filters.noCommissionOnly.value = queryBoolean(params.noCommission);
    const sortParam = queryString(params.sort) as FlatSort;
    filters.sort.value = FLAT_SORTS.includes(sortParam) ? sortParam : "newest";
    for (const key of ["priceMin", "priceMax", "roomsMin", "roomsMax", "bedroomsMin", "bedroomsMax", "areaMin", "areaMax", "pricePerSqmMin", "pricePerSqmMax", "metroMaxM", "nearbyMaxM", "floorMin", "floorMax", "totalFloorsMin", "totalFloorsMax", "yearMin", "yearMax", "maxAgeDays", "commissionPercentMin", "commissionPercentMax"] as const) {
      filters[key].value = Number(queryString(params[key])) || undefined;
    }
    if (queryString(params.currency)) filters.displayCurrency.value = queryString(params.currency);
    filters.nearbyKind.value = queryString(params.nearbyKind);
    filters.query.value = queryString(params.query);
    const sourceParam = queryString(params.sources);
    const allowedSources = new Set([...options.sources, ...SOCIAL_FLAT_SOURCES]);
    filters.source.value = allowedSources.has(sourceParam) ? sourceParam : "";
  }

  const routeState = useSearchRouteState({
    router: options.router,
    serialize,
    deserialize,
    preserve: () => {
      const preserved: Record<string, string> = {};
      for (const key of ["adv", "flat", "flatSource", "flatCountry", "page"] as const) {
        const value = queryString(options.route.query[key]);
        if (value) preserved[key] = value;
      }
      return preserved;
    },
    debounceMs: 200,
  });

  return { ...routeState, serialize, deserialize };
}
