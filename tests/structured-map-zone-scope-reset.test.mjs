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
