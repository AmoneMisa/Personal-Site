# Backend platform migration — code review false positives

`/code-review` on the `codex/backend-platform-migration` branch flagged four
findings that looked like regressions from the diff alone, but every one
turned out to be a false positive once checked against the actual backend in
`whiteslove.me-backend-platform`. Recorded here so the same findings aren't
re-litigated on a future review of this branch.

## 1. `server/flats/feedListingShape.ts` — dropped `potentiallyUnsafe`/`roomOnly`/`dealType` normalization

`shapeListing()` stopped computing these fields locally after
`flatDealType.ts`/`flatSafety.ts` were deleted (commit `99e26751`, "trust
backend card semantics"). The frontend (`FlatCard.vue`, `SpecTable.vue`,
`useFlatFilters.ts`) still reads these fields directly.

**Verified false positive:** the flats backend (`apps/flats/src/listing/
normalize-legacy.js` and `listing-enrichment.js`) already computes
`dealType`, `roomOnly`, and `potentiallyUnsafe` at ingestion time and
persists them in the `data` JSONB column, which `postgres-search-fast-core.js`
/ `postgres-canonical-feed.js` return verbatim with no key remapping. Field
names match exactly. A guarding test,
`tests/flats-live-verification-enrichment.test.mjs` ("flat cards trust
backend-owned normalized semantics"), asserts `shapeListing` does **not**
reference the deleted normalize functions — this is an intentional, tested
architecture decision, not an accidental regression.

## 2. `app/composables/flats/useFlatPresentation.ts` — weakened title fallback

`displayListingTitle` replaced `hasMeaningfulHousingTitle(title)` with a
plain `if (title) return title`, which looked like it would let junk titles
(e.g. `"..."`, emoji-only) through unfiltered.

**Verified false positive:** `normalizeListingTitle()` in
`apps/flats/src/listing/normalize-legacy.js:51-66` already performs the same
meaningful-title check (letter count ≥ 3, length ≤ 90) server-side at
ingestion time, generating the same kind of fallback label
("N-комнатная квартира · place") when the source title doesn't qualify. The
`title` field the frontend receives is always already-clean.

## 3. `server/utils/backendPlatformProxy.ts` — collapses all upstream errors to 502

`requirePlatformGet` treats any non-2xx upstream response as a generic 502
"unavailable", which looked like it could mask legitimate 4xx responses
(e.g. malformed query params) as outages.

**Verified false positive:** none of the four proxied backend routes
(`jobs-feed`, `jobs-vacancy`, `hiring-feed`, `hiring-meta` in
`apps/workforce/server/routes/`) ever throw or return a 4xx for bad input —
every parameter is clamped, defaulted, or whitelist-filtered, so they always
return 200. The proxy can only ever observe a genuine outage.

## 4. `server/plugins/share-preview.ts` — candidate share meta could describe the wrong candidate

`findPlatformSharedCandidate`'s `profiles.find(...) || profiles[0] || null`
fallback looked like it could pick an unrelated candidate's `sourceKey`/
`country` when no exact `profileId` match was found.

**Verified false positive:** the backend's `matchesFilters()` in
`apps/workforce/server/routes/hiring-feed.get.ts:198-205` already does an
exact match on `profileId`/`publicId` before a profile is included in the
response at all. The returned `profiles` array is therefore either empty or
contains only the exact match — the `profiles[0]` fallback is unreachable
for an unrelated candidate.
