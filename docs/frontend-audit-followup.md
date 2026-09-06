# Frontend audit follow-up — 2026-09-06

## Implemented

- Housing geography and translated location labels come from the backend through
  `/flats-meta` and `/flats-geo-city`. Canonical filter values are preserved.
  Cards, statistics, chips and detail titles no longer use the local lexicon
  geography adapter. Unknown labels stay unchanged; labels are scoped to the
  listing's country/city rather than the current search selection.
- Removed the unused zone/metro label wrappers and the duplicate distance helper.
  Parsing lexicon remains installed for non-housing consumers; no geo-catalog
  dependency or apartment geography dataset is introduced.
- District membership follows backend `parentId` chains, including indirect
  parents. A contained microdistrict/quartal/area is preserved; a known
  incompatible one is cleared. Missing/cyclic hierarchy is not guessed.
  Metro proximity never automatically imposes an administrative district.
- Leaflet tooltip/marker labels use DOM text nodes, not interpolated HTML.
  Marker colors are validated. Invalid coordinates and polygon structures are
  rejected at the response boundary without reconstructing upstream geography.
- The map proxy cache is limited to 64 entries, with 30-second freshness and a
  two-minute absolute stale window. At most 16 distinct upstream map requests
  run concurrently; equivalent requests share work. Stale expiry is rechecked
  after failed requests. Custom-source selection is preserved.
- Social repost deduplication no longer canonicalizes cities locally.
- Clipboard copying uses the modern API and returns failure when unavailable or
  denied; it no longer invokes `document.execCommand`.
- Added `npm run typecheck` using `vue-tsc -b --noEmit`. The previous root-only
  `vue-tsc --noEmit` command does not traverse this repository's referenced Nuxt
  projects and must not be used as evidence of a clean type check.

## Verification

- Automated tests: **232 passed**.
- ESLint (`--quiet`): **passed**.
- Production Nuxt build: **passed**, including Nitro packaging. The sandboxed
  attempt failed on Windows `readlink` permissions; the approved retry passed.
- Full project type check: **fails**. No diagnostics remain in the housing
  pages/components/composables/helpers or apartment proxy routes checked here.
  Errors remain in jobs/hiring, editor tools, quizzes, shared UI, SEO routes and
  Nuxt configuration. Examples include removed `#ui` imports, incompatible
  Fabric serialization signatures, diagnostic-contract drift and unsafe indexed
  access. This is not a claim that the entire frontend is type-clean.
- Build warnings remain for missing PT Root UI font paths, large editor chunks
  and an upstream Vue/Nitro export-resolution deprecation.
- Browser interaction and live backend data were not reverified in this pass.
  Tests cover district compatibility, backend metadata locale races, malformed
  geography, map-label injection, clipboard failure and cache capacity/expiry.

## Remaining maintenance work

The large map/page components and duplicated quiz UI/CSS still merit a separate
structural refactor. This pass extracted focused label/security/hierarchy helpers;
it did not rewrite those screens or duplicate any backend responsibility.
