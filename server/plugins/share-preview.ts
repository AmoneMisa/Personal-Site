import {
  SHARE_SITE_URL,
  buildFlatShareMeta,
  buildJobShareMeta,
  escapeXml,
  findSharedFlat,
  findSharedJob,
  flatPhotoUrl,
} from '../utils/sharePreview'
import { removeExistingSocialMeta } from '../utils/shareHead'

function queryValue(value: unknown): string {
  return Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '')
}

function isTelegramPhoto(value: string): boolean {
  return /^\/api\/tg-photo\/[A-Za-z0-9_]{3,64}\/\d+$/.test(value)
}

function absoluteFlatImage(flat: any): string {
  const photo = flatPhotoUrl(flat)
  if (!photo) return `${SHARE_SITE_URL}/web-app-manifest-512x512.png`

  // Public HTTPS listing photos can be consumed by Telegram directly.
  if (/^https:\/\//i.test(photo)) return photo

  // Telegram listing images live on the HTTP flat-finder backend. Proxy them
  // through whiteslove.me so social crawlers can fetch them over HTTPS.
  if (isTelegramPhoto(photo)) {
    return `${SHARE_SITE_URL}/flats-photo?path=${encodeURIComponent(photo)}`
  }

  return `${SHARE_SITE_URL}/web-app-manifest-512x512.png`
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:html', async (html, { event }) => {
    const requestUrl = getRequestURL(event)
    const pathname = requestUrl.pathname.replace(/\/$/, '') || '/'
    const query = getQuery(event)

    let meta = null

    if (pathname === '/flat-finder' || pathname === '/en/flat-finder') {
      const id = queryValue(query.flat).trim()
      if (!id) return

      const source = queryValue(query.flatSource).trim().toLowerCase()
      const country = queryValue(query.flatCountry).trim().toUpperCase()
      const flat = await findSharedFlat(id, source, country)

      // A shared link must always produce a card. When the lookup misses (cold
      // snapshot, expired listing, slow upstream) we still emit a generic
      // preview instead of returning early — otherwise the crawler receives no
      // usable tags and the chat shows an endless "generating preview".
      meta = flat
        ? buildFlatShareMeta(flat, id, source, country, pathname)
        : {
            title: 'Property listing · Flat Finder',
            description: 'Apartment and house search across Uzbekistan, Kazakhstan, Ukraine and Romania.',
            image: `${SHARE_SITE_URL}/web-app-manifest-512x512.png`,
            imageType: 'image/png' as const,
            url: `${SHARE_SITE_URL}${pathname}?flat=${encodeURIComponent(id)}`,
            type: 'website' as const,
          }
      if (flat) meta.image = absoluteFlatImage(flat)
    } else if (pathname === '/jobs' || pathname === '/en/jobs') {
      const id = queryValue(query.job).trim()
      if (!id) return

      const job = await findSharedJob(id)
      if (!job) return

      meta = buildJobShareMeta(job, id, pathname)
      // Until a vacancy-specific renderer is introduced, use a guaranteed,
      // same-origin image instead of the old /share/job-og.png URL (which did
      // not have a Nitro route and therefore returned 404).
      meta.image = `${SHARE_SITE_URL}/web-app-manifest-512x512.png`
    }

    if (!meta) return

    // Keep the declared type honest: absoluteFlatImage may fall back to a PNG
    // even though listing photos are normally JPEG.
    meta.imageType = /\.png(?:$|\?)/i.test(meta.image) ? 'image/png' : 'image/jpeg'

    html.head = removeExistingSocialMeta(html.head)
    html.head.push(
      `<meta property="og:type" content="${escapeXml(meta.type)}">`,
      `<meta property="og:site_name" content="whiteslove.me">`,
      `<meta property="og:title" content="${escapeXml(meta.title)}">`,
      `<meta property="og:description" content="${escapeXml(meta.description)}">`,
      `<meta property="og:url" content="${escapeXml(meta.url)}">`,
      `<meta property="og:image" content="${escapeXml(meta.image)}">`,
      // secure_url + type help Telegram accept the image. Dimensions are
      // deliberately NOT declared: the real photo size is unknown here, and a
      // wrong width/height breaks card rendering worse than omitting it.
      `<meta property="og:image:secure_url" content="${escapeXml(meta.image)}">`,
      `<meta property="og:image:type" content="${escapeXml(meta.imageType)}">`,
      `<meta property="og:image:alt" content="${escapeXml(meta.title)}">`,
      '<meta name="twitter:card" content="summary_large_image">',
      `<meta name="twitter:title" content="${escapeXml(meta.title)}">`,
      `<meta name="twitter:description" content="${escapeXml(meta.description)}">`,
      `<meta name="twitter:image" content="${escapeXml(meta.image)}">`,
    )
  })
})
