const FORBIDDEN_TAGS = new Set([
  'script',
  'foreignobject',
  'iframe',
  'object',
  'embed',
  'audio',
  'video',
  'source',
  'link',
  'meta',
  'base',
])

const URL_BEARING_ATTRIBUTES = new Set([
  'href',
  'xlink:href',
  'src',
  'fill',
  'stroke',
  'filter',
  'clip-path',
  'mask',
  'marker-start',
  'marker-mid',
  'marker-end',
  'cursor',
])

const SAFE_RASTER_DATA_URL = /^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i
const FRAGMENT_REFERENCE = /^#[A-Za-z_][\w:.-]*$/
const CSS_URL_RE = /url\(\s*(['"]?)(.*?)\1\s*\)/gi
const UNSAFE_CSS_RE = /(?:@import|expression\s*\(|javascript\s*:|vbscript\s*:|data\s*:\s*text\/html)/i

export type SvgParseFailure = 'empty' | 'noSvgRoot' | 'parse'

export type SanitizedSvgResult =
  | { ok: true; doc: Document; svg: SVGElement; markup: string }
  | { ok: false; reason: SvgParseFailure }

function isSafeResourceReference(value: string, allowRasterData: boolean): boolean {
  const normalized = value.trim()
  if (!normalized) return true
  if (FRAGMENT_REFERENCE.test(normalized)) return true
  return allowRasterData && SAFE_RASTER_DATA_URL.test(normalized)
}

function hasOnlySafeCssUrls(value: string): boolean {
  if (UNSAFE_CSS_RE.test(value)) return false

  CSS_URL_RE.lastIndex = 0
  for (const match of value.matchAll(CSS_URL_RE)) {
    if (!isSafeResourceReference(match[2] || '', false)) return false
  }
  return true
}

function sanitizeElement(element: Element) {
  const tag = element.localName.toLowerCase()
  if (FORBIDDEN_TAGS.has(tag)) {
    element.remove()
    return
  }

  if (tag === 'style') {
    if (!hasOnlySafeCssUrls(element.textContent || '')) {
      element.remove()
      return
    }
  }

  for (const attribute of [...element.attributes]) {
    const name = attribute.name.toLowerCase()
    const value = attribute.value.trim()

    if (name.startsWith('on')) {
      element.removeAttribute(attribute.name)
      continue
    }

    if (name === 'style') {
      if (!hasOnlySafeCssUrls(value)) element.removeAttribute(attribute.name)
      continue
    }

    if (!URL_BEARING_ATTRIBUTES.has(name)) continue

    const allowRasterData = (name === 'href' || name === 'xlink:href')
      && (tag === 'image' || tag === 'feimage')

    if (value.toLowerCase().includes('url(')) {
      if (!hasOnlySafeCssUrls(value)) element.removeAttribute(attribute.name)
      continue
    }

    if (!isSafeResourceReference(value, allowRasterData)) {
      element.removeAttribute(attribute.name)
    }
  }

  for (const child of [...element.children]) sanitizeElement(child)
}

/**
 * Parse and sanitize untrusted SVG before it is serialized, rendered through
 * `v-html`, or mounted with `innerHTML` for geometry inspection.
 */
export function parseAndSanitizeSvg(raw: string): SanitizedSvgResult {
  const source = String(raw || '').trim()
  if (!source) return { ok: false, reason: 'empty' }
  if (!/<svg[\s>]/i.test(source)) return { ok: false, reason: 'noSvgRoot' }

  try {
    const doc = new DOMParser().parseFromString(source, 'image/svg+xml')
    if (doc.getElementsByTagName('parsererror')[0]) {
      return { ok: false, reason: 'parse' }
    }

    const root = doc.documentElement
    if (!(root instanceof SVGElement) || root.localName.toLowerCase() !== 'svg') {
      return { ok: false, reason: 'noSvgRoot' }
    }

    sanitizeElement(root)
    const markup = new XMLSerializer().serializeToString(root)
    return { ok: true, doc, svg: root, markup }
  } catch {
    return { ok: false, reason: 'parse' }
  }
}

export function sanitizeSvgMarkup(raw: string): string | null {
  const result = parseAndSanitizeSvg(raw)
  return result.ok ? result.markup : null
}
