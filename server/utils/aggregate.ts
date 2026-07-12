// Pure filtering + de-dup + sorting + pagination + statistics. Fetching/caching
// lives in the route handler (server/api/jobs.get.ts), mirroring the site's
// headerMenu pattern. Jobs are enriched (enrich.ts) before filtering so the new
// structured filters and stats can operate on derived fields.

import { enrichJob } from './enrich'
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

// User preference: favor CIS but exclude Russia & Belarus. A vacancy is dropped
// when its location clearly names one of these (country names, common variants,
// and capital cities). Remote/worldwide postings are unaffected.
const EXCLUDED_LOCATION = new RegExp(
  [
    'russia', 'russian federation', '\\bru\\b',
    'росси', 'рф\\b', 'москв', 'moscow', 'петербург', 'saint petersburg', 'st\\.? petersburg',
    'belarus', 'belarusian', 'белар', 'білор', 'беларусь', 'минск', 'мінськ', 'minsk',
  ].join('|'),
  'i',
)

function isExcludedLocation(job: Job): boolean {
  if (job.remote) return false
  const loc = job.location || ''
  if (/worldwide|anywhere|remote|global/i.test(loc)) return false
  return EXCLUDED_LOCATION.test(loc)
}

function matches(job: Job, query: JobQuery, oldestAllowed: number): boolean {
  // Hard rule: never return vacancies older than maxAgeDays.
  const posted = new Date(job.postedAt).getTime()
  if (Number.isNaN(posted) || posted < oldestAllowed) return false

  // Hard rule: exclude Russia & Belarus locations.
  if (isExcludedLocation(job)) return false

  if (query.remote !== undefined && job.remote !== query.remote) return false
  if (query.location && !job.location.toLowerCase().includes(query.location.toLowerCase())) {
    return false
  }
  if (query.salaryMin !== undefined) {
    const pay = job.salaryUsd ?? job.salaryMax ?? job.salaryMin
    if (pay === undefined || pay < query.salaryMin) return false
  }
  if (query.q) {
    const hay = `${job.title} ${job.company} ${job.tags.join(' ')}`.toLowerCase()
    if (!hay.includes(query.q.toLowerCase())) return false
  }

  // ---- advanced (enriched) filters ----
  if (query.country && job.country !== query.country) return false
  if (query.workMode && job.workMode !== query.workMode) return false
  if (query.relocation && job.relocation !== query.relocation) return false
  if (query.foreignerFriendly !== undefined && job.foreignerFriendly !== query.foreignerFriendly) {
    return false
  }
  if (query.language) {
    const langs = job.languages || []
    const want = query.language.toLowerCase()
    const hit = langs.find((l) => l.language.toLowerCase() === want)
    if (!hit) return false
    if (query.languageLevel && (hit.level || '').toLowerCase() !== query.languageLevel.toLowerCase()) {
      return false
    }
  }
  if (query.skills.length) {
    const have = new Set([...(job.skills || []), ...(job.niceToHave || [])].map((s) => s.toLowerCase()))
    for (const s of query.skills) if (!have.has(s.toLowerCase())) return false
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
    const job = enrichJob(raw)
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
