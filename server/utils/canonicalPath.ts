import { INDEXABLE_ROUTES } from "./indexableRoutes";

const INDEXABLE_PATHS = new Set(INDEXABLE_ROUTES.map((route) => route.path));

// Returns the canonical spelling of a known indexable page path when the request
// used another one (upper case, trailing slash), otherwise null. Only the static
// routes in the sitemap are considered: dynamic routes such as
// /services/pdf-editor/[docId] can have case-sensitive segments and must never
// be rewritten.
export function canonicalIndexablePath(pathname: string): string | null {
  const trimmed = pathname.length > 1 ? pathname.replace(/\/+$/, "") || "/" : pathname;
  const lower = trimmed.toLowerCase();
  const bare = lower === "/en" ? "/" : lower.startsWith("/en/") ? lower.slice(3) : lower;

  if (!INDEXABLE_PATHS.has(bare)) return null;
  return lower === pathname ? null : lower;
}
