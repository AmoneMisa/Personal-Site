/**
 * Nuxt may group several head tags in one string. Remove only the social meta
 * elements themselves: filtering the whole string also removes the stylesheet
 * and module-script tags that happen to share that entry.
 */
const SOCIAL_META_RE =
  /<meta\b[^>]*(?:property|name)\s*=\s*["'](?:og:[^"']+|twitter:[^"']+)["'][^>]*>\s*/giu

export function removeExistingSocialMeta(head: string[]): string[] {
  return head
    .map((entry) => entry.replace(SOCIAL_META_RE, ''))
    .filter((entry) => entry.trim().length > 0)
}

function decodeHeadText(text: string): string {
  const entities: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' }
  return text.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (match, entity: string) => {
    if (!entity.startsWith('#')) return entities[entity.toLowerCase()] || match
    const value = entity[1]?.toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1))
    return value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : match
  })
}

// Use the final SSR page title, including localized quiz titles. Entity cards
// replace this default later in the same render hook when an item is selected.
export function withPageShareImage(head: string[], pathname: string, siteUrl: string): string[] {
  const markup = head.join('')
  const metaText = (key: string) => {
    for (const tag of markup.match(/<meta\b[^>]*>/gi) || []) {
      const name = tag.match(/(?:name|property)\s*=\s*["']([^"']*)["']/i)?.[1]
      if (name !== key) continue
      return decodeHeadText(tag.match(/content\s*=\s*"([^"]*)"|content\s*=\s*'([^']*)'/i)?.slice(1).find(value => value !== undefined) || '')
    }
    return ''
  }
  const title = metaText('og:title') || decodeHeadText(markup.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || 'WhitesLove')
  const description = metaText('og:description') || metaText('description')
  const page = pathname.replace(/^\/en(?=\/|$)/, '').split('/')[1]
  const kinds: Record<string, string> = { quizzes: 'quiz', jobs: 'job', hiring: 'candidate', 'flat-finder': 'flat' }
  const kind = kinds[page || ''] || 'site'
  const params = new URLSearchParams({ kind, title: title.slice(0, 150), description: description.slice(0, 210), v: '2' })
  const image = `${siteUrl}/share-og.png?${params}`.replace(/&/g, '&amp;')
  const alt = title.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const imageTags = /<meta\b[^>]*(?:property|name)\s*=\s*["'](?:og:image(?::(?:secure_url|alt))?|twitter:image(?::alt)?)["'][^>]*>\s*/giu
  return [
    ...head.map(entry => entry.replace(imageTags, '')),
    `<meta property="og:image" content="${image}">`,
    `<meta property="og:image:secure_url" content="${image}">`,
    `<meta name="twitter:image" content="${image}">`,
    `<meta property="og:image:alt" content="${alt}">`,
    `<meta name="twitter:image:alt" content="${alt}">`,
  ]
}
