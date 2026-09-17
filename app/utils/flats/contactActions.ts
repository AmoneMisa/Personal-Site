/**
 * Which contact buttons a listing card shows.
 *
 * The backend builds `contactActions` (whiteslove.me-backend-platform,
 * listing-contact-actions.js) with scheme-allowlisted hrefs. The card only
 * chooses and orders them: one button per channel, most direct first, and
 * only actions that actually have a link (§58: show available actions only).
 * The href is re-checked here anyway, because it ends up in an anchor.
 */

export type ContactAction = {
  channel: string
  action: string
  availability: string
  href?: string
  label?: string
  derivedFromPhone?: boolean
}

export type CardContactButton = {
  channel: 'phone' | 'telegram' | 'whatsapp' | 'viber' | 'email' | 'facebook' | 'threads'
  href: string
  external: boolean
  derivedFromPhone: boolean
}

const CHANNEL_ORDER = ['phone', 'telegram', 'whatsapp', 'viber', 'email', 'facebook', 'threads'] as const
const SAFE_HREF = /^(tel:\+\d{7,15}|mailto:[^\s<>"'`\\]+|https:\/\/[^\s<>"'`\\]+|tg:\/\/resolve\?phone=\d{7,15}|viber:\/\/chat\?number=[^\s<>"'`\\]+)$/u

export function isSafeContactHref(href: unknown): href is string {
  return typeof href === 'string' && SAFE_HREF.test(href)
}

export function cardContactButtons(actions: unknown): CardContactButton[] {
  if (!Array.isArray(actions)) return []
  const byChannel = new Map<string, CardContactButton>()
  for (const item of actions as ContactAction[]) {
    if (!item || !CHANNEL_ORDER.includes(item.channel as CardContactButton['channel'])) continue
    if (!['call', 'message', 'email', 'open_profile'].includes(item.action)) continue
    if (!isSafeContactHref(item.href)) continue
    const existing = byChannel.get(item.channel)
    // A real account beats one derived from a phone number; otherwise the
    // first action for a channel wins (the backend lists the primary one first).
    if (existing && !(existing.derivedFromPhone && !item.derivedFromPhone)) continue
    byChannel.set(item.channel, {
      channel: item.channel as CardContactButton['channel'],
      href: item.href,
      external: item.href.startsWith('https:'),
      derivedFromPhone: item.derivedFromPhone === true,
    })
  }
  return CHANNEL_ORDER.map((channel) => byChannel.get(channel)).filter((button): button is CardContactButton => Boolean(button))
}
