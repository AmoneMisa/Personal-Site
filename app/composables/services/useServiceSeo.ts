export function useServiceSeo(pageKey: string, options: {robots?: string} = {}) {
  const {t} = useI18n();
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
}
