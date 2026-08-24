import {
  buildCandidateShareMeta,
  buildFlatShareMeta,
  buildJobShareMeta,
  escapeXml,
  findSharedCandidate,
  findSharedFlat,
  findSharedJob,
} from '../utils/sharePreview'
import { removeExistingSocialMeta } from '../utils/shareHead'

function queryValue(value: unknown): string {
  return Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '')
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

      // Shared links must keep a valid card even after an item expires or while
      // its source snapshot is warming. The builders provide the same 1200x630
      // fallback renderer when item data is temporarily unavailable.
      meta = buildFlatShareMeta(flat || {}, id, source, country, pathname)
    } else if (pathname === '/jobs' || pathname === '/en/jobs') {
      const id = queryValue(query.job).trim()
      if (!id) return

      const job = await findSharedJob(id)
      meta = buildJobShareMeta(job || {}, id, pathname)
    } else if (pathname === '/hiring' || pathname === '/en/hiring') {
      const id = queryValue(query.cv).trim()
      if (!id) return

      const source = queryValue(query.cvSource).trim().toLowerCase()
      const country = queryValue(query.cvCountry).trim().toUpperCase()
      const candidate = await findSharedCandidate(id)
      meta = buildCandidateShareMeta(candidate || {}, id, source, country, pathname)
    }

    if (!meta) return

    html.head = removeExistingSocialMeta(html.head)
    html.head.push(
      `<meta property="og:type" content="${escapeXml(meta.type)}">`,
      `<meta property="og:site_name" content="whiteslove.me">`,
      `<meta property="og:title" content="${escapeXml(meta.title)}">`,
      `<meta property="og:description" content="${escapeXml(meta.description)}">`,
      `<meta property="og:url" content="${escapeXml(meta.url)}">`,
      `<meta property="og:image" content="${escapeXml(meta.image)}">`,
      // Every share image comes from the same renderer, so format and dimensions
      // are stable enough for Telegram, LinkedIn and Twitter/X to trust.
      `<meta property="og:image:secure_url" content="${escapeXml(meta.image)}">`,
      `<meta property="og:image:type" content="${escapeXml(meta.imageType)}">`,
      '<meta property="og:image:width" content="1200">',
      '<meta property="og:image:height" content="630">',
      `<meta property="og:image:alt" content="${escapeXml(meta.title)}">`,
      '<meta name="twitter:card" content="summary_large_image">',
      `<meta name="twitter:title" content="${escapeXml(meta.title)}">`,
      `<meta name="twitter:description" content="${escapeXml(meta.description)}">`,
      `<meta name="twitter:image" content="${escapeXml(meta.image)}">`,
      `<meta name="twitter:image:alt" content="${escapeXml(meta.title)}">`,
    )
  })
})
