import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("flat transport details are split into reusable mode tables", async () => {
  const group = await read("app/components/flats/FlatTransportTables.vue");
  const table = await read("app/components/flats/FlatTransportTable.vue");
  const specs = await read("app/components/ui/SpecTable.vue");

  assert.match(group, /mode: "bus"/);
  assert.match(group, /mode: "trolleybus"/);
  assert.match(group, /mode: "tram"/);
  assert.match(group, /<FlatTransportTable/);
  assert.match(table, /\.sort\(\(left, right\) =>/);
  assert.match(table, /stop\.routeRefs/);
  assert.match(table, /Math\.round\(distance\)/);

  assert.match(specs, /nearbyTransport\?: FlatTransportStop\[\]/);
  assert.match(specs, /<FlatTransportTables/);
  assert.match(specs, /flatTransportLabels\.value\.has\(row\.label\)/);
});

test("transport tables use three columns above 768px and two at 768px or below", async () => {
  const group = await read("app/components/flats/FlatTransportTables.vue");

  assert.match(group, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(group, /@media \(max-width: 768px\)[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
});

test("each transport mode shows at most six stop rows with a visible inner scrollbar", async () => {
  const table = await read("app/components/flats/FlatTransportTable.vue");

  assert.match(table, /orderedStops\.value\.length > 6/);
  assert.match(table, /--transport-row-height:\s*42px/);
  assert.match(table, /max-height:\s*calc\(var\(--transport-row-height\) \* 6\)/);
  assert.match(table, /flat-transport-table__rows--scrollable[\s\S]*overflow-y:\s*scroll/);
  assert.match(table, /scrollbar-width:\s*thin/);
  assert.match(table, /::-webkit-scrollbar-thumb/);
  assert.match(table, /overscroll-behavior:\s*contain/);
  assert.match(table, /height:\s*var\(--transport-row-height\)/);
});

test("dynamic transport icons stay in the offline Nuxt icon bundle", async () => {
  const config = await read("nuxt.config.ts");
  for (const icon of ["lucide:tram-front", "lucide:bus-front", "lucide:bus"]) {
    assert.match(config, new RegExp(icon.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
