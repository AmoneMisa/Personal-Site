export const SECONDARY_WEB_SOURCE_KEYS = [
  'novarobota-ua',
  'layboard-kz',
  'amountwork-ro',
] as const

export type SecondaryWebSourceKey = (typeof SECONDARY_WEB_SOURCE_KEYS)[number]

function enabledKeys(): SecondaryWebSourceKey[] {
  if (process.env.HIRING_SECONDARY_WEB_CV_SOURCE === 'off') return []
  const raw = process.env.HIRING_SECONDARY_WEB_CV_SOURCES?.trim()
  if (!raw) return [...SECONDARY_WEB_SOURCE_KEYS]
  const allowed = new Set(raw.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean))
  return SECONDARY_WEB_SOURCE_KEYS.filter((key) => allowed.has(key))
}

/** Runtime-neutral discovery for the secondary web-CV adapters. */
export function hiringSecondaryWebSourceHandles(): string[] {
  return enabledKeys().map((key) => `web:${key}`)
}
