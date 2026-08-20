// GET /hiring-feed — candidate CV/resume profiles (not employer vacancies).
// Search runs through Elasticsearch when available and falls back to memory.

import { getHiringSourceDiagnostics, HIRING_COUNTRIES } from '../utils/hiringSources'
import { getStoredCvProfiles, isHiringStoreCold, refreshHiringStore } from '../utils/hiringStore'
import { candidateSearchAvailable, searchCandidates } from '../utils/hiringElastic'
import { dedupeCandidates, normalizeCandidate } from '../utils/hiringNormalize'
import type { CvProfile } from '../utils/hiringTypes'

const PAGE_MAX = 60

function normalizeCity(value: string): string {
  return value.trim().toLocaleLowerCase('ru')
}

function list(params: URLSearchParams, key: string): string[] {
  return (params.get(key) || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function profileSearchText(profile: CvProfile): string {
  return [
    profile.name,
    profile.role,
    ...(profile.professions || []),
    ...(profile.previousProfessions || []),
    ...(profile.features || []),
    ...(profile.skills || []),
    profile.city || '',
    profile.district || '',
    profile.description || '',
  ].join(' ').toLocaleLowerCase('ru')
}

function matchesFilters(profile: CvProfile, params: URLSearchParams): boolean {
  const countries = list(params, 'countries').map((code) => code.toUpperCase())
  if (countries.length && !countries.includes((profile.country || '').toUpperCase())) return false

  const city = normalizeCity(params.get('city') || '')
  if (city) {
    const hay = `${profile.city || ''} ${profile.district || ''} ${profile.description || ''}`.toLocaleLowerCase('ru')
    if (!hay.includes(city)) return false
  }

  const remote = params.get('remote')
  if (remote === '1' && !profile.remote) return false
  if (remote === '0' && profile.remote) return false

  const expMin = Number(params.get('experienceMin'))
  if (Number.isFinite(expMin) && expMin > 0) {
    if (profile.experienceYears == null || profile.experienceYears < expMin) return false
  }

  const seniority = (params.get('seniority') || '').trim().toLowerCase()
  if (seniority && (profile.seniority || '') !== seniority) return false

  const skills = list(params, 'skills').map((skill) => skill.toLowerCase())
  if (skills.length) {
    const owned = new Set((profile.skills || []).map((skill) => skill.toLowerCase()))
    if (!skills.every((skill) => owned.has(skill))) return false
  }

  const languages = list(params, 'languages').map((language) => language.toLowerCase())
  if (languages.length) {
    const owned = new Set((profile.languages || []).map((language) => language.toLowerCase()))
    if (!languages.some((language) => owned.has(language))) return false
  }

  const query = (params.get('query') || '').trim().toLocaleLowerCase('ru')
  if (query) {
    const hay = profileSearchText(profile)
    if (!query.split(/\s+/).every((word) => hay.includes(word))) return false
  }

  const sources = list(params, 'sources').map((source) => source.toLowerCase())
  if (sources.length && !sources.includes(profile.source)) return false

  const profileId = params.get('profileId') || params.get('listingId')
  if (profileId && profile.id !== profileId) return false

  return true
}

function sourceCounts(profiles: CvProfile[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const profile of profiles) counts[profile.source] = (counts[profile.source] || 0) + 1
  return counts
}

export default defineEventHandler(async (event) => {
  const incoming = getRequestURL(event)
  const params = incoming.searchParams
  const offset = Math.max(0, Number(params.get('offset')) || 0)
  const limit = Math.min(PAGE_MAX, Math.max(1, Number(params.get('limit')) || 20))

  let warming = false
  const stored = await getStoredCvProfiles()
  if (!stored.length && isHiringStoreCold()) {
    warming = true
    refreshHiringStore().catch((error) => {
      console.error('[hiring-feed] background refresh failed:', (error as Error).message)
    })
  }

  const profiles = dedupeCandidates(stored.map(normalizeCandidate))
  const byId = new Map(profiles.map((profile) => [profile.id, profile]))

  const query = (params.get('query') || '').trim()
  let page: CvProfile[] = []
  let count = 0
  let engine: 'elasticsearch' | 'memory' = 'memory'

  if (query && (await candidateSearchAvailable())) {
    const result = await searchCandidates({
      query,
      countries: list(params, 'countries').map((code) => code.toUpperCase()),
      city: params.get('city') || undefined,
      skills: list(params, 'skills'),
      languages: list(params, 'languages'),
      seniority: (params.get('seniority') || '').trim().toLowerCase() || undefined,
      remote: params.get('remote') === '1' ? true : params.get('remote') === '0' ? false : undefined,
      experienceMin: Number(params.get('experienceMin')) || undefined,
      sources: list(params, 'sources'),
      from: offset,
      size: limit,
    })
    if (result) {
      engine = 'elasticsearch'
      count = result.total
      page = result.hits
        .map(({ id, score }) => {
          const profile = byId.get(id)
          return profile ? { ...profile, score } : null
        })
        .filter((profile): profile is CvProfile => profile != null)
    }
  }

  if (engine === 'memory') {
    const filtered = profiles.filter((profile) => matchesFilters(profile, params))
    filtered.sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''))
    count = filtered.length
    page = filtered.slice(offset, offset + limit)
  }

  const sourceStatuses = getHiringSourceDiagnostics()
  const sourceErrors = sourceStatuses
    .filter((item) => item.status === 'error')
    .map((item) => ({ source: 'telegram', country: item.country, handle: item.handle, error: item.error || 'source failed' }))

  setResponseHeader(event, 'Cache-Control', 'no-store')
  return {
    count,
    profiles: page,
    sourceCounts: sourceCounts(profiles),
    sourceStatuses,
    sourceErrors,
    warming,
    engine,
    filters: {
      countries: params.get('countries') || '',
      city: params.get('city') || '',
      query: params.get('query') || '',
      remote: params.get('remote') || '',
      experienceMin: params.get('experienceMin') || '',
      seniority: params.get('seniority') || '',
      skills: params.get('skills') || '',
      languages: params.get('languages') || '',
      sources: params.get('sources') || '',
      offset,
      limit,
    },
    meta: { countries: HIRING_COUNTRIES },
  }
})
