/**
 * Loads the cookieless Umami tracker through the same-origin /stats proxy
 * (server/routes/stats/[...path].ts). Nothing is injected until
 * NUXT_PUBLIC_UMAMI_WEBSITE_ID is configured, so dev and previews stay
 * untracked.
 *
 * Query strings are excluded because search filters can carry free text, and
 * browsers sending Do Not Track are not counted.
 */
export default defineNuxtPlugin(() => {
  const websiteId = String(useRuntimeConfig().public.umamiWebsiteId || '').trim()
  if (!websiteId) return

  useHead({
    script: [{
      src: '/stats/script.js',
      defer: true,
      'data-website-id': websiteId,
      'data-host-url': '/stats',
      'data-exclude-search': 'true',
      'data-do-not-track': 'true',
    }],
  })
})
