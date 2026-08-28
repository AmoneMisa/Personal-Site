# AI / Contributor Architecture Rules

## Read this before changing cross-service behavior

Personal Site is part of a larger multi-repository system.

Do **not** assume that a missing parser, geographic entity, AI behavior,
Telegram transport feature, or apartment field should be implemented inside
this repository.

Before writing code, determine which repository/package actually owns the
behavior.

The most important architecture rule is:

```text
Personal Site
    owns the website, jobs/hiring application logic,
    website-facing adapters and presentation

@whiteslove/parsing-lexicon
    owns reusable free-text understanding

@whiteslove/geo-catalog
    owns reusable canonical geography

flat-finder
    owns apartment ingestion, apartment normalization,
    apartment persistence/search and the apartment API

ai-worker
    owns shared probabilistic/LLM enrichment

Telegram-Worker-Userbot
    owns Telegram MTProto transport

subscription-bot
    owns Personal Site subscription-bot behavior
```

Do not duplicate another component's responsibility locally because the local
patch is easier.

---

# 1. Repository and service map

Before modifying an integration, use this map.

## Personal Site

Repository:

```text
https://github.com/AmoneMisa/Personal-Site
```

Production checkout:

```text
~/opt/myproject
```

Important paths:

```text
Personal-Site/
├── app/
│   ├── pages/
│   ├── components/
│   ├── composables/
│   └── utils/
│
├── server/
│   ├── routes/
│   ├── utils/
│   └── hiring/
│
├── shared/
│   ├── contracts/
│   ├── hiring/
│   └── ...
│
├── backend/
│   └── src/
│
├── jobs-worker/
├── job-browser-fetcher/
├── subscription-bot/
├── i18n/
├── public/
├── tests/
├── nuxt.config.ts
├── docker-compose.yml
└── AGENTS.md
```

Responsibility:

* Nuxt application;
* Nitro server routes;
* jobs/hiring domain;
* jobs/hiring ingestion worker;
* website tools;
* website presentation;
* hiring/job search;
* apartment UI and server-side apartment API proxying;
* subscription bot.

---

## Parsing Lexicon

Repository:

```text
https://github.com/AmoneMisa/parsing-lexicon
```

Package:

```text
@whiteslove/parsing-lexicon
```

Installed package path from Personal Site:

```text
node_modules/@whiteslove/parsing-lexicon/
```

Public API/types should be inspected through:

```text
node_modules/@whiteslove/parsing-lexicon/package.json
node_modules/@whiteslove/parsing-lexicon/index.d.ts
node_modules/@whiteslove/parsing-lexicon/src/
```

when investigating the currently installed package.

Do not edit `node_modules`.

If functionality is missing, change the source repository, release/update the
package, and bump the dependency in Personal Site.

---

## Geo Catalog

Repository:

```text
https://github.com/AmoneMisa/geo-catalog
```

Package:

```text
@whiteslove/geo-catalog
```

Package responsibilities include canonical:

* countries;
* regions;
* cities;
* districts;
* neighborhoods;
* microdistricts;
* residential complexes;
* transit;
* POIs;
* aliases;
* coordinates;
* bounds;
* geographic hierarchy;
* OSM metadata;
* spatial relationships.

Its public package surfaces include, where applicable:

```text
@whiteslove/geo-catalog
@whiteslove/geo-catalog/catalog
@whiteslove/geo-catalog/spatial
@whiteslove/geo-catalog/validate
@whiteslove/geo-catalog/lexicon-bridge
@whiteslove/geo-catalog/lookup-key
```

**Personal Site does not currently need to become a second geo catalog.**

Housing geography normally reaches Personal Site through the Flat Finder
backend.

If a future Personal Site feature genuinely needs canonical geo data directly,
add/use the shared package instead of creating another city/district/coordinate
catalog here.

---

## Flat Finder

Repository:

```text
https://github.com/AmoneMisa/flat-finder
```

Apartment backend source:

```text
flat-finder/backend/
```

Important Flat Finder backend paths include:

```text
flat-finder/backend/src/app.js
flat-finder/backend/src/server.js
flat-finder/backend/src/worker.js
flat-finder/backend/src/listing-routes.js
flat-finder/backend/src/postgres-search.js
flat-finder/backend/src/listing-enrichment.js
flat-finder/backend/src/scrapers/
flat-finder/backend/migrations/
```

Runtime Docker service:

```text
flat-finder-backend
```

Internal Docker/network address:

```text
http://flat-finder-backend:4000
```

The Flat Finder API listens on port:

```text
4000
```

Main apartment API includes:

```text
GET /api/countries
GET /api/rates
GET /api/listings
GET /api/listing/:source/:id
```

Protected server-to-server functionality may exist under:

```text
/internal/*
```

and must remain protected by the appropriate internal key.

Apartment data ownership belongs to Flat Finder.

---

## AI Worker

Repository:

```text
https://github.com/AmoneMisa/ai-worker
```

Production checkout:

```text
~/opt/ai-worker
```

Runtime service address:

```text
http://ai-worker:4030
```

Personal Site configuration:

```text
AI_WORKER_URL
AI_WORKER_KEY
```

Personal Site integration wrapper:

```text
server/utils/aiWorker.ts
```

The worker API currently includes:

```text
POST /ai/extract
GET  /ai/result/:key
POST /ai/vision
GET  /health
GET  /ready
GET  /metrics
```

Supported semantic task kinds include:

```text
apartment
vacancy
candidate
translation
```

AI Worker is a shared service used by both Personal Site and Flat Finder.

---

## Telegram MTProto Worker

Repository:

```text
https://github.com/AmoneMisa/Telegram-Worker-Userbot
```

Server installation path:

```text
/opt/tg-worker
```

systemd unit:

```text
tg-worker
```

Runtime port:

```text
4100
```

Personal Site configuration:

```text
TELEGRAM_WORKER_URL
```

Primary Personal Site candidate/hiring integration:

```text
server/hiring/sources/telegramRuntime.ts
```

Other Telegram source integration code may exist under:

```text
server/utils/sources.ts
server/utils/extraTelegramJobSources.ts
server/hiring/
```

Worker API:

```text
GET /health
GET /history
GET /photo
```

The TG worker is shared by Personal Site and Flat Finder.

---

# 2. Do not confuse the three backends

There are multiple server-side components and they have different owners.

This distinction is critical.

## Personal Site Nitro

Path:

```text
server/
```

Owns:

* Nitro website routes;
* jobs/hiring read APIs;
* website-facing proxy/adaptation;
* SSR-related server behavior;
* website-side application logic.

---

## Personal Site FastAPI tool backend

Path:

```text
backend/
```

Runtime service:

```text
backend:8000
```

Nuxt currently proxies:

```text
/api/**
```

to:

```text
http://backend:8000/**
```

This is the **Personal Site auxiliary/tool backend**.

It is not the Flat Finder apartment backend.

It is not the jobs/hiring ingestion worker.

Do not put apartment ingestion/search logic here merely because the directory
is called `backend`.

---

## Flat Finder apartment backend

Repository/path:

```text
AmoneMisa/flat-finder
└── backend/
```

Runtime:

```text
flat-finder-backend:4000
```

This is the canonical backend for apartment data.

When a task concerns:

* apartment crawlers;
* Telegram housing ingestion;
* OLX housing ingestion;
* Facebook/Threads housing ingestion;
* apartment parsing;
* apartment enrichment;
* apartment persistence;
* apartment availability;
* apartment search;
* apartment filters;
* apartment source normalization;
* apartment canonical geographic data;
* apartment AI enrichment pipeline;

inspect Flat Finder first.

Do not recreate that functionality inside Personal Site.

---

# 3. Apartment architecture

The intended direction is:

```text
housing sources
      ↓
Flat Finder worker / source adapters
      ↓
parsing-lexicon
      +
geo-catalog
      +
AI Worker where appropriate
      ↓
Flat Finder normalized listing
      ↓
PostgreSQL / search
      ↓
Flat Finder API
      ↓
Personal Site Nitro adapter/proxy
      ↓
Personal Site UI
```

Personal Site is a **consumer** of normalized apartment data.

It is not another apartment ingestion pipeline.

---

# 4. Personal Site apartment integration paths

The main apartment website page is:

```text
app/pages/flat-finder/index.vue
```

Apartment-specific frontend behavior lives primarily under:

```text
app/composables/flats/
```

The important website-side Nitro adapter routes include:

```text
server/routes/flats-feed.get.ts
server/routes/flats-meta.get.ts
server/routes/flats-map.get.ts
server/routes/flats-photo.get.ts
server/routes/flats-rates.get.ts
```

These routes exist to adapt/proxy Flat Finder data to the website.

They are **not** the canonical apartment backend.

For example, `server/routes/flats-feed.get.ts` proxies apartment listing
requests to Flat Finder.

When fixing an apartment data problem, determine whether the problem is:

```text
source/listing is wrong before API
    → Flat Finder

generic text was interpreted incorrectly
    → parsing-lexicon

canonical place/coordinate is wrong
    → geo-catalog

LLM enrichment is wrong
    → AI Worker and/or caller contract

Flat Finder API sends correct data,
but website shapes/displays it incorrectly
    → Personal Site

website request/proxy parameters are wrong
    → Personal Site Nitro adapter
```

Do not fix upstream data corruption in a Vue component.

---

# 5. `FLAT_API_URL` is the apartment upstream

Personal Site's apartment Nitro routes use the Flat Finder API through
`FLAT_API_URL`.

That variable represents the upstream apartment backend.

Do not introduce another apartment API URL in individual components/routes
without a concrete architectural reason.

Server-side calls should remain server-side when required by:

* mixed-content restrictions;
* private network access;
* internal credentials;
* API adaptation;
* caching;
* server-only upstream routes.

The browser should consume the Personal Site's website-facing contract rather
than learning Flat Finder internal topology unnecessarily.

---

# 6. Housing parsing does not belong in Personal Site

Generic housing language parsing belongs in:

```text
@whiteslove/parsing-lexicon
```

and is normally applied upstream by Flat Finder.

Personal Site should consume canonical/normalized housing fields.

It must not grow its own independent parser for:

* rooms;
* floor;
* area;
* price;
* currency;
* deposit;
* commission;
* audience;
* room sharing;
* deal type;
* property type;
* address;
* district;
* metro;
* amenities;
* utilities;
* condition;
* geographic names;
* housing shorthand.

If Flat Finder returns a wrong semantic field, fix the owning upstream layer.

---

# 7. Existing apartment compatibility shaping is not a precedent

Some Personal Site adapter code may contain compatibility normalization for
historic persisted rows or old upstream values.

Examples may exist in:

```text
server/routes/flats-feed.get.ts
server/utils/flatDealType.ts
server/utils/flatSafety.ts
server/utils/tashkentMetroLabels.ts
```

Do not interpret those files as permission to create a second apartment parser.

Existing compatibility code should remain:

* narrow;
* documented;
* output-oriented;
* removable when upstream data is canonical.

Do not extend it with new multilingual housing vocabulary.

If the new case is generic semantic understanding, fix:

```text
@whiteslove/parsing-lexicon
```

and/or the Flat Finder enrichment pipeline.

---

# 8. Parsing Lexicon ownership

All reusable free-text parsing and semantic classification belongs in:

```text
@whiteslove/parsing-lexicon
```

This applies to both housing and hiring/job data.

Examples include:

* salary extraction;
* salary period;
* currency wording;
* work mode;
* employment type;
* seniority;
* experience;
* skills;
* language requirements;
* visa/relocation wording where supported;
* location names;
* city aliases;
* room/floor/area;
* apartment audience;
* commission;
* address semantics;
* generic multilingual vocabulary.

The implementation method is irrelevant.

The same ownership applies to:

* regexes;
* dictionaries;
* keyword arrays;
* aliases;
* token matchers;
* synonym lists;
* transliteration rules;
* heuristic language classifiers.

---

# 9. Search the lexicon before adding local semantics

Before writing a semantic regex in Personal Site:

1. Inspect:

```text
package.json
```

to determine the installed package version.

2. Inspect public exports/types under:

```text
node_modules/@whiteslove/parsing-lexicon/
```

3. Search existing Personal Site adapters such as:

```text
server/utils/hiringLexicon.ts
shared/locationCatalog.ts
shared/jobSkills.ts
shared/hiring/
```

4. If the shared package does not support the case, change:

```text
AmoneMisa/parsing-lexicon
```

5. Add tests there.

6. Release/bump the package.

7. Update Personal Site's dependency/lockfile.

Do not create a "temporary" semantic fallback locally.

Temporary parsing fallbacks tend to become permanent forks.

---

# 10. `server/utils/hiringLexicon.ts` is an adapter, not a second lexicon

The existence of:

```text
server/utils/hiringLexicon.ts
```

does not mean Personal Site owns hiring-language parsing.

It should act as an application adapter over shared lexicon capabilities.

The historical compatibility parser that existed for older
`parsing-lexicon` versions was intentionally removed after the shared package
was fixed.

Do not reintroduce that pattern.

A missing lexicon feature should result in an upstream lexicon change, not a
larger `hiringLexicon.ts`.

---

# 11. Geographic ownership

Canonical geography belongs in:

```text
@whiteslove/geo-catalog
```

The lexicon answers:

```text
"What geographic place is this human-written phrase referring to?"
```

The geo catalog answers:

```text
"What canonical place is this, where is it, and what is its hierarchy?"
```

Personal Site answers:

```text
"How should the website display/filter/use that canonical place?"
```

---

# 12. Coordinates do not belong in Personal Site catalogs

Do not create structures such as:

```js
const CITY_COORDINATES = { ... }
const DISTRICT_COORDINATES = { ... }
const METRO_COORDINATES = { ... }
const RESIDENTIAL_COMPLEX_COORDINATES = { ... }
```

inside Personal Site when the values describe canonical geography.

Those belong in:

```text
@whiteslove/geo-catalog
```

For apartments, Personal Site normally receives the result through Flat Finder.

A missing district coordinate in an apartment response is not a reason to
hard-code it in:

```text
app/
server/
shared/
```

Fix the geo catalog / Flat Finder dependency chain.

---

# 13. `shared/locationCatalog.ts` is not the canonical geo database

Current Personal Site code contains:

```text
shared/locationCatalog.ts
```

It acts as website-side canonicalization/display glue over shared parsing
exports and hiring-market configuration.

Do not grow this file into a parallel `geo-catalog`.

In particular, do not add large local datasets for:

* geographic coordinates;
* district trees;
* microdistrict inventories;
* residential complexes;
* landmarks;
* metro coordinates;
* polygons;
* OSM IDs;
* bounding boxes.

If reusable structured geography is required, use:

```text
@whiteslove/geo-catalog
```

or receive it from Flat Finder when the feature belongs to housing.

---

# 14. AI Worker ownership

Shared probabilistic AI/LLM behavior belongs in:

```text
AmoneMisa/ai-worker
```

Personal Site integration belongs through:

```text
server/utils/aiWorker.ts
```

Do not add a second provider-selection/fallback implementation inside
Personal Site.

AI Worker owns:

* provider fallback;
* provider cooldown;
* extraction prompt/schema execution;
* shared LLM request orchestration;
* translation inference;
* vision inference;
* bounded inference execution;
* AI result validation at its service boundary.

---

# 15. AI Worker is enrichment, not deterministic parsing

The AI layer must not silently replace deterministic parsing.

Expected flow:

```text
raw source text
      ↓
deterministic parsing / trusted source facts
      ↓
knownFacts
      ↓
AI Worker
      ↓
optional semantic enrichment
      ↓
caller merge policy
```

`knownFacts` are intentionally part of the AI request contract.

Do not throw away deterministic facts merely because an LLM returned a
different answer.

AI output is probabilistic.

The calling application owns merge/precedence policy.

---

# 16. Do not put provider prompts in Personal Site

If a change concerns:

* AI prompt wording;
* extraction schema;
* LLM provider order;
* model choice;
* provider retry/cooldown;
* shared AI validation;
* vision prompt;
* extraction prompt version;

inspect/change:

```text
AmoneMisa/ai-worker
```

rather than embedding provider-specific logic in:

```text
server/utils/aiWorker.ts
```

The Personal Site wrapper owns the service contract and scheduling behavior,
not the underlying inference implementation.

---

# 17. AI Worker credentials are server-only

These values are private:

```text
AI_WORKER_URL
AI_WORKER_KEY
```

Do not expose them through:

```text
runtimeConfig.public
NUXT_PUBLIC_*
browser fetch()
client bundle
HTML
```

Browser code must never call AI Worker directly.

Correct:

```text
browser
   ↓
Personal Site server
   ↓
ai-worker
```

Incorrect:

```text
browser
   ↓
ai-worker:4030
```

---

# 18. AI Worker is stateless from the caller's perspective

Do not treat AI Worker's process-local queue/cache as durable application
storage.

Callers must be able to recover/resubmit work according to their own durable
or deterministic state.

An AI Worker restart must not become a reason to corrupt or erase a vacancy,
candidate or apartment.

AI enrichment should degrade independently from core deterministic data where
the product permits it.

---

# 19. AI Worker contract changes are cross-repository changes

The AI Worker is shared by at least:

```text
Personal-Site
flat-finder
```

Therefore changing:

```text
POST /ai/extract
GET /ai/result/:key
POST /ai/vision
```

or changing fields/status semantics may affect multiple repositories.

Before making an incompatible API change:

1. Search both callers.
2. Update schemas/contracts.
3. Preserve backward compatibility where practical.
4. Update every caller.
5. Deploy in a compatible order.

Do not change only one side of a shared service contract.

---

# 20. Telegram Worker ownership

`Telegram-Worker-Userbot` is a **transport-only MTProto service**.

Its responsibility is:

```text
Telegram
    ↓
raw channel history / media transport
    ↓
calling application
```

It must not understand whether a message is:

* a vacancy;
* a CV;
* an apartment;
* a sale;
* a rental;
* a candidate;
* relevant;
* irrelevant.

Those are caller/domain concerns.

---

# 21. Telegram Worker API

The shared transport contract currently includes:

```text
GET /health
GET /history?channel=...&limit=...&beforeId=...
GET /photo?channel=...&id=...
```

History returns transport fields such as:

```text
id
text
date
hasPhoto
photoIds
preview
```

Do not add domain-specific output such as:

```text
salary
rooms
district
candidateSkills
dealType
propertyType
```

to the Telegram Worker.

Those belong to parsing/domain layers.

---

# 22. Personal Site Telegram path

For hiring/candidate Telegram ingestion, start investigation at:

```text
server/hiring/sources/telegramRuntime.ts
```

That file is the Personal Site transport adapter.

The intended boundary is:

```text
Telegram-Worker-Userbot
        ↓
raw messages
        ↓
telegramRuntime.ts
        ↓
hiring domain parser/classifier
        ↓
candidate/job domain
```

Transport retrieval belongs in the worker.

Classification belongs in Personal Site domain code and shared parsing
packages as applicable.

---

# 23. Do not parse domain data inside the TG worker

If a Telegram vacancy or candidate is misclassified:

Do **not** patch:

```text
AmoneMisa/Telegram-Worker-Userbot
```

unless the worker returned incorrect raw transport data.

Instead inspect:

```text
Personal-Site/server/hiring/
Personal-Site/server/utils/
@whiteslove/parsing-lexicon
```

depending on whether the issue is application policy or reusable text parsing.

For housing Telegram data, inspect:

```text
flat-finder/backend/
@whiteslove/parsing-lexicon
```

not Personal Site.

---

# 24. TG Worker deployment is external to Personal Site

The worker is not part of Personal Site's Docker Compose stack.

Its server installation is:

```text
/opt/tg-worker
```

and its service is:

```text
tg-worker
```

Do not add a duplicate Telegram MTProto client to Personal Site merely because
the worker is temporarily unavailable.

Fix the worker or its connectivity.

Do not commit a second Telegram user session into Personal Site.

---

# 25. `TELEGRAM_WORKER_URL` is the shared MTProto boundary

Use:

```text
TELEGRAM_WORKER_URL
```

for the configured shared worker endpoint.

Do not scatter Telegram-worker addresses across:

* source adapters;
* pages;
* composables;
* workers.

Do not expose the worker directly to browser code.

The site/server/worker runtime should own that connection.

---

# 26. Telegram Worker and subscription bot are different services

Do not confuse:

```text
AmoneMisa/Telegram-Worker-Userbot
```

with:

```text
Personal-Site/subscription-bot/
```

They solve different problems.

## Telegram-Worker-Userbot

Uses a Telegram user account via MTProto.

Purpose:

* read public channel history;
* retrieve Telegram-hosted media;
* bypass deployment-host restrictions affecting `t.me/s`.

It is shared by multiple applications.

## `subscription-bot/`

Uses Telegram Bot API.

Purpose:

* Personal Site user subscriptions;
* apartment/job/candidate notifications;
* subscription flow;
* Telegram subscriber state.

It is part of Personal Site.

Do not move subscription business logic into the MTProto worker.

Do not move public-channel crawling into the subscription bot.

---

# 27. Flat Finder and TG Worker relationship

Flat Finder also consumes the Telegram worker.

Conceptually:

```text
Telegram
    ↓
Telegram-Worker-Userbot
    ├──→ Personal Site jobs/hiring
    └──→ Flat Finder housing
```

Therefore a TG worker API change is a shared-contract change.

Check both:

```text
AmoneMisa/Personal-Site
AmoneMisa/flat-finder
```

before changing transport fields or endpoints.

---

# 28. Personal Site jobs/hiring runtime ownership

Jobs/hiring are split intentionally.

## Website/read side

Lives primarily in:

```text
server/
```

Nuxt/Nitro handles:

* website-facing read APIs;
* search/read presentation contracts;
* SSR/server adaptation.

## Ingestion/execution side

Lives in:

```text
jobs-worker/
```

The jobs worker owns:

* scheduling;
* queue processing;
* scraping;
* source execution;
* parsing orchestration;
* normalization;
* AI enrichment;
* indexing.

Do not start crawlers or durable job execution from ordinary Nitro requests.

---

# 29. Do not make Nitro a second jobs worker

This pattern is forbidden:

```text
HTTP request
    ↓
Nuxt route
    ↓
start full job/candidate crawling
```

Normal page/API requests should read available application state.

The dedicated:

```text
jobs-worker/
```

owns ingestion.

This separation prevents:

* request timeouts;
* duplicate crawls;
* multiple schedulers;
* SSR side effects;
* deploy-time duplication.

---

# 30. The FastAPI `backend/` does not own jobs/hiring

Current Personal Site architecture intentionally keeps jobs/hiring outside the
FastAPI tool service.

Do not move jobs/hiring behavior into:

```text
backend/
```

merely because it is server-side code.

Use:

```text
server/
jobs-worker/
shared/
```

according to responsibility.

---

# 31. Job browser fetcher is transport infrastructure

Path:

```text
job-browser-fetcher/
```

This service exists for public job pages that reject normal Node HTTP requests
because of TLS/browser fingerprinting/WAF behavior.

It owns fetching.

It does not own semantic job parsing.

Expected flow:

```text
jobs-worker/source adapter
        ↓
job-browser-fetcher
        ↓
raw HTTP page
        ↓
caller parser/domain logic
```

Do not teach the browser fetcher:

* salary semantics;
* seniority semantics;
* skills;
* employment type;
* candidate classification.

---

# 32. Shared code inside Personal Site

Cross-runtime Personal Site contracts/helpers belong under:

```text
shared/
```

when they truly need to be shared by multiple Personal Site runtimes.

Examples include:

```text
shared/contracts/
shared/hiring/
shared/jobSkills.ts
shared/locationCatalog.ts
```

But `shared/` means:

```text
shared inside Personal Site
```

not:

```text
shared across every WhitesLove repository
```

If behavior should also be reused by Flat Finder or another project, consider
whether its real owner is an external shared package instead.

---

# 33. Do not use `shared/` to bypass package ownership

Bad:

```text
Personal-Site/shared/housingParser.ts
```

containing generic multilingual apartment parsing.

Bad:

```text
Personal-Site/shared/geoCoordinates.ts
```

containing canonical city/district coordinates.

Bad:

```text
Personal-Site/shared/aiPrompts.ts
```

duplicating AI Worker's extraction prompts.

`shared/` is not an escape hatch from architectural ownership.

---

# 34. Display logic may remain local

Personal Site owns website presentation.

Local code may legitimately handle:

* labels;
* i18n;
* component composition;
* formatting;
* visual grouping;
* display ordering;
* UI-specific fallbacks;
* URLs;
* image proxying;
* browser interaction;
* presentation-specific safety badges;
* application-specific filtering/ranking when based on already canonical data.

For example:

```text
canonical audience = women
        ↓
Russian UI label
        → "Для женщин"
```

is Personal Site presentation.

Recognizing arbitrary text as "women only" is parsing.

---

# 35. i18n is presentation, not parsing

Static site localization lives under:

```text
i18n/
```

Current locales are loaded from:

```text
i18n/locales/
```

Do not use i18n dictionaries as a semantic parser.

Bad:

```js
if (text.includes(t('housing.family'))) {
  ...
}
```

User-interface translations and source-text understanding are separate
concerns.

Semantic multilingual vocabulary belongs in parsing-lexicon.

---

# 36. Server-side proxy routes should not become domain forks

A Nitro proxy route may legitimately:

* validate website query parameters;
* translate website request shape into upstream shape;
* cache an upstream response;
* proxy media;
* prevent mixed-content browser access;
* remove private/internal fields;
* format canonical values for the site;
* add website-only presentation metadata.

It should not independently reconstruct the upstream domain.

For apartment routes:

```text
server/routes/flats-*.ts
```

should remain adapters over Flat Finder.

---

# 37. Apartment source-of-truth rule

When Personal Site and Flat Finder disagree about an apartment field:

Do not automatically trust the website copy.

Trace the field.

Example:

```text
website card says:
district = X
        ↓
inspect /flats-feed
        ↓
inspect Flat Finder /api/listings
        ↓
inspect persisted normalized listing
        ↓
inspect enrichment/parser/geo source
```

Fix the first layer where the value becomes incorrect.

Do not overwrite a correct upstream field downstream to make one card look
right.

---

# 38. AI result source-of-truth rule

When an AI-enriched field is wrong:

Determine whether:

1. deterministic `knownFacts` were already correct;
2. AI was allowed to override them;
3. the prompt/schema is wrong;
4. the caller merge policy is wrong.

Then fix the appropriate owner.

```text
wrong prompt/schema/provider behavior
    → ai-worker

wrong deterministic parse
    → parsing-lexicon

wrong caller precedence/merge
    → Personal Site or Flat Finder caller

wrong housing field persisted before site receives it
    → Flat Finder
```

---

# 39. Geographic source-of-truth rule

When a geographic value is wrong:

```text
phrase not recognized / alias issue
    → parsing-lexicon

canonical entity / hierarchy / coordinates wrong
    → geo-catalog

housing listing resolved incorrectly upstream
    → Flat Finder integration with shared packages

website label/format wrong
    → Personal Site
```

Do not fix a wrong coordinate using a Vue constant.

---

# 40. Cross-repository changes are expected

Do not optimize for:

```text
"change only Personal Site"
```

when another repository owns the behavior.

A correct task may require:

```text
parsing-lexicon
    ↓ release
flat-finder
    ↓ dependency bump
Personal-Site
    ↓ integration/update
```

or:

```text
ai-worker
    ↓ compatible contract
Personal-Site + flat-finder
```

or:

```text
Telegram-Worker-Userbot
    ↓ compatible transport contract
Personal-Site + flat-finder
```

Changing several repositories is preferable to duplicating one owner's logic
into another repository.

---

# 41. Package change workflow: parsing lexicon

If Personal Site needs a new generic parsing case:

1. Reproduce the input.
2. Check the installed lexicon exports.
3. Check the current parsing-lexicon repository.
4. Implement the generic behavior there.
5. Add positive tests.
6. Add false-positive tests.
7. Add multilingual variants where relevant.
8. Export through the public API.
9. Release/update the package.
10. Bump Personal Site's dependency.
11. Update the lockfile.
12. Verify the actually resolved version.
13. Remove any temporary downstream workaround rather than preserving both.

---

# 42. Package change workflow: geo catalog

If a canonical geographic entity/data item is missing:

1. Check `AmoneMisa/geo-catalog`.
2. Verify the entity really is missing.
3. Add/update the entity there.
4. Verify canonical ID.
5. Verify hierarchy.
6. Verify coordinates.
7. Verify bounds/OSM metadata where applicable.
8. Run geo-catalog validation/tests.
9. Update the consuming package/repository.
10. For housing, normally bump/consume it through Flat Finder first.
11. Do not add a permanent Personal Site copy.

---

# 43. AI Worker change workflow

When AI behavior must change:

1. Determine whether it is actually probabilistic enrichment.
2. Inspect `AmoneMisa/ai-worker`.
3. Inspect `server/utils/aiWorker.ts`.
4. Search Flat Finder for the same AI contract.
5. Change prompts/schema/service behavior in AI Worker when appropriate.
6. Increment prompt/schema version when required by AI Worker's cache contract.
7. Keep API compatibility or migrate all callers.
8. Update caller merge behavior separately if needed.
9. Never expose the worker key to the browser.

---

# 44. TG Worker change workflow

When Telegram fetching is wrong:

1. Inspect the raw worker response.
2. If transport itself is wrong, change:
   `AmoneMisa/Telegram-Worker-Userbot`.
3. If message classification is wrong, leave the worker alone.
4. Fix parsing/domain logic in the caller/shared package.
5. Search both Personal Site and Flat Finder before changing endpoint/payload
   semantics.
6. Preserve backward compatibility unless both callers move together.

---

# 45. Flat Finder change workflow from Personal Site

If a website apartment task exposes a backend gap:

1. Reproduce the website request.
2. Inspect the Personal Site Nitro upstream request.
3. Call/check the corresponding Flat Finder API response.
4. If the Flat Finder response is already correct, fix Personal Site.
5. If the Flat Finder response is wrong, move investigation to:
   `AmoneMisa/flat-finder`.
6. If the cause is text understanding, fix parsing-lexicon.
7. If the cause is canonical geography, fix geo-catalog.
8. If the cause is shared AI inference, inspect AI Worker.
9. Update package pins/contracts.
10. Return to Personal Site only for necessary integration/presentation changes.

---

# 46. Do not introduce local compatibility layers as permanent architecture

This anti-pattern is prohibited:

```js
const upstream = await getFlatFinderListing()

if (!upstream.district) {
  // 100 lines of Personal Site district parsing
}
```

Also prohibited:

```js
if (!candidate.salary) {
  // local multilingual salary parser copied from lexicon
}
```

and:

```js
if (!listing.lat) {
  listing.lat = LOCAL_DISTRICT_COORDINATES[listing.district]
}
```

and:

```js
if (aiWorkerFailed) {
  // duplicate direct provider-specific LLM implementation here
}
```

These hide upstream gaps instead of fixing them.

---

# 47. No Redis architecture

Do not reintroduce Redis based on obsolete assumptions about this project.

Personal Site no longer has a standalone Redis service.

Current runtime architecture uses the mechanisms explicitly present in the
current repository/deployment, including:

* filesystem-backed `site_state` for appropriate runtime state;
* PostgreSQL for durable hiring/queue data where configured;
* Elasticsearch where configured;
* dedicated workers/services.

Do not add Redis to solve a local synchronization problem without an explicit
architectural decision and a real requirement.

Existing historical references to old Redis architecture must not be treated
as current design guidance.

---

# 48. `site_state` is not permission to persist arbitrary domain truth

The shared Docker volume:

```text
site_state
```

exists for filesystem-backed application/runtime state.

Before storing new data there, determine whether the data is:

* cache/runtime snapshot;
* resumable cursor;
* temporary state;
* authoritative durable business data.

Data that requires database-level durability/query/coordination may belong in
the configured PostgreSQL-backed domain instead.

Do not blindly put every new persistent feature into JSON files because the
volume exists.

---

# 49. Hiring persistence may reuse Flat Finder infrastructure without becoming Flat Finder domain

Personal Site currently uses configured PostgreSQL/Elasticsearch infrastructure
from the Flat Finder deployment for some jobs/hiring storage/search.

Infrastructure sharing does **not** mean domain ownership moves to Flat Finder.

For example:

```text
hiring schema
job queue schema
job search index
```

remain Personal Site jobs/hiring domain concerns even when physically hosted
in shared PostgreSQL/Elasticsearch infrastructure.

Distinguish:

```text
who hosts the datastore
```

from:

```text
which application owns the domain
```

---

# 50. Social-fetch proxy boundary

Personal Site jobs/hiring may use Flat Finder's internal social-fetch
capability through:

```text
HIRING_SOCIAL_API_URL
```

with the current internal service target:

```text
http://flat-finder-backend:4000/internal/social/fetch
```

This is a server-to-server internal contract.

Do not expose it to browser code.

Do not remove its internal-key protection.

Do not assume that using Flat Finder's transport capability transfers hiring
domain parsing into Flat Finder.

The fetched content still belongs to the hiring ingestion/domain pipeline.

---

# 51. Browser trust boundary

Never expose private infrastructure topology or credentials merely to avoid a
server-side adapter.

Private values include:

```text
AI_WORKER_KEY
QUEUE_INTERNAL_KEY
Telegram session credentials
database credentials
internal service authentication
```

Browser code should use same-origin/public Personal Site APIs.

Internal services should be called from trusted server/worker runtimes.

---

# 52. Environment variables are service contracts

Important integration variables include:

```text
FLAT_API_URL
AI_WORKER_URL
AI_WORKER_KEY
TELEGRAM_WORKER_URL
HIRING_SOCIAL_API_URL
HIRING_DATABASE_URL
JOBS_QUEUE_DATABASE_URL
ELASTICSEARCH_URL
JOB_BROWSER_FETCHER_URL
```

Before inventing a new environment variable:

* check whether an existing canonical variable already represents the service;
* check Docker Compose;
* check `.env.example`;
* check every producer/consumer.

Do not create several names for the same upstream.

---

# 53. Keep `.env.example` architecture comments accurate

`.env.example` is not merely a list of variables.

It documents important production behavior and cross-service dependencies.

When changing:

* service ownership;
* failover behavior;
* upstream URLs;
* queue behavior;
* worker dependency;
* security expectations;

update `.env.example` comments as part of the change.

Do not leave architecture comments describing systems that no longer exist.

---

# 54. Docker Compose is an architecture source

Before assuming what services exist, inspect:

```text
docker-compose.yml
```

The current Compose file is authoritative for the Personal Site stack.

Do not infer service topology from:

* an old chat;
* old deployment docs;
* deleted architecture;
* historical filenames.

In particular, do not assume Redis exists.

---

# 55. README and AGENTS must follow actual runtime

When architecture changes:

```text
code
docker-compose.yml
.env.example
README.md
AGENTS.md
```

should converge on the same model.

An AI contributor should not preserve obsolete documentation simply because it
was previously correct.

---

# 56. Apartment UI is not allowed to infer missing domain semantics

Components under:

```text
app/pages/flat-finder/
app/composables/flats/
```

should render/query structured listing fields.

Avoid logic such as:

```js
listing.description.includes(...)
```

to determine:

* deal type;
* audience;
* commission;
* rooms;
* district;
* property type;
* amenities.

If a structured value is missing, trace it upstream.

---

# 57. Jobs/hiring UI follows the same principle

UI code should not parse raw vacancy/CV text merely to compensate for missing
domain fields.

Prefer:

```js
vacancy.salaryMin
vacancy.skills
vacancy.seniority
candidate.languages
```

over repeated text regexes inside components.

If data is missing:

```text
generic semantic extraction
    → parsing-lexicon

AI semantic enrichment
    → ai-worker

application source mapping/policy
    → jobs-worker / hiring domain

display
    → app/
```

---

# 58. Parsing vs policy

Not every string-based decision belongs in parsing-lexicon.

Use this distinction:

```text
"What does this text mean?"
    → parsing-lexicon

"Should Personal Site include/rank/hide this record?"
    → Personal Site domain policy
```

For example:

```text
Recognize "remote only"
    → parsing-lexicon

Give remote vacancies a ranking boost
    → Personal Site
```

Likewise:

```text
Recognize a discriminatory housing audience phrase
    → parsing-lexicon / Flat Finder parsing

Display a safety warning over the parsed result
    → Personal Site product policy
```

---

# 59. Transport vs parsing

The same rule applies to transport services.

```text
"Can we obtain the Telegram message?"
    → Telegram Worker

"What does the Telegram message mean?"
    → caller + parsing-lexicon

"Can we fetch this WAF-protected job page?"
    → job-browser-fetcher

"What vacancy fields does the page contain?"
    → source adapter + parsing-lexicon
```

Do not put semantic parsers into transport infrastructure.

---

# 60. AI vs deterministic parsing

Use AI when ambiguity genuinely benefits from probabilistic inference.

Do not send trivial deterministic concepts to AI solely because AI Worker is
available.

Good candidates:

* ambiguous semantic enrichment;
* structured extraction where deterministic rules are insufficient;
* translation;
* image understanding.

Prefer deterministic/shared parsing for explicit:

* URLs;
* emails;
* phone numbers;
* known enum values;
* explicit salary formats;
* explicit room/area/floor notation when parser support exists;
* canonical source IDs.

---

# 61. Public contracts should be shaped at boundaries

Personal Site may shape upstream data into a stable website-facing DTO.

That is different from reparsing it.

Acceptable:

```js
{
  ...listing,
  photo: proxiedPhotoUrl,
  displayLabel: localizedLabel,
}
```

Not acceptable:

```js
{
  rooms: parseRoomsAgain(listing.description),
  district: inferDistrictLocally(listing.description),
}
```

Boundary shaping should preserve canonical semantics.

---

# 62. Do not import another repository's private source files

Never depend on internal source paths across packages such as:

```js
import x from '../other-repo/src/internal/...'
```

or:

```js
import x from '@whiteslove/parsing-lexicon/src/private/...'
```

Use:

* published public package exports;
* documented HTTP APIs;
* explicit shared contracts.

Repository boundaries are intentional.

---

# 63. Package releases/pins matter

A shared-package fix is not complete because the source repository changed.

Verify:

* package version;
* Personal Site `package.json`;
* lockfile;
* resolved installed version;
* CI;
* production build.

For a Flat Finder consumer change, verify Flat Finder's own package pin too.

Do not assume workspace/local source resolution will match production.

---

# 64. Cross-service API compatibility matters

Treat these as real APIs:

```text
Personal Site ↔ AI Worker
Personal Site ↔ Telegram Worker
Personal Site ↔ Flat Finder
Personal Site ↔ job-browser-fetcher
Personal Site ↔ subscription-bot
```

Internal network access does not make an API disposable.

When changing request/response fields:

* identify all callers;
* identify all consumers;
* consider deployment order;
* preserve compatibility where needed;
* update tests.

---

# 65. Do not hard-code Docker DNS into browser code

Names such as:

```text
ai-worker
flat-finder-backend
backend
job-browser-fetcher
```

are internal service-discovery names.

They belong to server/container configuration.

They should not appear in client-side API calls.

The browser should use public/same-origin Personal Site routes.

---

# 66. Error ownership

When an external service fails, surface the failure according to the product
contract without pretending another layer can replace it.

Examples:

```text
TG Worker unavailable
    → Telegram-derived source may degrade
    → do not invent Telegram messages locally

AI Worker unavailable
    → AI enrichment may remain absent/pending
    → do not run hidden browser LLM fallback

Flat Finder unavailable
    → apartment API is degraded
    → do not scrape OLX from Personal Site

geo-catalog gap
    → canonical geo data incomplete
    → do not hard-code coordinates downstream
```

---

# 67. AI contributor investigation order

For any bug, first classify it.

## Apartment issue

Inspect in this order:

```text
Personal Site UI
↓
server/routes/flats-*.ts
↓
Flat Finder public API
↓
Flat Finder normalized listing
↓
Flat Finder enrichment/source
↓
parsing-lexicon / geo-catalog / AI Worker
```

Stop at the first layer where the value becomes wrong.

---

## Vacancy/candidate issue

Inspect:

```text
Personal Site UI/read API
↓
jobs/hiring normalized record
↓
jobs-worker / source adapter
↓
parsing-lexicon
↓
AI Worker if AI-enriched
↓
transport source (TG Worker/browser fetcher) if raw input is wrong
```

---

## Telegram issue

Inspect:

```text
TG Worker raw /history response
↓
Personal Site or Flat Finder transport adapter
↓
domain parser
↓
normalized data
↓
UI
```

---

# 68. Ownership matrix

| Requirement                                           | Owner                                |
| ----------------------------------------------------- | ------------------------------------ |
| Personal Site pages/components                        | `Personal-Site/app/`                 |
| Website SSR/Nitro routes                              | `Personal-Site/server/`              |
| Personal Site tool API                                | `Personal-Site/backend/`             |
| Jobs/hiring ingestion                                 | `Personal-Site/jobs-worker/`         |
| Browser-like protected job fetching                   | `Personal-Site/job-browser-fetcher/` |
| Telegram subscription behavior                        | `Personal-Site/subscription-bot/`    |
| Generic housing text parsing                          | `@whiteslove/parsing-lexicon`        |
| Generic vacancy/CV text parsing                       | `@whiteslove/parsing-lexicon`        |
| Multilingual semantic vocabulary                      | `@whiteslove/parsing-lexicon`        |
| Canonical geography                                   | `@whiteslove/geo-catalog`            |
| Canonical coordinates                                 | `@whiteslove/geo-catalog`            |
| Geographic hierarchy/bounds                           | `@whiteslove/geo-catalog`            |
| Apartment crawling                                    | `flat-finder`                        |
| Apartment normalization                               | `flat-finder` + shared packages      |
| Apartment persistence/search                          | `flat-finder`                        |
| Apartment public API                                  | `flat-finder-backend:4000`           |
| Apartment website proxy/UI                            | Personal Site                        |
| Shared LLM extraction                                 | `ai-worker`                          |
| Shared translation inference                          | `ai-worker`                          |
| Shared vision inference                               | `ai-worker`                          |
| AI caller merge/precedence                            | calling application                  |
| Telegram MTProto channel transport                    | `Telegram-Worker-Userbot`            |
| Telegram domain parsing                               | caller/shared lexicon                |
| TG worker `/history` contract                         | `Telegram-Worker-Userbot`            |
| Candidate Telegram ingestion                          | Personal Site hiring domain          |
| Housing Telegram ingestion                            | Flat Finder                          |
| Housing coordinates fallback in Personal Site         | **Never**                            |
| Generic semantic regex added to Vue/Nitro as fallback | **Never**                            |
| Direct browser call to private AI/TG workers          | **Never**                            |
| Redis assumed as current Personal Site infrastructure | **Never**                            |

---

# 69. Prohibited patterns

Do not add a housing parser to Personal Site:

```js
if (/без комиссии|no commission/i.test(description)) {
  listing.commission = false
}
```

Do not add canonical coordinates:

```js
const DISTRICTS = {
  chilanzar: {
    lat: 41.27,
    lng: 69.20,
  },
}
```

Do not bypass AI Worker:

```js
await fetch('https://some-llm-provider/...', {
  // duplicate shared inference pipeline
})
```

Do not teach TG Worker the domain:

```js
return {
  text: message.text,
  salary: parseSalary(message.text),
  isVacancy: detectVacancy(message.text),
}
```

Do not bypass Flat Finder for apartments:

```js
// Personal Site starts scraping OLX housing directly
```

Do not expose private service URLs/keys:

```js
runtimeConfig.public.aiWorkerKey = ...
```

Do not revive obsolete infrastructure casually:

```yaml
redis:
  image: redis
```

just to solve a state-management bug.

---

# 70. Expected patterns

Apartment UI:

```text
app/
    ↓
Personal Site flats Nitro route
    ↓
Flat Finder API
```

Housing semantic fix:

```text
parsing-lexicon
    ↓
Flat Finder dependency bump
    ↓
normalized Flat Finder API
    ↓
Personal Site renders it
```

Geographic fix:

```text
geo-catalog
    ↓
Flat Finder dependency/integration
    ↓
Flat Finder API
    ↓
Personal Site
```

AI enrichment:

```text
Personal Site server/jobs-worker
    ↓
server/utils/aiWorker.ts contract
    ↓
ai-worker:4030
```

Telegram candidate source:

```text
Personal Site hiring
    ↓
TELEGRAM_WORKER_URL
    ↓
Telegram-Worker-Userbot
    ↓
raw Telegram messages
```

---

# 71. Definition of done: apartment change

An apartment-related Personal Site task is complete only when applicable items
below are true:

* the source of the apartment field was traced;
* Flat Finder ownership was respected;
* generic housing parsing was not duplicated locally;
* canonical geography was not duplicated locally;
* coordinates were not hard-coded locally;
* AI behavior was changed in the correct service;
* website proxy shaping remains presentation/integration logic;
* apartment API compatibility is preserved;
* Personal Site tests cover website-specific behavior;
* upstream tests cover upstream fixes;
* package/service versions actually used in production contain the fix.

---

# 72. Definition of done: parsing change

A parsing-related task is complete when:

* reusable semantics live in parsing-lexicon;
* tests exist in parsing-lexicon;
* false positives were considered;
* multilingual variants were considered;
* public exports expose the behavior;
* package version/pin is updated;
* Personal Site does not retain a duplicate fallback;
* downstream applications consume the canonical result.

---

# 73. Definition of done: geographic change

A geography-related task is complete when:

* canonical entity data lives in geo-catalog;
* canonical coordinates live in geo-catalog;
* hierarchy is correct;
* bounds/OSM metadata are correct where relevant;
* tests/validation pass;
* the actual consumer has been updated;
* Flat Finder serves corrected housing geography when housing is affected;
* Personal Site does not retain a duplicate coordinate/location catalog.

---

# 74. Definition of done: AI change

An AI-related task is complete when:

* deterministic parsing remains deterministic;
* probabilistic work belongs to AI Worker;
* prompt/schema/provider changes live in AI Worker;
* caller merge policy remains explicit;
* credentials remain server-only;
* API compatibility with both Personal Site and Flat Finder was considered;
* AI failure does not silently corrupt deterministic data;
* tests cover the changed contract.

---

# 75. Definition of done: Telegram worker change

A TG Worker task is complete when:

* the change is truly transport-related;
* no job/CV/housing domain parsing was moved into the worker;
* `/history`/`/photo` compatibility was considered;
* Personal Site caller compatibility was checked;
* Flat Finder caller compatibility was checked;
* `TG_SESSION` remains outside repositories;
* deployment under `/opt/tg-worker` remains healthy;
* the `tg-worker` service exposes the expected contract.

---

# 76. Core decision rule

When deciding where code belongs, use these questions.

```text
"How should this look on whiteslove.me?"
    → Personal Site app/

"What website/server adaptation is required?"
    → Personal Site server/

"How should jobs/hiring behave?"
    → Personal Site jobs/hiring domain

"What does this arbitrary human text mean?"
    → @whiteslove/parsing-lexicon

"What canonical place is this and where is it?"
    → @whiteslove/geo-catalog

"How are apartments crawled/stored/searched/enriched?"
    → flat-finder

"What should an LLM infer?"
    → ai-worker

"How do we retrieve raw Telegram channel data?"
    → Telegram-Worker-Userbot

"How do users subscribe through the site's Telegram bot?"
    → Personal-Site/subscription-bot
```

---

# 77. Final architecture principle

Do not turn Personal Site into an integration dumping ground.

The repositories exist because their responsibilities are reusable and
independent:

```text
parsing-lexicon
    = language knowledge

geo-catalog
    = geographic knowledge

flat-finder
    = apartment domain

ai-worker
    = shared probabilistic inference

Telegram-Worker-Userbot
    = Telegram transport

Personal-Site
    = website + jobs/hiring product + presentation/integration
```

When a bug becomes visible on the website, that does **not** automatically
mean the fix belongs in the website repository.

Trace the data to its owner, fix it there, then update the consumer.

Prefer one correct cross-repository fix over one local workaround that creates
a second source of truth.
