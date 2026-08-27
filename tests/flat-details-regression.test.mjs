import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("flat details modal keeps public ID title and 960px width", async () => {
  const source = await read("app/components/search/SearchDetailsModal.vue");
  assert.match(source, /#\{\{ flatPublicId \}\}/);
  assert.match(source, /flatPriceTone/);
  assert.match(source, /max-w-\[960px\]/);
});

test("flat spec table does not parse listing description on the client", async () => {
  const source = await read("app/components/ui/SpecTable.vue");
  assert.doesNotMatch(source, /parsedBedrooms|parsedBathrooms|parsedArea|parsedFloor|parsedFirstRental|parsedCadastral|clientPotentiallyUnsafe/);
  assert.doesNotMatch(source, /listing\.description/);
  assert.match(source, /listing\.firstRental/);
  assert.match(source, /listing\.cadastral/);
  assert.match(source, /listing\.potentiallyUnsafe/);
});

test("flat spec grid uses three columns through 960px", async () => {
  const source = await read("app/assets/css/flat-placeholder.css");
  assert.match(source, /@media \(min-width: 721px\) and \(max-width: 960px\)/);
  assert.match(source, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
});

test("dynamic flat spec icons are bundled without Iconify runtime", async () => {
  const config = await read("nuxt.config.ts");
  for (const icon of [
    "lucide:shield-check",
    "lucide:receipt-text",
    "lucide:calendar-range",
    "lucide:calendar-check",
    "lucide:key-round",
    "lucide:file-check-2",
  ]) {
    assert.match(config, new RegExp(icon.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("frontend has an internal AI worker route for translation", async () => {
  const compose = await read("docker-compose.yml");
  assert.match(compose, /AI_WORKER_URL: \$\{AI_WORKER_URL:-http:\/\/ai-worker:4030\}/);
  assert.match(compose, /- ai-net/);
});
