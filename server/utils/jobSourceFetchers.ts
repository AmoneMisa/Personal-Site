import type { Job, JobSource } from './jobTypes'
import { fetchExtraTelegramJobs } from './extraTelegramJobSources'
import { fetchLinkedInJobs } from './linkedinSource'
import { fetchFacebookJobs, fetchThreadsJobs } from './socialJobSources'
import { fetchSourceExpansionJobs } from './sourceExpansionJobs'
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
    { label: 'source-expansion', load: () => fetchSourceExpansionJobs(query) },
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

export async function fetchJobSource(source: JobSource): Promise<Job[]> {
  return FETCHERS[source]('')
}
