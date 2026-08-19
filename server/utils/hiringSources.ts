// CV/resume pages from public Telegram channels where candidates publish profiles.
// Only CV-dedicated feeds are scraped by default; general job boards are excluded
// because they carry employer vacancies, not candidate CVs.

import type { CvProfile, HiringSource } from './hiringTypes'
import { isLikelyTelegramVacancy } from './sources'

const UA = 'hiringFinder/1.0 (CV board; contact: admin@whiteslove.me)'

interface TelegramChannel {
  handle: string
  label: string
  country: string
  location: string
  tags: string[]
  /** When true, posts still need CV structure but not an explicit "resume" keyword. */
  cvFeed?: boolean
}

// Resume/CV channels only. Override or extend via HIRING_TELEGRAM_CHANNELS env
// ("handle:Label:CC" comma-separated). General vacancy boards are never used.
const DEFAULT_CV_CHANNELS: TelegramChannel[] = [
  { handle: 'resume_uz', label: 'Resume UZ', country: 'UZ', location: 'Uzbekistan', tags: ['Resume'], cvFeed: true },
  { handle: 'cv_uzbekistan', label: 'CV Uzbekistan', country: 'UZ', location: 'Uzbekistan', tags: ['Resume'], cvFeed: true },
  { handle: 'rabota_resume', label: 'Rabota Resume', country: 'UA', location: 'Ukraine', tags: ['Resume'], cvFeed: true },
  { handle: 'cv_ukraine', label: 'CV Ukraine', country: 'UA', location: 'Ukraine', tags: ['Resume'], cvFeed: true },
  { handle: 'resume_ukraine', label: 'Resume Ukraine', country: 'UA', location: 'Ukraine', tags: ['Resume'], cvFeed: true },
  { handle: 'cv_kz', label: 'CV Kazakhstan', country: 'KZ', location: 'Kazakhstan', tags: ['Resume'], cvFeed: true },
  { handle: 'resume_kg', label: 'Resume KG', country: 'KG', location: 'Kyrgyzstan', tags: ['Resume'], cvFeed: true },
  { handle: 'cv_romania', label: 'CV Romania', country: 'RO', location: 'Romania', tags: ['Resume'], cvFeed: true },
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

const CV_MARKER_RE =
  /(?:резюме|resume|\bcv\b|curriculum vitae|анкета|профиль кандидата|кандидат|candidate profile|mening\s+(?:cv|rezume|ma(?:'|’)lumotlarim)|my\s+cv)/iu

const FIRST_PERSON_RE =
  /(?:^|\n)\s*(?:я[\s—,-]|men[\s,]|mening[\s,]|мен[\s,]|my name is|i am a|i'm a|men\s+\d)/iu

const EMPLOYER_RE =
  /(?:we(?:'re| are)\s+(?:hiring|looking\s+for)|(?:^|\n)\s*(?:ищем|требуется|вакансия|vacancy|position\s*:|hiring|открыта\s+позиция|компания\s+ищет|kerak\s+(?:mutaxassis|xodim|dasturchi|odam)))/iu

const VACANCY_SECTION_RE =
  /(?:requirements?|responsibilit|qualifications?|обязанност|требован|условия\s+работ|мы\s+предлагаем|what we offer|benefits package|откликайтесь на ваканс)/iu

const ROLE_RE =
  /\b(?:developer|engineer|designer|manager|analyst|consultant|specialist|qa|tester|devops|frontend|backend|android|ios|accountant|marketer|sales|support)\b|разработ|инженер|дизайнер|менеджер|аналитик|специалист|dasturchi|mutaxassis|menejer/iu

const PROMOTION_RE =
  /t\.me\/addlist\b|(?:telegram[- ]?)?канал\w*\s+(?:в\s+)?(?:одн\w+\s+)?папк|добав(?:ить|ьте)\s+(?:свой\s+)?канал/iu

const SECTION_PATTERNS = {
  experience: /(?:опыт|experience|staj|tajriba|ish\s+tajribasi)/iu,
  skills: /(?:skills|навыки|стек|stack|technologies|texnologiyalar|ko'nikmalar)/iu,
  education: /(?:education|образован|o['’]?qish|ta'lim|университет|university|college|institut)/iu,
  languages: /(?:languages|языки|til(lar)?|language skills)/iu,
  contact: /(?:contact|контакт|telegram|телефон|phone|tel|boglanish|aloqa)/iu,
}

function cvSectionCount(text: string): number {
  let count = 0
  for (const pattern of Object.values(SECTION_PATTERNS)) {
    if (pattern.test(text)) count += 1
  }
  return count
}

/** True when a Telegram message is a candidate CV/resume, not an employer vacancy. */
export function isLikelyCvPost(text: string, cvFeed = false): boolean {
  const value = text.replace(/\s+/g, ' ').trim()
  if (value.length < 40 || PROMOTION_RE.test(value)) return false
  if (isLikelyTelegramVacancy(value)) return false
  if (EMPLOYER_RE.test(value)) return false
  if (VACANCY_SECTION_RE.test(value)) return false

  const hasCvMarker = CV_MARKER_RE.test(value)
  const firstPerson = FIRST_PERSON_RE.test(value)
  const hasRole = ROLE_RE.test(value)
  const sections = cvSectionCount(value)
  const hasExperience = /(?:\d+\+?\s*(?:лет|years|yil|йил)|опыт\s*[:—-]?\s*\d|experience\s*[:—-]?\s*\d)/iu.test(value)

  if (hasCvMarker && (hasRole || sections >= 1)) return true
  if (cvFeed && firstPerson && hasRole && (sections >= 2 || hasExperience)) return true
  if (firstPerson && hasRole && sections >= 3) return true
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
  const match = text.match(/(?:опыт|experience|staj|tajriba)\s*[:—-]?\s*(\d+)\+?\s*(?:лет|years|yil|йил)?/iu)
    || text.match(/(\d+)\+?\s*(?:лет|years|yil|йил)\s*(?:опыт|experience|tajriba)?/iu)
  const years = match ? Number(match[1]) : undefined
  return Number.isFinite(years) ? years : undefined
}

function parseName(text: string, channel: TelegramChannel): string {
  const explicit = field(text, 'name|имя|fio|фio|пib|ism|ismim|candidate')
  if (explicit) return explicit.slice(0, 80)

  const firstLine = text.split('\n').map((line) => line.trim()).find((line) => {
    if (line.length < 3 || line.length > 70 || /^#/.test(line)) return false
    if (/^(?:резюме|resume|\bcv\b|vacancy|вакансия)/iu.test(line)) return false
    return !ROLE_RE.test(line) || /^[\p{L}][\p{L}\s.'-]{2,40}$/u.test(line)
  })
  if (firstLine) {
    return firstLine.replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\s#*_-]+/gu, '').slice(0, 80)
  }
  return `Candidate · ${channel.label}`
}

function parseRole(text: string): string {
  const role = field(text, 'position|role|должность|позиция|lavozim|specialization|специализация|target role')
  if (role) return role.slice(0, 120)
  const line = text.split('\n').map((value) => value.trim()).find((value) =>
    ROLE_RE.test(value) && value.length <= 120,
  )
  return (line || text.split('\n')[0] || 'Open to opportunities').replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\s#*_-]+/gu, '').slice(0, 120)
}

function parseSkills(text: string): string[] {
  const skillsLine = field(text, 'skills|навыки|стек|stack|technologies|texnologiyalar|ko\'nikmalar')
  const source = skillsLine || text
  const hashtags = [...source.matchAll(/(?:^|\s)#([\p{L}\p{N}_+-]{2,40})/gu)].map((m) => m[1]!)
  const commaList = skillsLine
    ? skillsLine.split(/[,;/|•·]+/).map((item) => item.trim()).filter((item) => item.length >= 2 && item.length <= 40)
    : []
  return [...new Set([...hashtags, ...commaList])].slice(0, 12)
}

function parseLanguages(text: string): string[] {
  const raw = field(text, 'languages|языки|til(lar)?|language skills') || blockAfter(text, 'languages|языки|til(lar)?')
  if (!raw) return []
  return raw.split(/[,;/|•·]+/).map((item) => item.trim()).filter(Boolean).slice(0, 8)
}

function messageToProfile(
  text: string,
  opts: { id: string; url: string; dateIso: string | null | undefined },
  channel: TelegramChannel,
  needle: string,
): CvProfile | null {
  if (!isLikelyCvPost(text, channel.cvFeed)) return null

  const name = parseName(text, channel)
  const role = parseRole(text)
  if (needle && !`${name} ${role} ${text} ${(parseSkills(text)).join(' ')}`.toLocaleLowerCase('ru').includes(needle)) {
    return null
  }

  const city = field(text, 'location|city|локация|город|місто|manzil|shahar') || channel.location
  const contact = field(text, 'contact|контакт|telegram|phone|телефон|tel|boglanish|aloqa')
  const employmentType = field(text, 'employment|format|занятость|график|ish vaqti|bandlik')
  const education = field(text, 'education|образование|o\'qish|ta\'lim') || blockAfter(text, 'education|образование|o\'qish|ta\'lim') || null
  const hashtags = [...text.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]{2,40})/gu)].map((m) => m[1]!)

  return {
    id: opts.id,
    source: 'telegram',
    country: channel.country,
    name,
    role,
    experienceYears: parseExperience(text),
    city,
    remote: /remote|удалён|удален|віддален|masofaviy|online|онлайн/i.test(`${role} ${text}`),
    url: opts.url,
    createdAt: opts.dateIso && !Number.isNaN(Date.parse(opts.dateIso))
      ? new Date(opts.dateIso).toISOString()
      : new Date().toISOString(),
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
  const url = `${base.replace(/\/+$/, '')}/history?channel=${encodeURIComponent(channel.handle)}&limit=100`
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
  { code: 'RO', name: 'Romania', currency: 'RON', cities: ['Bucharest', 'Cluj-Napoca', 'Timisoara', 'Iasi'] },
] as const
