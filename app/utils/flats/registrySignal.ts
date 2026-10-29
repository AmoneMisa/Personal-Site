/**
 * The note a listing carries when its contact is in the realtor registry
 * (whiteslove.me-backend-platform, flats registrySignal / registrySources).
 *
 * Wording describes the listing's contact, never a verdict about a person: the match is automatic, by contact, and the
 * registry is hand-kept and may be wrong. The links are the public sources the registry's classification rests on.
 */

export const REGISTRY_SIGNALS = ['hidden_agent', 'flagged', 'trusted'] as const
export type RegistrySignal = typeof REGISTRY_SIGNALS[number]

export function registrySignalOf(value: unknown): RegistrySignal | null {
  return REGISTRY_SIGNALS.includes(value as RegistrySignal) ? (value as RegistrySignal) : null
}

export type RegistrySource = { href: string; host: string }

/** Public http(s) links only, at most three, shown by host. Anything else the backend sends is dropped. */
export function registrySourcesOf(value: unknown): RegistrySource[] {
  if (!Array.isArray(value)) return []
  const out: RegistrySource[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const url = URL.canParse(item) ? new URL(item) : null
    if (!url) continue
    if (url.protocol !== 'https:' && url.protocol !== 'http:') continue
    if (out.some((source) => source.href === url.href)) continue
    out.push({ href: url.href, host: url.hostname.replace(/^www\./, '') })
    if (out.length === 3) break
  }
  return out
}

const TEXT: Record<'ru' | 'en', Record<RegistrySignal | 'caveat' | 'sources', string>> = {
  ru: {
    hidden_agent: 'Контакт этого объявления есть в нашем реестре как посредник, который публикует объявления как собственник.',
    flagged: 'Контакт этого объявления есть в нашем реестре с негативной пометкой. Проверьте объявление внимательно.',
    trusted: 'Контакт этого объявления есть в нашем реестре как проверенный посредник.',
    caveat: 'Метка автоматическая, по контакту; реестр ведётся вручную и может ошибаться.',
    sources: 'Основания:',
  },
  en: {
    hidden_agent: "This listing's contact is in our registry as an agent who publishes listings as an owner.",
    flagged: "This listing's contact is in our registry with a negative note. Check the listing carefully.",
    trusted: "This listing's contact is in our registry as a trusted agent.",
    caveat: 'The note is automatic, by contact; the registry is kept by hand and may be wrong.',
    sources: 'Basis:',
  },
}

export function registryText(locale: unknown) {
  return String(locale).startsWith('en') ? TEXT.en : TEXT.ru
}
