import {
  SHARE_SITE_URL,
  buildCandidateShareMeta,
  buildFlatShareMeta,
  buildJobShareMeta,
  escapeXml,
  findSharedFlat,
} from '../utils/sharePreview'
import {
  findPlatformSharedCandidate,
  findPlatformSharedJob,
} from '../utils/backendPlatformShareLookup'
import { removeExistingSocialMeta } from '../utils/shareHead'

function queryValue(value: unknown): string {
  return Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '')
}

function cleanEntityUrl(pathname: string, publicId: string): string {
  return `${SHARE_SITE_URL}${pathname}?adv=${encodeURIComponent(publicId)}`
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
      const publicId = queryValue(query.adv).trim()
      const legacyId = queryValue(query.job).trim()
      const id = publicId || legacyId
      if (!id) return

      const job = await findPlatformSharedJob(id, Boolean(publicId))
      meta = buildJobShareMeta(job || {}, String(job?.id || id), pathname)
      if (publicId) meta.url = cleanEntityUrl(pathname, publicId)
    } else if (pathname === '/hiring' || pathname === '/en/hiring') {
      const publicId = queryValue(query.adv).trim()
      const legacyId = queryValue(query.cv).trim()
      const id = publicId || legacyId
      if (!id) return

      const source = queryValue(query.cvSource).trim().toLowerCase()
      const country = queryValue(query.cvCountry).trim().toUpperCase()
      const candidate = await findPlatformSharedCandidate(id, Boolean(publicId), source, country)
      const candidateId = String(candidate?.id || id)
      const candidateSource = String(candidate?.sourceKey || candidate?.source || source)
      const candidateCountry = String(candidate?.country || country)
      meta = buildCandidateShareMeta(candidate || {}, candidateId, candidateSource, candidateCountry, pathname)
      if (publicId) meta.url = cleanEntityUrl(pathname, publicId)
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
