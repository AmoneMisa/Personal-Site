from pathlib import Path
import re

path = Path('server/hiring/domain/telegramCandidateParser.ts')
text = path.read_text()

text = text.replace("import { cityRe } from '../../utils/hiringWebFields'\n", '')
anchor = "import { isLikelyTelegramVacancy } from '../../utils/sources'\n"
shared = """import {
  classifySharedHiringMessage,
  detectEmploymentTypes,
  detectHiringIntent,
  detectLexiconCity,
  detectLexiconDistrict,
  detectProfessionMatches,
  detectWorkModes,
  parseHiringExperience,
  parseHiringSalary,
  parseSharedLanguageContext,
  resolveSharedProfessionContext,
} from '../../utils/hiringLexicon'\n"""
if shared not in text:
    if anchor not in text:
        raise SystemExit('import anchor missing')
    text = text.replace(anchor, anchor + shared, 1)

# Candidate/employer lexical intent now belongs to the package.
start = text.find('const UZ_CANDIDATE_MARKER_RE')
end = text.find('const CANDIDATE_FORM_RE', start)
if start >= 0 and end > start:
    text = text[:start] + text[end:]

start = text.find('const CANDIDATE_INTENT_RE')
end = text.find('const CV_MARKER_RE', start)
if start >= 0 and end > start:
    text = text[:start] + text[end:]

start = text.find('const EMPLOYER_RE')
end = text.find('const CONTACT_RE', start)
if start >= 0 and end > start:
    text = text[:start] + text[end:]

text = re.sub(r"const PROMOTION_RE = .*?\n\n", '', text, count=1, flags=re.S)

# City/district aliases are shared canonical geography now.
start = text.find('const CITY_ALIASES:')
end = text.find('function candidateCutoff', start)
if start >= 0 and end > start:
    text = text[:start] + text[end:]

# Classification remains source-specific in thresholds, but lexical evidence is shared.
start = text.find('export function isLikelyCvPost')
end = text.find('const MAX_PLAUSIBLE_EXPERIENCE_YEARS', start)
if start < 0 or end < 0:
    raise SystemExit('isLikelyCvPost anchors missing')
replacement = """export function isLikelyCvPost(text: string, cvFeed = false): boolean {
  const value = text.split('\\n').map((line) => line.replace(/\\s+/g, ' ').trim()).filter(Boolean).join('\\n').trim()
  const compact = value.replace(/\\s+/g, ' ')
  if (compact.length < 30) return false
  if (/^(?:колеги[,!\\s]*)?(?:вітаю[,!\\s]*)?рекомендую\\s+(?:класного\\s+)?кандидат\\p{L}*[.!\\s]+(?:контакт\\p{L}*\\s+та\\s+)?резюме\\s+додаю\\.?$/iu.test(compact)) return false

  const kind = classifySharedHiringMessage(value)
  if (['vacancy', 'vacancy_digest', 'recruitment_ad', 'course', 'job_service', 'closed_vacancy', 'spam'].includes(kind)) return false
  const explicitIntent = kind === 'candidate' || detectHiringIntent(value).intent === 'candidate'
  const candidateForm = CANDIDATE_FORM_RE.test(value)
  if (!explicitIntent && !candidateForm && isLikelyTelegramVacancy(compact)) return false

  const hasCvMarker = CV_MARKER_RE.test(value)
  const firstPerson = FIRST_PERSON_RE.test(value)
  const hasRole = detectProfessionMatches(value, 1).length > 0
  const hasContact = CONTACT_RE.test(value)
  const sections = cvSectionCount(value)
  const parsedExperience = parseHiringExperience(value)
  const hasExperience = parsedExperience?.minYears != null || parsedExperience?.maxYears != null

  if (explicitIntent && (firstPerson || candidateForm || hasRole || hasContact || sections >= 1)) return true
  if (hasCvMarker && (candidateForm || hasRole || sections >= 1 || hasContact)) return true
  if (cvFeed && (firstPerson || hasCvMarker || candidateForm) && (hasRole || sections >= 1 || hasExperience || hasContact)) return true
  if (firstPerson && hasRole && (candidateForm || sections >= 1 || hasExperience || hasContact)) return true
  return false
}

"""
text = text[:start] + replacement + text[end:]

# Shared experience parser is authoritative for lexical interpretation.
start = text.find('const MAX_PLAUSIBLE_EXPERIENCE_YEARS')
end = text.find('function parseRole', start)
if start < 0 or end < 0:
    raise SystemExit('experience block anchors missing')
text = text[:start] + """function parseExperience(text: string): number | undefined {
  const parsed = parseHiringExperience(text)
  const years = parsed?.minYears ?? parsed?.maxYears ?? null
  return years != null && years > 0 && years <= 55 ? years : undefined
}

""" + text[end:]

# Role extraction uses section-aware profession context instead of a local profession regex.
start = text.find('function parseRole')
end = text.find('function parseSkills', start)
if start < 0 or end < 0:
    raise SystemExit('role block anchors missing')
text = text[:start] + """function parseRole(text: string): string {
  const profession = resolveSharedProfessionContext(text, { mode: 'candidate' }) as {
    desiredProfession?: { matched?: string; canonical?: string } | null
    currentProfession?: { matched?: string; canonical?: string } | null
  }
  const target = profession.desiredProfession || profession.currentProfession
  return String(target?.matched || target?.canonical || '').trim().slice(0, 180)
}

""" + text[end:]

# Structured language parser preserves candidate relation/level while satisfying the existing string[] contract.
start = text.find('function parseLanguages')
end = text.find('export function detectCity', start)
if start < 0 or end < 0:
    raise SystemExit('languages/city anchors missing')
text = text[:start] + """function parseLanguages(text: string): string[] {
  const parsed = parseSharedLanguageContext(text, 'candidate') as Array<{
    language: string
    name: string
    level: string | null
    cefr: string | null
  }>
  if (parsed.length) {
    return parsed.slice(0, 8).map((item) => {
      const level = item.cefr || item.level
      return level ? `${item.name} — ${level}` : item.name
    })
  }
  const raw = field(text, 'languages|языки|мови|til(?:lar)?|language skills') || blockAfter(text, 'languages|языки|мови|til(?:lar)?')
  return raw ? raw.split(/[,;/|•·]+/).map((item) => item.trim()).filter(Boolean).slice(0, 8) : []
}

export function detectCity(text: string, country: string): string | null {
  return detectLexiconCity(text, country)
}

function fallbackChannelCity(channel: TelegramCandidateChannel): string | null {
  return detectLexiconCity(channel.location || '', channel.country)
}

export function detectDistrict(text: string, city: string | null): string | null {
  const explicit = field(text, 'район|р-н|district|туман|tumani')
  return detectLexiconDistrict(explicit || text, city) || explicit || null
}

""" + text[text.find('function parseMoneyNumber', end):]

# Replace local currency/number parsing with shared salary parser while retaining source-country default currency.
start = text.find('function parseMoneyNumber')
end = text.find('export function telegramMessageToProfile', start)
if start < 0 or end < 0:
    raise SystemExit('salary block anchors missing')
text = text[:start] + """function parseSalary(text: string, country: string): Pick<CvProfile, 'salaryMin' | 'salaryMax' | 'currency'> {
  const parsed = parseHiringSalary(text)
  if (!parsed || (parsed.min == null && parsed.max == null)) return {}
  const currency = parsed.currency
    || ({ UZ: 'UZS', UA: 'UAH', KZ: 'KZT', KG: 'KGS' } as Record<string, string>)[country]
  return {
    salaryMin: parsed.min ?? parsed.max ?? undefined,
    salaryMax: parsed.max ?? parsed.min ?? undefined,
    currency,
  }
}

""" + text[end:]

text = text.replace(
    '  if (channel.requireCandidateMarker && !UZ_CANDIDATE_MARKER_RE.test(text)) return null',
    "  if (channel.requireCandidateMarker && detectHiringIntent(text).intent !== 'candidate') return null",
)
text = text.replace(
    "    remote: /remote|удалён|удален|віддален|дистанц|masofaviy|online|онлайн/i.test(`${role} ${text}`),",
    "    remote: detectWorkModes(`${role} ${text}`).includes('remote'),",
)
text = text.replace(
    "  const employmentType = field(text, 'employment|format|занятость|зайнятість|график|графік|ish vaqti|bandlik')",
    "  const employmentType = detectEmploymentTypes(text)[0]\n    || field(text, 'employment|format|занятость|зайнятість|график|графік|ish vaqti|bandlik')",
)

start = text.find('function looksLikeVacancy')
end = text.find('export function classifyTelegramMessage', start)
if start < 0 or end < 0:
    raise SystemExit('looksLikeVacancy anchors missing')
text = text[:start] + """function looksLikeVacancy(text: string): boolean {
  const kind = classifySharedHiringMessage(text)
  if (kind === 'vacancy' || kind === 'closed_vacancy') return true
  return isLikelyTelegramVacancy(text.replace(/\\s+/g, ' '))
}

""" + text[end:]
text = text.replace(
    '  const candidateMarker = UZ_CANDIDATE_MARKER_RE.test(text)',
    "  const candidateMarker = detectHiringIntent(text).intent === 'candidate'",
)

stale = [
  'UZ_CANDIDATE_MARKER_RE', 'UZ_EMPLOYER_RE', 'CANDIDATE_INTENT_RE', 'EMPLOYER_RE',
  'VACANCY_SECTION_RE', 'ROLE_RE', 'CITY_ALIASES', 'TASHKENT_DISTRICTS', 'parseMoneyNumber',
]
for token in stale:
    if token in text:
        raise SystemExit(f'stale local lexicon token remains: {token}')

path.write_text(text)
