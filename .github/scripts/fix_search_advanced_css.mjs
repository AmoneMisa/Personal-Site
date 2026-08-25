import { readFile, writeFile } from "node:fs/promises";

const flatPath = "app/pages/flat-finder/index.vue";
let flat = await readFile(flatPath, "utf8");

const replacements = [
  [
    ".filter-card, .filter-card { padding: 16px; }",
    ".filter-card { padding: 16px; }",
  ],
  [
    ".advanced-card__header > div, .flats__filter-blocks { grid-template-columns: 1.15fr .95fr 1.1fr 1.1fr 1fr; gap: 0; padding: 16px; }",
    ".flats__filter-blocks { grid-template-columns: 1.15fr .95fr 1.1fr 1.1fr 1fr; gap: 0; padding: 16px; }",
  ],
  [
    "    .active-filter-chips { flex: 1 1 100%; }\n      .flats__filter-blocks { grid-template-columns: 1fr; padding: 14px 12px; gap: 0; }",
    "  .active-filter-chips { flex: 1 1 100%; }\n  .flats__filter-blocks { grid-template-columns: 1fr; padding: 14px 12px; gap: 0; }",
  ],
];

for (const [from, to] of replacements) {
  if (!flat.includes(from)) throw new Error(`Missing expected flat CSS fragment: ${from}`);
  flat = flat.replace(from, to);
}
if (/advanced-card|advanced-button|toggleAdvanced/u.test(flat)) {
  throw new Error("Legacy flat advanced-filter UI still remains after cleanup");
}
await writeFile(flatPath, flat, "utf8");

const testPath = "tests/flats-layout-and-stats.test.mjs";
let test = await readFile(testPath, "utf8");
const anchor = "  assert.doesNotMatch(hiringPage, /v-if=\"showAdvanced\" class=\"hiring__advanced\"/u)\n";
if (!test.includes(anchor)) throw new Error("Missing shared advanced-filter test anchor");
test = test.replace(anchor, `${anchor}  assert.doesNotMatch(page, /advanced-card|advanced-button|toggleAdvanced/u)\n`);
await writeFile(testPath, test, "utf8");

console.log("Cleaned legacy flat advanced-filter CSS remnants.");
