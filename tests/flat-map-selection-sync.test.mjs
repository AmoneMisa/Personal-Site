import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mapSource = await readFile(new URL("../app/components/flats/FlatMap.client.vue", import.meta.url), "utf8");
const pageSource = await readFile(new URL("../app/pages/flat-finder/index.vue", import.meta.url), "utf8");

test("map selection is controlled by the same filter state as the selects", () => {
  assert.match(mapSource, /selectedMetros\?: string\[\]/);
  assert.match(mapSource, /selectedMetroRadiusM\?: number/);
  assert.match(mapSource, /metroBearingFrom\?: number/);
  assert.match(mapSource, /metroBearingTo\?: number/);
  assert.match(mapSource, /function syncSelectionFromProps\(focus = false\)/);
  assert.match(pageSource, /:selected-metros="metro"/);
  assert.match(pageSource, /:selected-metro-radius-m="metroMaxM"/);
});

test("clicking a station toggles it, and the last one out clears the shape", () => {
  assert.match(mapSource, /emit\("metro-toggle", station\.name\)/);
  assert.match(pageSource, /metro\.value\.includes\(name\)/);
  assert.match(pageSource, /if \(!next\.length\) \{/);
  assert.match(pageSource, /metroMaxM\.value = undefined;/);
});

test("the radius and arc handles report one settled shape per drag", () => {
  assert.match(mapSource, /handle\.on\("dragend"/);
  assert.match(mapSource, /emit\("metro-shape", \{/);
  assert.match(mapSource, /draftRadiusM\.value = null;/);
  assert.match(mapSource, /function refreshMetroShape\(\)/);
  assert.match(pageSource, /function onMetroShape\(/);
});

test("a metro selection removes overlapping discovery rings but keeps every station tappable", () => {
  assert.doesNotMatch(mapSource, /renderMetroPresetRings/);
  assert.match(mapSource, /for \(const station of stations\)/);
  assert.match(mapSource, /anyChosen && !stationSelected \? " flat-metro-marker_dim" : ""/);
  assert.match(mapSource, /marker\.on\("click", select\)/);
});

test("station dots carry a touch-sized hit target", () => {
  const hit = mapSource.match(/const METRO_MARKER_HIT_RADIUS = (\d+)/);
  assert.ok(hit);
  assert.ok(Number(hit[1]) >= 14);
  assert.match(mapSource, /radius: METRO_MARKER_HIT_RADIUS, opacity: 0, fillOpacity: 0/);
  assert.match(mapSource, /hitTarget\.on\("click", select\)/);
});

test("the map can be framed back onto the results by hand", () => {
  assert.match(mapSource, /function fitToPointsNow\(\)/);
  assert.match(mapSource, /lastFitSig = "";/);
  assert.match(mapSource, /@click="fitToPointsNow"/);
});

test("selected geography keeps its label visible until the second click", () => {
  assert.match(mapSource, /shape\.openTooltip\?\.\(\)/);
  assert.match(mapSource, /circle\.openTooltip\?\.\(\)/);
  assert.match(mapSource, /if \(stationSelected\) marker\.openTooltip\?\.\(\)/);
});
