// GET /hiring-feed — read-only candidate CV/resume feed.
// Search uses the persisted snapshot and Elasticsearch only; crawling, targeted
// web search, normalization writes and backfill belong exclusively to jobs-worker.

import { getHiringSourceDiagnostics, HIRING_COUNTRIES } from '../utils/hiringSources'
import { DERIVED_VERSION, getStoredCvProfilesSnapshot } from '../utils/hiringSnapshot'
import { getStoredWebCvProfiles } from '../utils/hiringWebStore'
import { candidateSearchAvailable, searchCandidates } from '../utils/hiringElastic'
import { dedupeCandidates, detectMentionedProfessions, normalizeCandidate } from '../utils/hiringNormalize'
import { withProfessionExperience } from '../utils/hiringExperience'
import { listWebSources } from '../utils/hiringWebSources'
import { listUzJobsSources } from '../utils/hiringUzJobsSource'
import { getHiringWebDiagnostics } from '../utils/hiringDiagnostics'
import { loadDbSourceRuns } from '../utils/hiringDb'
import type { CvProfile } from '../utils/hiringTypes'
import {
  HIRING_PROFESSION_LABELS,
  hiringProfessionLabel,
  hiringProfessionLocale,
  type HiringProfessionLocale,
} from '../../shared/hiringProfessionLabels'
import { hiringEducationLabel } from '../../shared/hiringEducationLabels'
import {
  collapseHiringProfessionFilterValues,
  expandHiringProfessionFilters,
} from '../../shared/hiringProfessionGroups'

const PAGE_MAX = 60

const CITY_ALIASES: Record<string, string[]> = {
  tashkent: ['tashkent', 'toshkent', 'ташкент', 'тошкент'],
  samarkand: ['samarkand', 'samarqand', 'самарканд', 'самарқанд'],
  bukhara: ['bukhara', 'buxoro', 'бухара', 'бухоро'],
  namangan: ['namangan', 'наманган'],
  andijan: ['andijan', 'andijon', 'андижан', 'андижон'],
  fergana: ['fergana', "farg'ona", 'fargona', 'фаргана', 'фергана'],
  qarshi: ['qarshi', 'karshi', 'карши', 'қарши'],
  nukus: ['nukus', 'нукус'],
  urgench: ['urgench', 'urganch', 'ургенч', 'урганч'],
  khiva: ['khiva', 'xiva', 'хива'],
  kyiv: ['kyiv', 'kiev', 'киев', 'київ'],
  lviv: ['lviv', 'львов', 'львів'],
  odesa: ['odesa', 'odessa', 'одесса', 'одеса'],
  kharkiv: ['kharkiv', 'kharkov', 'харьков', 'харків'],
  dnipro: ['dnipro', 'днепр', 'дніпро'],
  vinnytsia: ['vinnytsia', 'vinnitsa', 'винница', 'вінниця'],
  zaporizhzhia: ['zaporizhzhia', 'zaporozhye', 'запорожье', 'запоріжжя'],
  almaty: ['almaty', 'алматы'],
  astana: ['astana', 'астана'],
  shymkent: ['shymkent', 'chimkent', 'шымкент', 'чимкент'],
  karaganda: ['karaganda', 'караганда'],
  atyrau: ['atyrau', 'атырау'],
  aktobe: ['aktobe', 'актобе'],
  bishkek: ['bishkek', 'бишкек'],
  osh: ['osh', 'ош'],
  karakol: ['karakol', 'каракол'],
  bucharest: ['bucharest', 'bucuresti', 'bucurești', 'бухарест'],
  'cluj-napoca': ['cluj-napoca', 'cluj napoca', 'cluj', 'клуж-напока', 'клуж'],
  iasi: ['iasi', 'iași', 'яссы'],
  timisoara: ['timisoara', 'timișoara', 'тимишоара'],
  brasov: ['brasov', 'brașov', 'брашов'],
}

function normalizeCity(value: string): string {
  return value.trim().toLocaleLowerCase('ru').replace(/ё/g, 'е')
}

function canonicalCity(value: string): string {
  const normalized = normalizeCity(value)
  for (const [canonical, aliases] of Object.entries(CITY_ALIASES)) {
    if (aliases.some((alias) => normalizeCity(alias) === normalized)) return canonical
  }
  return normalized
}

function cityMatches(profile: CvProfile, requested: string): boolean {
  const canonical = canonicalCity(requested)
  if (profile.city && canonicalCity(profile.city) === canonical) return true
  const hay = `${profile.city || ''} ${profile.district || ''} ${profile.description || ''}`.toLocaleLowerCase('ru')
  const aliases = CITY_ALIASES[canonical] || [requested]
  return aliases.some((alias) => hay.includes(normalizeCity(alias)))
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

function profileOrigin(profile: CvProfile): string {
  return (profile.origin || 'telegram').toLowerCase()
}

const WEB_SOURCE_LABELS = new Map(listWebSources().map((source) => [source.key, source.label]))

function profileProvider(profile: CvProfile): string {
  if (profile.sourceLabel?.trim()) return profile.sourceLabel.trim()
  const key = profile.sourceKey?.toLowerCase()
  if (key && WEB_SOURCE_LABELS.has(key)) return WEB_SOURCE_LABELS.get(key)!
  const origin = profileOrigin(profile)
  if (origin === 'facebook') return 'Facebook'
  if (origin === 'threads') return 'Threads'
  if (origin === 'web') return key || 'Web'
  return 'Telegram'
}

function canonicalProfessions(profile: CvProfile): string[] {
  return [...new Set([
    ...(profile.professions || []),
    profile.role,
  ].map((value) => String(value || '').trim()).filter(Boolean))]
}

function profileSearchText(profile: CvProfile): string {
  const professionTerms = [
    ...canonicalProfessions(profile),
    ...(profile.previousProfessions || []),
  ].flatMap((profession) => [
    profession,
    hiringProfessionLabel(profession, 'ru'),
    hiringProfessionLabel(profession, 'en'),
  ])

  return [
    profile.name,
    ...professionTerms,
    ...(profile.professionExperience || []).flatMap((item) => [
      `${item.profession} ${item.years}`,
      `${hiringProfessionLabel(item.profession, 'ru')} ${item.years}`,
      `${hiringProfessionLabel(item.profession, 'en')} ${item.years}`,
    ]),
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

  const city = (params.get('city') || '').trim()
  if (city && !cityMatches(profile, city)) return false

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
  if (gender && (profile.gender || 'unknown') !== gender) return false

  const professions = list(params, 'professions')
  if (professions.length) {
    const owned = new Set(canonicalProfessions(profile))
    if (!expandHiringProfessionFilters(professions).some((profession) => owned.has(profession))) return false
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
  if (sources.length && !sources.includes(profileSource(profile)) && !sources.includes(profileOrigin(profile))) return false

  const profileId = params.get('profileId') || params.get('listingId')
  if (profileId && profile.id !== profileId) return false

  return true
}

const SNAPSHOT_TTL_MS = 60_000
let snapshotCache: CvProfile[] = []
let snapshotKey = ''
let snapshotAt = 0

function snapshotSignature(stored: CvProfile[]): string {
  const newest = stored.reduce((latest, profile) => {
    const activity = profile.activityAt || profile.updatedAt || profile.createdAt || ''
    return activity > latest ? activity : latest
  }, '')
  return `${stored.length}:${newest}:${stored[0]?.id || ''}:${stored[stored.length - 1]?.id || ''}`
}

function normalizedSnapshot(stored: CvProfile[]): CvProfile[] {
  const key = snapshotSignature(stored)
  if (key === snapshotKey && Date.now() - snapshotAt < SNAPSHOT_TTL_MS) return snapshotCache
  snapshotCache = dedupeCandidates(stored.map((profile) => (
    profile.derived === DERIVED_VERSION ? profile : withProfessionExperience(normalizeCandidate(profile))
  )))
  snapshotKey = key
  snapshotAt = Date.now()
  return snapshotCache
}

function sourceCounts(profiles: CvProfile[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const profile of profiles) {
    const key = profileSource(profile)
    counts[key] = (counts[key] || 0) + 1
  }
  return counts
}

function professionValues(): string[] {
  return collapseHiringProfessionFilterValues(Object.keys(HIRING_PROFESSION_LABELS))
    .sort((a, b) => a.localeCompare(b, 'en'))
}

function requestLocale(event: Parameters<typeof getCookie>[0]): HiringProfessionLocale {
  const cookieLocale = getCookie(event, 'i18n_lang')
  if (cookieLocale) return hiringProfessionLocale(cookieLocale)

  const referer = getRequestHeader(event, 'referer') || ''
  if (referer) {
    try {
      if (/^\/en(?:\/|$)/.test(new URL(referer).pathname)) return 'en'
    } catch {
      // Ignore malformed/relative referer and use the site default below.
    }
  }
  return 'ru'
}

function formatYears(years: number, locale: HiringProfessionLocale): string {
  if (years > 0 && years < 1) {
    const months = Math.max(1, Math.round(years * 12))
    if (locale === 'en') return `${months} ${months === 1 ? 'month' : 'months'}`
    const mod10 = months % 10
    const mod100 = months % 100
    const unit = mod10 === 1 && mod100 !== 11 ? 'месяц'
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'месяца'
        : 'месяцев'
    return `${months} ${unit}`
  }
  if (locale === 'en') return `${years} ${years === 1 ? 'year' : 'years'}`
  const integer = Math.abs(Math.trunc(years))
  const mod10 = integer % 10
  const mod100 = integer % 100
  const unit = mod10 === 1 && mod100 !== 11 ? 'год'
    : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'года'
      : 'лет'
  return `${years} ${unit}`
}

function previousExperienceSummary(profile: CvProfile, locale: HiringProfessionLocale): string[] {
  const byProfession = new Map(
    (profile.professionExperience || []).map((item) => [item.profession, item.years]),
  )
  return (profile.previousProfessions || []).map((profession) => {
    const label = hiringProfessionLabel(profession, locale)
    const years = byProfession.get(profession)
    return years == null ? label : `${label} — ${formatYears(years, locale)}`
  })
}

function publicProfile(profile: CvProfile, locale: HiringProfessionLocale): CvProfile {
  const localizeEmploymentType = (value: string): string => value === 'full_time'
    ? locale === 'en' ? 'Full-time' : 'Полная занятость'
    : value === 'part_time' ? locale === 'en' ? 'Part-time' : 'Частичная занятость' : value
  const localizeDetail = (value: string): string => {
    if (locale === 'en') return value
    if (value === 'No experience') return 'Без опыта'
    if (value === 'Student') return 'Студент'
    if (value === 'Minor') return 'Несовершеннолетний'
    if (value === 'Open to relocation') return 'Готов к переезду'
    if (value === 'Not open to relocation') return 'Не готов к переезду'
    if (value === 'Contact via source platform') return 'Контакт через платформу-источник'
    if (value === 'Web CV') return 'Веб-резюме'
    return value.replace(/^Age:\s*/u, 'Возраст: ').replace(/^District:\s*/u, 'Район: ')
  }
  const details = [...(profile.tags || [])].map(localizeDetail)
  for (const feature of profile.features || []) details.push(localizeDetail(feature))
  const previous = previousExperienceSummary(profile, locale)
  if (previous.length) details.push(`${locale === 'en' ? 'Previous experience' : 'Предыдущий опыт'}: ${previous.join(', ')}`)
  if (profile.district) details.push(localizeDetail(`District: ${profile.district}`))
  if (profile.age != null) details.push(localizeDetail(`Age: ${profile.age}`))
  if (profile.isAdult === false) details.push(localizeDetail('Minor'))
  if (profile.relocationReady === true) details.push(localizeDetail('Open to relocation'))
  if (profile.relocationReady === false) details.push(localizeDetail('Not open to relocation'))
  if (profile.contactType === 'platform' && profileOrigin(profile) !== 'telegram') details.push(localizeDetail('Contact via source platform'))

  const canonical = profile.professions?.length ? profile.professions : [profile.role].filter(Boolean)
  return {
    ...profile,
    role: canonical.map((profession) => hiringProfessionLabel(profession, locale)).join(', '),
    previousProfessions: (profile.previousProfessions || []).map((profession) => hiringProfessionLabel(profession, locale)),
    professionExperience: (profile.professionExperience || []).map((item) => ({
      ...item,
      profession: hiringProfessionLabel(item.profession, locale),
    })),
    employmentType: profile.employmentTypes?.length
      ? profile.employmentTypes.map(localizeEmploymentType).join(', ')
      : profile.employmentType ? localizeEmploymentType(profile.employmentType) : profile.employmentType,
    education: hiringEducationLabel(profile.education, locale),
    tags: [...new Set(details)].slice(0, 20),
    origin: profileOrigin(profile) as CvProfile['origin'],
    sourceKey: profileSource(profile),
    sourceLabel: profileProvider(profile),
  }
}

export default defineEventHandler(async (event) => {
  const incoming = getRequestURL(event)
  const params = incoming.searchParams
  const locale = requestLocale(event)
  const offset = Math.max(0, Number(params.get('offset')) || 0)
  const limit = Math.min(PAGE_MAX, Math.max(1, Number(params.get('limit')) || 20))

  const [telegramStored, webStored, persistedSourceRuns] = await Promise.all([
    getStoredCvProfilesSnapshot(),
    getStoredWebCvProfiles(),
    loadDbSourceRuns(),
  ])

  const storedByUrl = new Map<string, CvProfile>()
  for (const profile of [...telegramStored, ...webStored]) {
    storedByUrl.set(profile.url || profile.id, profile)
  }
  const profiles = normalizedSnapshot([...storedByUrl.values()])
  const byId = new Map(profiles.map((profile) => [profile.id, profile]))

  const query = (params.get('query') || '').trim()
  const needsMemoryFilters = Boolean(
    list(params, 'professions').length
    || params.get('ageMin')
    || params.get('ageMax')
    || params.get('gender'),
  )
  const professionQuery = query ? detectMentionedProfessions(query).length > 0 : false
  const hasWebProfiles = webStored.length > 0
  let page: CvProfile[] = []
  let count = 0
  let engine: 'elasticsearch' | 'memory' = 'memory'

  if (query && !hasWebProfiles && !needsMemoryFilters && !professionQuery && (await candidateSearchAvailable())) {
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
  const webStatusesByHandle = new Map(
    persistedSourceRuns
      .filter((item) => /^(?:web|social):/i.test(item.handle))
      .map((item) => [item.handle.toLowerCase(), item]),
  )
  for (const item of getHiringWebDiagnostics()) webStatusesByHandle.set(item.handle.toLowerCase(), item)
  const webSourceStatuses = [...webStatusesByHandle.values()]
    .sort((a, b) => a.handle.localeCompare(b.handle))
  const sourceErrors = [
    ...sourceStatuses
      .filter((item) => item.status === 'error')
      .map((item) => ({ source: 'telegram', country: item.country, handle: item.handle, error: item.error || 'source failed' })),
    ...webSourceStatuses
      .filter((item) => item.status === 'error')
      .map((item) => ({
        source: 'key' in item ? item.key : item.handle.replace(/^(?:web|social):/i, ''),
        country: item.country,
        handle: item.handle,
        error: item.error || 'source failed',
      })),
  ]

  setResponseHeader(event, 'Cache-Control', 'no-store')
  return {
    count,
    profiles: page.map((profile) => publicProfile(profile, locale)),
    sourceCounts: sourceCounts(profiles),
    sourceStatuses,
    webSourceStatuses,
    sourceErrors,
    lastCrawlAt: [...persistedSourceRuns.map((run) => run.lastSuccessAt || ''), ...sourceStatuses.map((item) => item.checkedAt)]
      .filter(Boolean)
      .sort()
      .pop() || null,
    funnel: { parsed: 0, duplicate: 0, expired: 0, visibilityRejected: 0, shown: profiles.length },
    warming: false,
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
      professions: professionValues(),
      sources: [
        ...(profiles.some((profile) => profileOrigin(profile) === 'telegram')
          ? [{ value: 'telegram', label: 'Telegram', origin: 'telegram' }]
          : []),
        ...(profiles.some((profile) => profileOrigin(profile) === 'web')
          ? [{ value: 'web', label: 'Web', origin: 'web' }]
          : []),
        ...(profiles.some((profile) => profileOrigin(profile) === 'facebook')
          ? [{ value: 'facebook', label: 'Facebook', origin: 'facebook' }]
          : []),
        ...(profiles.some((profile) => profileOrigin(profile) === 'threads')
          ? [{ value: 'threads', label: 'Threads', origin: 'threads' }]
          : []),
        ...[...listWebSources(), ...listUzJobsSources()]
          .filter((source) => (sourceCounts(profiles)[source.key] || 0) > 0)
          .map((source) => ({ value: source.key, label: source.label, origin: 'web' as const })),
      ],
    },
  }
})
