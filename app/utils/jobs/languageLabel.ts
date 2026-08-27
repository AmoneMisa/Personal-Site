export type JobLanguageTranslate = (key: string) => string;

const LANGUAGE_KEYS: Readonly<Record<string, string>> = Object.freeze({
  english: 'languageEnglish',
  russian: 'languageRussian',
  ukrainian: 'languageUkrainian',
  romanian: 'languageRomanian',
  uzbek: 'languageUzbek',
  kazakh: 'languageKazakh',
  polish: 'languagePolish',
  georgian: 'languageGeorgian',
  german: 'languageGerman',
  french: 'languageFrench',
  spanish: 'languageSpanish',
  chinese: 'languageChinese',
  'mandarin chinese': 'languageChinese',
  mandarin: 'languageChinese',
  japanese: 'languageJapanese',
  belarusian: 'languageBelarusian',
  belorussian: 'languageBelarusian',
  byelorussian: 'languageBelarusian',
  portuguese: 'languagePortuguese',
  italian: 'languageItalian',
  korean: 'languageKorean',
  turkish: 'languageTurkish',
  arabic: 'languageArabic',
  dutch: 'languageDutch',
  czech: 'languageCzech',
  slovak: 'languageSlovak',
  hungarian: 'languageHungarian',
  bulgarian: 'languageBulgarian',
  serbian: 'languageSerbian',
  croatian: 'languageCroatian',
  greek: 'languageGreek',
  swedish: 'languageSwedish',
  norwegian: 'languageNorwegian',
  danish: 'languageDanish',
  finnish: 'languageFinnish',
  estonian: 'languageEstonian',
  latvian: 'languageLatvian',
  lithuanian: 'languageLithuanian',
  armenian: 'languageArmenian',
  azerbaijani: 'languageAzerbaijani',
  kyrgyz: 'languageKyrgyz',
  tajik: 'languageTajik',
  hindi: 'languageHindi',
  hebrew: 'languageHebrew',
});

const LANGUAGE_CODE_KEYS: Readonly<Record<string, string>> = Object.freeze({
  en: 'languageEnglish', ru: 'languageRussian', uk: 'languageUkrainian', ua: 'languageUkrainian',
  ro: 'languageRomanian', uz: 'languageUzbek', kk: 'languageKazakh', pl: 'languagePolish',
  ka: 'languageGeorgian', de: 'languageGerman', fr: 'languageFrench', es: 'languageSpanish',
  zh: 'languageChinese', ja: 'languageJapanese', be: 'languageBelarusian', pt: 'languagePortuguese',
  it: 'languageItalian', ko: 'languageKorean', tr: 'languageTurkish', ar: 'languageArabic',
  nl: 'languageDutch', cs: 'languageCzech', sk: 'languageSlovak', hu: 'languageHungarian',
  bg: 'languageBulgarian', sr: 'languageSerbian', hr: 'languageCroatian', el: 'languageGreek',
  sv: 'languageSwedish', no: 'languageNorwegian', da: 'languageDanish', fi: 'languageFinnish',
  et: 'languageEstonian', lv: 'languageLatvian', lt: 'languageLithuanian', hy: 'languageArmenian',
  az: 'languageAzerbaijani', ky: 'languageKyrgyz', tg: 'languageTajik', hi: 'languageHindi', he: 'languageHebrew',
});

function normalizeLanguage(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase('en').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

export function jobLanguageTranslationKey(value: string): string | undefined {
  const normalized = normalizeLanguage(value);
  return LANGUAGE_KEYS[normalized] || LANGUAGE_CODE_KEYS[normalized];
}

export function localizeJobLanguage(value: string, translate: JobLanguageTranslate): string {
  const key = jobLanguageTranslationKey(value);
  return key ? translate(key) : value;
}

/** Localize a comma-separated display string while preserving levels like `(B2)`. */
export function localizeJobLanguageList(value: string, translate: JobLanguageTranslate): string {
  return value.split(',').map((part) => {
    const trimmed = part.trim();
    const match = trimmed.match(/^(.*?)(\s+\([^)]*\))$/);
    const language = (match?.[1] || trimmed).trim();
    const suffix = match?.[2] || '';
    return `${localizeJobLanguage(language, translate)}${suffix}`;
  }).join(', ');
}
