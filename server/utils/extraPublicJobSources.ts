import { detectUsLocation } from '@whiteslove/parsing-lexicon/hiring-source-semantics'
import type { Job, SponsorshipConfidence } from './jobTypes'
import { detectWorkModes } from './hiringLexicon'

type PublicBoard = {
  label: string
  url: string
  /**
   * Deterministic parser for a board whose markup we know. The generic
   * anchor/JSON-LD path stays the default for everything else — it guesses,
   * which is fine for boards nobody has looked at, and wrong for ones we have.
   */
  parse?: (html: string, board: PublicBoard) => Job[]
  /** Country the listing belongs to when the board is national. */
  country?: string
  remoteByDefault?: boolean
  usOnly?: boolean
  assumeUs?: boolean
  sponsorshipConfidence?: SponsorshipConfidence
  sponsorshipEvidence?: string
}

// Sources collected from the community/profile links supplied for Job Finder.
// These are public candidate-facing listings, not the social profiles themselves.
// Each board is isolated: a block/markup change produces [] for that board only.
// Flagma publishes vacancies alongside the resumes the hiring board already
// reads: same card layout, "-rv<id>.html" instead of "-rr<id>.html". Low
// volume (RO lists a few dozen), so this adds breadth rather than bulk. The UZ
// domain answers datacenter clients with a reCAPTCHA page, and reaches this
// parser only once the Chrome-impersonating fetcher unblocks it.
// The whole anchor, not just its href: the vacancy title is the link text.
const FLAGMA_VACANCY_LINK_RE =
  /<a\b[^>]*href="([^"]*flagma\.[a-z]{2}\/(?:ru\/)?vakansiya-[^"?#]*-rv\d+\.html)"[^>]*>([\s\S]*?)<\/a>/gi

/** Card markup as rows, because each row of a Flagma card means something. */
function cardLines(fragment: string): string[] {
  return decodeEntities(fragment)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6]|tr|section|article|span|td)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function parseFlagmaVacancies(html: string, board: PublicBoard): Job[] {
  const jobs: Job[] = []
  const seen = new Set<string>()
  const matches = [...html.matchAll(FLAGMA_VACANCY_LINK_RE)]

  for (const [index, match] of matches.entries()) {
    const url = match[1]!
    if (seen.has(url)) continue
    seen.add(url)

    // The card runs to the next link for a *different* vacancy: a card holds
    // several anchors to the same posting, and stopping at the first of them
    // would cut off the employer and location rows that follow the title.
    const start = Math.max(0, (match.index ?? 0) - 200)
    const nextDistinct = matches.slice(index + 1).find((candidate) => candidate[1] !== url)
    const end = nextDistinct?.index ?? Math.min(html.length, (match.index ?? 0) + 2_000)
    // The shared stripHtml flattens a document to one line, which is right for
    // the generic boards and useless here: this card's meaning is in its rows.
    const lines = cardLines(html.slice(start, end))

    const title = stripHtml(match[2] || '') || lines[0] || ''
    // "Коваленко О.А., ФЛП" then "| Полтава, UA" — the employer and where it
    // is, which the card may put on one row or two.
    const employerRowIndex = lines.findIndex((line) => /\|\s*[^|]+,\s*[A-Z]{2}\s*$/.test(line))
    const employerRow = employerRowIndex >= 0 ? lines[employerRowIndex]! : ''
    const inlineEmployer = employerRow.includes('|') ? employerRow.split('|')[0]!.trim() : ''
    const employerPart = inlineEmployer
      || (employerRowIndex > 0 ? lines[employerRowIndex - 1]!.replace(/[|,]+$/, '').trim() : '')
    const locationPart = employerRow.replace(/^[^|]*\|/, '').trim()
    // "в Бухаресте, полная занятость" — where the work is.
    const placementLine = lines.find((line) => /^(?:в|у|in)\s+\p{Lu}/u.test(line)) || ''

    const text = lines.join(' ')
    const cleanTitle = title.replace(/\s+/g, ' ').trim()
    if (cleanTitle.length < 3 || cleanTitle.length > 180) continue

    jobs.push({
      id: `flagma-${url.match(/-rv(\d+)\.html/)?.[1] || url.slice(-24)}`,
      title: cleanTitle,
      company: employerPart || board.label,
      // "в Бухаресте, полная занятость" -> "Бухаресте". The city keeps the
      // grammatical case the site prints; declining it back is not worth a
      // dictionary, and the string is only ever displayed.
      location: placementLine
        .replace(/^(?:в|у|in)\s+/iu, '')
        .replace(/,\s*(?:полная|частичная|неполная)\s+занятость.*$/iu, '')
        .replace(/,\s*удал[ёе]нно.*$/iu, '')
        .trim()
        || locationPart
        || board.country
        || '',
      url,
      source: 'companies',
      remote: detectWorkModes(text).includes('remote'),
      postedAt: new Date().toISOString(),
      description: lines.slice(0, 8).join(' · ').slice(0, 600),
      tags: [board.label, ...(board.country ? [board.country] : [])],
    } as Job)
  }

  return jobs
}

const PUBLIC_JOB_BOARDS: PublicBoard[] = [
  {
    label: 'Flagma RO',
    url: 'https://flagma.ro/ru/vacancies/',
    country: 'RO',
    parse: parseFlagmaVacancies,
  },
  {
    label: 'Flagma UZ',
    url: 'https://flagma.uz/ru/vacancies/',
    country: 'UZ',
    parse: parseFlagmaVacancies,
  },
  { label: 'Remote Source', url: 'https://www.remotesource.com/jobs', remoteByDefault: true },
  { label: 'TaskFavour', url: 'https://www.taskfavour.com/jobs' },
  { label: 'Tech Leads Community', url: 'https://techleadscommunity.com/', remoteByDefault: true },
  { label: '4 Day Week', url: 'https://4dayweek.io/jobs' },
  { label: '80,000 Hours', url: 'https://jobs.80000hours.org/' },
  { label: 'Welcome to the Jungle', url: 'https://www.welcometothejungle.com/en/jobs' },
  { label: 'Working Nomads', url: 'https://www.workingnomads.com/', remoteByDefault: true },
  { label: 'Remote.co', url: 'https://remote.co/remote-jobs', remoteByDefault: true },
  { label: 'Virtual Vocations', url: 'https://www.virtualvocations.com/jobs/', remoteByDefault: true },
  { label: 'Jobspresso', url: 'https://jobspresso.co/jobs/', remoteByDefault: true },
  { label: 'Wellfound', url: 'https://wellfound.com/jobs' },
  { label: 'Dice', url: 'https://www.dice.com/jobs?location=&q=' },
  { label: 'Built In', url: 'https://builtin.com/jobs/remote/software-engineering', usOnly: true, assumeUs: true },
  { label: 'Y Combinator', url: 'https://www.ycombinator.com/jobs/role/software-engineer/united-states', usOnly: true, assumeUs: true },
  { label: 'TechFetch', url: 'https://www.techfetch.com/', usOnly: true, assumeUs: true },
  { label: 'PowerToFly', url: 'https://powertofly.com/jobs/?location=USA', usOnly: true, assumeUs: true },
  { label: 'SimplyHired', url: 'https://www.simplyhired.com/' },
  { label: 'Escape the City', url: 'https://www.escapethecity.org/search/jobs' },
  { label: 'Diversity Jobs Group', url: 'https://diversityjobsgroup.com/job-listings/' },

  // USA visa-sponsorship-focused boards. Confidence is deliberately explicit:
  // "historical" means the employer has sponsored before, not that this exact
  // vacancy promises sponsorship. The other values reflect the board's own
  // curation/verification claims and are surfaced as evidence, not guarantees.
  {
    label: 'VisaJobSearch',
    url: 'https://www.visajobsearch.com/jobs',
    usOnly: true,
    sponsorshipConfidence: 'verified',
    sponsorshipEvidence: 'Visa-focused board labels roles with sponsorship status',
  },
  {
    label: 'VisaJobFinder',
    url: 'https://visajobfinder.com/usa',
    usOnly: true,
    assumeUs: true,
    sponsorshipConfidence: 'explicit',
    sponsorshipEvidence: 'Board states listed US roles explicitly offer visa sponsorship',
  },
  {
    label: 'JobsH1B',
    url: 'https://jobsh1b.com/jobs',
    usOnly: true,
    assumeUs: true,
    sponsorshipConfidence: 'historical',
    sponsorshipEvidence: 'Employer has H-1B sponsorship history; role eligibility is not guaranteed',
  },
  {
    label: 'VisaHire',
    url: 'https://visahire.co/',
    usOnly: true,
    assumeUs: true,
    sponsorshipConfidence: 'verified',
    sponsorshipEvidence: 'Board checks listing sponsorship intent or recent H-1B sponsor history',
  },
  {
    label: 'Migrate Mate',
    url: 'https://migratemate.co/visa-sponsorship-jobs',
    usOnly: true,
    assumeUs: true,
    sponsorshipConfidence: 'verified',
    sponsorshipEvidence: 'Visa-focused US board backed by employer sponsorship history',
  },
  {
    label: 'MyVisaJobs',
    url: 'https://www.myvisajobs.com/Search_Visa',
    usOnly: true,
    assumeUs: true,
    sponsorshipConfidence: 'historical',
    sponsorshipEvidence: 'Employer sponsorship history from US visa/LCA data',
  },
]

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 12_000
const MAX_PER_BOARD = 100

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
  }
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#')) {
      const hex = entity[1]?.toLowerCase() === 'x'
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return named[entity.toLowerCase()] ?? match
  })
}

function stripHtml(value: unknown): string {
  return decodeEntities(String(value || ''))
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function validDate(value: unknown): string {
  const time = Date.parse(String(value || ''))
  return Number.isNaN(time) ? new Date().toISOString() : new Date(time).toISOString()
}

function absoluteUrl(raw: string, base: string): string | undefined {
  try {
    const url = new URL(decodeEntities(raw), base)
    if (!/^https?:$/.test(url.protocol)) return undefined
    url.hash = ''
    return url.toString()
  } catch {
    return undefined
  }
}

function locationFromPosting(posting: any): string {
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
  if (posting?.jobLocationType === 'TELECOMMUTE') return 'Remote'
  return 'See listing'
}


function boardTags(board: PublicBoard): string[] {
  const tags = [board.label]
  if (board.sponsorshipConfidence === 'explicit') tags.push('Visa sponsorship', 'Explicit sponsorship')
  if (board.sponsorshipConfidence === 'verified') tags.push('Visa sponsorship', 'Verified sponsor')
  if (board.sponsorshipConfidence === 'historical') tags.push('H1B sponsor history')
  if (board.usOnly) tags.push('USA')
  return tags
}

function sponsorshipFields(board: PublicBoard): Pick<Job, 'sponsorshipConfidence' | 'sponsorshipEvidence'> {
  return {
    ...(board.sponsorshipConfidence ? { sponsorshipConfidence: board.sponsorshipConfidence } : {}),
    ...(board.sponsorshipEvidence ? { sponsorshipEvidence: [board.sponsorshipEvidence] } : {}),
  }
}

function jsonLdNodes(value: any): any[] {
  if (!value) return []
  if (Array.isArray(value)) return value.flatMap(jsonLdNodes)
  const graph = value?.['@graph']
  return graph ? jsonLdNodes(graph) : [value]
}

function parseJsonLd(html: string, board: PublicBoard): Job[] {
  const out: Job[] = []
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null

  while ((match = re.exec(html))) {
    let parsed: any
    try {
      parsed = JSON.parse(match[1]!)
    } catch {
      continue
    }

    for (const node of jsonLdNodes(parsed)) {
      const type = node?.['@type']
      const isJob = type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'))
      if (!isJob || !node?.title) continue

      const url = absoluteUrl(String(node.url || node.sameAs || ''), board.url)
      if (!url) continue
      const location = locationFromPosting(node)
      if (board.usOnly && !board.assumeUs && !detectUsLocation(location)) continue
      const company = stripHtml(node?.hiringOrganization?.name) || board.label
      const description = stripHtml(node.description)

      out.push({
        id: `public-${board.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${url}`,
        title: stripHtml(node.title),
        company,
        location: board.assumeUs && location === 'See listing' ? 'United States' : location,
        url,
        source: 'companies',
        remote: board.remoteByDefault === true
          || node.jobLocationType === 'TELECOMMUTE'
          || /remote|anywhere|worldwide/i.test(`${node.title} ${location} ${description}`),
        tags: boardTags(board),
        postedAt: validDate(node.datePosted),
        employmentType: Array.isArray(node.employmentType) ? node.employmentType[0] : node.employmentType,
        description: description.slice(0, 4000) || undefined,
        ...sponsorshipFields(board),
      })
    }
  }

  return out
}

function looksLikeJobUrl(url: URL): boolean {
  const path = url.pathname.toLowerCase().replace(/\/+$/, '')
  if (!path || path === '/') return false

  if (/\/(?:login|signin|signup|register|pricing|employers?|companies|categories|search)(?:\/|$)/.test(path)) {
    return false
  }

  // A detail route normally contains a segment after the job-like noun.
  return /\/(?:jobs?|job|vacanc(?:y|ies)|positions?|openings?|opportunities)\/[a-z0-9][^/]{2,}/i.test(path)
    || /\/job[-_][a-z0-9][a-z0-9_-]{4,}/i.test(path)
}

function parseAnchors(html: string, board: PublicBoard): Job[] {
  // If a board is multinational and we cannot infer location from the anchor,
  // avoid fabricating a US location. JSON-LD results above can still be used.
  if (board.usOnly && !board.assumeUs) return []

  const byUrl = new Map<string, string>()
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null

  while ((match = re.exec(html))) {
    const href = absoluteUrl(match[1]!, board.url)
    if (!href) continue

    let parsed: URL
    try {
      parsed = new URL(href)
    } catch {
      continue
    }
    if (!looksLikeJobUrl(parsed)) continue

    const title = stripHtml(match[2])
    if (title.length < 3 || title.length > 180) continue
    if (/^(apply|view|details?|read more|learn more|save|next|previous)$/i.test(title)) continue

    const existing = byUrl.get(href)
    if (!existing || title.length < existing.length) byUrl.set(href, title)
    if (byUrl.size >= MAX_PER_BOARD) break
  }

  const now = new Date().toISOString()
  return [...byUrl.entries()].map(([url, title]) => ({
    id: `public-${board.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${url}`,
    title,
    company: board.label,
    location: board.assumeUs ? 'United States' : board.remoteByDefault ? 'Remote' : 'See listing',
    url,
    source: 'companies',
    remote: board.remoteByDefault === true || /remote|anywhere|worldwide/i.test(title),
    tags: boardTags(board),
    postedAt: now,
    ...sponsorshipFields(board),
  }))
}

async function fetchBoard(board: PublicBoard): Promise<Job[]> {
  const response = await fetch(board.url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (!response.ok) throw new Error(`${board.label} -> ${response.status}`)
  const html = await response.text()

  const byUrl = new Map<string, Job>()
  const parsed = board.parse ? board.parse(html, board) : [...parseJsonLd(html, board), ...parseAnchors(html, board)]
  for (const job of parsed) {
    byUrl.set(job.url, job)
    if (byUrl.size >= MAX_PER_BOARD) break
  }
  return [...byUrl.values()]
}

export async function fetchExtraPublicJobs(q: string): Promise<Job[]> {
  if (process.env.PUBLIC_JOB_BOARDS_SOURCE === 'off') return []

  const results = await Promise.allSettled(PUBLIC_JOB_BOARDS.map(fetchBoard))
  const byUrl = new Map<string, Job>()

  results.forEach((result, index) => {
    const board = PUBLIC_JOB_BOARDS[index]!
    if (result.status === 'rejected') {
      console.warn('[jobs] public board failed:', board.label,
        result.reason instanceof Error ? result.reason.message : String(result.reason))
      return
    }
    for (const job of result.value) byUrl.set(job.url, job)
  })

  const jobs = [...byUrl.values()]
  if (!q) return jobs

  const needle = q.toLocaleLowerCase('en')
  return jobs.filter((job) =>
    `${job.title} ${job.company} ${job.location} ${job.description || ''}`
      .toLocaleLowerCase('en')
      .includes(needle),
  )
}
