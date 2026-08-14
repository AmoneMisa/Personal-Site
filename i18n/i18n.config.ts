// vue-i18n runtime config. Keys missing in a locale (e.g. untranslated EN)
// fall back to Russian instead of showing the raw key.
export default defineI18nConfig(() => ({
  legacy: false,
  fallbackLocale: "ru",
}));
