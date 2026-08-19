// GET /hiring-feed — candidate CV/resume profiles (not employer vacancies).
// Same-origin Nitro route; UI follows /flat-finder layout patterns.

import { HIRING_COUNTRIES } from '../utils/hiringSources'
import { getStoredCvProfiles, isHiringStoreCold, refreshHiringStore } from '../utils/hiringStore'
import type { CvProfile } from '../utils/hiringTypes'

const PAGE_MAX = 60

function normalizeCity(value: string): string {
  return value.trim().toLocaleLowerCase('ru')
}

function matchesFilters(profile: CvProfile, params: URLSearchParams): boolean {
  const countries = (params.get('countries') || '')
    .split(',')
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean)
  if (countries.length && !countries.includes((profile.country || '').toUpperCase())) return false

  const city = normalizeCity(params.get('city') || '')
  if (city) {
    const hay = `${profile.city || ''} ${profile.name} ${profile.role} ${profile.description}`.toLocaleLowerCase('ru')
    if (!hay.includes(city)) return false
  }

  const remote = params.get('remote')
  if (remote === '1' && !profile.remote) return false
  if (remote === '0' && profile.remote) return false

  const expMin = Number(params.get('experienceMin'))
  if (Number.isFinite(expMin) && expMin > 0) {
    if (profile.experienceYears == null || profile.experienceYears < expMin) return false
  }

  const query = (params.get('query') || '').trim().toLocaleLowerCase('ru')
  if (query) {
    const hay = `${profile.name} ${profile.role} ${profile.description} ${(profile.skills || []).join(' ')}`.toLocaleLowerCase('ru')
    if (!hay.includes(query)) return false
  }

  const sources = (params.get('sources') || '')
    .split(',')
    .map((source) => source.trim().toLowerCase())
    .filter(Boolean)
  if (sources.length && !sources.includes(profile.source)) return false

  const profileId = params.get('profileId') || params.get('listingId')
  if (profileId && profile.id !== profileId) return false

  return true
}

function sourceCounts(profiles: CvProfile[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const profile of profiles) {
    counts[profile.source] = (counts[profile.source] || 0) + 1
  }
  return counts
}

export default defineEventHandler(async (event) => {
  const incoming = getRequestURL(event)
  const params = incoming.searchParams
  const offset = Math.max(0, Number(params.get('offset')) || 0)
  const limit = Math.min(PAGE_MAX, Math.max(1, Number(params.get('limit')) || 20))

  let warming = false
  let profiles = await getStoredCvProfiles()
  if (!profiles.length && isHiringStoreCold()) {
    warming = true
    refreshHiringStore().catch((error) => {
      console.error('[hiring-feed] background refresh failed:', (error as Error).message)
    })
  }

  const filtered = profiles.filter((profile) => matchesFilters(profile, params))
  filtered.sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''))

  setResponseHeader(event, 'Cache-Control', 'no-store')
  return {
    count: filtered.length,
    profiles: filtered.slice(offset, offset + limit),
    sourceCounts: sourceCounts(profiles),
    warming,
    filters: {
      countries: params.get('countries') || '',
      city: params.get('city') || '',
      query: params.get('query') || '',
      remote: params.get('remote') || '',
      experienceMin: params.get('experienceMin') || '',
      sources: params.get('sources') || '',
      offset,
      limit,
    },
    meta: { countries: HIRING_COUNTRIES },
  }
})
