import type { Job } from './jobTypes'
import { crawlCyclicJobBoard } from './cyclicJobBoardCrawler'

const API_URL = 'https://api.hh.ru/vacancies'
const USER_AGENT = 'WhitesLove-Hiring-Aggregator/1.0 (admin@whiteslove.me)'
const PER_PAGE = 100
const DEFAULT_PAGES_PER_RUN = 4
const HH_MAX_PAGE = 20
const MAX_ATTEMPTS = 4

type HhCountry = 'UZ' | 'KZ' | 'KG'
interface HhTarget {
  country: HhCountry
  area: string
  host: string
  label: string
  fallbackLocation: string
}

const STANDARD_TARGETS: HhTarget[] = [
  { country: 'UZ', area: '2759', host: 'hh.uz', label: 'HH.uz', fallbackLocation: 'Uzbekistan' },
  { country: 'KZ', area: '40', host: 'hh.kz', label: 'HH.kz', fallbackLocation: 'Kazakhstan' },
  { country: 'KG', area: '48', host: 'headhunter.kg', label: 'HeadHunter.kg', fallbackLocation: 'Kyrgyzstan' },
]

interface HhSalary {
  from?: number | null
  to?: number | null
  currency?: string | null
  gross?: boolean | null
}

interface HhVacancy {
  id?: string
  name?: string
  alternate_url?: string
  published_at?: string
  employer?: { name?: string }
  area?: { name?: string }
  salary?: HhSalary | null
  snippet?: { requirement?: string | null; responsibility?: string | null }
  schedule?: { id?: string; name?: string } | null
  employment?: { id?: string; name?: string } | null
  professional_roles?: Array<{ name?: string }>
}

interface HhVacancyPage {
  items?: HhVacancy[]
  pages?: number
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function configuredTargets(): HhTarget[] {
  const countries = String(process.env.HH_JOB_COUNTRIES || 'UZ,KZ,KG')
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean)
  const enabled = new Set(countries)
  const targets = STANDARD_TARGETS.filter((target) => enabled.has(target.country))

  // Backwards-compatible supplemental Uzbekistan area IDs. The old deployment
  // value `2759` remains harmless while KZ/KG standard targets are enabled by
  // HH_JOB_COUNTRIES, so existing production env files do not suppress the new
  // countries accidentally.
  const extraAreas = String(process.env.HH_JOB_AREAS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  for (const area of extraAreas) {
    if (targets.some((target) => target.area === area)) continue
    targets.push({
      country: 'UZ',
      area,
      host: 'hh.uz',
      label: 'HH.uz',
      fallbackLocation: 'Uzbekistan',
    })
  }
  return targets
}

function pagesPerRun(): number {
  return Math.max(1, Math.min(19, Number(process.env.HH_JOB_PAGES_PER_RUN) || DEFAULT_PAGES_PER_RUN))
}

function dateFrom(): string {
  const days = Math.max(1, Math.min(14, Number(process.env.HH_JOB_MAX_AGE_DAYS) || 14))
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

function isRemote(item: HhVacancy): boolean {
  return item.schedule?.id === 'remote' || /(?:remote|удал[её]н|masofaviy|қашықтан)/iu.test(
    `${item.name || ''} ${item.schedule?.name || ''}`,
  )
}

function description(item: HhVacancy): string | undefined {
  const value = [item.snippet?.requirement, item.snippet?.responsibility]
    .map((part) => String(part || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
  return value || undefined
}

export function mapHhVacancy(item: HhVacancy, target: HhTarget = STANDARD_TARGETS[0]!): Job | null {
  const id = String(item.id || '').trim()
  const title = String(item.name || '').trim()
  const url = String(item.alternate_url || '').trim()
  const posted = Date.parse(String(item.published_at || ''))
  if (!id || !title || !url || !Number.isFinite(posted)) return null

  const roles = (item.professional_roles || []).map((role) => String(role.name || '').trim()).filter(Boolean)
  const stableId = target.country === 'UZ' ? `hh-${id}` : `hh-${target.country.toLowerCase()}-${id}`
  return {
    id: stableId,
    title,
    company: String(item.employer?.name || 'Не указан').trim(),
    location: String(item.area?.name || target.fallbackLocation).trim(),
    url,
    source: 'hh',
    remote: isRemote(item),
    tags: [target.label, ...roles].slice(0, 8),
    postedAt: new Date(posted).toISOString(),
    description: description(item),
    employmentType: item.employment?.name || undefined,
    salaryMin: typeof item.salary?.from === 'number' ? item.salary.from : undefined,
    salaryMax: typeof item.salary?.to === 'number' ? item.salary.to : undefined,
    salaryCurrency: item.salary?.currency || undefined,
    salaryGross: typeof item.salary?.gross === 'boolean' ? item.salary.gross : undefined,
    schedule: item.schedule?.name || undefined,
    country: target.country,
    city: item.area?.name || undefined,
    employerType: 'board',
    hiringKind: 'vacancy',
  }
}

async function fetchPage(target: HhTarget, page: number): Promise<HhVacancyPage> {
  const params = new URLSearchParams({
    host: target.host,
    area: target.area,
    page: String(page),
    per_page: String(PER_PAGE),
    order_by: 'publication_time',
    date_from: dateFrom(),
  })
  const query = String(process.env.HH_JOB_QUERY || '').trim()
  if (query) params.set('text', query)

  let backoffMs = 500
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let response: Response | undefined
    try {
      response = await fetch(`${API_URL}?${params}`, {
        headers: {
          'User-Agent': USER_AGENT,
          'HH-User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(15_000),
      })
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) throw error
    }
    if (response?.ok) return await response.json() as HhVacancyPage
    if (response && response.status !== 429 && response.status < 500) {
      throw new Error(`api.hh.ru (${target.host}) -> ${response.status}`)
    }
    if (response && attempt === MAX_ATTEMPTS) throw new Error(`api.hh.ru (${target.host}) -> ${response.status}`)
    const retryAfter = Number(response?.headers.get('retry-after'))
    await wait(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1_000 : backoffMs)
    backoffMs = Math.min(backoffMs * 2, 8_000)
  }
  return { items: [], pages: 0 }
}

/** Public HH-family vacancy ingestion for Uzbekistan, Kazakhstan and Kyrgyzstan. */
export async function fetchHhJobs(_query = ''): Promise<Job[]> {
  const byId = new Map<string, Job>()
  for (const target of configuredTargets()) {
    let availablePages = HH_MAX_PAGE
    const run = await crawlCyclicJobBoard({
      key: `hh-${target.country.toLowerCase()}-area-${target.area}`,
      pagesPerRun: pagesPerRun(),
      maxPage: HH_MAX_PAGE,
      fetchPage: async (crawlerPage) => {
        if (crawlerPage > availablePages) return JSON.stringify({ items: [], pages: availablePages })
        const data = await fetchPage(target, crawlerPage - 1)
        availablePages = Math.max(1, Math.min(HH_MAX_PAGE, Number(data.pages) || 1))
        return JSON.stringify(data)
      },
      parsePage: (raw) => {
        const data = JSON.parse(raw) as HhVacancyPage
        return (data.items || []).map((item) => mapHhVacancy(item, target)).filter((job): job is Job => Boolean(job))
      },
      requestDelayMs: Math.max(0, Math.min(5_000, Number(process.env.HH_JOB_REQUEST_DELAY_MS) || 250)),
    })
    for (const job of run.jobs) byId.set(job.id, job)
    console.log(
      `[jobs] ${target.label} area=${target.area} pages=${run.pages.join(',')} next=${run.nextPage} cycle=${run.cycle}`,
    )
  }
  return [...byId.values()]
}
