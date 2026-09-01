import type { Job, JobSource } from './jobTypes'
import { fetchExtraTelegramJobs } from './extraTelegramJobSources'
import { fetchLinkedInJobs } from './linkedinSource'
import { fetchFacebookJobs, fetchThreadsJobs } from './socialJobSources'
import { fetchExtraPublicJobs } from './extraPublicJobSources'
import { fetchCuratedRemoteJobs } from './curatedRemoteJobSources'
import { fetchUsaTechCompanyJobs } from './usaTechCompanySources'
import { fetchRegionalTechCompanyJobs } from './regionalTechCompanySources'
import { fetchRegionalGeneralEmployerJobs } from './regionalGeneralEmployerSources'
import { fetchRegionalJobBoardJobs } from './regionalJobBoardSources'
import { fetchUsaVisaSponsorJobs } from './usaVisaSponsorSource'
import { fetchSourceExpansionJobs } from './sourceExpansionJobs'
import { fetchAviationExpansionJobs } from './aviationExpansionJobs'
import { fetchIntelliasJobs } from './intelliasJobs'
import { fetchJobsUaJobs } from './jobsUaSource'
import { fetchHhJobs } from './hhJobSource'
import { fetchUkraineBoardJobs } from './ukraineJobSources'
import {
  fetchAdzuna,
  fetchArbeitnow,
  fetchCompanies,
  fetchDevKg,
  fetchIshGo,
  fetchItJobsUz,
  fetchJobicy,
  fetchJooble,
  fetchOlx,
  fetchRemoteOk,
  fetchRemotive,
  fetchRss,
  fetchTheMuse,
  fetchTelegram,
} from './sources'

const SOURCE_TIMEOUT_MS = 30_000
const COMPANIES_SOURCE_TIMEOUT_MS = 150_000
const LINKEDIN_SOURCE_TIMEOUT_MS = Math.max(
  60_000,
  Math.min(170_000, Number(process.env.LINKEDIN_SOURCE_TIMEOUT_MS) || 150_000),
)
const SOCIAL_SOURCE_TIMEOUT_MS = Math.max(
  60_000,
  Math.min(170_000, Number(process.env.SOCIAL_JOB_SOURCE_TIMEOUT_MS) || 150_000),
)

async function fetchAllTelegram(query: string): Promise<Job[]> {
  const [primary, extra] = await Promise.all([
    fetchTelegram(query),
    fetchExtraTelegramJobs(query),
  ])
  return [...primary, ...extra]
}

async function fetchAllCompanies(query: string): Promise<Job[]> {
  const loaders = [
    { label: 'companies', load: () => fetchCompanies(query) },
    { label: 'public-boards', load: () => fetchExtraPublicJobs(query) },
    { label: 'curated-remote-boards', load: () => fetchCuratedRemoteJobs(query) },
    { label: 'usa-tech-companies', load: () => fetchUsaTechCompanyJobs(query) },
    { label: 'regional-tech-companies', load: () => fetchRegionalTechCompanyJobs(query) },
    { label: 'regional-general-employers', load: () => fetchRegionalGeneralEmployerJobs(query) },
    { label: 'regional-job-boards', load: () => fetchRegionalJobBoardJobs(query) },
    { label: 'usa-visa-sponsors', load: () => fetchUsaVisaSponsorJobs(query) },
    { label: 'source-expansion', load: () => fetchSourceExpansionJobs(query) },
    { label: 'aviation-expansion', load: () => fetchAviationExpansionJobs(query) },
    { label: 'intellias', load: () => fetchIntelliasJobs(query) },
    { label: 'jobs-ua', load: () => fetchJobsUaJobs(query) },
    { label: 'ua-boards', load: () => fetchUkraineBoardJobs(query) },
  ]

  const results = await Promise.allSettled(loaders.map(({ load }) => load()))
  const jobs: Job[] = []
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      jobs.push(...result.value)
      return
    }
    console.warn(
      `[jobs] ${loaders[index]!.label} sub-source failed:`,
      result.reason instanceof Error ? result.reason.message : String(result.reason),
    )
  })
  return jobs
}

const FETCHERS: Record<JobSource, (query: string) => Promise<Job[]>> = {
  remotive: fetchRemotive,
  remoteok: fetchRemoteOk,
  arbeitnow: fetchArbeitnow,
  themuse: fetchTheMuse,
  jobicy: fetchJobicy,
  hh: fetchHhJobs,
  adzuna: fetchAdzuna,
  jooble: fetchJooble,
  rss: fetchRss,
  companies: fetchAllCompanies,
  linkedin: fetchLinkedInJobs,
  facebook: fetchFacebookJobs,
  threads: fetchThreadsJobs,
  devkg: fetchDevKg,
  ishgo: fetchIshGo,
  itjobsuz: fetchItJobsUz,
  telegram: fetchAllTelegram,
  olx: fetchOlx,
}

function sourceTimeoutMs(source: JobSource): number {
  if (source === 'companies') return COMPANIES_SOURCE_TIMEOUT_MS
  if (source === 'linkedin') return LINKEDIN_SOURCE_TIMEOUT_MS
  if (source === 'facebook' || source === 'threads') return SOCIAL_SOURCE_TIMEOUT_MS
  return SOURCE_TIMEOUT_MS
}

export async function fetchJobSource(source: JobSource): Promise<Job[]> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeoutMs = sourceTimeoutMs(source)

  try {
    return await Promise.race([
      FETCHERS[source](''),
      new Promise<Job[]>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`timed out after ${timeoutMs / 1000}s`)),
          timeoutMs,
        )
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
