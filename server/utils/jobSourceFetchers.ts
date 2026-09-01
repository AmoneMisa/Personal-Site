import type { Job, JobSource } from './jobTypes'
import { fetchExtraTelegramJobs } from './extraTelegramJobSources'
import { fetchLinkedInJobs } from './linkedinSource'
import { fetchFacebookJobs, fetchThreadsJobs } from './socialJobSources'
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
  companies: fetchCompanies,
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
