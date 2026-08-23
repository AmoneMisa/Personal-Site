export const WEB_CV_SOURCE_KEYS = [
  'flagma-uz',
  'careerist-uz',
  'rabotakz',
  'talent-ua',
  'flagma-ro',
] as const

export type WebCvSourceKey = (typeof WEB_CV_SOURCE_KEYS)[number]

function enabledKeys(): WebCvSourceKey[] {
  if (process.env.HIRING_WEB_CV_SOURCE === 'off') return []
  const raw = process.env.HIRING_WEB_CV_SOURCES?.trim()
  if (!raw) return [...WEB_CV_SOURCE_KEYS]
  const allowed = new Set(raw.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean))
  return WEB_CV_SOURCE_KEYS.filter((key) => allowed.has(key))
}

/** Runtime-neutral discovery for the generic web-CV adapters. */
export function hiringWebSourceHandles(): string[] {
  return enabledKeys().map((key) => `web:${key}`)
}
