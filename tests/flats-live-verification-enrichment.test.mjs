import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("live OLX verification only returns source-authoritative non-empty fields", async () => {
  const source = await read("server/routes/flats-feed.get.ts");

  assert.match(source, /const LIVE_REFRESH_FIELDS = new Set\(\[/);
  assert.match(source, /listings: \[shapeLiveListing\(exact\.listing\)\]/);
  assert.match(source, /if \(!LIVE_REFRESH_FIELDS\.has\(field\)\) continue/);
  assert.match(source, /if \(value == null\) continue/);
  assert.match(source, /if \(typeof value === 'string' && !value\.trim\(\)\) continue/);
  assert.match(source, /if \(Array\.isArray\(value\) && value\.length === 0\) continue/);

  const liveFields = source.match(/const LIVE_REFRESH_FIELDS = new Set\(\[([\s\S]*?)\]\)/)?.[1] || "";
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
    assert.doesNotMatch(liveFields, new RegExp(`['\"]${enrichmentOnly}['\"]`));
  }
});

test("English AI semantics are canonicalized before localized rendering", async () => {
  const source = await read("server/routes/flats-feed.get.ts");

  assert.match(source, /function normalizeBooleanLike\(field: BooleanListingField, value: any\)/);
  assert.match(source, /\['yes', 'true', 'present'\]/);
  assert.match(source, /\['no', 'false', 'absent'\]/);
  assert.match(source, /\['petsAllowed', 'childrenAllowed', 'smokingAllowed'\]/);
  assert.match(source, /field === 'furnished'/);
  assert.match(source, /field === 'communalSeparated'/);
  assert.match(source, /\['included', 'utilities included'\]/);
  assert.match(source, /return 'needs_renovation'/);
  assert.match(source, /return 'modern'/);
  assert.match(source, /return 'luxury'/);
  assert.match(source, /return 'women'/);
  assert.match(source, /return 'men'/);
  assert.match(source, /return 'family'/);
  assert.match(source, /normalizeBooleanLike\(field, normalized\[field\]\)/);
  assert.match(source, /const semanticListing = normalizeListingSemantics\(listing\)/);
});
