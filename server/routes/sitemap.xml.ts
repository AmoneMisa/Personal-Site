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
const DEFAULT_LOCALE = LOCALES[0];

// Indexable routes with a rough change frequency / priority.
const ROUTES: { path: string; changefreq: string; priority: number }[] = [
  { path: "/", changefreq: "weekly", priority: 1.0 },
  { path: "/about", changefreq: "monthly", priority: 0.8 },
  { path: "/projects", changefreq: "monthly", priority: 0.8 },
  { path: "/cv", changefreq: "monthly", priority: 0.9 },
  { path: "/services", changefreq: "weekly", priority: 0.9 },
  { path: "/jobs", changefreq: "daily", priority: 0.8 },
  { path: "/hiring", changefreq: "daily", priority: 0.8 },
  { path: "/flat-finder", changefreq: "daily", priority: 0.8 },
  { path: "/quizzes", changefreq: "monthly", priority: 0.6 },
  { path: "/quizzes/country-fit", changefreq: "monthly", priority: 0.6 },
  { path: "/quizzes/career-fit", changefreq: "monthly", priority: 0.6 },
  { path: "/quizzes/life-values", changefreq: "monthly", priority: 0.6 },
  { path: "/services/converter", changefreq: "monthly", priority: 0.7 },
  { path: "/services/dockerhub", changefreq: "monthly", priority: 0.7 },
  { path: "/services/email-editor", changefreq: "monthly", priority: 0.7 },
  { path: "/services/markdown-editor", changefreq: "monthly", priority: 0.7 },
  { path: "/services/merge-json", changefreq: "monthly", priority: 0.7 },
  { path: "/services/pdf-editor", changefreq: "monthly", priority: 0.7 },
  { path: "/services/svg-editor", changefreq: "monthly", priority: 0.7 },
  { path: "/services/workflow-validator", changefreq: "monthly", priority: 0.7 },
];

// Build the absolute URL for a route in a given locale. The home path "/" must
// not become "/en/" — the prefixed home is just "/en".
function localeUrl(prefix: string, path: string): string {
  if (path === "/") return `${SITE_URL}${prefix || "/"}`;
  return `${SITE_URL}${prefix}${path}`;
}

export default defineEventHandler((event) => {
  const lastmod = new Date().toISOString().slice(0, 10);

  const urls: string[] = [];

  for (const route of ROUTES) {
    // Shared set of hreflang alternates for this route (same for every locale's
    // <url> entry), plus x-default pointing at the default-locale URL.
    const alternates = [
      ...LOCALES.map(
        (l) =>
          `    <xhtml:link rel="alternate" hreflang="${l.code}" href="${localeUrl(l.prefix, route.path)}"/>`
      ),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${localeUrl(DEFAULT_LOCALE.prefix, route.path)}"/>`,
    ].join("\n");

    for (const l of LOCALES) {
      urls.push(
        `  <url>\n` +
          `    <loc>${localeUrl(l.prefix, route.path)}</loc>\n` +
          `    <lastmod>${lastmod}</lastmod>\n` +
          `    <changefreq>${route.changefreq}</changefreq>\n` +
          `    <priority>${route.priority.toFixed(1)}</priority>\n` +
          `${alternates}\n` +
          `  </url>`
      );
    }
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n` +
    `        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    `${urls.join("\n")}\n` +
    `</urlset>\n`;

  setHeader(event, "content-type", "application/xml; charset=utf-8");
  setHeader(event, "cache-control", "public, max-age=3600");
  return xml;
});
