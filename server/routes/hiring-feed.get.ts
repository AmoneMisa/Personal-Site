// GET /hiring-feed — candidate CV/resume profiles (not employer vacancies).
// Same-origin Nitro route; UI follows /flat-finder layout patterns.
//
// Search runs through Elasticsearch when it is reachable (relevance ranking,
// fuzzy + multi-word + transliterated matching) and falls back to in-memory
// filtering otherwise, so the page keeps working with the cluster down. The
// store stays the source of truth for display: Elasticsearch only ranks ids.

import { HIRING_COUNTRIES } from '../utils/hiringSources'
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

function matchesFilters(profile: CvProfile, params: URLSearchParams): boolean {
  const countries = list(params, 'countries').map((code) => code.toUpperCase())
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

  const seniority = (params.get('seniority') || '').trim().toLowerCase()
  if (seniority && (profile.seniority || '') !== seniority) return false

  // Every requested skill must be present, matching the Job Finder's model.
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
    const hay = `${profile.name} ${profile.role} ${profile.description} ${(profile.skills || []).join(' ')}`.toLocaleLowerCase('ru')
    // Multi-word queries match when every word appears, so word order and
    // punctuation between them stop mattering in the fallback too.
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
  const stored = await getStoredCvProfiles()
  if (!stored.length && isHiringStoreCold()) {
    warming = true
    refreshHiringStore().catch((error) => {
      console.error('[hiring-feed] background refresh failed:', (error as Error).message)
    })
  }

  // Canonical skills/seniority/contacts, then collapse reposts of the same CV.
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
      // Hydrate from the store; an id missing there was removed since the last
      // sync, so it is simply skipped rather than rendered as a broken card.
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

  setResponseHeader(event, 'Cache-Control', 'no-store')
  return {
    count,
    profiles: page,
    sourceCounts: sourceCounts(profiles),
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
