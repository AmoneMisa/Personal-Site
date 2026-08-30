import {
  GENERIC_LANDMARK_TERMS,
  findCanonical,
} from '@whiteslove/parsing-lexicon'
import {
  geographyDisplayName,
  geographyMetroLabelWithAlias,
} from '@whiteslove/parsing-lexicon/geography-display'
import { dictionaryFor } from '@whiteslove/parsing-lexicon/locations'

export type LocationKind = 'country' | 'city' | 'district' | 'metro' | 'any'

type UiLanguage = 'ru' | 'en'

const CYRILLIC_RE = /\p{Script=Cyrillic}/u
const NON_RUSSIAN_CYRILLIC_RE = /[ІіЇїЄєҐґЎўҚқҒғҲҳӘәӨөҰұҮүҢң]/u
const ZONE_DICTIONARY_KEYS = ['microdistricts', 'mahallas', 'localAreas', 'developmentAreas'] as const

function uiLanguage(locale: string): UiLanguage {
  return String(locale).toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

function genericLandmarkDisplayName(value: string, locale: string): string {
  const landmark = findCanonical(value, GENERIC_LANDMARK_TERMS)
  if (!landmark) return value

  const labels = landmark.aliases?.[uiLanguage(locale)]
  return labels?.[0] || landmark.canonical || value
}

export function locationLabel(
  value: string | null | undefined,
  locale: string,
  kind: LocationKind = 'any',
): string {
  const exact = geographyDisplayName(value, locale, kind)
  const raw = String(value ?? '').trim()

  if (kind === 'any') {
    // Generic semantic landmarks (for example "Railway station") are canonical
    // values from parsing-lexicon too, but they are not administrative geography.
    // Resolve them from the shared landmark lexicon instead of maintaining a
    // second translation dictionary in Personal Site.
    return raw && exact === raw
      ? genericLandmarkDisplayName(raw, locale)
      : exact
  }

  // Some source feeds use a colloquial locality/metro name in the district
  // slot (Tashkent "Minor" is a common example). The geography package already
  // knows the localized display name, just under another presentation kind.
  // Do not expose the canonical English token merely because the source chose
  // a looser field; fall back to the package's cross-kind display dictionary.
  return raw && exact === raw
    ? geographyDisplayName(value, locale, 'any')
    : exact
}

export function metroLabelWithAlias(value: string | null | undefined, locale: string): string {
  return geographyMetroLabelWithAlias(value, locale)
}

function preferredDictionaryAlias(entry: any, locale: string): string | null {
  if (!entry) return null
  const aliases = (entry.aliases || []).map((value: unknown) => String(value).trim()).filter(Boolean)
  if (uiLanguage(locale) !== 'ru') return entry.canonical || entry.name || null

  return aliases.find((alias: string) => CYRILLIC_RE.test(alias) && !NON_RUSSIAN_CYRILLIC_RE.test(alias))
    || aliases.find((alias: string) => CYRILLIC_RE.test(alias))
    || entry.canonical
    || entry.name
    || null
}

function dictionaryZoneLabel(
  raw: string,
  locale: string,
  countryCode: string,
  cityName: string,
): string | null {
  if (!countryCode || !cityName) return null
  const dictionary = dictionaryFor(countryCode, cityName) as Record<string, any[]> | null
  if (!dictionary) return null

  for (const key of ZONE_DICTIONARY_KEYS) {
    const entry = (dictionary[key] || []).find((candidate: any) =>
      candidate?.canonical === raw
      || candidate?.name === raw
      || candidate?.aliases?.includes(raw),
    )
    if (!entry) continue
    return preferredDictionaryAlias(entry, locale)
  }
  return null
}

function directZoneLabel(
  raw: string,
  locale: string,
  countryCode: string,
  cityName: string,
): string | null {
  for (const kind of ['city', 'district', 'microdistrict', 'metro'] as const) {
    const translated = geographyDisplayName(raw, locale, kind)
    if (translated && translated !== raw) return translated
  }
  const dictionary = dictionaryZoneLabel(raw, locale, countryCode, cityName)
  return dictionary && dictionary !== raw ? dictionary : null
}

// Canonical map-zone names come from geo-catalog, while reusable multilingual
// aliases belong to parsing-lexicon. Keep raw canonical values as filter values
// and derive only the visible label here from the shared packages.
export function zoneNameLabel(
  value: string | null | undefined,
  locale: string,
  countryCode = '',
  cityName = '',
): string {
  const raw = String(value ?? '').trim()
  if (!raw) return raw

  const direct = directZoneLabel(raw, locale, countryCode, cityName)
  if (direct) return direct

  // Numbered/composite zones (for example "Karasu-3" or "Chilanzar-20A")
  // can reuse the shared display/alias for their base token while preserving
  // the canonical suffix used by filtering and routing.
  const separatorIndex = raw.indexOf('-')
  if (separatorIndex > 0) {
    const prefix = raw.slice(0, separatorIndex)
    const suffix = raw.slice(separatorIndex)
    const translated = directZoneLabel(prefix, locale, countryCode, cityName)
    if (translated) return `${translated}${suffix}`
  }

  return raw
}
