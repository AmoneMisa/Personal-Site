import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mapSource = await readFile(new URL("../app/components/flats/FlatMap.client.vue", import.meta.url), "utf8");
const pageSource = await readFile(new URL("../app/pages/flat-finder/index.vue", import.meta.url), "utf8");

test("map selection is controlled by the same filter state as the selects", () => {
  // Metro is the one multi-select kind; the rest stay single-valued.
  assert.match(mapSource, /selectedMetros\?: string\[\]/);
  assert.match(mapSource, /selectedMetroRadiusM\?: number/);
  assert.match(mapSource, /metroBearingFrom\?: number/);
  assert.match(mapSource, /metroBearingTo\?: number/);
  assert.match(mapSource, /function syncSelectionFromProps\(focus = false\)/);
  assert.match(pageSource, /:selected-metros="metro"/);
  assert.match(pageSource, /:selected-metro-radius-m="metroMaxM"/);
  assert.match(pageSource, /:metro-bearing-from="metroBearingFrom"/);
  assert.match(pageSource, /:metro-bearing-to="metroBearingTo"/);
});

test("clicking a station toggles it, and the last one out clears the shape", () => {
  assert.match(mapSource, /emit\("metro-toggle", station\.name\)/);
  assert.match(mapSource, /const sameZone = isZoneSelected\(kind, name\)/);
  assert.match(pageSource, /metro\.value\.includes\(name\)/);
  // A radius and an arc only mean something relative to a station.
  assert.match(pageSource, /if \(!next\.length\) \{/);
  assert.match(pageSource, /metroMaxM\.value = undefined;/);
});

test("the radius and arc handles report one settled shape per drag", () => {
  assert.match(mapSource, /handle\.on\("dragend"/);
  assert.match(mapSource, /emit\("metro-shape", \{/);
  assert.match(mapSource, /draftRadiusM\.value = null;/);
  // Dragging must not wait on the parent or the feed to redraw.
  assert.match(mapSource, /function refreshMetroShape\(\)/);
  assert.match(pageSource, /function onMetroShape\(/);
});

test("metro keeps all station badges visible without duplicate preset rings", () => {
  assert.match(mapSource, /for \(const station of stations\)/);
  assert.doesNotMatch(mapSource, /METRO_PRESET_RINGS|renderMetroPresetRings/u);
  assert.match(mapSource, /flat-metro-marker_dim/u);
  assert.match(mapSource, />M<\/span>/u);
  assert.match(mapSource, /lineColors/u);
  assert.match(mapSource, /conic-gradient/u);
});

test("station badges carry a touch-sized hit target", () => {
  assert.match(mapSource, /const METRO_MARKER_HIT_RADIUS = 16/);
  assert.match(mapSource, /radius: METRO_MARKER_HIT_RADIUS, opacity: 0, fillOpacity: 0,/);
  assert.match(mapSource, /hitTarget\.on\("click", select\)/);
});

test("redundant frame-results map action is not rendered", () => {
  assert.doesNotMatch(mapSource, /function fitToPointsNow\(\)/);
  assert.doesNotMatch(mapSource, /@click="fitToPointsNow"/);
  // Automatic framing remains for new result sets.
  assert.match(mapSource, /function fitToPoints\(\)/);
});

test("selected geography keeps its label visible until the second click", () => {
  assert.match(mapSource, /shape\.openTooltip\?\.\(\)/);
  assert.match(mapSource, /circle\.openTooltip\?\.\(\)/);
  assert.match(mapSource, /if \(stationSelected\) marker\.openTooltip\?\.\(\)/);
});
