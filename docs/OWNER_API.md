# Owner API — editing site content from cURL / Postman

This is the owner-only surface for changing site content (translations, menus,
SEO settings, cards, testimonials, …) **without the admin UI** — driven straight
from cURL, Postman, or a script.

Import [`owner-api.postman_collection.json`](./owner-api.postman_collection.json)
into Postman to get every request below pre-built.

---

## 1. Base URL

The frontend proxies `/api/**` to the backend, so from the public domain use:

```
https://whiteslove.me/api
```

Locally against the backend directly:

```
http://localhost:8000
```

All paths below are relative to that base (e.g. `POST {base}/owner/apply`).

---

## 2. Authentication — two options

### Option A — static owner key (easiest for scripting)

Set `OWNER_API_KEY` in the backend `.env` (generate one with `openssl rand -hex 32`),
redeploy, then send it as a header on every write request:

```
X-Owner-Key: <your key>
```

No login, no token expiry. Reads (`GET`) are public and need no auth.

### Option B — admin Bearer token

Log in as the admin account and use the returned `access_token`:

```bash
curl -s https://whiteslove.me/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"••••••","remember_me":true}'
# -> { "access_token": "eyJ...", ... }
```

Then on writes:

```
Authorization: Bearer eyJ...
```

Either credential works on every `owner`/`settings` write endpoint.

---

## 3. Translations — fix copy, apply new keys

The live site reads all text from the DB, so this is how you fix things like the
hero H1 or remove template leftovers. `values` is keyed by language code.

```bash
curl -s -X POST https://whiteslove.me/api/owner/translations/apply \
  -H "X-Owner-Key: $OWNER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "upsert": [
      { "key": "hero.title",    "values": { "ru": "Маргарита — Frontend-разработчик", "en": "Margarita — Frontend Developer" } },
      { "key": "hero.subtitle", "values": { "ru": "Vue.js · Nuxt.js · TypeScript", "en": "Vue.js · Nuxt.js · TypeScript" } }
    ],
    "delete": [ "pricing.limitedOffer", "hero.title2" ]
  }'
```

Response: `{ "status": "ok", "upserted": 2, "deleted": 2, "languages": ["en","ru"] }`.
The per-language translation cache is invalidated automatically.

---

## 4. SEO settings (and any site-wide setting)

Free-form key/value store. Public `GET`, owner `PUT`/`DELETE`.

```bash
# Read everything (public)
curl -s https://whiteslove.me/api/settings

# Upsert several settings at once (owner)
curl -s -X PUT https://whiteslove.me/api/settings \
  -H "X-Owner-Key: $OWNER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "seo.ogImage": "https://whiteslove.me/images/og-default.png",
    "seo.canonicalBase": "https://whiteslove.me",
    "seo.robots": "index, follow",
    "seo.social": { "github": "https://github.com/AmoneMisa", "linkedin": "https://www.linkedin.com/in/…" }
  }'

# Delete one
curl -s -X DELETE https://whiteslove.me/api/settings/seo.robots \
  -H "X-Owner-Key: $OWNER_KEY"
```

---

## 5. Items — create / update / delete by JSON

Generic CRUD over whitelisted flat entities:

| entity              | model            | cache-busted |
|---------------------|------------------|:------------:|
| `testimonials`      | Testimonial      | ✅ |
| `feature-cards`     | FeatureCard      |    |
| `offer-cards`       | OfferCard        | ✅ |
| `price-cards`       | PriceCard        |    |
| `service-categories`| ServiceCategory  |    |
| `services`          | Service          |    |
| `tabs-underbutton`  | TabsUnderbutton  |    |
| `animated-text`     | AnimatedText     | ✅ |
| `contacts`          | Contact          |    |
| `languages`         | Language         |    |

> Nested structures (footer blocks + links, tabs-with-background + features) are
> **not** here — use their dedicated routers (`/footer/...`, `/tabs/...`) which
> understand the child relationships.

```bash
# List (owner)
curl -s https://whiteslove.me/api/owner/items/testimonials -H "X-Owner-Key: $OWNER_KEY"

# Create — id is auto-generated (uuid) when omitted
curl -s -X POST https://whiteslove.me/api/owner/items/testimonials \
  -H "X-Owner-Key: $OWNER_KEY" -H "Content-Type: application/json" \
  -d '{ "nameKey":"t.acme.name", "roleKey":"t.acme.role", "quoteKey":"t.acme.quote", "rating":5, "order":1, "isVisible":true }'

# Update
curl -s -X PATCH https://whiteslove.me/api/owner/items/testimonials/<id> \
  -H "X-Owner-Key: $OWNER_KEY" -H "Content-Type: application/json" \
  -d '{ "isVisible": false }'

# Delete
curl -s -X DELETE https://whiteslove.me/api/owner/items/testimonials/<id> \
  -H "X-Owner-Key: $OWNER_KEY"
```

Unknown JSON keys are ignored; only real columns are written. `createdAt` /
`updatedAt` are read-only.

---

## 6. Unified apply — one call, many changes

Translations + settings + header menu together:

```bash
curl -s -X POST https://whiteslove.me/api/owner/apply \
  -H "X-Owner-Key: $OWNER_KEY" -H "Content-Type: application/json" \
  -d '{
    "translations": { "upsert": [ { "key":"footer.about", "values": { "ru":"…", "en":"…" } } ] },
    "settings":     { "seo.ogImage": "https://whiteslove.me/images/og-default.png" },
    "headerMenu":   [ { "type":"simple", "labelKey":"menu.about", "href":"/cv" } ]
  }'
```

`headerMenu` **replaces** the whole menu array (send the full desired list).

---

## 7. Existing per-entity endpoints (admin token)

These pre-date the owner surface and take an **admin Bearer token** (not the
owner key): `PATCH /header-menu`, `POST/PATCH/DELETE /translations`,
`/footer/...`, `/feature-cards`, `/offer-cards`, `/service-categories`,
`/services`, `/tabs/...`, `/animated-text`, `/contacts`. See each router in
`src/routers/` for exact schemas. Prefer the `owner` endpoints above for
scripting — they also accept the static key.
