// Candidate/resume sources from public Telegram channels.
// Defaults are intentionally conservative: every channel below had recent
// candidate/job-seeker posts verified during the 2026-08 source audit.

import type { CvProfile, HiringSource } from './hiringTypes'
import { isLikelyTelegramVacancy } from './sources'

const UA = 'hiringFinder/1.0 (CV board; contact: admin@whiteslove.me)'
const DEFAULT_HISTORY_LIMIT = 300
const MAX_HISTORY_LIMIT = 500
const MIN_HISTORY_LIMIT = 50
const MAX_CANDIDATE_AGE_MONTHS = 3
const FUTURE_DATE_TOLERANCE_MS = 48 * 60 * 60 * 1000

interface TelegramChannel {
  handle: string
  label: string
  country: string
  location: string
  tags: string[]
  /** Candidate-dedicated feeds may omit explicit "looking for work" wording. */
  cvFeed?: boolean
  /** For global feeds, require at least one location marker before assigning a country. */
  includeAny?: string[]
}

// Public channels with verified candidate/resume posts. Mixed vacancy boards are
// kept only where current candidate posts were observed and are protected by the
// strict candidate-intent classifier below.
const DEFAULT_CV_CHANNELS: TelegramChannel[] = [
  // Uzbekistan — mass market + regional coverage.
  { handle: 'ishchi', label: 'ISHCHI', country: 'UZ', location: 'Uzbekistan', tags: ['Resume', 'Mass market'] },
  { handle: 'TALIMDAN_ISH_TOPISH', label: 'Taʼlimdan ish topish', country: 'UZ', location: 'Tashkent', tags: ['Resume', 'Education'] },
  { handle: 'uzb_vakansiya', label: 'UZB Vakansiya', country: 'UZ', location: 'Uzbekistan', tags: ['Resume', 'Mass market'] },
  { handle: 'SAMARQAND_ISH', label: 'Samarqand ish', country: 'UZ', location: 'Samarkand', tags: ['Resume', 'Mass market'] },
  { handle: 'Fargona_ishlar', label: 'Fargona ishlar', country: 'UZ', location: 'Fergana', tags: ['Resume', 'Mass market'] },
  { handle: 'Ishga_marhamat_andijon_elonlar', label: 'Andijon ish', country: 'UZ', location: 'Andijan', tags: ['Resume', 'Mass market'] },
  { handle: 'namanganishbor', label: 'Namangan ish', country: 'UZ', location: 'Namangan', tags: ['Resume', 'Mass market'] },
  { handle: 'buxoroda_ish', label: 'Buxoroda ish', country: 'UZ', location: 'Bukhara', tags: ['Resume', 'Mass market'] },
  { handle: 'AlmalykRabota', label: 'Almalyk Rabota', country: 'UZ', location: 'Almalyk', tags: ['Resume', 'Mass market'] },

  // Kazakhstan — verified current resume flow (primarily IT).
  { handle: 'workitkz', label: 'workITkz', country: 'KZ', location: 'Kazakhstan', tags: ['Resume', 'IT'] },

  // Kyrgyzstan — one local mass-market board plus a filtered candidate-only IT feed.
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

  // Ukraine — candidate-heavy professional feeds + verified Odesa mass-market boards.
  { handle: 'itcandidatesUA', label: 'IT Candidates UA', country: 'UA', location: 'Ukraine', tags: ['Resume', 'IT'], cvFeed: true },
  { handle: 'hr_recruiter_ua', label: 'HR & Recruiters UA', country: 'UA', location: 'Ukraine', tags: ['Resume', 'HR'] },
  { handle: 'True_Help_Odessa', label: 'True Help Odesa', country: 'UA', location: 'Odesa', tags: ['Resume', 'Mass market'] },
  { handle: 'obzhorabota', label: 'Odesa work board', country: 'UA', location: 'Odesa', tags: ['Resume', 'Mass market'] },
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

const CV_MARKER_RE =
  /(?:резюме|resume|\bcv\b|curriculum vitae|анкета|профиль кандидата|профіль кандидата|кандидат(?:ка)?|candidate profile|mening\s+(?:cv|rezume|ma(?:'|’)lumotlarim)|my\s+cv)/iu

const FIRST_PERSON_RE =
  /(?:^|\n)\s*[^\p{L}\p{N}\n]{0,6}(?:я[\s—,-]|я\s+(?:ищу|шукаю)|men[\s,]|mening[\s,]|мен[\s,]|my name is|i am a|i'm a|men\s+\d)/iu

const EMPLOYER_RE =
  /(?:we(?:'re| are)\s+(?:hiring|looking\s+for)|(?:^|\n)\s*[^\p{L}\p{N}\n]{0,10}(?:ищем|требуется|требуются|вакансия|открыта\s+позиция|открыта\s+вакансия|компания\s+ищет|шукаємо|потрібен|потрібна|потрібні|вакансія|запрошуємо|hiring|vacancy|position\s*:|ishchi\s+kerak|xodim\s+kerak|ishga\s+(?:taklif|qabul)|bo(?:'|’)sh\s+ish\s+o(?:'|’)rni))/iu

const VACANCY_SECTION_RE =
  /(?:requirements?|responsibilit|qualifications?|обязанност|требован|условия\s+работ|мы\s+предлагаем|обов(?:'|’)язк|вимог|ми\s+пропонуємо|what we offer|benefits package|откликайтесь на ваканс|надсилайте\s+резюме|присылайте\s+резюме)/iu

const ROLE_RE =
  /\b(?:developer|engineer|designer|manager|analyst|consultant|specialist|qa|tester|devops|frontend|backend|android|ios|accountant|marketer|sales|support|cashier|seller|driver|builder|construction|welder|cleaner|waiter|cook|guard|seamstress|loader|warehouse|courier|teacher|tutor|nanny|student|operator|nurse|mechanic|electrician|plumber)\b|разработ|інженер|инженер|дизайнер|менеджер|аналитик|аналітик|специалист|спеціаліст|кассир|касир|продав|водител|водій|строит|будівел|сварщик|зварюваль|убор|прибирал|официант|офіціант|повар|кухар|охран|охорон|шве|грузчик|вантажник|кладов|склад|курьер|кур'єр|учител|вчител|преподав|викладач|нян|студент|оператор|медсестр|механик|механік|электрик|електрик|сантехник|сантехнік|dasturchi|mutaxassis|menejer|sotuvchi|haydovchi|shafyor|qurilish|payvandchi|farrosh|afitsant|oshpaz|qorovul|tikuv|o(?:'|’)qituvchi|talaba|enaga/iu

const CONTACT_RE =
  /(?:\+?\d[\d\s()\-]{7,}|@[a-z0-9_]{4,}|(?:telegram|телефон|phone|tel|aloqa|murojaat|bog(?:'|’)lanish)\s*[:—-])/iu

const PROMOTION_RE =
  /t\.me\/addlist\b|(?:telegram[- ]?)?канал\w*\s+(?:в\s+)?(?:одн\w+\s+)?папк|добав(?:ить|ьте)\s+(?:свой\s+)?канал/iu

const SECTION_PATTERNS = {
  experience: /(?:опыт|досвід|experience|staj|tajriba|ish\s+tajribasi)/iu,
  skills: /(?:skills|навыки|навички|стек|stack|technologies|texnologiyalar|ko(?:'|’)nikmalar)/iu,
  education: /(?:education|образован|освіт|o(?:'|’)qish|ta(?:'|’)lim|университет|університет|university|college|institut)/iu,
  languages: /(?:languages|языки|мови|til(?:lar)?|language skills)/iu,
  contact: /(?:contact|контакт|telegram|телефон|phone|tel|bog(?:'|’)lanish|aloqa)/iu,
}

function cvSectionCount(text: string): number {
  let count = 0
  for (const pattern of Object.values(SECTION_PATTERNS)) {
    if (pattern.test(text)) count += 1
  }
  return count
}

/** True when a Telegram message is a candidate CV/job-seeker post, not an employer vacancy. */
export function isLikelyCvPost(text: string, cvFeed = false): boolean {
  const value = text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim()
  const compact = value.replace(/\s+/g, ' ')
  if (compact.length < 30 || PROMOTION_RE.test(value)) return false

  const explicitIntent = CANDIDATE_INTENT_RE.test(value)
  if (EMPLOYER_RE.test(value)) return false
  if (VACANCY_SECTION_RE.test(value)) return false
  // Generic job-board heuristics are useful, but must not override an explicit
  // first-person job-seeker marker such as "ищу работу" / "ish kerak".
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
  const named: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  }
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
  return decodeTelegramEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:p|div|li|h[1-6])>/gi, '\n')
      .replace(/<[^>]*>/g, ' '),
  )
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim()
}

function field(text: string, names: string): string | undefined {
  const match = text.match(new RegExp(`(?:^|\\n)[^\\p{L}\\p{N}\\n]{0,6}(?:${names})\\s*[:—-]\\s*([^\\n]{2,160})`, 'iu'))
  return match?.[1]?.trim()
}

function blockAfter(text: string, names: string): string | undefined {
  const match = text.match(new RegExp(`(?:^|\\n)[^\\p{L}\\p{N}\\n]{0,6}(?:${names})\\s*[:—-]?\\s*\\n([\\s\\S]{10,800}?)(?=\\n[^\\p{L}\\p{N}\\n]{0,6}(?:${Object.keys(SECTION_PATTERNS).join('|')})\\s*[:—-]|$)`, 'iu'))
  return match?.[1]?.replace(/\s+/g, ' ').trim()
}

function parseExperience(text: string): number | undefined {
  const match = text.match(/(?:опыт|досвід|experience|staj|tajriba)\s*[:—-]?\s*(\d+)\+?\s*(?:лет|рок(?:и|ів)?|years|yil|йил)?/iu)
    || text.match(/(\d+)\+?\s*(?:лет|рок(?:и|ів)?|years|yil|йил)\s*(?:опыт|досвід|experience|tajriba)?/iu)
  const years = match ? Number(match[1]) : undefined
  return Number.isFinite(years) ? years : undefined
}

function parseName(text: string, channel: TelegramChannel): string {
  const explicit = field(text, 'name|имя|ім(?:ʼ|\')я|fio|фio|пib|піб|ism|ismim|candidate|кандидат')
  if (explicit) return explicit.slice(0, 80)

  const firstLine = text.split('\n').map((line) => line.trim()).find((line) => {
    if (line.length < 3 || line.length > 70 || /^#/.test(line)) return false
    if (/^(?:резюме|resume|\bcv\b|vacancy|вакансия|вакансія)/iu.test(line)) return false
    return !ROLE_RE.test(line) || /^[\p{L}][\p{L}\s.'ʼ-]{2,40}$/u.test(line)
  })
  if (firstLine) {
    return firstLine.replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\s#*_-]+/gu, '').slice(0, 80)
  }
  return `Candidate · ${channel.label}`
}

function parseRole(text: string): string {
  const role = field(text, 'position|role|должность|желаемая должность|позиция|посада|бажана посада|lavozim|kasb|specialization|специализация|target role')
  if (role) return role.slice(0, 120)
  const line = text.split('\n').map((value) => value.trim()).find((value) =>
    ROLE_RE.test(value) && value.length <= 120,
  )
  return (line || text.split('\n')[0] || 'Open to opportunities').replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\s#*_-]+/gu, '').slice(0, 120)
}

function parseSkills(text: string): string[] {
  const skillsLine = field(text, "skills|навыки|навички|стек|stack|technologies|texnologiyalar|ko['’]nikmalar")
  const source = skillsLine || text
  const hashtags = [...source.matchAll(/(?:^|\s)#([\p{L}\p{N}_+-]{2,40})/gu)].map((m) => m[1]!)
  const commaList = skillsLine
    ? skillsLine.split(/[,;/|•·]+/).map((item) => item.trim()).filter((item) => item.length >= 2 && item.length <= 40)
    : []
  return [...new Set([...hashtags, ...commaList])].slice(0, 12)
}

function parseLanguages(text: string): string[] {
  const raw = field(text, 'languages|языки|мови|til(?:lar)?|language skills') || blockAfter(text, 'languages|языки|мови|til(?:lar)?')
  if (!raw) return []
  return raw.split(/[,;/|•·]+/).map((item) => item.trim()).filter(Boolean).slice(0, 8)
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
  if (channel.includeAny?.length && !channel.includeAny.some((marker) => lowerText.includes(marker.toLocaleLowerCase('ru')))) {
    return null
  }
  if (!isLikelyCvPost(text, channel.cvFeed)) return null

  const name = parseName(text, channel)
  const role = parseRole(text)
  if (needle && !`${name} ${role} ${text} ${(parseSkills(text)).join(' ')}`.toLocaleLowerCase('ru').includes(needle)) {
    return null
  }

  const city = field(text, 'location|city|локация|локація|город|місто|manzil|shahar|hudud') || channel.location
  const contact = field(text, 'contact|контакт|telegram|phone|телефон|tel|boglanish|aloqa|murojaat')
  const employmentType = field(text, 'employment|format|занятость|зайнятість|график|графік|ish vaqti|bandlik')
  const education = field(text, "education|образование|освіта|o['’]qish|ta['’]lim") || blockAfter(text, "education|образование|освіта|o['’]qish|ta['’]lim") || null
  const hashtags = [...text.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]{2,40})/gu)].map((m) => m[1]!)

  return {
    id: opts.id,
    source: 'telegram',
    country: channel.country,
    name,
    role,
    experienceYears: parseExperience(text),
    city,
    remote: /remote|удалён|удален|віддален|дистанц|masofaviy|online|онлайн/i.test(`${role} ${text}`),
    url: opts.url,
    createdAt,
    description: text.slice(0, 6000),
    skills: parseSkills(text),
    languages: parseLanguages(text),
    education,
    tags: [...channel.tags, channel.country, `@${channel.handle}`, ...hashtags].slice(0, 8),
    contact,
    employmentType,
  }
}

interface TelegramWorkerMessage { id: number; text: string; date: string | null; preview?: string | null }

async function fetchChannelViaWorker(base: string, channel: TelegramChannel, q: string): Promise<CvProfile[]> {
  const url = `${base.replace(/\/+$/, '')}/history?channel=${encodeURIComponent(channel.handle)}&limit=${telegramHistoryLimit()}`
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`tg-worker @${channel.handle} -> ${res.status}`)
  const data = (await res.json()) as { ok?: boolean; messages?: TelegramWorkerMessage[] }
  if (!data.ok || !Array.isArray(data.messages)) throw new Error(`tg-worker @${channel.handle} bad payload`)
  const needle = q.trim().toLocaleLowerCase('ru')
  const profiles: CvProfile[] = []
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

  const url = `https://t.me/s/${encodeURIComponent(channel.handle)}`
  const res = await fetch(url, {
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
    const batch = channels.slice(start, start + 4)
    const results = await Promise.all(
      batch.map((channel) => fetchTelegramChannel(channel, q).catch((err) => {
        console.error(`[hiring] telegram @${channel.handle} failed:`, (err as Error).message)
        return [] as CvProfile[]
      })),
    )
    profiles.push(...results.flat())
  }
  return profiles
}

const FETCHERS: Record<HiringSource, (q: string) => Promise<CvProfile[]>> = {
  telegram: fetchHiringTelegram,
}

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
