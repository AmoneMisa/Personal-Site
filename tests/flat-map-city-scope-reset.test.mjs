import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/composables/flats/useFlatMap.ts", import.meta.url), "utf8");

test("drawn map area is cleared when the listing feed moves to another city", () => {
  assert.match(source, /function singleListingLocationScope\(items: FlatListing\[]\)/);
  assert.match(source, /const lastLocationScope = ref\(""\)/);
  assert.match(source, /scope !== lastLocationScope\.value/);
  assert.match(source, /drawnArea\.value = \[]/);
  assert.match(source, /\{ flush: "sync" \}/);
});
