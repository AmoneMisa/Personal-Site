// GET /sitemap.xml — Nitro server route. Deliberately NOT under "/api/**" (that
// prefix is proxied to the FastAPI backend). Generates the XML sitemap from the
// static, indexable top-level routes. Per-document editor URLs
// (/services/pdf-editor/[docId]) are intentionally excluded — they are noindex.

const SITE_URL = "https://whiteslove.me";

// Indexable routes with a rough change frequency / priority.
const ROUTES: { path: string; changefreq: string; priority: number }[] = [
  { path: "/", changefreq: "weekly", priority: 1.0 },
  { path: "/services", changefreq: "weekly", priority: 0.9 },
  { path: "/jobs", changefreq: "daily", priority: 0.8 },
  { path: "/quizzes", changefreq: "monthly", priority: 0.6 },
  { path: "/quizzes/country-fit", changefreq: "monthly", priority: 0.6 },
  { path: "/services/converter", changefreq: "monthly", priority: 0.7 },
  { path: "/services/dockerhub", changefreq: "monthly", priority: 0.7 },
  { path: "/services/email-editor", changefreq: "monthly", priority: 0.7 },
  { path: "/services/markdown-editor", changefreq: "monthly", priority: 0.7 },
  { path: "/services/merge-json", changefreq: "monthly", priority: 0.7 },
  { path: "/services/pdf-editor", changefreq: "monthly", priority: 0.7 },
  { path: "/services/svg-editor", changefreq: "monthly", priority: 0.7 },
];

export default defineEventHandler((event) => {
  const lastmod = new Date().toISOString().slice(0, 10);

  const urls = ROUTES.map(
    (r) =>
      `  <url>\n` +
      `    <loc>${SITE_URL}${r.path}</loc>\n` +
      `    <lastmod>${lastmod}</lastmod>\n` +
      `    <changefreq>${r.changefreq}</changefreq>\n` +
      `    <priority>${r.priority.toFixed(1)}</priority>\n` +
      `  </url>`
  ).join("\n");

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${urls}\n` +
    `</urlset>\n`;

  setHeader(event, "content-type", "application/xml; charset=utf-8");
  setHeader(event, "cache-control", "public, max-age=3600");
  return xml;
});
