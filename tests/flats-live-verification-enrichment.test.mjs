import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("live OLX verification only returns source-authoritative non-empty fields", async () => {
  const route = await read("server/routes/flats-feed.get.ts");
  const lookup = await read("server/flats/feedLookup.ts");
  const shape = await read("server/flats/feedListingShape.ts");

  assert.match(route, /verifyOlxListingLive/);
  assert.match(route, /return verifyOlxListingLive\(exactListingId, exactCountryCode\)/);
  assert.match(lookup, /shapeLiveListing/);
  assert.match(lookup, /listings: \[shapeLiveListing\(exact\.listing\)\]/);
  assert.match(shape, /const LIVE_REFRESH_FIELDS = new Set\(\[/);
  assert.match(shape, /if \(!LIVE_REFRESH_FIELDS\.has\(field\)\) continue/);
  assert.match(shape, /if \(value == null\) continue/);
  assert.match(shape, /if \(typeof value === 'string' && !value\.trim\(\)\) continue/);
  assert.match(shape, /if \(Array\.isArray\(value\) && value\.length === 0\) continue/);

  const liveFields = shape.match(/const LIVE_REFRESH_FIELDS = new Set\(\[([\s\S]*?)\]\)/)?.[1] || "";
  for (const enrichmentOnly of [
    "vision",
    "marketComparison",
    "amenities",
    "condition",
    "furnished",
    "airConditioner",
    "balcony",
    "parking",
    "elevator",
    "bathrooms",
    "bedrooms",
  ]) {
    assert.doesNotMatch(liveFields, new RegExp(`['"]${enrichmentOnly}['"]`));
  }
});

test("flat cards trust backend-owned normalized semantics", async () => {
  const route = await read("server/routes/flats-feed.get.ts");
  const shape = await read("server/flats/feedListingShape.ts");

  assert.match(route, /shapeListing/);
  assert.match(route, /shapeResponse/);
  assert.match(shape, /\.\.\.listing/);
  assert.doesNotMatch(shape, /normalizeFlat(?:DealType|Price|RoomOnly)/);
  assert.doesNotMatch(shape, /isPotentiallyUnsafeFlat/);
  assert.doesNotMatch(shape, /normalizeBooleanLike/);
  assert.doesNotMatch(shape, /normalizeListingSemantics/);
});
