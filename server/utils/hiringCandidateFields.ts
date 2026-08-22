import type { CandidateGender } from './hiringTypes'

/** Reads only an explicitly stated gender; never guesses from the name. */
export function extractCandidateGender(text: string): CandidateGender | undefined {
  if (/(?:^|[^\p{L}])(?:женщина|female|ayol)(?=$|[^\p{L}])/iu.test(text)) return 'female'
  if (/(?:^|[^\p{L}])(?:мужчина|male|erkak)(?=$|[^\p{L}])/iu.test(text)) return 'male'
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
