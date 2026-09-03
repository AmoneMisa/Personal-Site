import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/composables/flats/useFlatFilters.ts", import.meta.url), "utf8");

function functionBody(name) {
  const match = source.match(new RegExp(`function ${name}\\(\\) \\{([\\s\\S]*?)\\n  \\}`));
  assert.ok(match, `${name} must exist`);
  return match[1];
}

test("country and city changes clear only location-scoped filters", () => {
  const locationReset = functionBody("clearCityLocationFilters");
  const mapZoneReset = functionBody("clearMapZones");

  for (const pattern of [
    /district\.value = ""/,
    /metro\.value = \[\]/,
    /metroMaxM\.value = undefined/,
    /metroBearingFrom\.value = undefined/,
    /metroBearingTo\.value = undefined/,
    /nearbyKind\.value = ""/,
    /nearbyMaxM\.value = undefined/,
    /query\.value = ""/,
  ]) assert.match(locationReset, pattern);

  for (const pattern of [
    /microdistrict\.value = ""/,
    /quartal\.value = ""/,
    /mapArea\.value = ""/,
  ]) assert.match(mapZoneReset, pattern);

  assert.match(source, /watch\(selectedCountries, clearCityLocationFilters, \{ flush: "sync" \}\)/);
  assert.match(source, /watch\(city, clearCityLocationFilters, \{ flush: "sync" \}\)/);
  assert.match(source, /watch\(selectedCountries, clearMapZones, \{ flush: "sync" \}\)/);
  assert.match(source, /watch\(city, clearMapZones, \{ flush: "sync" \}\)/);
});

test("portable filters survive a city or country change", () => {
  const locationReset = functionBody("clearCityLocationFilters");
  const mapZoneReset = functionBody("clearMapZones");
  const resetCode = `${locationReset}\n${mapZoneReset}`;

  for (const portable of [
    "propertyType",
    "dealType",
    "agency",
    "audience",
    "petFriendly",
    "roomOnlyFilter",
    "onlyWithPhotos",
    "childrenRequired",
    "newBuildingOnly",
    "dishwasherOnly",
    "airConditionerOnly",
    "parkingOnly",
    "internetOnly",
    "gasOnly",
    "balconyOnly",
    "terraceOnly",
    "privateYardOnly",
    "noElevatorOnly",
    "noDepositOnly",
    "communalIncludedOnly",
    "noCommissionOnly",
    "tvOnly",
    "microwaveOnly",
    "ovenOnly",
    "bidetOnly",
    "walkInClosetOnly",
    "bathtubOnly",
    "showerOnly",
    "euroLayoutOnly",
    "commissionPercentMin",
    "commissionPercentMax",
    "sort",
    "priceMin",
    "priceMax",
    "displayCurrency",
    "roomsMin",
    "roomsMax",
    "bedroomsMin",
    "bedroomsMax",
    "areaMin",
    "areaMax",
    "pricePerSqmMin",
    "pricePerSqmMax",
    "floorMin",
    "floorMax",
    "totalFloorsMin",
    "totalFloorsMax",
    "yearMin",
    "yearMax",
    "maxAgeDays",
    "source",
  ]) {
    assert.doesNotMatch(resetCode, new RegExp(`\\b${portable}\\.value\\s*=`), `${portable} must survive location changes`);
  }
});
