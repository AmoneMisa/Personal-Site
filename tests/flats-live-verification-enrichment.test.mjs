import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("live OLX verification only returns source-authoritative non-empty fields", async () => {
  const route = await read("server/routes/flats-feed.get.ts");
  const shape = await read("server/flats/feedListingShape.ts");

  assert.match(route, /shapeLiveListing/);
  assert.match(route, /listings: \[shapeLiveListing\(exact\.listing\)\]/);
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

test("English AI semantics are canonicalized by the shaping module before localized rendering", async () => {
  const route = await read("server/routes/flats-feed.get.ts");
  const shape = await read("server/flats/feedListingShape.ts");

  assert.match(route, /shapeListing/);
  assert.match(route, /shapeResponse/);
  assert.match(shape, /function normalizeBooleanLike\(field: BooleanListingField, value: any\)/);
  assert.match(shape, /\['yes', 'true', 'present'\]/);
  assert.match(shape, /\['no', 'false', 'absent'\]/);
  assert.match(shape, /\['petsAllowed', 'childrenAllowed', 'smokingAllowed'\]/);
  assert.match(shape, /field === 'furnished'/);
  assert.match(shape, /field === 'communalSeparated'/);
  assert.match(shape, /\['included', 'utilities included'\]/);
  assert.match(shape, /return 'needs_renovation'/);
  assert.match(shape, /return 'modern'/);
  assert.match(shape, /return 'luxury'/);
  assert.match(shape, /return 'women'/);
  assert.match(shape, /return 'men'/);
  assert.match(shape, /return 'family'/);
  assert.match(shape, /normalizeBooleanLike\(field, normalized\[field\]\)/);
  assert.match(shape, /const semanticListing = normalizeListingSemantics\(listing\)/);
});
