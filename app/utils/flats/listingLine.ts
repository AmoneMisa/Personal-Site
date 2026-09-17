/**
 * The coloured line on a flat card. The backend decides the line
 * (whiteslove.me-backend-platform, identity/listing-line.js); the site only
 * validates the value and labels it.
 *
 * Wording describes the listing, never a verdict about a person: the lines are
 * automatic, and nobody reviews them.
 */

export const LISTING_LINES = ['steady', 'check', 'phantom_risk', 'multi_listing'] as const
export type ListingLine = typeof LISTING_LINES[number]

export function listingLineOf(value: unknown): ListingLine | null {
  return LISTING_LINES.includes(value as ListingLine) ? (value as ListingLine) : null
}

export type ListingLineLegendItem = { line: ListingLine | 'none'; title: string; hint: string }

const LEGEND: Record<'ru' | 'en', ListingLineLegendItem[]> = {
  ru: [
    { line: 'steady', title: 'Устойчивый рекламодатель', hint: 'Долгая история без расхождений' },
    { line: 'check', title: 'Нужна проверка', hint: 'Есть расхождения' },
    { line: 'phantom_risk', title: 'Похоже на фантом', hint: 'Будьте осторожны' },
    { line: 'multi_listing', title: 'У контакта есть', hint: 'ещё объявления' },
    { line: 'none', title: 'Обычные', hint: 'без метки' },
  ],
  en: [
    { line: 'steady', title: 'Steady advertiser', hint: 'Long history, no inconsistencies' },
    { line: 'check', title: 'Worth checking', hint: 'Some inconsistencies' },
    { line: 'phantom_risk', title: 'Looks like a phantom', hint: 'Be careful' },
    { line: 'multi_listing', title: 'Contact has', hint: 'other listings' },
    { line: 'none', title: 'Regular', hint: 'no line' },
  ],
}

export function listingLineLegend(locale: unknown): ListingLineLegendItem[] {
  return String(locale).startsWith('en') ? LEGEND.en : LEGEND.ru
}

/** Tooltip for a card's line, reusing the legend text. */
export function listingLineTitle(line: ListingLine | null, locale: unknown): string | undefined {
  if (!line) return undefined
  const item = listingLineLegend(locale).find((entry) => entry.line === line)
  if (!item) return undefined
  // The purple legend entry is one sentence split over two lines.
  return line === 'multi_listing' ? `${item.title} ${item.hint}` : `${item.title} — ${item.hint}`
}
