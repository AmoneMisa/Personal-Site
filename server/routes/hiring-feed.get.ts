// GET /hiring-feed — candidate CV/resume profiles (not employer vacancies).
// Search runs through Elasticsearch when available and falls back to memory.

import { getHiringSourceDiagnostics, HIRING_COUNTRIES } from '../utils/hiringSources'
import { getStoredCvProfiles, isHiringStoreCold, refreshHiringStore } from '../utils/hiringStore'
import { getStoredWebCvProfiles } from '../utils/hiringWebStore'
import { candidateSearchAvailable, searchCandidates } from '../utils/hiringElastic'
import { dedupeCandidates, normalizeCandidate } from '../utils/hiringNormalize'
import type { CandidateGender, CvProfile } from '../utils/hiringTypes'

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

function profileSource(profile: CvProfile): string {
  return (profile.sourceKey || profile.source || 'unknown').toLowerCase()
}

function explicitGender(profile: CvProfile): CandidateGender {
  if (profile.gender === 'male' || profile.gender === 'female') return profile.gender

  const text = `${profile.originalText || ''}\n${profile.description || ''}`
  const labelled = text.match(/(?:пол|gender|sex|jins(?:i)?|жинс)\s*[:：—-]?\s*(муж(?:ской)?|жен(?:ский)?|male|female|erkak|ayol)\b/iu)?.[1]?.toLowerCase()
  if (labelled) {
    if (/^(?:муж|male|erkak)/iu.test(labelled)) return 'male'
    if (/^(?:жен|female|ayol)/iu.test(labelled)) return 'female'
  }

  if (/(?:ищу\s+работу|шукаю\s+роботу|ish\s+(?:kerak|qidir)|looking\s+for\s+(?:a\s+)?job)[^\n]{0,80}\b(?:мужчина|парень|erkak|yigit)\b/iu.test(text)
    || /\b(?:мужчина|парень|erkak|yigit)\b[^\n]{0,80}(?:ищет\s+работу|ищу\s+работу|ish\s+(?:kerak|qidir))/iu.test(text)) return 'male'

  if (/(?:ищу\s+работу|шукаю\s+роботу|ish\s+(?:kerak|qidir)|looking\s+for\s+(?:a\s+)?job)[^\n]{0,80}\b(?:женщина|девушка|ayol|qiz)\b/iu.test(text)
    || /\b(?:женщина|девушка|ayol|qiz)\b[^\n]{0,80}(?:ищет\s+работу|ищу\s+работу|ish\s+(?:kerak|qidir))/iu.test(text)) return 'female'

  return 'unknown'
}

function desiredProfessions(profile: CvProfile): string[] {
  const values = profile.professions?.length ? profile.professions : [profile.role]
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
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

  const ageMin = Number(params.get('ageMin'))
  if (Number.isFinite(ageMin) && ageMin > 0) {
    if (profile.age == null || profile.age < ageMin) return false
  }

  const ageMax = Number(params.get('ageMax'))
  if (Number.isFinite(ageMax) && ageMax > 0) {
    if (profile.age == null || profile.age > ageMax) return false
  }

  const gender = (params.get('gender') || '').trim().toLowerCase()
  if (gender && ['male', 'female', 'unknown'].includes(gender) && explicitGender(profile) !== gender) return false

  const professions = list(params, 'professions').map((value) => value.toLocaleLowerCase('ru'))
  if (professions.length) {
    const desired = desiredProfessions(profile).map((value) => value.toLocaleLowerCase('ru'))
    if (!professions.some((profession) => desired.some((value) => value === profession))) return false
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
  if (sources.length && !sources.includes(profileSource(profile)) && !sources.includes(profile.source)) return false

  const profileId = params.get('profileId') || params.get('listingId')
  if (profileId && profile.id !== profileId) return false

  return true
}

function sourceCounts(profiles: CvProfile[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const profile of profiles) {
    const key = profileSource(profile)
    counts[key] = (counts[key] || 0) + 1
  }
  return counts
}

function professionOptions(profiles: CvProfile[]): string[] {
  const values = new Set<string>()
  for (const profile of profiles) {
    for (const profession of desiredProfessions(profile)) values.add(profession)
  }
  return [...values].sort((a, b) => a.localeCompare(b, 'ru'))
}

function publicProfile(profile: CvProfile): CvProfile {
  const details = [...(profile.tags || [])]
  for (const feature of profile.features || []) details.push(feature)
  if (profile.previousProfessions?.length) details.push(`Previous: ${profile.previousProfessions.join(', ')}`)
  if (profile.district) details.push(`District: ${profile.district}`)
  if (profile.age != null) details.push(`Age: ${profile.age}`)
  if (profile.isAdult === false) details.push('Minor')
  if (profile.relocationReady === true) details.push('Open to relocation')
  if (profile.relocationReady === false) details.push('Not open to relocation')
  if (profile.origin === 'web' && profile.contactType === 'platform') details.push('Contact via source platform')

  const { photo: _photo, photos: _photos, ...withoutPhotos } = profile
  return {
    ...withoutPhotos,
    gender: explicitGender(profile),
    role: profile.professions?.length ? profile.professions.join(', ') : profile.role,
    employmentType: profile.employmentTypes?.length ? profile.employmentTypes.join(', ') : profile.employmentType,
    tags: [...new Set(details)].slice(0, 20),
  }
}

export default defineEventHandler(async (event) => {
  const incoming = getRequestURL(event)
  const params = incoming.searchParams
  const offset = Math.max(0, Number(params.get('offset')) || 0)
  const limit = Math.min(PAGE_MAX, Math.max(1, Number(params.get('limit')) || 20))

  let warming = false
  const [telegramStored, webStored] = await Promise.all([
    getStoredCvProfiles(),
    getStoredWebCvProfiles(),
  ])
  const storedByUrl = new Map<string, CvProfile>()
  for (const profile of [...telegramStored, ...webStored]) storedByUrl.set(profile.url || profile.id, profile)
  const stored = [...storedByUrl.values()]

  if (!stored.length && isHiringStoreCold()) {
    warming = true
    refreshHiringStore().catch((error) => {
      console.error('[hiring-feed] background refresh failed:', (error as Error).message)
    })
  }

  const profiles = dedupeCandidates(stored.map(normalizeCandidate))
  const byId = new Map(profiles.map((profile) => [profile.id, profile]))

  const query = (params.get('query') || '').trim()
  const hasMemoryOnlyFilters = Boolean(
    params.get('ageMin')
    || params.get('ageMax')
    || params.get('gender')
    || params.get('professions'),
  )
  let page: CvProfile[] = []
  let count = 0
  let engine: 'elasticsearch' | 'memory' = 'memory'

  // Age/gender/profession filters are evaluated against the normalized stored
  // profile so they also work for legacy records without an ES remap.
  if (query && !webStored.length && !hasMemoryOnlyFilters && (await candidateSearchAvailable())) {
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
    filtered.sort((a, b) => Date.parse(b.activityAt || b.updatedAt || b.createdAt || '') - Date.parse(a.activityAt || a.updatedAt || a.createdAt || ''))
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
    profiles: page.map(publicProfile),
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
      ageMin: params.get('ageMin') || '',
      ageMax: params.get('ageMax') || '',
      gender: params.get('gender') || '',
      professions: params.get('professions') || '',
      seniority: params.get('seniority') || '',
      skills: params.get('skills') || '',
      languages: params.get('languages') || '',
      sources: params.get('sources') || '',
      offset,
      limit,
    },
    meta: {
      countries: HIRING_COUNTRIES,
      professions: professionOptions(profiles),
    },
  }
})
