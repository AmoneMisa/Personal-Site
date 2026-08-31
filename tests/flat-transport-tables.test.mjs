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
  const table = await read("app/components/flats/FlatTransportTable.vue");

  assert.match(group, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(group, /@media \(max-width: 768px\)[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(group, /overflow-y:\s*(?:auto|scroll)/);
  assert.doesNotMatch(table, /overflow-y:\s*(?:auto|scroll)/);
});

test("dynamic transport icons stay in the offline Nuxt icon bundle", async () => {
  const config = await read("nuxt.config.ts");
  for (const icon of ["lucide:tram-front", "lucide:bus-front", "lucide:bus"]) {
    assert.match(config, new RegExp(icon.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
