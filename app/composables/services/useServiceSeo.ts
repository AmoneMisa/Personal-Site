const SITE_URL = "https://whiteslove.me";

export function useServiceSeo(pageKey: string, options: {robots?: string} = {}) {
  const {t, locale} = useI18n();
  const route = useRoute();
  const prefix = `seo.pages.${pageKey}`;

  useSeoMeta({
    title: () => t(`${prefix}.title`),
    description: () => t(`${prefix}.description`),
    robots: options.robots ?? (() => t("seo.common.robots")),
    ogType: "website",
    ogSiteName: () => t("seo.common.siteName"),
    ogTitle: () => t(`${prefix}.ogTitle`),
    ogDescription: () => t(`${prefix}.ogDescription`),
  });

  // noindex pages (per-document editors) get no structured data.
  if (options.robots?.includes("noindex")) return;

  const isCatalog = pageKey === "services";

  useHead(() => {
    const localePrefix = locale.value === "ru" ? "" : `/${locale.value}`;
    const pageUrl = `${SITE_URL}${route.path === "/" ? "" : route.path}`;
    const crumbs = [
      {name: t("seo.common.breadcrumbHome"), url: `${SITE_URL}${localePrefix || "/"}`},
      {name: t("seo.common.breadcrumbServices"), url: `${SITE_URL}${localePrefix}/services`},
      ...(isCatalog ? [] : [{name: t(`${prefix}.ogTitle`), url: pageUrl}]),
    ];

    const graph: Record<string, unknown>[] = [
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: crumbs.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: c.name,
          item: c.url,
        })),
      },
    ];

    if (!isCatalog) {
      graph.push({
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: t(`${prefix}.ogTitle`),
        description: t(`${prefix}.description`),
        url: pageUrl,
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "Any",
        inLanguage: locale.value,
        isAccessibleForFree: true,
        offers: {"@type": "Offer", price: "0", priceCurrency: "USD"},
        author: {"@id": `${SITE_URL}/#person`},
      });
    }

    return {
      script: graph.map((item, i) => ({
        key: `service-ld-${i}`,
        type: "application/ld+json",
        innerHTML: JSON.stringify(item),
      })),
    };
  });
}
