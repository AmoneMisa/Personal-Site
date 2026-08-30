import {
  GENERIC_LANDMARK_TERMS,
  dictionaryFor,
  findCanonical,
  type CountryCode,
  type LocationEntry,
} from '@whiteslove/parsing-lexicon'
import {
  geographyDisplayName,
  geographyMetroLabelWithAlias,
} from '@whiteslove/parsing-lexicon/geography-display'

export type LocationKind = 'country' | 'city' | 'district' | 'metro' | 'any'

type UiLanguage = 'ru' | 'en'
type ZoneDictionaryKey = 'microdistricts' | 'mahallas' | 'localAreas' | 'developmentAreas'

const CYRILLIC_RE = /\p{Script=Cyrillic}/u
const NON_RUSSIAN_CYRILLIC_RE = /[ІіЇїЄєҐґЎўҚқҒғҲҳӘәӨөҰұҮүҢң]/u
const UZBEK_CYRILLIC_SUFFIX_RE = /\b(?:массиви|махалласи|даҳаси|дахаси|мавзеси)\b/iu
const COMPACT_ZONE_SUFFIX_RE = /\s+(?:массив|массиви|микрорайон|мкр|квартал|махалла|махалласи|даха|дахаси|даҳаси|мавзе|мавзеси)$/iu
const ZONE_DICTIONARY_KEYS: readonly ZoneDictionaryKey[] = ['microdistricts', 'mahallas', 'localAreas', 'developmentAreas']

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

function compactZoneBase(label: string): string {
  return label.replace(COMPACT_ZONE_SUFFIX_RE, '').trim() || label
}

function preferredDictionaryAlias(entry: LocationEntry, locale: string, compactBase = false): string | null {
  const aliases = entry.aliases.map((value) => String(value).trim()).filter(Boolean)
  if (uiLanguage(locale) !== 'ru') return entry.canonical || entry.name || null

  const cyrillic = aliases.filter((alias) => CYRILLIC_RE.test(alias))
  const russianScript = cyrillic.filter((alias) => !NON_RUSSIAN_CYRILLIC_RE.test(alias))
  const pool = russianScript.length ? russianScript : cyrillic
  const preferred = [...pool].sort((a, b) => {
    const aPenalty = UZBEK_CYRILLIC_SUFFIX_RE.test(a) ? 1 : 0
    const bPenalty = UZBEK_CYRILLIC_SUFFIX_RE.test(b) ? 1 : 0
    return aPenalty - bPenalty
  })[0]
    || entry.canonical
    || entry.name
    || null

  return preferred && compactBase ? compactZoneBase(preferred) : preferred
}

function scopedZoneDictionary(countryCode: string, cityName: string) {
  if (!countryCode || !cityName) return null
  return dictionaryFor(countryCode as CountryCode, cityName)
}

function dictionaryZoneLabel(
  raw: string,
  locale: string,
  countryCode: string,
  cityName: string,
): string | null {
  const dictionary = scopedZoneDictionary(countryCode, cityName)
  if (!dictionary) return null

  for (const key of ZONE_DICTIONARY_KEYS) {
    const entries = (dictionary[key] || []) as readonly LocationEntry[]
    const entry = entries.find((candidate) =>
      candidate.canonical === raw
      || candidate.name === raw
      || candidate.aliases.includes(raw),
    )
    if (!entry) continue
    return preferredDictionaryAlias(entry, locale)
  }
  return null
}

function dictionaryCompositeBaseLabel(
  rawBase: string,
  locale: string,
  countryCode: string,
  cityName: string,
): string | null {
  const dictionary = scopedZoneDictionary(countryCode, cityName)
  if (!dictionary) return null

  // Geo canonicals and source-language listing aliases can use different
  // transliterations for the same named massif (e.g. Karasu vs Qorasuv).
  // Probe only exact shared aliases and their generic locality forms, scoped
  // to the selected city; never perform an unscoped fuzzy city/country match.
  const probes = [
    rawBase,
    `${rawBase} massiv`,
    `${rawBase} massivi`,
    `${rawBase} массив`,
    `${rawBase} массиви`,
    `${rawBase} daha`,
    `${rawBase} dahasi`,
    `${rawBase} даха`,
    `${rawBase} даҳаси`,
  ]

  for (const key of ZONE_DICTIONARY_KEYS) {
    const entries = (dictionary[key] || []) as readonly LocationEntry[]
    for (const probe of probes) {
      const entry = findCanonical(probe, entries, { transliteration: true }) as LocationEntry | null
      if (!entry) continue
      return preferredDictionaryAlias(entry, locale, true)
    }
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
  // reuse the shared display/alias for their base token while preserving the
  // canonical suffix used by filtering and routing.
  const separatorIndex = raw.indexOf('-')
  if (separatorIndex > 0) {
    const prefix = raw.slice(0, separatorIndex)
    const suffix = raw.slice(separatorIndex)
    const translated = directZoneLabel(prefix, locale, countryCode, cityName)
      || dictionaryCompositeBaseLabel(prefix, locale, countryCode, cityName)
    if (translated) return `${translated}${suffix}`
  }

  return raw
}
