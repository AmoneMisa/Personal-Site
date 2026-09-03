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

test("a selection hides the other stations' rings, not the stations", () => {
  // Drawing only the chosen ones would leave no way to add a second station
  // by clicking the map; it was the overlapping rings that made it
  // unreadable, so only those go.
  assert.match(mapSource, /for \(const station of stations\)/);
  assert.match(mapSource, /if \(!anyChosen\) renderMetroPresetRings\(station\)/);
  assert.match(mapSource, /anyChosen && !stationSelected \? 0\.45 : 1/);
});

test("station dots carry a touch-sized hit target", () => {
  // A 6px circleMarker is a 6px click target; the invisible disc under it
  // is what actually takes the click.
  assert.match(mapSource, /const METRO_MARKER_HIT_RADIUS = 14/);
  assert.match(mapSource, /radius: METRO_MARKER_HIT_RADIUS,\s+opacity: 0,\s+fillOpacity: 0,/);
  assert.match(mapSource, /hitTarget\.on\("click", select\)/);
});

test("the map can be framed back onto the results by hand", () => {
  assert.match(mapSource, /function fitToPointsNow\(\)/);
  // Must override the guards the automatic fit uses, or the button would
  // silently do nothing in exactly the cases it is needed.
  assert.match(mapSource, /lastFitSig = "";/);
  assert.match(mapSource, /@click="fitToPointsNow"/);
});

test("selected geography keeps its label visible until the second click", () => {
  assert.match(mapSource, /shape\.openTooltip\?\.\(\)/);
  assert.match(mapSource, /circle\.openTooltip\?\.\(\)/);
  assert.match(mapSource, /if \(stationSelected\) marker\.openTooltip\?\.\(\)/);
});
