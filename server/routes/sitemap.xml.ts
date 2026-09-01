// GET /sitemap.xml — Nitro server route. Deliberately NOT under "/api/**" (that
// prefix is proxied to the FastAPI backend). Generates the XML sitemap from the
// static, indexable top-level routes. Per-document editor URLs
// (/services/pdf-editor/[docId]) are intentionally excluded — they are noindex.
//
// The site uses i18n strategy "prefix_except_default": Russian (default) lives at
// "/", other locales are prefixed ("/en/..."). For every indexable route we emit
// one <url> per locale, and inside each we list all locales as <xhtml:link>
// hreflang alternates (+ x-default -> the default/ru URL) so search engines pick
// the right language per user. Keep this list in sync with actual pages.

const SITE_URL = "https://whiteslove.me";

// Locales in priority order. The first entry is the default and stays unprefixed.
const LOCALES: { code: string; prefix: string }[] = [
  { code: "ru", prefix: "" },       // default -> unprefixed at "/"
  { code: "en", prefix: "/en" },
];


// Indexable routes with a rough change frequency / priority.


// Build the absolute URL for a route in a given locale. The home path "/" must
// not become "/en/" — the prefixed home is just "/en".


