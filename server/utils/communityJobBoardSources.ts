import { parseHiringSourceSalary } from '@whiteslove/parsing-lexicon/hiring-source-semantics'
import type { Job } from './jobTypes'
import { detectWorkModes } from './hiringLexicon'
import { absoluteHttpUrl, stripHtml } from './htmlText'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 6_000
const MAX_PER_BOARD = 60
const FETCH_CONCURRENCY = 10

type CommunityBoard = {
  key: string
  label: string
  url: string
  remoteByDefault?: boolean
  tags?: string[]
}

// Community-sourced boards collected from the vacancy-site lists supplied for
// Job Finder. Sources already covered by dedicated adapters are intentionally
// omitted here (LinkedIn, Jooble, Adzuna, RemoteOK, Remotive, The Muse,
// Remote.co, FlexJobs, SimplyHired, Wellfound, Working Nomads, Jobspresso,
// Virtual Vocations, SkipTheDrive, 4 Day Week, Dice, Built In, YC and TechFetch).
//
// This list deliberately mixes classic boards with freelance/talent networks.
// Some networks expose only a small public catalogue or occasionally challenge
// datacenter traffic. Each board is isolated and the fan-out is concurrency
// limited, so one blocked/changed source returns [] without slowing or breaking
// the rest of the job feed.
export const COMMUNITY_JOB_BOARDS: CommunityBoard[] = [
  // General job boards
  { key: 'indeed', label: 'Indeed', url: 'https://www.indeed.com/jobs' },
  { key: 'glassdoor', label: 'Glassdoor', url: 'https://www.glassdoor.com/Job/jobs.htm' },
  { key: 'careerjet', label: 'Careerjet', url: 'https://www.careerjet.com/jobs' },
  { key: 'ziprecruiter', label: 'ZipRecruiter', url: 'https://www.ziprecruiter.com/jobs-search' },
  { key: 'monster', label: 'Monster', url: 'https://www.monster.com/jobs/search' },
  { key: 'talent-com', label: 'Talent.com', url: 'https://www.talent.com/jobs' },
  { key: 'careerbuilder', label: 'CareerBuilder', url: 'https://www.careerbuilder.com/jobs' },
  { key: 'jora', label: 'Jora', url: 'https://www.jora.com/jobs' },
  { key: 'jobisjob', label: 'JobisJob', url: 'https://www.jobisjob.com/' },
  { key: 'getwork', label: 'Getwork', url: 'https://www.getwork.com/jobs' },
  { key: 'lensa', label: 'Lensa', url: 'https://lensa.com/jobs' },

  // Remote-first boards
  { key: 'we-work-remotely', label: 'We Work Remotely', url: 'https://weworkremotely.com/', remoteByDefault: true },
  { key: 'dynamite-jobs', label: 'Dynamite Jobs', url: 'https://dynamitejobs.com/', remoteByDefault: true },
  { key: 'justremote', label: 'JustRemote', url: 'https://justremote.co/remote-jobs', remoteByDefault: true },
  { key: 'remotehub', label: 'RemoteHub', url: 'https://www.remotehub.com/jobs', remoteByDefault: true },
  { key: 'remote4me', label: 'Remote4Me', url: 'https://remote4.me/', remoteByDefault: true },
  { key: 'dailyremote', label: 'DailyRemote', url: 'https://dailyremote.com/', remoteByDefault: true },
  { key: 'workew', label: 'Workew', url: 'https://workew.com/', remoteByDefault: true },
  { key: 'nodesk', label: 'NoDesk', url: 'https://nodesk.co/remote-jobs/', remoteByDefault: true },
  { key: 'pangian', label: 'Pangian', url: 'https://pangian.com/job-travel-remote/', remoteByDefault: true },
  { key: 'rocketship', label: 'Rocketship Jobs', url: 'https://www.rocketshipjobs.com/', remoteByDefault: true },
  { key: 'jobgether', label: 'Jobgether', url: 'https://jobgether.com/remote-jobs', remoteByDefault: true },
  { key: 'hiring-cafe', label: 'HiringCafe', url: 'https://hiringcafe.com/jobs' },

  // Developer / IT networks
  { key: 'turing', label: 'Turing', url: 'https://www.turing.com/jobs', remoteByDefault: true },
  { key: 'arc-dev', label: 'Arc.dev', url: 'https://arc.dev/remote-jobs', remoteByDefault: true },
  { key: 'crossover', label: 'Crossover', url: 'https://www.crossover.com/jobs', remoteByDefault: true },
  { key: 'gun-io', label: 'Gun.io', url: 'https://gun.io/find-work/', remoteByDefault: true },
  { key: 'landing-jobs', label: 'Landing.Jobs', url: 'https://landing.jobs/jobs' },
  { key: 'offerzen', label: 'OfferZen', url: 'https://www.offerzen.com/job-seekers' },
  { key: 'devitjobs', label: 'DevITJobs', url: 'https://devitjobs.com/' },
  { key: 'js-remotely', label: 'JS Remotely', url: 'https://jsremotely.com/', remoteByDefault: true },
  { key: 'golang-cafe', label: 'Golang Cafe', url: 'https://golang.cafe/', remoteByDefault: true },
  { key: 'python-jobs', label: 'Python Jobs', url: 'https://www.python.org/jobs/' },
  { key: 'rubynow', label: 'RubyNow', url: 'https://rubynow.com/' },
  { key: 'ai-jobs', label: 'AI Jobs', url: 'https://aijobs.net/' },

  // Freelance / project marketplaces
  { key: 'upwork', label: 'Upwork', url: 'https://www.upwork.com/nx/search/jobs/' },
  { key: 'fiverr', label: 'Fiverr', url: 'https://www.fiverr.com/categories/programming-tech' },
  { key: 'freelancer', label: 'Freelancer', url: 'https://www.freelancer.com/jobs/' },
  { key: 'toptal', label: 'Toptal', url: 'https://www.toptal.com/talent/apply' },
  { key: 'braintrust', label: 'Braintrust', url: 'https://app.usebraintrust.com/jobs/' },
  { key: 'contra', label: 'Contra', url: 'https://contra.com/opportunities' },
  { key: 'guru', label: 'Guru', url: 'https://www.guru.com/d/jobs/' },
  { key: 'peopleperhour', label: 'PeoplePerHour', url: 'https://www.peopleperhour.com/freelance-jobs' },
  { key: 'workana', label: 'Workana', url: 'https://www.workana.com/jobs' },
  { key: 'truelancer', label: 'Truelancer', url: 'https://www.truelancer.com/freelance-jobs' },
  { key: 'hubstaff-talent', label: 'Hubstaff Talent', url: 'https://talent.hubstaff.com/search/jobs' },
  { key: 'solidgigs', label: 'SolidGigs', url: 'https://solidgigs.com/' },
  { key: 'catalant', label: 'Catalant', url: 'https://gocatalant.com/experts/' },
  { key: 'cloudpeeps', label: 'CloudPeeps', url: 'https://www.cloudpeeps.com/jobs' },
  { key: 'kolabtree', label: 'Kolabtree', url: 'https://www.kolabtree.com/projects' },
  { key: 'bark', label: 'Bark', url: 'https://www.bark.com/en/us/find-a-professional/' },

  // Design / creative
  { key: 'dribbble', label: 'Dribbble Jobs', url: 'https://dribbble.com/jobs' },
  { key: 'behance', label: 'Behance Jobs', url: 'https://www.behance.net/joblist' },
  { key: 'krop', label: 'Krop', url: 'https://www.krop.com/creative-jobs/' },
  { key: 'coroflot', label: 'Coroflot', url: 'https://www.coroflot.com/design-jobs' },
  { key: 'design-jobs-board', label: 'Design Jobs Board', url: 'https://www.designjobsboard.com/' },
  { key: 'working-not-working', label: 'Working Not Working', url: 'https://workingnotworking.com/jobs' },
  { key: 'creativepool', label: 'Creativepool', url: 'https://creativepool.com/jobs' },
  { key: 'designcrowd', label: 'DesignCrowd', url: 'https://www.designcrowd.com/jobs' },

  // Writing / marketing / content
  { key: 'problogger', label: 'ProBlogger Jobs', url: 'https://problogger.com/jobs/' },
  { key: 'freelance-writing', label: 'Freelance Writing Jobs', url: 'https://www.freelancewriting.com/jobs/' },
  { key: 'contena', label: 'Contena', url: 'https://contena.co/' },
  { key: 'bloggingpro', label: 'BloggingPro', url: 'https://www.bloggingpro.com/jobs/' },
  { key: 'writeraccess', label: 'WriterAccess', url: 'https://www.writeraccess.com/apply/' },
  { key: 'clearvoice', label: 'ClearVoice', url: 'https://www.clearvoice.com/talent-network/' },
  { key: 'marketerhire', label: 'MarketerHire', url: 'https://marketerhire.com/marketers' },
  { key: 'mediabistro', label: 'Mediabistro', url: 'https://www.mediabistro.com/jobs/' },
  { key: 'superpath', label: 'Superpath Jobs', url: 'https://www.superpath.co/jobs' },

  // Translation / teaching
  { key: 'proz', label: 'ProZ', url: 'https://www.proz.com/translation-jobs' },
  { key: 'translators-cafe', label: 'TranslatorsCafe', url: 'https://www.translatorscafe.com/cafe/searchjobs.asp' },
  { key: 'gengo', label: 'Gengo', url: 'https://gengo.com/translators/' },
  { key: 'smartcat', label: 'Smartcat', url: 'https://www.smartcat.com/marketplace/' },
  { key: 'preply', label: 'Preply', url: 'https://preply.com/en/teach' },
  { key: 'italki', label: 'italki', url: 'https://teach.italki.com/' },
  { key: 'cambly', label: 'Cambly', url: 'https://www.cambly.com/english/tutors?lang=en' },

  // Support / virtual assistants
  { key: 'modsquad', label: 'ModSquad', url: 'https://modsquad.com/careers/' },
  { key: 'support-adventure', label: 'Support Adventure', url: 'https://www.supportadventure.com/careers/', remoteByDefault: true },
  { key: 'working-solutions', label: 'Working Solutions', url: 'https://jobs.workingsolutions.com/', remoteByDefault: true },
  { key: 'belay', label: 'BELAY', url: 'https://belaysolutions.com/jobs/', remoteByDefault: true },
  { key: 'time-etc', label: 'Time Etc', url: 'https://web.timeetc.com/be-a-virtual-assistant/', remoteByDefault: true },
]

type HimalayasJob = {
  title?: string
  excerpt?: string
  companyName?: string
  employmentType?: string
  minSalary?: number | null
  maxSalary?: number | null
  salaryPeriod?: string | null
  currency?: string | null
  locationRestrictions?: string[] | null
  category?: string[] | null
  categories?: string[] | null
  parentCategories?: string[] | null
  description?: string
  pubDate?: number | string
  applicationLink?: string
  guid?: string
}

type HimalayasResponse = {
  jobs?: HimalayasJob[]
}

function sourceToken(value: string): string {
  return value
    .replace(/^https?:\/\//i, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(-180)
}

function salaryFields(text: string): Pick<Job, 'salaryMin' | 'salaryMax' | 'salaryCurrency'> {
  const parsed = parseHiringSourceSalary(text)
  if (!parsed || !parsed.currency || (parsed.min == null && parsed.max == null)) return {}
  return {
    salaryMin: parsed.min ?? undefined,
    salaryMax: parsed.max ?? undefined,
    salaryCurrency: parsed.currency,
  }
}

function postedAt(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value < 100_000_000_000 ? value * 1_000 : value
    return new Date(ms).toISOString()
  }
  const time = Date.parse(String(value || ''))
  return Number.isFinite(time) ? new Date(time).toISOString() : new Date().toISOString()
}

function sameHostFamily(candidate: URL, base: URL): boolean {
  return candidate.hostname === base.hostname
    || candidate.hostname.endsWith(`.${base.hostname}`)
    || base.hostname.endsWith(`.${candidate.hostname}`)
}

function looksLikeJobUrl(url: URL): boolean {
  const path = url.pathname.toLowerCase().replace(/\/+$/, '')
  if (!path || path === '/') return false
  if (/\/(?:login|signin|signup|register|pricing|employers?|companies|categories|search)(?:\/|$)/.test(path)) return false

  return /\/(?:remote-)?jobs?\/[a-z0-9][^/]{1,}/i.test(path)
    || /\/(?:vacanc(?:y|ies)|positions?|openings?|opportunities|offers?|projects?)\/[a-z0-9][^/]{1,}/i.test(path)
    || /\/job(?:ad)?[-_/][a-z0-9][a-z0-9_-]{3,}/i.test(path)
}

function jsonLdNodes(value: unknown): any[] {
  if (!value) return []
  if (Array.isArray(value)) return value.flatMap(jsonLdNodes)
  if (typeof value !== 'object') return []
  const graph = (value as any)['@graph']
  return graph ? jsonLdNodes(graph) : [value]
}

function locationFromPosting(posting: any, board: CommunityBoard): string {
  const raw = Array.isArray(posting?.jobLocation)
    ? posting.jobLocation
    : posting?.jobLocation
      ? [posting.jobLocation]
      : []
  const values = raw
    .map((item: any) => item?.address || item)
    .map((address: any) => [
      address?.addressLocality,
      address?.addressRegion,
      address?.addressCountry?.name || address?.addressCountry,
    ].filter(Boolean).join(', '))
    .filter(Boolean)
  if (values.length) return [...new Set(values)].join('; ')
  if (posting?.jobLocationType === 'TELECOMMUTE' || board.remoteByDefault) return 'Remote'
  return 'See listing'
}

function makeJob(input: {
  board: CommunityBoard
  title: string
  company?: string
  location?: string
  url: string
  description?: string
  date?: unknown
  employmentType?: string
  extraTags?: string[]
}): Job | null {
  const title = stripHtml(input.title).replace(/\s+/g, ' ').trim().slice(0, 240)
  if (title.length < 3) return null
  const description = stripHtml(input.description || '').slice(0, 4_000)
  const location = stripHtml(input.location || '') || (input.board.remoteByDefault ? 'Remote' : 'See listing')
  const semanticText = `${title}\n${location}\n${description}`

  return {
    id: `companies-community-${input.board.key}-${sourceToken(input.url)}`,
    title,
    company: (stripHtml(input.company || '') || input.board.label).slice(0, 180),
    location: location.slice(0, 240),
    url: input.url,
    source: 'companies',
    remote: input.board.remoteByDefault === true || detectWorkModes(semanticText).includes('remote'),
    tags: [...new Set([input.board.label, 'Community board', ...(input.board.tags || []), ...(input.extraTags || [])])].slice(0, 8),
    postedAt: postedAt(input.date),
    employmentType: input.employmentType,
    description: description || undefined,
    employerType: 'board',
    ...salaryFields(semanticText),
  }
}

function parseJsonLd(html: string, board: CommunityBoard): Job[] {
  const jobs: Job[] = []
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null

  while ((match = re.exec(html))) {
    let parsed: unknown
    try {
      parsed = JSON.parse(match[1]!)
    } catch {
      continue
    }

    for (const node of jsonLdNodes(parsed)) {
      const type = node?.['@type']
      const isJob = type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'))
      if (!isJob || !node?.title) continue
      const url = absoluteHttpUrl(String(node.url || node.sameAs || ''), board.url)
      if (!url) continue
      const job = makeJob({
        board,
        title: node.title,
        company: node?.hiringOrganization?.name,
        location: locationFromPosting(node, board),
        url,
        description: node.description,
        date: node.datePosted,
        employmentType: Array.isArray(node.employmentType) ? node.employmentType[0] : node.employmentType,
      })
      if (job) jobs.push(job)
      if (jobs.length >= MAX_PER_BOARD) break
    }
  }

  return jobs
}

function parseAnchors(html: string, board: CommunityBoard): Job[] {
  const base = new URL(board.url)
  const anchors: Array<{ index: number; end: number; url: string; title: string }> = []
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null

  while ((match = re.exec(html))) {
    const href = absoluteHttpUrl(match[1]!, board.url)
    if (!href) continue
    let parsed: URL
    try {
      parsed = new URL(href)
    } catch {
      continue
    }
    if (!sameHostFamily(parsed, base) || !looksLikeJobUrl(parsed)) continue

    const title = stripHtml(match[2] || '').replace(/\s+/g, ' ').trim()
    if (title.length < 3 || title.length > 220) continue
    if (/^(?:apply|apply now|view|view job|details?|read more|learn more|save|next|previous)$/i.test(title)) continue
    anchors.push({ index: match.index, end: re.lastIndex, url: href, title })
    if (anchors.length >= MAX_PER_BOARD * 3) break
  }

  const byUrl = new Map<string, Job>()
  for (let index = 0; index < anchors.length; index += 1) {
    const anchor = anchors[index]!
    if (byUrl.has(anchor.url)) continue
    const start = Math.max(0, anchor.index - 600)
    const end = anchors[index + 1]?.index ?? Math.min(html.length, anchor.end + 2_000)
    const card = html.slice(start, end)
    const text = stripHtml(card).slice(0, 4_000)
    const timeValue = card.match(/<time\b[^>]*datetime=["']([^"']+)["']/i)?.[1]
    const company = stripHtml(
      card.match(/<[^>]+(?:class|data-testid|itemprop)=["'][^"']*(?:company|employer|hiring-organization)[^"']*["'][^>]*>([\s\S]{0,400}?)<\/[^>]+>/i)?.[1] || '',
    )
    const location = stripHtml(
      card.match(/<[^>]+(?:class|data-testid|itemprop)=["'][^"']*(?:location|job-location)[^"']*["'][^>]*>([\s\S]{0,400}?)<\/[^>]+>/i)?.[1] || '',
    )
    const job = makeJob({
      board,
      title: anchor.title,
      company,
      location,
      url: anchor.url,
      description: text,
      date: timeValue,
    })
    if (job) byUrl.set(job.url, job)
    if (byUrl.size >= MAX_PER_BOARD) break
  }
  return [...byUrl.values()]
}

async function fetchText(url: string, accept = 'text/html,application/xhtml+xml'):
Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: accept,
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`${new URL(url).host} -> ${response.status}`)
  return response.text()
}

async function fetchBoard(board: CommunityBoard): Promise<Job[]> {
  const html = await fetchText(board.url)
  const byUrl = new Map<string, Job>()
  for (const job of [...parseJsonLd(html, board), ...parseAnchors(html, board)]) {
    byUrl.set(job.url, job)
    if (byUrl.size >= MAX_PER_BOARD) break
  }
  return [...byUrl.values()]
}

async function fetchHimalayas(): Promise<Job[]> {
  const response = await fetch('https://himalayas.app/jobs/api?limit=20', {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`himalayas.app -> ${response.status}`)
  const data = await response.json() as HimalayasResponse
  const board: CommunityBoard = {
    key: 'himalayas',
    label: 'Himalayas',
    url: 'https://himalayas.app/jobs',
    remoteByDefault: true,
  }

  return (data.jobs || []).flatMap((item) => {
    if (!item.title) return []
    const url = item.guid || item.applicationLink
    if (!url) return []
    const categories = item.categories || item.category || []
    const location = item.locationRestrictions?.length
      ? item.locationRestrictions.join('; ')
      : 'Remote / Worldwide'
    const job = makeJob({
      board,
      title: item.title,
      company: item.companyName,
      location,
      url,
      description: item.description || item.excerpt,
      date: item.pubDate,
      employmentType: item.employmentType,
      extraTags: [...categories, ...(item.parentCategories || [])],
    })
    if (!job) return []
    job.salaryMin = item.minSalary ?? job.salaryMin
    job.salaryMax = item.maxSalary ?? job.salaryMax
    job.salaryCurrency = item.currency || job.salaryCurrency
    if (item.salaryPeriod) job.tags = [...new Set([...(job.tags || []), item.salaryPeriod])].slice(0, 8)
    return [job]
  })
}

async function mapSettledLimited<T, R>(items: T[], concurrency: number, task: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      try {
        results[index] = { status: 'fulfilled', value: await task(items[index]!) }
      } catch (reason) {
        results[index] = { status: 'rejected', reason }
      }
    }
  })
  await Promise.all(workers)
  return results
}

export async function fetchCommunityJobBoardJobs(q = ''): Promise<Job[]> {
  if (process.env.COMMUNITY_JOB_BOARDS_SOURCE === 'off') return []

  const [boardResults, himalayasResult] = await Promise.all([
    mapSettledLimited(COMMUNITY_JOB_BOARDS, FETCH_CONCURRENCY, fetchBoard),
    fetchHimalayas().then(
      (value) => ({ status: 'fulfilled', value } as PromiseFulfilledResult<Job[]>),
      (reason) => ({ status: 'rejected', reason } as PromiseRejectedResult),
    ),
  ])

  const byUrl = new Map<string, Job>()
  boardResults.forEach((result, index) => {
    const board = COMMUNITY_JOB_BOARDS[index]!
    if (result.status === 'rejected') {
      console.warn(
        '[jobs] community board failed:',
        board.label,
        result.reason instanceof Error ? result.reason.message : String(result.reason),
      )
      return
    }
    for (const job of result.value) byUrl.set(job.url, job)
  })

  if (himalayasResult.status === 'fulfilled') {
    for (const job of himalayasResult.value) byUrl.set(job.url, job)
  } else {
    console.warn(
      '[jobs] community board failed: Himalayas',
      himalayasResult.reason instanceof Error ? himalayasResult.reason.message : String(himalayasResult.reason),
    )
  }

  const jobs = [...byUrl.values()]
  if (!q.trim()) return jobs
  const needle = q.toLocaleLowerCase('en')
  return jobs.filter((job) =>
    `${job.title} ${job.company} ${job.location} ${job.description || ''}`
      .toLocaleLowerCase('en')
      .includes(needle),
  )
}
