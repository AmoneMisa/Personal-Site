import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("flat details modal keeps public ID title and 960px width", async () => {
  const source = await read("app/components/search/SearchDetailsModal.vue");
  const modal = await read("app/components/U/Modal.vue");
  const page = await read("app/pages/flat-finder/index.vue");
  assert.match(source, /#\{\{ displayPublicId \}\}/);
  assert.match(source, /activeFlatListing\.value\?\.publicId \?\? props\.publicId/);
  assert.match(source, /flatListing\?: FlatListing \| null/);
  assert.match(source, /props\.flatListing/);
  assert.doesNotMatch(source, /flats:latest-recent:v1/);
  assert.match(page, /:flat-listing="active"/);
  assert.match(page, /publicId: verified\.publicId \?\? active\.value\.publicId/);
  assert.match(source, /publicId\?: number \| string \| null/);
  assert.match(source, /class="search-details-public-title__id"/);
  assert.match(source, /\.search-details-public-title__id \{[\s\S]*?color: #fff/);
  assert.doesNotMatch(source, /flatPriceTone|public-title__id_(?:green|blue|pink|orange|yellow|red)/);
  assert.match(source, /:max-width="isSearchBoard \? '960px' : undefined"/);
  assert.match(modal, /class="u-modal__heading"/);
  assert.match(modal, /\.u-modal__heading \{ flex: 1 1 auto; min-width: 0; \}/);
  assert.match(modal, /margin-left: auto/);
  assert.doesNotMatch(source, /max-w-\[960px\]/);
});

test("flat spec table does not parse listing description on the client", async () => {
  const source = await read("app/components/ui/SpecTable.vue");
  assert.doesNotMatch(source, /parsedBedrooms|parsedBathrooms|parsedArea|parsedFloor|parsedFirstRental|parsedCadastral|clientPotentiallyUnsafe/);
  assert.doesNotMatch(source, /listing\.description/);
  assert.match(source, /listing\.firstRental/);
  assert.match(source, /listing\.cadastral/);
  assert.match(source, /listing\.potentiallyUnsafe/);
});

test("flat specs use three independent, logically grouped columns through 960px", async () => {
  const source = await read("app/components/ui/SpecTable.vue");
  const page = await read("app/pages/flat-finder/index.vue");
  const fallback = await read("app/assets/css/flat-placeholder.css");
  assert.match(source, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(source, /align-items: start/);
  assert.match(source, /class="spec-table__column"/);
  assert.match(source, /class="spec-table__section"/);
  assert.match(source, /row\.group && row\.column/);
  assert.match(source, /const columns: Array<Array</);
  assert.match(page, /advert: 1/);
  assert.match(page, /property: 1/);
  assert.match(page, /location: 2/);
  assert.match(page, /amenities: 2/);
  assert.match(page, /terms: 3/);
  assert.match(page, /costs: 3/);
  assert.match(page, /row\("property", t\("specRooms"\)/);
  assert.match(page, /row\("location", t\("specCity"\)/);
  assert.match(page, /row\("amenities", t\("specParking"\)/);
  assert.match(page, /row\("terms", t\("specPets"\)/);
  assert.match(page, /row\("costs", t\("specDeposit"\)/);
  assert.doesNotMatch(source, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(fallback, /@media \(min-width: 721px\) and \(max-width: 960px\)/);
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

test("full-screen photo zoom is click-driven", async () => {
  const source = await read("app/components/flats/FlatGallery.vue");
  assert.match(source, /@click\.stop="toggleZoom"/);
  assert.match(source, /flat-lightbox__image_zoomed/);
  assert.match(source, /function toggleZoom\(event: MouseEvent\)/);
  assert.match(source, /@pointermove="onPointerMove"/);
  assert.match(source, /setPointerCapture\(event\.pointerId\)/);
  assert.match(source, /function clampPan\(\)/);
  assert.match(source, /translate3d\(\$\{pan\.x\}px, \$\{pan\.y\}px, 0\) scale\(\$\{zoom\}\)/);
});

test("flat price and empty-field toggle share the specification header row", async () => {
  const page = await read("app/pages/flat-finder/index.vue");
  const specs = await read("app/components/ui/SpecTable.vue");
  assert.match(page, /<UiSpecTable[^>]*><template #header><div class="flat-modal__price">/);
  assert.match(specs, /class="spec-table__head"/);
  assert.match(specs, /<slot name="header" \/>/);
  assert.match(specs, /class="spec-table__toggle"/);
});

test("flat description translation remains wired to the AI worker", async () => {
  const compose = await read("docker-compose.yml");
  const translation = await read("app/composables/flats/useFlatTranslation.ts");
  const route = await read("server/routes/flats-translate.post.ts");
  assert.match(compose, /AI_WORKER_URL: \$\{AI_WORKER_URL:-http:\/\/ai-worker:4030\}/);
  assert.match(compose, /- ai-net/);
  assert.match(translation, /safeFetch<FlatTranslationResult>\("\/flats-translate"/);
  assert.match(route, /requestAiWorker<TranslationResponse>\('\/ai\/extract'/);
  assert.match(route, /kind: 'translation'/);
});
