# AI / Contributor Architecture Rules

## Parsing belongs in the lexicon, not here

All free-text parsing, semantic classification, and multilingual vocabulary
(regex or dictionary-based) for housing and hiring data lives in
`@whiteslove/parsing-lexicon` — never locally in this repo.

This applies to:

- Extracting structured fields from free text (rooms, floor, area, price,
  audience, commission, address, salary, seniority, languages, etc.)
- Multilingual keyword/vocabulary lists used to detect or classify meaning
  (deal type, work mode, employment type, currency, city/district names,
  landmark names, etc.)
- Any regex whose job is to *understand* text, not just validate a
  narrowly-scoped UI/technical format.

It does **not** apply to purely technical, non-semantic checks that never
need multilingual or free-text understanding — e.g. validating a 3-letter
currency code (`^[A-Z]{3}$`), a URL shape, or an ID format. Those may stay
local.

**Before writing a new regex or vocabulary list here, check whether
`@whiteslove/parsing-lexicon` already exports it** (`node_modules/@whiteslove/parsing-lexicon/src/*.d.ts`
or the package's own `AGENTS.md`/README). If the lexicon is missing the
case, the fix belongs in the lexicon package, then this repo bumps its
dependency — do not patch around a lexicon gap with a local parser as a
shortcut, even a small one.

If you find yourself adding a "compatibility" regex to work around a bug
or missing case in an older pinned lexicon version, that is a signal to
fix the bug in `@whiteslove/parsing-lexicon` itself and bump the pin here,
not to grow a local patch layer (this repo carried exactly such a layer in
`server/utils/hiringLexicon.ts` for parsing-lexicon <=0.2.7; it was deleted
once the underlying bugs were fixed upstream in 0.2.14 — do not reintroduce
that pattern).

This repo consumes canonical fields from the lexicon (via the flat-finder
backend for housing, or directly for hiring) and is responsible for
**display only**: formatting, i18n labels, and UI composition over
already-parsed values.
