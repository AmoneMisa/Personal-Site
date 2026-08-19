// Pure filtering + de-dup + sorting + pagination + statistics. Fetching/caching
// lives in the route handler (server/api/jobs.get.ts), mirroring the site's
// headerMenu pattern. Jobs are enriched (enrich.ts) before filtering so the new
// structured filters and stats can operate on derived fields.

import { enrichJob, resolveCountry } from './enrich'
import { canonicalSkillName } from '~~/shared/jobSkills'
import type {
  Job,
  JobQuery,
  JobResponse,
  JobSource,
  JobStats,
  SalaryStat,
  SortKey,
  WorkMode,
} from './jobTypes'

const ENRICHMENT_CACHE_MAX = 20_000
const enrichmentCache = new Map<string, { fingerprint: string; job: Job }>()

function cachedEnrichment(raw: Job): Job {
  if (raw.workMode !== undefined && raw.skillDetails !== undefined) return raw
  const key = raw.url || raw.id
  const fingerprint = `${raw.postedAt}|${raw.title}|${raw.description?.length || 0}`
  const cached = enrichmentCache.get(key)
  if (cached?.fingerprint === fingerprint) return cached.job
  const job = enrichJob(raw)
  enrichmentCache.set(key, { fingerprint, job })
  if (enrichmentCache.size > ENRICHMENT_CACHE_MAX) {
    const oldest = enrichmentCache.keys().next().value
    if (oldest) enrichmentCache.delete(oldest)
  }
  return job
}

// User preference: favor CIS but exclude Russia & Belarus by default. Each country
// has its own matcher so the two can be toggled back on independently via the
// includeRu / includeBy query flags. Remote/worldwide postings are unaffected.
const RUSSIA_LOCATION = new RegExp(
  [
    'russia', 'russian federation', '\\bru\\b',
    'росси', 'рф\\b', 'москв', 'moscow', 'петербург', 'saint petersburg', 'st\\.? petersburg',
  ].join('|'),
  'i',
)
const BELARUS_LOCATION = new RegExp(
  ['belarus', 'belarusian', 'белар', 'білор', 'беларусь', 'минск', 'мінськ', 'minsk'].join('|'),
  'i',
)

function isExcludedLocation(job: Job, includeRu: boolean, includeBy: boolean): boolean {
  if (job.remote) return false
  const loc = job.location || ''
  if (/worldwide|anywhere|remote|global/i.test(loc)) return false
  // Location is often a placeholder, so also scan the title where the city is
  // frequently named (keeps the RU/BY exclusion working for those postings).
  const hay = `${loc} ${job.title || ''}`
  if (job.country === 'RU' || RUSSIA_LOCATION.test(hay)) return !includeRu
  if (job.country === 'BY' || BELARUS_LOCATION.test(hay)) return !includeBy
  return false
}

function matches(job: Job, query: JobQuery, oldestAllowed: number): boolean {
  // Hard rule: never return vacancies older than maxAgeDays.
  const posted = new Date(job.postedAt).getTime()
  if (Number.isNaN(posted) || posted < oldestAllowed) return false

  // Exclude Russia & Belarus locations unless explicitly opted-in.
  if (isExcludedLocation(job, query.includeRu === true, query.includeBy === true)) return false

  if (query.remote !== undefined && job.remote !== query.remote) return false
  if (query.location) {
    const want = query.location.toLowerCase()
    // Match the raw location text, OR — when the query names a country/city in
    // EN/RU/UK (e.g. "Узбекистан", "Ташкент", "Uzbekistan") — the job's detected
    // country, so postings with a placeholder location still match.
    const wantCode = resolveCountry(query.location)
    const hitText = job.location.toLowerCase().includes(want)
    const hitCode = wantCode !== undefined && job.country === wantCode
    if (!hitText && !hitCode) return false
  }
  // City filter (any-of): a job passes if it matches ANY of the listed cities.
  // Terms may span countries (e.g. "Tashkent, Kharkiv, Miami"). Each term is
  // matched against the location text + title (the city is often only in the
  // title), or — when the term names a country/known city — the detected country.
  if (query.cities.length) {
    const hay = `${job.location} ${job.title}`.toLowerCase()
    const hit = query.cities.some((term) => {
      const needle = term.toLowerCase()
      if (needle && hay.includes(needle)) return true
      const code = resolveCountry(term)
      return code !== undefined && job.country === code
    })
    if (!hit) return false
  }
  if (query.salaryMin !== undefined) {
    const pay = job.salaryUsd ?? job.salaryMax ?? job.salaryMin
    if (pay === undefined || pay < query.salaryMin) return false
  }
  if (query.q) {
    const hay = [
      job.title,
      job.company,
      job.location,
      job.tags.join(' '),
      job.description || '',
      ...(job.skills || []),
      ...(job.niceToHave || []),
    ].join(' ').toLowerCase()
    if (!hay.includes(query.q.toLowerCase())) return false
  }

  // ---- advanced (enriched) filters ----
  // Country filters strictly by the job's location country. Remote-only postings
  // are surfaced via the separate Work mode = Remote filter, not by country.
  if (query.countries.length && !query.countries.includes(job.country || '')) return false
  if (query.workMode && job.workMode !== query.workMode) return false
  if (query.relocation && job.relocation !== query.relocation) return false
  if (query.employmentKind && job.employmentKind !== query.employmentKind) return false
  // "Has shown salary": keep only postings that carry an actual salary figure.
  if (query.hasSalary && job.salaryMin === undefined && job.salaryMax === undefined) return false
  // Experience ceiling: drop roles that require MORE than the given years. Postings
  // with no detected requirement are kept (unknown ≠ over the limit).
  if (
    query.maxExperienceYears !== undefined
    && job.experienceMinYears !== undefined
    && job.experienceMinYears > query.maxExperienceYears
  ) {
    return false
  }
  if (query.foreignerFriendly !== undefined && job.foreignerFriendly !== query.foreignerFriendly) {
    return false
  }
  // Hidden by default: gambling / adult / earnings-bait postings. Only a hard
  // riskCategory hides a vacancy — the softer `suspicious` flag is a badge only.
  if (query.hideRiskyIndustries !== false && job.riskCategory) return false
  if (query.noExperience && !job.noExperience) return false
  if (query.language) {
    const langs = job.languages || []
    const want = query.language.toLowerCase()
    const hit = langs.find((l) => l.language.toLowerCase() === want)
    if (!hit) return false
    if (query.languageLevel && (hit.level || '').toLowerCase() !== query.languageLevel.toLowerCase()) {
      return false
    }
  }
  if (query.excludeLanguages.length) {
    const have = new Set((job.languages || []).map((l) => l.language.toLowerCase()))
    for (const ex of query.excludeLanguages) if (have.has(ex.toLowerCase())) return false
  }
  if (query.skills.length) {
    const have = new Set(
      [...(job.skills || []), ...(job.niceToHave || [])]
        .map((skill) => canonicalSkillName(skill) || skill)
        .map((skill) => skill.toLocaleLowerCase('en')),
    )
    for (const requested of query.skills) {
      const canonical = canonicalSkillName(requested) || requested
      if (!have.has(canonical.toLocaleLowerCase('en'))) return false
    }
  }
  return true
}

const comparators: Record<SortKey, (a: Job, b: Job) => number> = {
  date: (a, b) => +new Date(b.postedAt) - +new Date(a.postedAt),
  oldest: (a, b) => +new Date(a.postedAt) - +new Date(b.postedAt),
  title: (a, b) => a.title.localeCompare(b.title),
  company: (a, b) => a.company.localeCompare(b.company),
  salary: (a, b) => (b.salaryUsd ?? 0) - (a.salaryUsd ?? 0),
}

function median(sorted: number[]): number {
  if (!sorted.length) return 0
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? (sorted[mid] ?? 0)
    : Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2)
}

function salaryStat(values: number[]): SalaryStat {
  if (!values.length) return { count: 0, medianUsd: 0, avgUsd: 0, minUsd: 0, maxUsd: 0 }
  const sorted = [...values].sort((a, b) => a - b)
  const sum = sorted.reduce((s, v) => s + v, 0)
  return {
    count: sorted.length,
    medianUsd: median(sorted),
    avgUsd: Math.round(sum / sorted.length),
    minUsd: sorted[0] ?? 0,
    maxUsd: sorted[sorted.length - 1] ?? 0,
  }
}

// Build the statistics block over the *filtered* set (what the user is looking at).
function computeStats(jobs: Job[]): JobStats {
  const allSalaries: number[] = []
  const bySourceSal: Partial<Record<JobSource, number[]>> = {}
  const byCountrySal: Record<string, number[]> = {}
  const byWorkMode: Record<WorkMode, number> = { remote: 0, hybrid: 0, office: 0, unknown: 0 }
  const byLanguage: Record<string, number> = {}
  const skillCount: Record<string, number> = {}
  let foreignerFriendly = 0

  for (const job of jobs) {
    const pay = job.salaryUsd
    if (pay) {
      allSalaries.push(pay)
      ;(bySourceSal[job.source] ||= []).push(pay)
      const c = job.country || 'OTHER'
      ;(byCountrySal[c] ||= []).push(pay)
    }
    byWorkMode[job.workMode || 'unknown']++
    if (job.foreignerFriendly) foreignerFriendly++
    for (const l of job.languages || []) {
      byLanguage[l.language] = (byLanguage[l.language] || 0) + 1
    }
    for (const s of [...(job.skills || []), ...(job.niceToHave || [])]) {
      skillCount[s] = (skillCount[s] || 0) + 1
    }
  }

  const bySource: JobStats['bySource'] = {}
  for (const [src, vals] of Object.entries(bySourceSal)) {
    const s = salaryStat(vals!)
    bySource[src as JobSource] = { count: s.count, medianUsd: s.medianUsd }
  }

  const byCountry: JobStats['byCountry'] = {}
  for (const [c, vals] of Object.entries(byCountrySal)) {
    const s = salaryStat(vals)
    byCountry[c] = { count: s.count, medianUsd: s.medianUsd }
  }

  const topSkills = Object.entries(skillCount)
    .map(([skill, count]) => ({ skill, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  return {
    salary: salaryStat(allSalaries),
    bySource,
    byCountry,
    byWorkMode,
    foreignerFriendly,
    byLanguage,
    topSkills,
  }
}

export function filterAndPaginate(all: Job[], query: JobQuery): JobResponse {
  const maxAge = Math.min(query.maxAgeDays || 14, 14) // enforce the 14-day ceiling
  const oldestAllowed = Date.now() - maxAge * 86_400_000

  const perSource: JobResponse['sources'] = {}
  const seen = new Set<string>()
  const filtered: Job[] = []

  for (const raw of all) {
    if (!query.sources.includes(raw.source)) continue
    const job = cachedEnrichment(raw)
    if (!matches(job, query, oldestAllowed)) continue
    const key = job.url || job.id
    if (seen.has(key)) continue
    seen.add(key)
    perSource[job.source] = (perSource[job.source] || 0) + 1
    filtered.push(job)
  }

  // Stats reflect the whole filtered result set, not just the current page.
  const stats = computeStats(filtered)

  filtered.sort(comparators[query.sort] || comparators.date)

  const total = filtered.length
  const start = (query.page - 1) * query.pageSize
  const jobs = filtered.slice(start, start + query.pageSize)

  return { jobs, total, page: query.page, pageSize: query.pageSize, sources: perSource, stats }
}
