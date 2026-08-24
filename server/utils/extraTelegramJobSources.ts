import type { Job } from './jobTypes'
import { isLikelyTelegramVacancy } from './sources'

interface TelegramChannel {
  handle: string
  label: string
  location: string
  countryCode: string
  tags: string[]
  remoteByDefault?: boolean
}

const EXTRA_TELEGRAM_JOB_CHANNELS: TelegramChannel[] = [
  // Uzbekistan — IT / office feeds from the initial source set.
  { handle: 'unilance', label: 'Unilance', location: 'Uzbekistan', countryCode: 'UZ', tags: ['IT', 'Jobs'] },
  { handle: 'jobmakon', label: 'Jobmakon', location: 'Uzbekistan', countryCode: 'UZ', tags: ['IT', 'Jobs', 'Internships'] },
  { handle: 'itjobstashkent', label: 'IT Jobs Tashkent', location: 'Tashkent, Uzbekistan', countryCode: 'UZ', tags: ['IT', 'Jobs'] },

  // Uzbekistan — broad/local work: retail, service, horeca, production, delivery, students.
  { handle: 'tashjobs', label: 'Tash Jobs', location: 'Tashkent, Uzbekistan', countryCode: 'UZ', tags: ['Jobs', 'Local', 'Retail', 'Service'] },
  { handle: 'clozjobs', label: 'CLOZ Jobs', location: 'Tashkent, Uzbekistan', countryCode: 'UZ', tags: ['Jobs', 'Local', 'Retail', 'Service'] },
  { handle: 'ISHboor', label: 'IshBor', location: 'Tashkent, Uzbekistan', countryCode: 'UZ', tags: ['Jobs', 'Local', 'EntryLevel', 'Retail'] },
  { handle: 'Ish_Toshkent', label: 'ISH TOSHKENT', location: 'Tashkent, Uzbekistan', countryCode: 'UZ', tags: ['Jobs', 'Local', 'EntryLevel', 'Retail'] },
  { handle: 'tg_job', label: 'Работа в Узбекистане', location: 'Uzbekistan', countryCode: 'UZ', tags: ['Jobs', 'Local', 'Retail', 'Production'] },
  { handle: 'work_saleuz', label: 'Worksale.uz', location: 'Uzbekistan', countryCode: 'UZ', tags: ['Jobs', 'Local', 'Retail', 'Service'] },

  // Ukraine — broad career/job channels.
  { handle: 'WORKIN_CHERNIVTSI', label: 'Work in Chernivtsi', location: 'Chernivtsi, Ukraine', countryCode: 'UA', tags: ['Jobs', 'General'] },
  { handle: 'happymonday', label: 'Happy Monday', location: 'Ukraine', countryCode: 'UA', tags: ['Jobs', 'Career', 'Ukraine'] },
  { handle: 'lobbyx', label: 'Lobby X', location: 'Ukraine', countryCode: 'UA', tags: ['Jobs', 'Ukraine'] },
  { handle: 'lobbyxIT', label: 'Lobby X IT', location: 'Ukraine', countryCode: 'UA', tags: ['IT', 'Jobs', 'Ukraine'] },
  { handle: 'univwork', label: 'UNI WORK', location: 'Ukraine', countryCode: 'UA', tags: ['Jobs', 'Internships', 'Junior', 'Ukraine'] },
  { handle: 'aplaywork', label: 'A-Play', location: 'Ukraine', countryCode: 'UA', tags: ['Jobs', 'Internships', 'Ukraine'] },
  { handle: 'ukrjob_one', label: 'UKRJOB', location: 'Ukraine', countryCode: 'UA', tags: ['Jobs', 'Remote', 'EntryLevel', 'Ecommerce'] },
  { handle: 'beejob1_ua', label: 'BEE JOB', location: 'Ukraine', countryCode: 'UA', tags: ['Jobs', 'Remote', 'EntryLevel', 'Ecommerce'] },

  // Ukraine — remote-first feeds.
  { handle: 'robotaua_now_remote', label: 'robota.ua NOW Remote', location: 'Ukraine', countryCode: 'UA', tags: ['Remote', 'Jobs', 'Ukraine'], remoteByDefault: true },
  { handle: 'workua_remote', label: 'Work.ua Remote', location: 'Ukraine', countryCode: 'UA', tags: ['Remote', 'Jobs', 'EntryLevel', 'Ukraine'], remoteByDefault: true },
  { handle: 'top_vacansii', label: 'CATWORK', location: 'Ukraine', countryCode: 'UA', tags: ['Remote', 'Jobs', 'Internships', 'Ukraine'], remoteByDefault: true },

  // Romania — local jobs, including vacancies aimed at Ukrainians and newcomers.
  { handle: 'jobs4ukrinromania', label: 'Jobs4UKR Romania', location: 'Romania', countryCode: 'RO', tags: ['Jobs', 'Local', 'EntryLevel', 'Romania'] },
  { handle: 'RoMunca', label: 'RoMunca', location: 'Romania', countryCode: 'RO', tags: ['Jobs', 'Local', 'Romania'] },
]

const UA = 'jobFinder/1.0 (job aggregator; contact: admin@whiteslove.me)'
const DESC_MAX = Number.POSITIVE_INFINITY

interface TelegramWorkerMessage {
  id: number
  text: string
  date: string | null
  preview?: string | null
  urls?: string[]
}

function decodeTelegramEntities(text: string): string {
  const named: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', bull: '•',
  }
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#')) {
      const hex = entity[1]?.toLowerCase() === 'x'
      const value = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10)
      return Number.isFinite(value) ? String.fromCodePoint(value) : match
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
  const match = text.match(new RegExp(`(?:^|\\n)[^\\p{L}\\p{N}\\n]{0,6}(?:${names})\\s*[:—-]\\s*([^\\n]{2,120})`, 'iu'))
  return match?.[1]?.trim()
}

function titleFromText(text: string, channel: TelegramChannel): string {
  const explicit = field(text, 'vacancy|position|role|job|вакансия|позиция|посада|loc de muncă|loc de munca|post|angajare|lavozim')
  if (explicit) return explicit.slice(0, 180)

  const line = text
    .split('\n')
    .map((value) => value.trim())
    .find((value) => value.length >= 3 && value.length <= 180 && !/^#/.test(value))

  return line || `Vacancy from ${channel.label}`
}

function normalizeExternalUrl(raw: string): string | undefined {
  try {
    const url = new URL(decodeTelegramEntities(raw.trim()))
    if (!/^https?:$/.test(url.protocol)) return undefined

    const host = url.hostname.toLowerCase().replace(/^www\./, '')

    if (host === 't.me' || host === 'telegram.me' || host === 'telegram.org') return undefined
    if (host === 'ya.cc' || host.endsWith('.ya.cc') || host === 'clck.yandex.ru') return undefined

    return url.toString()
  } catch {
    return undefined
  }
}

function urlsFromText(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>()"']+/gi) || []
  return matches
    .map(normalizeExternalUrl)
    .filter((url): url is string => !!url)
}

function urlsFromHtml(html: string): string[] {
  const urls: string[] = []
  for (const match of html.matchAll(/\bhref=["']([^"']+)["']/gi)) {
    const url = normalizeExternalUrl(match[1]!)
    if (url) urls.push(url)
  }
  return urls
}

function pickApplyUrl(text: string, supplied: string[] = []): string | undefined {
  const candidates = [
    ...supplied,
    ...urlsFromText(text),
  ]
    .map(normalizeExternalUrl)
    .filter((url): url is string => !!url)

  const unique = [...new Set(candidates)]

  return unique.find((url) => /(?:linkedin\.com\/jobs|lnkd\.in|hh\.(?:uz|ru)\/vacancy|work\.ua|robota\.ua|jobs4ukr\.com|cloz\.uz|career|careers|jobs|vacanc|apply)/i.test(url))
    || unique[0]
}

function toJob(
  text: string,
  channel: TelegramChannel,
  id: string,
  url: string,
  date: string | null | undefined,
  externalUrls: string[] = [],
): Job | null {
  if (!isLikelyTelegramVacancy(text)) return null

  const title = titleFromText(text, channel)
  const company = field(text, 'company|employer|компания|работодатель|роботодавець|компанія|companie|angajator|tashkilot|ish beruvchi') || channel.label
  const location = field(text, 'location|city|локация|город|місто|locație|locatie|oraș|oras|manzil|shahar') || channel.location
  const hashtags = [...text.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]{2,40})/gu)].map((match) => match[1]!)
  const applyUrl = pickApplyUrl(text, externalUrls)

  return {
    id,
    title,
    company,
    location,
    url,
    ...(applyUrl ? { applyUrl } : {}),
    source: 'telegram',
    remote: channel.remoteByDefault === true
      || /remote|удал[её]н|віддален|дистанційн|робота\s+(?:з|із)\s+дому|la distanță|la distanta|de acasă|de acasa|masofaviy|онлайн|online/i.test(`${title} ${text}`),
    tags: [...channel.tags, channel.countryCode, `@${channel.handle}`, ...hashtags].slice(0, 8),
    postedAt: date && !Number.isNaN(Date.parse(date)) ? new Date(date).toISOString() : new Date().toISOString(),
    description: text.slice(0, DESC_MAX),
  }
}

async function fetchViaWorker(base: string, channel: TelegramChannel): Promise<Job[]> {
  const url = `${base.replace(/\/+$/, '')}/history?channel=${encodeURIComponent(channel.handle)}&limit=100`
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`tg-worker @${channel.handle} -> ${res.status}`)

  const data = (await res.json()) as { ok?: boolean; messages?: TelegramWorkerMessage[] }
  if (!data.ok || !Array.isArray(data.messages)) throw new Error(`tg-worker @${channel.handle} bad payload`)

  return data.messages
    .map((message) => {
      const text = [(message.text || '').trim(), (message.preview || '').trim()].filter(Boolean).join('\n')
      if (!text) return null
      return toJob(
        text,
        channel,
        `telegram-${channel.handle}-${message.id}`,
        `https://t.me/${channel.handle}/${message.id}`,
        message.date,
        message.urls || [],
      )
    })
    .filter((job): job is Job => job !== null)
}

async function fetchViaPreview(channel: TelegramChannel): Promise<Job[]> {
  const res = await fetch(`https://t.me/s/${encodeURIComponent(channel.handle)}`, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`t.me/@${channel.handle} -> ${res.status}`)

  const html = await res.text()
  const jobs: Job[] = []
  const chunks = html.split(/<div class="tgme_widget_message_wrap\b[^>]*>/i).slice(1)

  for (const chunk of chunks) {
    const post = chunk.match(/data-post="([^"]+)"/i)?.[1]
    const body = chunk.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1]
    if (!post || !body) continue

    const datetime = chunk.match(/<time[^>]+datetime="([^"]+)"/i)?.[1]
    const job = toJob(
      telegramText(body),
      channel,
      `telegram-${post.replace(/[^a-z0-9_-]+/gi, '-')}`,
      `https://t.me/${post}`,
      datetime,
      urlsFromHtml(chunk),
    )
    if (job) jobs.push(job)
  }

  return jobs
}

async function fetchChannel(channel: TelegramChannel): Promise<Job[]> {
  const workerUrl = process.env.TELEGRAM_WORKER_URL
  if (workerUrl) return fetchViaWorker(workerUrl, channel)
  return fetchViaPreview(channel)
}

export async function fetchExtraTelegramJobs(q: string): Promise<Job[]> {
  if (process.env.TELEGRAM_SOURCE === 'off') return []

  const results = await Promise.all(
    EXTRA_TELEGRAM_JOB_CHANNELS.map((channel) => fetchChannel(channel).catch((error) => {
      console.error(`[jobs] telegram @${channel.handle} failed:`, (error as Error).message)
      return [] as Job[]
    })),
  )

  const jobs = results.flat()
  if (!q) return jobs
  const needle = q.toLocaleLowerCase('ru')
  return jobs.filter((job) =>
    `${job.title} ${job.company} ${job.description || ''}`.toLocaleLowerCase('ru').includes(needle),
  )
}
