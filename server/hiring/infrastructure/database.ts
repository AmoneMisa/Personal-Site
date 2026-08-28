// Durable candidate storage in the shared Postgres, in its own `hiring` schema
// so the site's tables never collide with flat-finder's public ones.
//
// The filesystem-backed state store on SITE_STATE_DIR is the hot snapshot path.
// Postgres is the durable fallback across snapshot loss, cold container restarts
// and Telegram worker outages. Every operation is best-effort: database failures
// must not take the candidate board down with them.

import { Pool } from 'pg'
import { candidateFingerprint, normalizeCandidate } from '../../utils/hiringNormalize'
import { withProfessionExperience } from '../../utils/hiringExperience'
import type { CvProfile } from '../../../shared/contracts/hiring'
import { runOrigin, type SourceRun } from '../../../shared/hiring/hiringDiagnostics'
import type { HiringStatistics } from '../../../shared/contracts/hiring'
import { publicEntityId } from '../../../shared/publicEntityId'
import { canonicalCityValue } from '../../../shared/locationCatalog'
import { hiringStatisticGroupsForProfessions } from '../../../shared/hiringStatisticGroups'
import { expandHiringProfessionFilters } from '../../../shared/hiringProfessionGroups'
import { convertCurrency } from '../../utils/currency'
import {
  publicCandidateGender,
  publicCandidateProfessionKeys,
  publicCandidateRemote,
  publicCandidateSalary,
} from '../../utils/hiringCandidatePresentation'

const HYDRATE_LIMIT = 5_000
const UPSERT_BATCH = 500
const RETENTION_MONTHS = 3
const SCHEMA_RE = /^[a-z_][a-z0-9_]*$/i

let pool: Pool | undefined
let schemaReady: Promise<void> | undefined
let candidateBackfillComplete = false

function schema(): string {
  const raw = (process.env.HIRING_DB_SCHEMA || 'hiring').trim()
  return SCHEMA_RE.test(raw) ? raw : 'hiring'
}

export function hiringDbEnabled(): boolean {
  return Boolean((process.env.HIRING_DATABASE_URL || '').trim())
}

function db(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.HIRING_DATABASE_URL,
      max: Number(process.env.HIRING_DB_POOL_MAX) || 4,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })
    pool.on('error', (error) => console.error('[hiring:db] idle client error:', error.message))
  }
  return pool
}

function ensureSchema(): Promise<void> {
  if (schemaReady) return schemaReady
  const name = schema()
  schemaReady = (async () => {
    await db().query(`CREATE SCHEMA IF NOT EXISTS ${name};`)
    await db().query(`
      CREATE TABLE IF NOT EXISTS ${name}.candidates (
        id BIGSERIAL PRIMARY KEY,
        source VARCHAR(32) NOT NULL,
        country VARCHAR(8) NOT NULL,
        source_id TEXT NOT NULL,
        source_handle TEXT NOT NULL DEFAULT '',
        name TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL DEFAULT '',
        city TEXT,
        district TEXT,
        remote BOOLEAN,
        experience_years DOUBLE PRECISION,
        created_at TIMESTAMPTZ NOT NULL,
        url TEXT NOT NULL DEFAULT '',
        first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        active BOOLEAN NOT NULL DEFAULT TRUE,
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        CONSTRAINT candidates_source_country_id_unique UNIQUE (source, country, source_id)
      );
    `)
    await db().query(`
      CREATE TABLE IF NOT EXISTS ${name}.source_runs (
        source VARCHAR(32) NOT NULL,
        handle TEXT NOT NULL,
        country VARCHAR(8) NOT NULL DEFAULT '',
        status VARCHAR(16) NOT NULL,
        fetched INTEGER NOT NULL DEFAULT 0,
        candidates INTEGER NOT NULL DEFAULT 0,
        error TEXT,
        checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_success_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (source, handle)
      );
    `)
    await db().query(`ALTER TABLE ${name}.candidates ADD COLUMN IF NOT EXISTS public_id BIGINT`)
    await db().query(`ALTER TABLE ${name}.candidates ADD COLUMN IF NOT EXISTS origin TEXT`)
    await db().query(`ALTER TABLE ${name}.candidates ADD COLUMN IF NOT EXISTS source_key TEXT`)
    await db().query(`ALTER TABLE ${name}.candidates ADD COLUMN IF NOT EXISTS provider TEXT`)
    await db().query(`ALTER TABLE ${name}.candidates ADD COLUMN IF NOT EXISTS canonical_city TEXT`)
    await db().query(`ALTER TABLE ${name}.candidates ADD COLUMN IF NOT EXISTS activity_at TIMESTAMPTZ`)
    await db().query(`ALTER TABLE ${name}.candidates ADD COLUMN IF NOT EXISTS gender TEXT`)
    await db().query(`ALTER TABLE ${name}.candidates ADD COLUMN IF NOT EXISTS age SMALLINT`)
    await db().query(`ALTER TABLE ${name}.candidates ADD COLUMN IF NOT EXISTS salary_min_usd DOUBLE PRECISION`)
    await db().query(`ALTER TABLE ${name}.candidates ADD COLUMN IF NOT EXISTS salary_max_usd DOUBLE PRECISION`)
    await db().query(`ALTER TABLE ${name}.candidates ADD COLUMN IF NOT EXISTS seniority TEXT`)
    await db().query(`ALTER TABLE ${name}.candidates ADD COLUMN IF NOT EXISTS professions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`)
    await db().query(`ALTER TABLE ${name}.candidates ADD COLUMN IF NOT EXISTS sectors TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`)
    await db().query(`ALTER TABLE ${name}.candidates ADD COLUMN IF NOT EXISTS skills TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`)
    await db().query(`ALTER TABLE ${name}.candidates ADD COLUMN IF NOT EXISTS languages TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`)
    await db().query(`ALTER TABLE ${name}.candidates ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''`)
    await db().query(`ALTER TABLE ${name}.candidates ADD COLUMN IF NOT EXISTS search_text TEXT NOT NULL DEFAULT ''`)
    await db().query(`ALTER TABLE ${name}.candidates ADD COLUMN IF NOT EXISTS dedupe_key TEXT`)
    await db().query(`CREATE INDEX IF NOT EXISTS candidates_active_created_idx ON ${name}.candidates(active, created_at DESC);`)
    await db().query(`CREATE INDEX IF NOT EXISTS candidates_country_created_idx ON ${name}.candidates(country, created_at DESC);`)
    await db().query(`CREATE INDEX IF NOT EXISTS candidates_handle_idx ON ${name}.candidates(source_handle);`)
    await db().query(`CREATE INDEX IF NOT EXISTS candidates_data_gin_idx ON ${name}.candidates USING GIN(data jsonb_path_ops);`)
    await db().query(`CREATE INDEX IF NOT EXISTS candidates_public_id_idx ON ${name}.candidates(public_id) WHERE active = TRUE`)
    await db().query(`CREATE INDEX IF NOT EXISTS candidates_active_activity_idx ON ${name}.candidates(activity_at DESC, id DESC) WHERE active = TRUE`)
    await db().query(`CREATE INDEX IF NOT EXISTS candidates_city_lower_idx ON ${name}.candidates((LOWER(canonical_city)), activity_at DESC) WHERE active = TRUE`)
    await db().query(`CREATE INDEX IF NOT EXISTS candidates_professions_gin_idx ON ${name}.candidates USING GIN(professions)`)
    await db().query(`CREATE INDEX IF NOT EXISTS candidates_skills_gin_idx ON ${name}.candidates USING GIN(skills)`)
    await db().query(`CREATE INDEX IF NOT EXISTS candidates_languages_gin_idx ON ${name}.candidates USING GIN(languages)`)
    await db().query(`CREATE INDEX IF NOT EXISTS candidates_search_idx ON ${name}.candidates USING GIN(to_tsvector('simple', search_text))`)
    await db().query(`CREATE INDEX IF NOT EXISTS candidates_dedupe_idx ON ${name}.candidates(dedupe_key, created_at DESC, id DESC) WHERE active = TRUE`)
    console.log(`[hiring:db] schema ${name} ready`)
  })().catch((error) => {
    schemaReady = undefined
    throw error
  })
  return schemaReady
}

function isoDate(value: unknown): string | null {
  const date = new Date(String(value ?? ''))
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

function candidateRow(profile: CvProfile, handle: string) {
  const base = withProfessionExperience(normalizeCandidate(profile))
  const publicProfessions = publicCandidateProfessionKeys(base)
  const normalized: CvProfile = {
    ...base,
    ...publicCandidateSalary(base),
    gender: publicCandidateGender(base),
    remote: publicCandidateRemote(base),
    role: publicProfessions[0] || base.role,
    professions: publicProfessions.length ? publicProfessions : base.professions,
  }
  const sourceKey = String(normalized.sourceKey || normalized.source || 'unknown').toLowerCase()
  const origin = String(normalized.origin || 'telegram').toLowerCase()
  const professions = [...new Set([...(normalized.professions || []), normalized.role].map((value) => String(value || '').trim()).filter(Boolean))]
  const currency = String(normalized.currency || 'USD').trim().toUpperCase()
  return {
    source: String(normalized.source || 'telegram').toLowerCase(),
    country: String(normalized.country || '').toUpperCase(),
    source_id: String(normalized.id || ''),
    source_handle: handle.replace(/^@/, ''),
    name: String(normalized.name || ''),
    role: String(normalized.role || ''),
    city: normalized.city ?? null,
    district: normalized.district ?? null,
    remote: normalized.remote ?? null,
    experience_years: Number.isFinite(Number(normalized.experienceYears)) ? Number(normalized.experienceYears) : null,
    created_at: isoDate(normalized.createdAt),
    url: String(normalized.url || ''),
    public_id: normalized.publicId ?? publicEntityId('candidate', sourceKey, normalized.country, normalized.id),
    origin,
    source_key: sourceKey,
    provider: String(normalized.sourceLabel || (origin === 'telegram' ? 'Telegram' : sourceKey)),
    canonical_city: normalized.city ? canonicalCityValue(normalized.city) : String(normalized.country || '__unknown__'),
    activity_at: isoDate(normalized.activityAt || normalized.updatedAt || normalized.createdAt),
    gender: normalized.gender || 'unknown',
    age: normalized.age != null && Number.isFinite(Number(normalized.age)) ? Number(normalized.age) : null,
    salary_min_usd: convertCurrency(normalized.salaryMin, currency, 'USD') ?? null,
    salary_max_usd: convertCurrency(normalized.salaryMax, currency, 'USD') ?? null,
    seniority: normalized.seniority || null,
    professions,
    sectors: hiringStatisticGroupsForProfessions(professions),
    skills: [...new Set((normalized.skills || []).map((value) => value.toLocaleLowerCase('en')))],
    languages: [...new Set((normalized.languages || []).map((value) => value.toLocaleLowerCase('en')))],
    description: String(normalized.description || ''),
    search_text: [normalized.name, ...professions, ...(normalized.previousProfessions || []), ...(normalized.features || []), ...(normalized.skills || []), normalized.city, normalized.district, normalized.description].filter(Boolean).join(' '),
    dedupe_key: candidateFingerprint(normalized),
    data: normalized,
  }
}

const UPSERT_SQL = (name: string) => `
  INSERT INTO ${name}.candidates (
    source, country, source_id, source_handle, name, role, city, district,
    remote, experience_years, created_at, url, active, first_seen_at,
    last_seen_at, updated_at, data, public_id, origin, source_key, provider,
    canonical_city, activity_at, gender, age, salary_min_usd,
    salary_max_usd, seniority, professions, sectors, skills, languages,
    description, search_text, dedupe_key
  )
  SELECT
    input.source, input.country, input.source_id, input.source_handle,
    input.name, input.role, input.city, input.district, input.remote,
    input.experience_years, input.created_at, input.url, TRUE,
    NOW(), NOW(), NOW(), input.data, input.public_id, input.origin,
    input.source_key, input.provider, input.canonical_city,
    input.activity_at, input.gender, input.age, input.salary_min_usd,
    input.salary_max_usd, input.seniority, input.professions,
    input.sectors, input.skills, input.languages, input.description,
    input.search_text, input.dedupe_key
  FROM jsonb_to_recordset($1::jsonb) AS input (
    source TEXT, country TEXT, source_id TEXT, source_handle TEXT, name TEXT,
    role TEXT, city TEXT, district TEXT, remote BOOLEAN,
    experience_years DOUBLE PRECISION, created_at TIMESTAMPTZ, url TEXT,
    data JSONB, public_id BIGINT, origin TEXT, source_key TEXT,
    provider TEXT, canonical_city TEXT, activity_at TIMESTAMPTZ,
    gender TEXT, age SMALLINT, salary_min_usd DOUBLE PRECISION,
    salary_max_usd DOUBLE PRECISION, seniority TEXT, professions TEXT[],
    sectors TEXT[], skills TEXT[], languages TEXT[], description TEXT,
    search_text TEXT, dedupe_key TEXT
  )
  WHERE input.source_id <> '' AND input.country <> '' AND input.created_at IS NOT NULL
  ON CONFLICT (source, country, source_id) DO UPDATE SET
    source_handle = EXCLUDED.source_handle,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    city = EXCLUDED.city,
    district = EXCLUDED.district,
    remote = EXCLUDED.remote,
    experience_years = EXCLUDED.experience_years,
    created_at = EXCLUDED.created_at,
    url = EXCLUDED.url,
    active = TRUE,
    last_seen_at = NOW(),
    updated_at = NOW(),
    data = EXCLUDED.data,
    public_id = EXCLUDED.public_id,
    origin = EXCLUDED.origin,
    source_key = EXCLUDED.source_key,
    provider = EXCLUDED.provider,
    canonical_city = EXCLUDED.canonical_city,
    activity_at = EXCLUDED.activity_at,
    gender = EXCLUDED.gender,
    age = EXCLUDED.age,
    salary_min_usd = EXCLUDED.salary_min_usd,
    salary_max_usd = EXCLUDED.salary_max_usd,
    seniority = EXCLUDED.seniority,
    professions = EXCLUDED.professions,
    sectors = EXCLUDED.sectors,
    skills = EXCLUDED.skills,
    languages = EXCLUDED.languages,
    description = EXCLUDED.description,
    search_text = EXCLUDED.search_text,
    dedupe_key = EXCLUDED.dedupe_key;
`

async function backfillCandidateReadModel(): Promise<void> {
  if (candidateBackfillComplete) return
  for (let batch = 0; batch < Math.ceil(HYDRATE_LIMIT / UPSERT_BATCH); batch += 1) {
    const legacy = await db().query<{
      data: CvProfile
      source: string
      country: string
      source_id: string
      source_handle: string
      created_at: Date
      url: string
    }>(
      `SELECT data, source, country, source_id, source_handle, created_at, url
       FROM ${schema()}.candidates
       WHERE active = TRUE AND (public_id IS NULL OR dedupe_key IS NULL)
       ORDER BY id
       LIMIT $1`,
      [UPSERT_BATCH],
    )
    if (!legacy.rows.length) {
      candidateBackfillComplete = true
      return
    }
    const rows = legacy.rows.map((row) => candidateRow({
      ...(row.data || {}),
      source: row.data?.source || row.source,
      country: row.data?.country || row.country,
      id: row.data?.id || row.source_id,
      createdAt: row.data?.createdAt || isoDate(row.created_at) || String(row.created_at),
      url: row.data?.url || row.url,
    } as CvProfile, row.source_handle))
    await db().query(UPSERT_SQL(schema()), [JSON.stringify(rows)])
    if (legacy.rows.length < UPSERT_BATCH) {
      candidateBackfillComplete = true
      return
    }
  }
}

export async function loadDbCandidates(): Promise<CvProfile[]> {
  if (!hiringDbEnabled()) return []
  try {
    await ensureSchema()
    const result = await db().query<{ data: CvProfile }>(
      `SELECT data FROM ${schema()}.candidates
       WHERE active = TRUE
         AND created_at >= (NOW() - INTERVAL '${RETENTION_MONTHS} months')
         AND created_at <= (NOW() + INTERVAL '48 hours')
       ORDER BY created_at DESC, id DESC
       LIMIT $1;`,
      [HYDRATE_LIMIT],
    )
    return result.rows.map((row) => row.data).filter(Boolean)
  } catch (error) {
    console.warn('[hiring:db] load failed:', (error as Error).message)
    return []
  }
}

export interface DbCandidateFeed {
  profiles: CvProfile[]
  count: number
  statistics: HiringStatistics
  sourceCounts: Record<string, number>
}

function queryList(params: URLSearchParams, key: string): string[] {
  return (params.get(key) || '').split(',').map((value) => value.trim()).filter(Boolean)
}

function candidateOrder(sort: string): string {
  if (sort === 'name_asc') return `LOWER(name) ASC NULLS LAST, activity_at DESC NULLS LAST, id DESC`
  if (sort === 'name_desc') return `LOWER(name) DESC NULLS LAST, activity_at DESC NULLS LAST, id DESC`
  if (sort === 'experience_desc') return `experience_years DESC NULLS LAST, activity_at DESC NULLS LAST, id DESC`
  if (sort === 'experience_asc') return `experience_years ASC NULLS LAST, activity_at DESC NULLS LAST, id DESC`
  if (sort === 'age_desc') return `age DESC NULLS LAST, activity_at DESC NULLS LAST, id DESC`
  if (sort === 'age_asc') return `age ASC NULLS LAST, activity_at DESC NULLS LAST, id DESC`
  if (sort === 'salary_desc') return `COALESCE(salary_max_usd, salary_min_usd) DESC NULLS LAST, activity_at DESC NULLS LAST, id DESC`
  if (sort === 'salary_asc') return `COALESCE(salary_min_usd, salary_max_usd) ASC NULLS LAST, activity_at DESC NULLS LAST, id DESC`
  return `activity_at DESC NULLS LAST, created_at DESC, id DESC`
}

function emptyHiringStatistics(): HiringStatistics {
  return {
    genders: { female: 0, male: 0, unknown: 0 },
    ages: ['<18', '18–24', '25–34', '35–44', '45–54', '55+', '__unknown__'].map((label) => ({ label, value: 0 })),
    platforms: [], locations: [], sectors: [], professions: [], activity: [],
    salaryByExperience: [null, null, null, null, null],
    salaryByProfession: [], salarySamples: 0,
  }
}

export async function queryDbCandidates(params: URLSearchParams, offset: number, limit: number): Promise<DbCandidateFeed | null> {
  if (!hiringDbEnabled()) return null
  try {
    await ensureSchema()
    await backfillCandidateReadModel()
    const values: unknown[] = []
    const add = (value: unknown) => { values.push(value); return `$${values.length}` }
    const where = [
      'active = TRUE',
      `created_at >= NOW() - INTERVAL '${RETENTION_MONTHS} months'`,
      `created_at <= NOW() + INTERVAL '48 hours'`,
    ]
    const countries = queryList(params, 'countries').map((value) => value.toUpperCase())
    if (countries.length) where.push(`country = ANY(${add(countries)}::text[])`)
    const city = String(params.get('city') || '').trim()
    if (city) where.push(`LOWER(canonical_city) = LOWER(${add(canonicalCityValue(city))})`)
    const remote = params.get('remote')
    if (remote === '1' || remote === '0') where.push(`remote = ${add(remote === '1')}`)
    const experienceMin = Number(params.get('experienceMin'))
    if (Number.isFinite(experienceMin) && experienceMin > 0) where.push(`experience_years >= ${add(experienceMin)}`)
    const ageMin = Number(params.get('ageMin'))
    if (Number.isFinite(ageMin) && ageMin > 0) where.push(`age >= ${add(ageMin)}`)
    const ageMax = Number(params.get('ageMax'))
    if (Number.isFinite(ageMax) && ageMax > 0) where.push(`age <= ${add(ageMax)}`)
    const salaryCurrency = String(params.get('salaryCurrency') || 'USD').trim().toUpperCase()
    const salaryFrom = convertCurrency(Number(params.get('salaryFrom')), salaryCurrency, 'USD')
    const salaryTo = convertCurrency(Number(params.get('salaryTo')), salaryCurrency, 'USD')
    if (salaryFrom != null) where.push(`COALESCE(salary_max_usd, salary_min_usd) >= ${add(salaryFrom)}`)
    if (salaryTo != null) where.push(`COALESCE(salary_min_usd, salary_max_usd) <= ${add(salaryTo)}`)
    const gender = String(params.get('gender') || '').trim().toLowerCase()
    if (gender) where.push(`gender = ${add(gender)}`)
    const professions = expandHiringProfessionFilters(queryList(params, 'professions'))
    if (professions.length) where.push(`professions && ${add(professions)}::text[]`)
    const seniority = String(params.get('seniority') || '').trim().toLowerCase()
    if (seniority) where.push(`seniority = ${add(seniority)}`)
    const skills = queryList(params, 'skills').map((value) => value.toLocaleLowerCase('en'))
    if (skills.length) where.push(`skills @> ${add(skills)}::text[]`)
    const languages = queryList(params, 'languages').map((value) => value.toLocaleLowerCase('en'))
    if (languages.length) where.push(`languages && ${add(languages)}::text[]`)
    const query = String(params.get('query') || '').trim()
    if (query) where.push(`to_tsvector('simple', search_text) @@ plainto_tsquery('simple', ${add(query)})`)
    const sources = queryList(params, 'sources').map((value) => value.toLowerCase())
    if (sources.length) where.push(`(source_key = ANY(${add(sources)}::text[]) OR origin = ANY(${add(sources)}::text[]))`)
    const profileId = String(params.get('profileId') || params.get('listingId') || '').trim()
    if (profileId) where.push(`source_id = ${add(profileId)}`)
    const publicId = String(params.get('publicId') || '').trim()
    if (publicId && /^\d+$/.test(publicId)) where.push(`public_id = ${add(publicId)}::bigint`)

    const pageLimit = add(limit)
    const pageOffset = add(offset)
    const result = await db().query({
      text: `
        WITH deduped AS MATERIALIZED (
          SELECT * FROM (
            SELECT candidates.*, ROW_NUMBER() OVER (PARTITION BY dedupe_key ORDER BY created_at DESC, id DESC) AS dedupe_rank
            FROM ${schema()}.candidates candidates WHERE active = TRUE
          ) ranked WHERE dedupe_rank = 1
        ), filtered AS MATERIALIZED (
          SELECT * FROM deduped WHERE ${where.filter((part) => part !== 'active = TRUE').join(' AND ')}
        ), page_rows AS (
          SELECT data || jsonb_build_object('publicId', public_id) AS data,
            ROW_NUMBER() OVER (ORDER BY ${candidateOrder(String(params.get('sort') || 'recent').toLowerCase())}) AS page_order
          FROM filtered ORDER BY ${candidateOrder(String(params.get('sort') || 'recent').toLowerCase())}
          LIMIT ${pageLimit} OFFSET ${pageOffset}
        ), platform_counts AS (
          SELECT COALESCE(NULLIF(provider, ''), source_key, origin, 'unknown') label, COUNT(*)::int value
          FROM filtered GROUP BY 1 ORDER BY value DESC, label ASC
        ), location_counts AS (
          SELECT COALESCE(NULLIF(canonical_city, ''), country, '__unknown__') label, COUNT(*)::int value
          FROM filtered GROUP BY 1 ORDER BY value DESC, label ASC
        ), sector_counts AS (
          SELECT sector label, COUNT(*)::int value FROM filtered, unnest(sectors) sector
          GROUP BY sector ORDER BY value DESC, label ASC
        ), profession_counts AS (
          SELECT profession label, COUNT(*)::int value FROM filtered, unnest(professions) profession
          WHERE profession <> 'Any Role' GROUP BY profession ORDER BY value DESC, label ASC
        ), activity_counts AS (
          SELECT activity_at::date::text date, COUNT(*)::int value FROM filtered
          WHERE activity_at >= NOW() - INTERVAL '60 days' AND activity_at <= NOW()
          GROUP BY activity_at::date ORDER BY activity_at::date
        ), salary_profession AS (
          SELECT profession, COUNT(*)::int count,
            MIN(LEAST(COALESCE(salary_min_usd, salary_max_usd), COALESCE(salary_max_usd, salary_min_usd)))::float8 min_usd,
            MAX(GREATEST(COALESCE(salary_min_usd, salary_max_usd), COALESCE(salary_max_usd, salary_min_usd)))::float8 max_usd
          FROM filtered, unnest(professions) profession
          WHERE COALESCE(salary_min_usd, salary_max_usd) IS NOT NULL AND profession <> 'Any Role'
          GROUP BY profession ORDER BY count DESC, max_usd DESC, profession ASC
        ), salary_experience AS (
          SELECT CASE WHEN experience_years < 2 THEN 0 WHEN experience_years < 4 THEN 1 WHEN experience_years < 7 THEN 2 WHEN experience_years < 11 THEN 3 ELSE 4 END bucket,
            (percentile_cont(0.5) WITHIN GROUP (ORDER BY (COALESCE(salary_min_usd, salary_max_usd) + COALESCE(salary_max_usd, salary_min_usd)) / 2.0))::float8 AS median
          FROM filtered WHERE experience_years IS NOT NULL AND COALESCE(salary_min_usd, salary_max_usd) IS NOT NULL
          GROUP BY 1
        )
        SELECT
          (SELECT COUNT(*)::int FROM ${schema()}.candidates WHERE active = TRUE) database_total,
          (SELECT COUNT(*)::int FROM ${schema()}.candidates WHERE active = TRUE AND public_id IS NOT NULL AND dedupe_key IS NOT NULL) database_ready,
          (SELECT COUNT(*)::int FROM filtered) count,
          COALESCE((SELECT jsonb_agg(data ORDER BY page_order) FROM page_rows), '[]'::jsonb) profiles,
          COALESCE((SELECT jsonb_object_agg(key, value) FROM (
            SELECT key, COUNT(*)::int value
            FROM filtered
            CROSS JOIN LATERAL unnest(ARRAY(SELECT DISTINCT item FROM unnest(ARRAY[source_key, origin]) item WHERE item IS NOT NULL AND item <> '')) key
            GROUP BY key
          ) x), '{}'::jsonb) source_counts,
          jsonb_build_object(
            'genders', jsonb_build_object(
              'female', (SELECT (COUNT(*) FILTER (WHERE gender = 'female'))::int FROM filtered),
              'male', (SELECT (COUNT(*) FILTER (WHERE gender = 'male'))::int FROM filtered),
              'unknown', (SELECT (COUNT(*) FILTER (WHERE gender IS NULL OR gender NOT IN ('female', 'male')))::int FROM filtered)
            ),
            'ages', (SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY ord) FROM (VALUES
              (1, '<18', (SELECT COUNT(*)::int FROM filtered WHERE age < 18)),
              (2, '18–24', (SELECT COUNT(*)::int FROM filtered WHERE age >= 18 AND age < 25)),
              (3, '25–34', (SELECT COUNT(*)::int FROM filtered WHERE age >= 25 AND age < 35)),
              (4, '35–44', (SELECT COUNT(*)::int FROM filtered WHERE age >= 35 AND age < 45)),
              (5, '45–54', (SELECT COUNT(*)::int FROM filtered WHERE age >= 45 AND age < 55)),
              (6, '55+', (SELECT COUNT(*)::int FROM filtered WHERE age >= 55)),
              (7, '__unknown__', (SELECT COUNT(*)::int FROM filtered WHERE age IS NULL))
            ) ages(ord, label, value)),
            'platforms', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value)) FROM platform_counts), '[]'::jsonb),
            'locations', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value)) FROM location_counts), '[]'::jsonb),
            'sectors', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value)) FROM sector_counts), '[]'::jsonb),
            'professions', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value)) FROM profession_counts), '[]'::jsonb),
            'activity', COALESCE((SELECT jsonb_agg(jsonb_build_object('date', date, 'value', value)) FROM activity_counts), '[]'::jsonb),
            'salaryByExperience', (SELECT jsonb_agg((SELECT median FROM salary_experience WHERE bucket = series.bucket) ORDER BY series.bucket) FROM generate_series(0, 4) series(bucket)),
            'salaryByProfession', COALESCE((SELECT jsonb_agg(jsonb_build_object('profession', profession, 'count', count, 'minUsd', min_usd, 'maxUsd', max_usd)) FROM salary_profession), '[]'::jsonb),
            'salarySamples', (SELECT COUNT(*)::int FROM filtered WHERE experience_years IS NOT NULL AND COALESCE(salary_min_usd, salary_max_usd) IS NOT NULL)
          ) statistics
      `,
      values,
    })
    const row = result.rows[0]
    if (!row) return null
    if ((Number(row.database_total) || 0) === 0 || Number(row.database_ready) !== Number(row.database_total)) return null
    return {
      profiles: row.profiles || [], count: Number(row.count) || 0,
      statistics: { ...emptyHiringStatistics(), ...(row.statistics || {}) },
      sourceCounts: row.source_counts || {},
    }
  } catch (error) {
    console.warn('[hiring:db] indexed read failed:', (error as Error).message)
    return null
  }
}

export async function saveDbCandidates(
  profiles: CvProfile[],
  diagnostic: SourceRun,
): Promise<number> {
  if (!hiringDbEnabled()) return 0
  try {
    await ensureSchema()
    const unique = new Map<string, ReturnType<typeof candidateRow>>()
    for (const profile of profiles) {
      const row = candidateRow(profile, diagnostic.handle)
      if (!row.source_id || !row.country || !row.created_at) continue
      unique.set(`${row.source}:${row.country}:${row.source_id}`, row)
    }

    const rows = [...unique.values()]
    for (let offset = 0; offset < rows.length; offset += UPSERT_BATCH) {
      await db().query(UPSERT_SQL(schema()), [JSON.stringify(rows.slice(offset, offset + UPSERT_BATCH))])
    }

    await recordDbSourceRun(diagnostic)
    return rows.length
  } catch (error) {
    console.warn(`[hiring:db] upsert @${diagnostic.handle} failed:`, (error as Error).message)
    return 0
  }
}

export async function recordDbSourceRun(diagnostic: SourceRun): Promise<void> {
  if (!hiringDbEnabled()) return
  try {
    await ensureSchema()
    await db().query(
      `INSERT INTO ${schema()}.source_runs (
         source, handle, country, status, fetched, candidates, error,
         checked_at, last_success_at, updated_at
       ) VALUES ($1, $2, $3, $4::text, $5, $6, $7, $8::timestamptz,
         CASE WHEN $4::text <> 'error' THEN $8::timestamptz ELSE NULL END, NOW())
       ON CONFLICT (source, handle) DO UPDATE SET
         country = EXCLUDED.country,
         status = EXCLUDED.status,
         fetched = EXCLUDED.fetched,
         candidates = EXCLUDED.candidates,
         error = EXCLUDED.error,
         checked_at = EXCLUDED.checked_at,
         last_success_at = CASE
           WHEN EXCLUDED.status <> 'error' THEN EXCLUDED.checked_at
           ELSE ${schema()}.source_runs.last_success_at
         END,
         updated_at = NOW();`,
      [
        runOrigin(diagnostic.handle),
        diagnostic.handle.replace(/^@/, ''),
        (diagnostic.country || '').toUpperCase(),
        ['ok', 'empty', 'error'].includes(diagnostic.status) ? diagnostic.status : 'error',
        Math.max(0, diagnostic.fetched || 0),
        Math.max(0, diagnostic.candidates || 0),
        diagnostic.error ? diagnostic.error.slice(0, 2000) : null,
        isoDate(diagnostic.checkedAt) || new Date().toISOString(),
      ],
    )
  } catch (error) {
    console.warn(`[hiring:db] source run @${diagnostic.handle} failed:`, (error as Error).message)
  }
}

const SOURCE_RUNS_TTL_MS = 60_000
let sourceRunsCache: Array<SourceRun & { lastSuccessAt?: string | null }> = []
let sourceRunsAt = 0

export async function loadDbSourceRuns(): Promise<
  Array<SourceRun & { lastSuccessAt?: string | null }>
> {
  if (!hiringDbEnabled()) return []
  if (Date.now() - sourceRunsAt < SOURCE_RUNS_TTL_MS) return sourceRunsCache
  try {
    await ensureSchema()
    const result = await db().query(
      `SELECT source, handle, country, status, fetched, candidates, error, checked_at, last_success_at
       FROM ${schema()}.source_runs ORDER BY checked_at DESC, handle ASC;`,
    )
    sourceRunsCache = result.rows.map((row) => ({
      handle: row.handle,
      country: row.country,
      status: row.status,
      fetched: Number(row.fetched) || 0,
      candidates: Number(row.candidates) || 0,
      error: row.error || undefined,
      checkedAt: row.checked_at ? new Date(row.checked_at).toISOString() : '',
      lastSuccessAt: row.last_success_at ? new Date(row.last_success_at).toISOString() : null,
    }))
    sourceRunsAt = Date.now()
    return sourceRunsCache
  } catch (error) {
    console.warn('[hiring:db] source runs failed:', (error as Error).message)
    sourceRunsAt = Date.now()
    sourceRunsCache = []
    return sourceRunsCache
  }
}

export async function pruneDbCandidates(): Promise<number> {
  if (!hiringDbEnabled()) return 0
  try {
    await ensureSchema()
    const result = await db().query(
      `DELETE FROM ${schema()}.candidates
       WHERE created_at < (NOW() - INTERVAL '${RETENTION_MONTHS} months')
          OR created_at > (NOW() + INTERVAL '48 hours');`,
    )
    return result.rowCount || 0
  } catch (error) {
    console.warn('[hiring:db] prune failed:', (error as Error).message)
    return 0
  }
}
