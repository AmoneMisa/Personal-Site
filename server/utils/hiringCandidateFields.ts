import type { CandidateGender } from './hiringTypes'

const EXPLICIT_FEMALE_RE = /(?:^|[^\p{L}])(?:женщина|женский|девушка|female|ayol)(?=$|[^\p{L}])/iu
const EXPLICIT_MALE_RE = /(?:^|[^\p{L}])(?:мужчина|мужской|парень|male|erkak)(?=$|[^\p{L}])/iu

// High-confidence Central Asian lineage markers. These are grammatical sex
// markers in Uzbek names, not guesses from a first name. Boards use both Latin
// and Cyrillic spellings, and often omit apostrophes in o'g'li.
const FEMALE_LINEAGE_RE = /(?:^|[^\p{L}])(?:qizi|қизи|кизи|қызы)(?=$|[^\p{L}])/iu
const MALE_LINEAGE_RE = /(?:^|[^\p{L}])(?:o(?:['’ʻʼ‘`])?g(?:['’ʻʼ‘`])?li|ўғли|угли|оғли|огли)(?=$|[^\p{L}])/iu

// Russian/Cyrillic surnames commonly used across the former USSR have distinct
// masculine/feminine forms. Case-insensitive matching also covers boards that
// publish names in ALL CAPS.
const FEMALE_SURNAME_RE = /(?:^|[^\p{L}])\p{L}[\p{L}ёЁ-]{2,}(?:ова|ева|ёва|ина|ына|ская|цкая|ая)(?=$|[^\p{L}])/iu
const MALE_SURNAME_RE = /(?:^|[^\p{L}])\p{L}[\p{L}ёЁ-]{2,}(?:ов|ев|ёв|ин|ын|ский|цкий|ой)(?=$|[^\p{L}])/iu
const FEMALE_LATIN_SURNAME_RE = /(?:^|[^\p{L}])\p{L}[\p{L}'’ʻʼ‘`-]{2,}(?:ova|eva|ina|skaya|tskaya|aya)(?=$|[^\p{L}])/iu
const MALE_LATIN_SURNAME_RE = /(?:^|[^\p{L}])\p{L}[\p{L}'’ʻʼ‘`-]{2,}(?:ov|ev|in|skiy|sky|tskiy|oy)(?=$|[^\p{L}])/iu

// Patronymics are an even stronger grammatical signal than a first name and
// occur frequently on Careerist/ish-bor profiles where the gender field itself
// is missing from the parsed card.
const FEMALE_PATRONYMIC_RE = /(?:^|[^\p{L}])\p{L}[\p{L}ёЁ-]{2,}(?:овна|евна|ична|инична)(?=$|[^\p{L}])/iu
const MALE_PATRONYMIC_RE = /(?:^|[^\p{L}])\p{L}[\p{L}ёЁ-]{2,}(?:ович|евич|ич)(?=$|[^\p{L}])/iu

/**
 * Extracts candidate gender with an explicit-source-first policy.
 *
 * Priority:
 * 1. Explicit gender stated by the source.
 * 2. Grammatical Central Asian lineage markers (`qizi`, `o'g'li`).
 * 3. Patronymics and high-confidence masculine/feminine surname morphology.
 *
 * Surname morphology is intentionally applied only to the first line. Public
 * presentation prepends the parsed candidate name before source text, which
 * prevents ordinary CV phrases such as "любая работа" from being mistaken for
 * a feminine surname ending in -ая.
 */
export function extractCandidateGender(text: string): CandidateGender | undefined {
  if (EXPLICIT_FEMALE_RE.test(text)) return 'female'
  if (EXPLICIT_MALE_RE.test(text)) return 'male'
  if (FEMALE_LINEAGE_RE.test(text)) return 'female'
  if (MALE_LINEAGE_RE.test(text)) return 'male'

  const nameLine = text.split(/\r?\n/u).map((line) => line.trim()).find(Boolean) || ''
  if (FEMALE_PATRONYMIC_RE.test(nameLine)) return 'female'
  if (MALE_PATRONYMIC_RE.test(nameLine)) return 'male'
  if (FEMALE_SURNAME_RE.test(nameLine) || FEMALE_LATIN_SURNAME_RE.test(nameLine)) return 'female'
  if (MALE_SURNAME_RE.test(nameLine) || MALE_LATIN_SURNAME_RE.test(nameLine)) return 'male'
  return undefined
}

export function extractCandidateName(text: string): string {
  const match = text.match(
    /(?:^|\n)[^\p{L}\p{N}\n]{0,10}(?:xodim|hodim|nomzod|candidate|фио|ф\.и\.о\.?|f\.?\s*i\.?\s*sh\.?|піб|full name|name|имя|ім(?:ʼ|')я|fio|ism(?:i|im)?(?:\s*[-–—]\s*(?:familya|familiya))?|familya|familiya)\s*[:—-]\s*([^\n]{2,100})/iu,
  )
  return (match?.[1] || '')
    .split(/\s*[▪▫◾◽📚🕑🌐💰📞🇺🇿]\s*|\s+(?=(?:tug['’ʻʼ‘`]?ilgan|yashash|ma['’ʻʼ‘`]?lumoti|avvalgi|ish\s+staji|so['’ʻʼ‘`]?ralgan)\b)/iu)[0]!
    .trim().replace(/\s{2,}/g, ' ').slice(0, 100)
}

export function extractCandidateAge(text: string, now = new Date()): number | null {
  const patterns = [
    /(?:возраст|вік|age|yosh)\s*[:—-]?\s*(\d{1,2})/iu,
    /(?:yoshim|yoshm)\s*(\d{1,2})\s*da\b/iu,
    /(?:мне|мені)\s+(\d{1,2})\s*(?:лет|рок(?:и|ів)?)/iu,
    /(?:^|\n)\s*(\d{1,2})\s*(?:лет|рок(?:и|ів)?|yosh)\b/iu,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    const age = match ? Number(match[1]) : Number.NaN
    if (Number.isFinite(age) && age >= 14 && age <= 90) return age
  }

  const born = text.match(
    /(?:tug(?:['’‘])ilgan\s+yili|tug(?:['’‘])ilgan\s+sana(?:si)?|год\s+рождения|дата\s+рождения|birth\s+(?:year|date))\s*[:—-]?\s*(?:(\d{1,2})[./-](\d{1,2})[./-])?((?:19|20)\d{2})/iu,
  )
  if (born) {
    const year = Number(born[3])
    let age = now.getUTCFullYear() - year
    if (born[1] && born[2]) {
      const month = Number(born[2])
      const day = Number(born[1])
      if (now.getUTCMonth() + 1 < month || (now.getUTCMonth() + 1 === month && now.getUTCDate() < day)) age -= 1
    }
    if (age >= 14 && age <= 90) return age
  }
  return null
}
