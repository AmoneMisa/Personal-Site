import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/components/flats/FlatMap.client.vue", import.meta.url), "utf8");

test("map overlays reserve a safe band below the top controls", () => {
  assert.match(source, /flat-map__scroll-hint[^}]*top: 56px/u);
  assert.match(source, /flat-map__district-card[^}]*top: 62px/u);
  assert.match(source, /@media \(max-width: 1024px\)/u);
  assert.match(source, /flat-map__menu \{[\s\S]*position: fixed;[\s\S]*top: max\(52px/u);
});

test("compact breakpoints never expand toolbar labels over map text", () => {
  assert.match(source, /@media \(max-width: 1024px\)[\s\S]*flat-map__tool-label[\s\S]*max-width: 0;[\s\S]*opacity: 0;/u);
  assert.match(source, /@include bp-down\(sm\)[\s\S]*flat-map__scroll-hint[\s\S]*max-width: calc\(100% - 24px\)/u);
});

test("map toolbar keeps territories, transport, POI and selection as distinct concerns", () => {
  assert.match(source, /ui\.administrative[\s\S]*ui\.regions[\s\S]*ui\.districts/u);
  assert.match(source, /ui\.local[\s\S]*ui\.microdistricts[\s\S]*ui\.mahallas[\s\S]*ui\.quarters/u);
  assert.match(source, /ui\.other[\s\S]*ui\.zones/u);
  assert.match(source, /mode: 'funicular'/u);
  assert.match(source, /props\.drawLabel[\s\S]*@click="toggleDrawing"/u);
});

test("POI radius and residential-complex presentation follow the design contract", () => {
  assert.match(source, /type="range"[\s\S]*type="number"/u);
  assert.match(source, /residentialStatsByName/u);
  assert.match(source, /iconKind === "building"/u);
  assert.match(source, /residenceComplex/u);
});
