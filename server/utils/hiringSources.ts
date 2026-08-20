// Candidate/resume sources from public Telegram channels.
// Only public job-seeker/CV posts are accepted; employer vacancies are rejected.

import type { CvProfile, HiringSource } from './hiringTypes'
import { isLikelyTelegramVacancy } from './sources'

const UA = 'hiringFinder/1.0 (CV board; contact: admin@whiteslove.me)'
const DEFAULT_HISTORY_LIMIT = 300
const MAX_HISTORY_LIMIT = 500
const MIN_HISTORY_LIMIT = 50
const TELEGRAM_WORKER_PAGE_LIMIT = 200
const MAX_CANDIDATE_AGE_MONTHS = 3
const FUTURE_DATE_TOLERANCE_MS = 48 * 60 * 60 * 1000

interface TelegramChannel {
  handle: string
  label: string
  country: string
  location: string
  tags: string[]
  cvFeed?: boolean
  includeAny?: string[]
}

// Verified during the August 2026 audit. Mixed boards are listed only when
// recent candidate posts were found; vacancy-only/dead/wrong-entity handles are
// deliberately absent.
const DEFAULT_CV_CHANNELS: TelegramChannel[] = [
  // Uzbekistan — Tashkent + regions, broad mass-market coverage.
  { handle: 'ISH_QIDIR', label: 'Ish Qidir', country: 'UZ', location: 'Uzbekistan', tags: ['Resume', 'Mass market'] },
  { handle: 'myrabota_uz', label: 'Работа в Ташкенте', country: 'UZ', location: 'Tashkent', tags: ['Resume', 'Mass market'] },
  { handle: 'ishchi', label: 'ISHCHI', country: 'UZ', location: 'Uzbekistan', tags: ['Resume', 'Mass market'] },
  { handle: 'TALIMDAN_ISH_TOPISH', label: 'Taʼlimdan ish topish', country: 'UZ', location: 'Tashkent', tags: ['Resume', 'Education'] },
  { handle: 'uzb_vakansiya', label: 'UZB Vakansiya', country: 'UZ', location: 'Uzbekistan', tags: ['Resume', 'Mass market'] },
  { handle: 'SAMARQAND_ISH', label: 'Samarqand ish', country: 'UZ', location: 'Samarkand', tags: ['Resume', 'Mass market'] },
  { handle: 'Fargona_ishlar', label: 'Fargona ishlar', country: 'UZ', location: 'Fergana', tags: ['Resume', 'Mass market'] },
  { handle: 'Ishga_marhamat_andijon_elonlar', label: 'Andijon ish', country: 'UZ', location: 'Andijan', tags: ['Resume', 'Mass market'] },
  { handle: 'namanganishbor', label: 'Namangan ish', country: 'UZ', location: 'Namangan', tags: ['Resume', 'Mass market'] },
  { handle: 'buxoroda_ish', label: 'Buxoroda ish', country: 'UZ', location: 'Bukhara', tags: ['Resume', 'Mass market'] },

  // Kazakhstan — current candidate/resume flow; primarily IT for now.
  { handle: 'workitkz', label: 'workITkz', country: 'KZ', location: 'Kazakhstan', tags: ['Resume', 'IT'] },

  // Kyrgyzstan.
  { handle: 'jobslbish', label: 'Jobs.bish', country: 'KG', location: 'Bishkek', tags: ['Resume', 'Mass market'] },
  {
    handle: 'Cvflow',
    label: 'CV Flow',
    country: 'KG',
    location: 'Kyrgyzstan',
    tags: ['Resume', 'IT'],
    cvFeed: true,
    includeAny: ['kyrgyzstan', 'кыргызстан', 'bishkek', 'бишкек', 'osh', 'ош'],
  },

  // Ukraine.
  { handle: 'itcandidatesUA', label: 'IT Candidates UA', country: 'UA', location: 'Ukraine', tags: ['Resume', 'IT'], cvFeed: true },
  { handle: 'hr_recruiter_ua', label: 'HR & Recruiters UA', country: 'UA', location: 'Ukraine', tags: ['Resume', 'HR'] },
  { handle: 'True_Help_Odessa', label: 'True Help Odesa', country: 'UA', location: 'Odesa', tags: ['Resume', 'Mass market'] },
]

function telegramChannels(): TelegramChannel[] {
  const raw = process.env.HIRING_TELEGRAM_CHANNELS
  if (!raw?.trim()) return DEFAULT_CV_CHANNELS
  return raw.split(',').map((entry) => {
    const [handle = '', label = '', country = 'UZ'] = entry.split(':').map((part) => part.trim())
    return {
      handle,
      label: label || handle,
      country: country.toUpperCase(),
      location: label || country,
      tags: ['Resume'],
      cvFeed: true,
    }
  }).filter((channel) => channel.handle)
}

function telegramHistoryLimit(): number {
  const requested = Number(process.env.HIRING_TELEGRAM_HISTORY_LIMIT || DEFAULT_HISTORY_LIMIT)
  if (!Number.isFinite(requested)) return DEFAULT_HISTORY_LIMIT
  return Math.min(MAX_HISTORY_LIMIT, Math.max(MIN_HISTORY_LIMIT, Math.round(requested)))
}

function recentCandidateDate(dateIso: string | null | undefined): string | null {
  if (!dateIso) return null
  const date = new Date(dateIso)
  if (!Number.isFinite(date.getTime())) return null
  const now = new Date()
  const cutoff = new Date(now)
  cutoff.setUTCMonth(cutoff.getUTCMonth() - MAX_CANDIDATE_AGE_MONTHS)
  if (date < cutoff || date.getTime() > now.getTime() + FUTURE_DATE_TOLERANCE_MS) return null
  return date.toISOString()
}

const CANDIDATE_INTENT_RE =
  /(?:#(?:ищу[_-]?(?:работу|подработку)|ищуработу|шукаю[_-]?(?:роботу|підробіток)|шукаюроботу|кандидат(?:ка)?|резюме|resume|cv|ish[_-]?kerak|ish[_-]?izlayapman|menga[_-]?ish[_-]?kerak)|\b(?:ищу|шукаю)\s+(?:работу|подработку|роботу|підробіток)|\b(?:у\s+пошуках?\s+роботи|у\s+пошуку\s+роботи|розглядаю\s+пропозиції|нахожусь\s+в\s+поиске\s+работы|в\s+поиске\s+работы)|\b(?:menga\s+ish\s+kerak|ish\s+(?:kerak|izlayapman|qidiryapman|qidiraman)|ish\s+joyi\s+kerak)|\b(?:looking\s+for\s+(?:a\s+)?(?:job|work|opportunit(?:y|ies))|open\s+to\s+work))/iu
const CV_MARKER_RE = /(?:резюме|resume|\bcv\b|curriculum vitae|анкета|профиль кандидата|профіль кандидата|кандидат(?:ка)?|candidate profile|mening\s+(?:cv|rezume)|my\s+cv)/iu
const FIRST_PERSON_RE = /(?:^|\n)\s*[^\p{L}\p{N}\n]{0,6}(?:я[\s—,-]|я\s+(?:ищу|шукаю)|men[\s,]|mening[\s,]|my name is|i am a|i'm a)/iu
const EMPLOYER_RE = /(?:we(?:'re| are)\s+(?:hiring|looking\s+for)|(?:^|\n)\s*[^\p{L}\p{N}\n]{0,10}(?:ищем|требуется|требуются|вакансия|компания\s+ищет|шукаємо|потрібен|потрібна|потрібні|вакансія|запрошуємо|hiring|vacancy|ishchi\s+kerak|xodim\s+kerak|ishga\s+(?:taklif|qabul)|bo(?:'|’)sh\s+ish\s+o(?:'|’)rni))/iu
const VACANCY_SECTION_RE = /(?:requirements?|responsibilit|qualifications?|обязанност|требован|условия\s+работ|мы\s+предлагаем|обов(?:'|’)язк|вимог|ми\s+пропонуємо|what we offer|надсилайте\s+резюме|присылайте\s+резюме)/iu
const ROLE_RE = /\b(?:developer|engineer|designer|manager|analyst|specialist|qa|tester|devops|frontend|backend|accountant|cashier|seller|driver|builder|welder|cleaner|waiter|cook|guard|courier|teacher|tutor|nanny|nurse|doctor|bartender|barista|trainer|coach)\b|разработ|инженер|інженер|дизайнер|менеджер|аналитик|аналітик|специалист|спеціаліст|бухгалтер|кассир|касир|продав|водител|водій|строит|будівел|сварщик|зварюваль|убор|прибирал|официант|офіціант|бармен|бариста|повар|кухар|охран|охорон|управляющ|керівник|курьер|кур'єр|учител|вчител|преподав|викладач|репетитор|воспитател|виховател|нян|врач|лікар|медсестр|медбрат|тренер|dasturchi|menejer|buxgalter|kassir|sotuvchi|haydovchi|shafyor|qurilish|payvandchi|farrosh|afitsant|barmen|oshpaz|qorovul|boshqaruv|kuryer|o(?:'|’)qituvchi|repetitor|tarbiyachi|enaga|shifokor|hamshira/iu
const CONTACT_RE = /(?:\+?\d[\d\s()\-]{7,}|@[a-z0-9_]{4,}|(?:telegram|телефон|phone|tel|aloqa|murojaat|bog(?:'|’)lanish)\s*[:—-])/iu
const PROMOTION_RE = /t\.me\/addlist\b|(?:telegram[- ]?)?канал\w*\s+(?:в\s+)?(?:одн\w+\s+)?папк|добав(?:ить|ьте)\s+(?:свой\s+)?канал/iu

const SECTION_PATTERNS = {
  experience: /(?:опыт|досвід|experience|staj|tajriba|ish\s+tajribasi)/iu,
  skills: /(?:skills|навыки|навички|умею|стек|stack|technologies|texnologiyalar|ko(?:'|’)nikmalar)/iu,
  education: /(?:education|образован|освіт|o(?:'|’)qish|ta(?:'|’)lim|университет|університет|university|college|institut)/iu,
  languages: /(?:languages|языки|мови|til(?:lar)?|language skills)/iu,
  contact: /(?:contact|контакт|telegram|телефон|phone|tel|bog(?:'|’)lanish|aloqa)/iu,
}

function cvSectionCount(text: string): number {
  return Object.values(SECTION_PATTERNS).filter((pattern) => pattern.test(text)).length
}

export function isLikelyCvPost(text: string, cvFeed = false): boolean {
  const value = text.split('\n').map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n').trim()
  const compact = value.replace(/\s+/g, ' ')
  if (compact.length < 30 || PROMOTION_RE.test(value)) return false
  const explicitIntent = CANDIDATE_INTENT_RE.test(value)
  if (EMPLOYER_RE.test(value) || VACANCY_SECTION_RE.test(value)) return false
  if (!explicitIntent && isLikelyTelegramVacancy(compact)) return false

  const hasCvMarker = CV_MARKER_RE.test(value)
  const firstPerson = FIRST_PERSON_RE.test(value)
  const hasRole = ROLE_RE.test(value)
  const hasContact = CONTACT_RE.test(value)
  const sections = cvSectionCount(value)
  const hasExperience = /(?:\d+\+?\s*(?:лет|рок(?:и|ів)?|years|yil|йил)|(?:опыт|досвід|experience|staj|tajriba)\s*[:—-]?\s*\d)/iu.test(value)

  if (explicitIntent && (firstPerson || hasRole || hasContact || sections >= 1 || compact.length >= 60)) return true
  if (hasCvMarker && (hasRole || sections >= 1 || hasContact)) return true
  if (cvFeed && (firstPerson || hasCvMarker) && (hasRole || sections >= 2 || hasExperience || hasContact)) return true
  if (firstPerson && hasRole && (sections >= 2 || hasExperience || hasContact)) return true
  return false
}

function decodeTelegramEntities(text: string): string {
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#')) {
      const hex = entity[1]?.toLowerCase() === 'x'
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return named[entity.toLowerCase()] ?? match
  })
}

function telegramText(html: string): string {
  return decodeTelegramEntities(html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(?:p|div|li|h[1-6])>/gi, '\n').replace(/<[^>]*>/g, ' '))
    .split('\n').map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n').trim()
}

function field(text: string, names: string): string | undefined {
  const match = text.match(new RegExp(`(?:^|\\n)[^\\p{L}\\p{N}\\n]{0,8}(?:${names})\\s*[:—-]\\s*([^\\n]{2,220})`, 'iu'))
  return match?.[1]?.trim()
}

function blockAfter(text: string, names: string): string | undefined {
  const match = text.match(new RegExp(`(?:^|\\n)[^\\p{L}\\p{N}\\n]{0,8}(?:${names})\\s*[:—-]?\\s*\\n([\\s\\S]{10,800}?)(?=\\n[^\\p{L}\\p{N}\\n]{0,8}(?:experience|опыт|досвід|skills|навыки|навички|education|образован|освіта|languages|языки|мови|contact|контакт|телефон)\\s*[:—-]|$)`, 'iu'))
  return match?.[1]?.replace(/\s+/g, ' ').trim()
}

function parseExperience(text: string): number | undefined {
  const match = text.match(/(?:опыт|досвід|experience|staj|tajriba)\s*[:—-]?\s*(\d+)\+?\s*(?:лет|рок(?:и|ів)?|years|yil|йил)?/iu)
    || text.match(/(\d+)\+?\s*(?:лет|рок(?:и|ів)?|years|yil|йил)\s*(?:опыт|досвід|experience|tajriba)?/iu)
  const years = match ? Number(match[1]) : undefined
  return Number.isFinite(years) ? years : undefined
}

function parseName(text: string): string {
  return (field(text, "фио|піб|full name|name|имя|ім(?:ʼ|')я|fio|ism|ismim") || '').slice(0, 100)
}

function parseRole(text: string): string {
  const explicit = field(text, 'желаемая (?:работа|должность)|бажана (?:робота|посада)|ищу работу|шукаю роботу|ish kerak|menga ish kerak|position|role|должность|позиция|посада|lavozim|kasb|specialization|специализация|target role')
  if (explicit && ROLE_RE.test(explicit)) return explicit.slice(0, 180)

  const intentLine = text.split('\n').find((line) => CANDIDATE_INTENT_RE.test(line) && ROLE_RE.test(line))
  if (intentLine) return intentLine.replace(CANDIDATE_INTENT_RE, '').replace(/^\s*[:—-]\s*/, '').slice(0, 180)

  const roleLine = text.split('\n').map((value) => value.trim()).find((value) => ROLE_RE.test(value) && value.length <= 180)
  return roleLine?.slice(0, 180) || ''
}

function parseSkills(text: string): string[] {
  const skillsLine = field(text, "skills|навыки|навички|умею|стек|stack|technologies|texnologiyalar|ko['’]nikmalar")
  const source = skillsLine || ''
  if (!source) return []
  return [...new Set(source.split(/[,;/|•·]+/).map((item) => item.trim()).filter((item) => item.length >= 2 && item.length <= 60))].slice(0, 20)
}

function parseLanguages(text: string): string[] {
  const raw = field(text, 'languages|языки|мови|til(?:lar)?|language skills') || blockAfter(text, 'languages|языки|мови|til(?:lar)?')
  return raw ? raw.split(/[,;/|•·]+/).map((item) => item.trim()).filter(Boolean).slice(0, 8) : []
}

function parseMoneyNumber(raw: string): number | null {
  let value = raw.trim().replace(/\s+/g, '')
  if (!value) return null
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(value)) value = value.replace(/[.,]/g, '')
  else value = value.replace(',', '.')
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function parseSalary(text: string, country: string): Pick<CvProfile, 'salaryMin' | 'salaryMax' | 'currency'> {
  const raw = field(text, 'ожидания по (?:зп|зарплате)|зарплата|зп|бажана зарплата|salary|expected salary|oylik|maosh|ish haqi')
  if (!raw) return {}
  const numbers = (raw.match(/\d[\d\s.,]*\d|\d/g) || []).map(parseMoneyNumber).filter((value): value is number => value != null)
  if (!numbers.length) return {}
  const multiplier = /(?:млн|million|mln)/iu.test(raw) ? 1_000_000 : /(?:тыс|тис|thousand|ming)/iu.test(raw) ? 1_000 : 1
  const values = numbers.slice(0, 2).map((value) => Math.round(value * multiplier))
  const currency = /(?:\$|usd|доллар)/iu.test(raw) ? 'USD'
    : /(?:uzs|сум|so(?:'|’)m)/iu.test(raw) ? 'UZS'
      : /(?:uah|грн|грив)/iu.test(raw) ? 'UAH'
        : /(?:kzt|₸|тенге|тг)/iu.test(raw) ? 'KZT'
          : /(?:kgs|сом)/iu.test(raw) ? 'KGS'
            : ({ UZ: 'UZS', UA: 'UAH', KZ: 'KZT', KG: 'KGS' } as Record<string, string>)[country]
  return values.length > 1
    ? { salaryMin: Math.min(...values), salaryMax: Math.max(...values), currency }
    : { salaryMin: values[0], salaryMax: values[0], currency }
}

function messageToProfile(
  text: string,
  opts: { id: string; url: string; dateIso: string | null | undefined },
  channel: TelegramChannel,
  needle: string,
): CvProfile | null {
  const createdAt = recentCandidateDate(opts.dateIso)
  if (!createdAt) return null
  const lowerText = text.toLocaleLowerCase('ru')
  if (channel.includeAny?.length && !channel.includeAny.some((marker) => lowerText.includes(marker.toLocaleLowerCase('ru')))) return null
  if (!isLikelyCvPost(text, channel.cvFeed)) return null

  const name = parseName(text)
  const role = parseRole(text)
  const skills = parseSkills(text)
  if (needle && !`${name} ${role} ${text} ${skills.join(' ')}`.toLocaleLowerCase('ru').includes(needle)) return null

  const city = field(text, 'location|city|локация|локація|город|місто|manzil|shahar|hudud') || channel.location
  const district = field(text, 'район|р-н|district|туман|tumani') || null
  const contact = field(text, 'contact|контакт|telegram|phone|телефон|tel|boglanish|aloqa|murojaat')
  const employmentType = field(text, 'employment|format|занятость|зайнятість|график|графік|ish vaqti|bandlik')
  const education = field(text, "education|образование|освіта|o['’]qish|ta['’]lim") || blockAfter(text, "education|образование|освіта|o['’]qish|ta['’]lim") || null
  const hashtags = [...text.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]{2,40})/gu)].map((match) => match[1]!)
  const salary = parseSalary(text, channel.country)

  return {
    id: opts.id,
    source: 'telegram',
    country: channel.country,
    name,
    role,
    experienceYears: parseExperience(text),
    ...salary,
    city,
    district,
    remote: /remote|удалён|удален|віддален|дистанц|masofaviy|online|онлайн/i.test(`${role} ${text}`),
    url: opts.url,
    createdAt,
    originalText: text,
    description: text,
    skills,
    languages: parseLanguages(text),
    education,
    tags: [...channel.tags, channel.country, `@${channel.handle}`, ...hashtags].slice(0, 10),
    contact,
    employmentType,
  }
}

interface TelegramWorkerMessage { id: number; text: string; date: string | null; preview?: string | null }
interface TelegramWorkerHistory { ok?: boolean; messages?: TelegramWorkerMessage[]; minId?: number | null }

async function fetchChannelViaWorker(base: string, channel: TelegramChannel, q: string): Promise<CvProfile[]> {
  const target = telegramHistoryLimit()
  const needle = q.trim().toLocaleLowerCase('ru')
  const profiles: CvProfile[] = []
  let fetched = 0
  let beforeId = 0

  while (fetched < target) {
    const pageLimit = Math.min(TELEGRAM_WORKER_PAGE_LIMIT, target - fetched)
    const params = new URLSearchParams({ channel: channel.handle, limit: String(pageLimit) })
    if (beforeId > 0) params.set('beforeId', String(beforeId))
    const res = await fetch(`${base.replace(/\/+$/, '')}/history?${params}`, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) throw new Error(`tg-worker @${channel.handle} -> ${res.status}`)
    const data = (await res.json()) as TelegramWorkerHistory
    if (!data.ok || !Array.isArray(data.messages)) throw new Error(`tg-worker @${channel.handle} bad payload`)
    if (!data.messages.length) break

    for (const message of data.messages) {
      const text = [(message.text || '').trim(), (message.preview || '').trim()].filter(Boolean).join('\n')
      if (!text) continue
      const profile = messageToProfile(text, {
        id: `telegram-${channel.handle}-${message.id}`,
        url: `https://t.me/${channel.handle}/${message.id}`,
        dateIso: message.date,
      }, channel, needle)
      if (profile) profiles.push(profile)
    }

    fetched += data.messages.length
    const ids = data.messages.map((message) => message.id).filter(Number.isFinite)
    const nextBeforeId = Number(data.minId) || (ids.length ? Math.min(...ids) : 0)
    if (!nextBeforeId || nextBeforeId === beforeId || data.messages.length < pageLimit) break
    beforeId = nextBeforeId
  }
  return profiles
}

function parseChannelHtml(html: string, channel: TelegramChannel, q: string): CvProfile[] {
  const profiles: CvProfile[] = []
  const chunks = html.split(/<div class="tgme_widget_message_wrap\b[^>]*>/i).slice(1)
  const needle = q.trim().toLocaleLowerCase('ru')
  for (const chunk of chunks) {
    const postId = chunk.match(/data-post="([^"]+)"/i)?.[1]
    const body = chunk.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1]
    if (!postId || !body) continue
    const datetime = chunk.match(/<time[^>]+datetime="([^"]+)"/i)?.[1]
    const profile = messageToProfile(telegramText(body), {
      id: `telegram-${postId.replace(/[^a-z0-9_-]+/gi, '-')}`,
      url: `https://t.me/${postId}`,
      dateIso: datetime,
    }, channel, needle)
    if (profile) profiles.push(profile)
  }
  return profiles
}

async function fetchTelegramChannel(channel: TelegramChannel, q: string): Promise<CvProfile[]> {
  const workerUrl = process.env.TELEGRAM_WORKER_URL
  if (workerUrl) return fetchChannelViaWorker(workerUrl, channel, q)
  const res = await fetch(`https://t.me/s/${encodeURIComponent(channel.handle)}`, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`t.me/@${channel.handle} -> ${res.status}`)
  return parseChannelHtml(await res.text(), channel, q)
}

export async function fetchHiringTelegram(q: string): Promise<CvProfile[]> {
  if (process.env.TELEGRAM_SOURCE === 'off') return []
  const channels = telegramChannels()
  const profiles: CvProfile[] = []
  for (let start = 0; start < channels.length; start += 4) {
    const results = await Promise.all(channels.slice(start, start + 4).map((channel) =>
      fetchTelegramChannel(channel, q).catch((err) => {
        console.error(`[hiring] telegram @${channel.handle} failed:`, (err as Error).message)
        return [] as CvProfile[]
      }),
    ))
    profiles.push(...results.flat())
  }
  return profiles
}

const FETCHERS: Record<HiringSource, (q: string) => Promise<CvProfile[]>> = { telegram: fetchHiringTelegram }

export function isHiringSourceConfigured(source: HiringSource): boolean {
  return source === 'telegram' && process.env.TELEGRAM_SOURCE !== 'off'
}

export async function fetchHiringSource(source: HiringSource, q = ''): Promise<CvProfile[]> {
  return FETCHERS[source](q)
}

export const HIRING_COUNTRIES = [
  { code: 'UZ', name: 'Uzbekistan', currency: 'UZS', cities: ['Tashkent', 'Samarkand', 'Bukhara', 'Namangan', 'Andijan', 'Fergana'] },
  { code: 'UA', name: 'Ukraine', currency: 'UAH', cities: ['Kyiv', 'Lviv', 'Odesa', 'Kharkiv', 'Dnipro', 'Vinnytsia'] },
  { code: 'KZ', name: 'Kazakhstan', currency: 'KZT', cities: ['Almaty', 'Astana', 'Shymkent', 'Karaganda'] },
  { code: 'KG', name: 'Kyrgyzstan', currency: 'KGS', cities: ['Bishkek', 'Osh', 'Karakol'] },
] as const
