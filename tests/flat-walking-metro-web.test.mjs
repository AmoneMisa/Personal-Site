import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Flat Finder web DTO keeps pedestrian routing metrics", async () => {
  const types = await read("app/types/flats.ts");

  assert.match(types, /walkingDistanceM\?: number \| null/);
  assert.match(types, /walkingDurationMin\?: number \| null/);
  assert.match(types, /walkingSource\?: string \| null/);
  assert.match(types, /metroWalkingDistanceM\?: number \| null/);
  assert.match(types, /metroWalkingDurationMin\?: number \| null/);
});

test("Flat Finder details prefer walking metro distance and retain straight-line fallback", async () => {
  const page = await read("app/pages/flat-finder/index.vue");

  assert.match(page, /const metroSpecValue = \(listing: Listing\) =>/);
  assert.match(page, /const distance = listing\.metroWalkingDistanceM/);
  assert.match(page, /listing\.metroWalkingDurationMin/);
  assert.match(page, /`🚶 \$\{walkingDistanceLabel\(distance\)\}`/);
  assert.match(page, /row\("location", t\("specMetro"\), metroSpecValue\(l\)\)/);
  assert.match(page, /if \(stop\.walkingDistanceM != null\)/);
  assert.match(page, /return `\$\{stop\.name\}\$\{routes\} · \$\{Math\.round\(stop\.distanceM\)\} m`/);
});
