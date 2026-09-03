import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/composables/flats/useFlatFilters.ts", import.meta.url), "utf8");

test("structured map zones are cleared when their location scope changes", () => {
  assert.match(source, /function clearMapZones\(\)/);
  assert.match(source, /watch\(selectedCountries, clearMapZones, \{ flush: "sync" \}\)/);
  assert.match(source, /watch\(city, clearMapZones, \{ flush: "sync" \}\)/);
  assert.match(source, /watch\(district, clearMapZones, \{ flush: "sync" \}\)/);
});

test("city changes clear every city-scoped location filter before the next request", () => {
  assert.match(source, /function clearCityLocationFilters\(\)/);
  assert.match(source, /district\.value = ""/);
  assert.match(source, /metro\.value = \[\]/);
  assert.match(source, /metroMaxM\.value = undefined/);
  // The arc is scoped to the stations it is measured from.
  assert.match(source, /metroBearingFrom\.value = undefined/);
  assert.match(source, /metroBearingTo\.value = undefined/);
  assert.match(source, /nearbyKind\.value = ""/);
  assert.match(source, /nearbyMaxM\.value = undefined/);
  assert.match(source, /query\.value = ""/);
  assert.match(source, /watch\(selectedCountries, clearCityLocationFilters, \{ flush: "sync" \}\)/);
  assert.match(source, /watch\(city, clearCityLocationFilters, \{ flush: "sync" \}\)/);
});
