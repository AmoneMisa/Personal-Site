import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mapSource = await readFile(new URL("../app/components/flats/FlatMap.client.vue", import.meta.url), "utf8");
const pageSource = await readFile(new URL("../app/pages/flat-finder/index.vue", import.meta.url), "utf8");

test("map selection is controlled by the same filter state as the selects", () => {
  assert.match(mapSource, /selectedMetro\?: string/);
  assert.match(mapSource, /selectedMetroRadiusM\?: number/);
  assert.match(mapSource, /function syncSelectionFromProps\(focus = false\)/);
  assert.match(pageSource, /:selected-metro="metro"/);
  assert.match(pageSource, /:selected-metro-radius-m="metroMaxM"/);
});

test("metro rings select an exact station and radius and can toggle off", () => {
  assert.match(mapSource, /emitZoneSelect\("metro", nearest\.name, radius\)/);
  assert.match(mapSource, /const sameZone = isZoneSelected\(kind, name\)/);
  assert.match(mapSource, /const nextName = sameZone && sameRadius \? "" : name/);
  assert.match(pageSource, /if \(!name\) metroMaxM\.value = undefined/);
});

test("selected geography keeps its label visible until the second click", () => {
  assert.match(mapSource, /shape\.openTooltip\?\.\(\)/);
  assert.match(mapSource, /circle\.openTooltip\?\.\(\)/);
  assert.match(mapSource, /if \(stationSelected\) marker\.openTooltip\?\.\(\)/);
});
