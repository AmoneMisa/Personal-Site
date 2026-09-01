import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const jobsDb = await readFile(new URL('../server/jobs/infrastructure/database.ts', import.meta.url), 'utf8')
const hiringDb = await readFile(new URL('../server/hiring/infrastructure/database.ts', import.meta.url), 'utf8')
const jobsMigration = await readFile(new URL('../db/migrations/jobs/001_initial_read_model.sql', import.meta.url), 'utf8')
const hiringMigration = await readFile(new URL('../db/migrations/hiring/001_candidate_read_model.sql', import.meta.url), 'utf8')
const jobsFeed = await readFile(new URL('../server/routes/jobs-feed.get.ts', import.meta.url), 'utf8')
const hiringFeed = await readFile(new URL('../server/routes/hiring-feed.get.ts', import.meta.url), 'utf8')
const jobsSourceRefresh = await readFile(new URL('../server/utils/jobsSourceRefresh.ts', import.meta.url), 'utf8')
const compose = await readFile(new URL('../docker-compose.yml', import.meta.url), 'utf8')

test('vacancies use a Personal Site-owned indexed PostgreSQL read model', () => {
  assert.match(jobsDb, /JOBS_DB_SCHEMA \|\| 'jobs'/)
  assert.match(jobsDb, /SELECT to_regclass\(\$1\)::text AS vacancies, to_regclass\(\$2\)::text AS migrations/)
  assert.match(jobsDb, /Jobs schema \$\{name\} is not migrated/)
  assert.doesNotMatch(jobsDb, /CREATE\s+(?:SCHEMA|TABLE|INDEX)/i)
  assert.doesNotMatch(jobsDb, /ALTER\s+TABLE/i)

  assert.match(jobsMigration, /CREATE TABLE IF NOT EXISTS \{\{schema\}\}\.vacancies/)
  assert.match(jobsMigration, /vacancies_active_posted_idx/)
  assert.match(jobsMigration, /vacancies_city_lower_idx[\s\S]*LOWER\(city\)/)
  assert.match(jobsMigration, /vacancies_skills_gin_idx[\s\S]*USING GIN\(skills\)/)
  assert.match(jobsMigration, /vacancies_search_idx[\s\S]*to_tsvector\('simple', search_text\)/)
  assert.doesNotMatch(jobsDb, /\blistings\b/)
})

test('vacancy ingestion keeps PostgreSQL synchronized and feed reads it before the snapshot', () => {
  assert.match(jobsSourceRefresh, /await syncJobsDb\(kept\)/)
  const dbIndex = jobsFeed.indexOf('await queryJobsDb(jobQuery)')
  const snapshotIndex = jobsFeed.indexOf('await getStoredSnapshot()')
  assert.ok(dbIndex > -1 && snapshotIndex > -1 && dbIndex < snapshotIndex)
  assert.match(jobsFeed, /engine: 'postgresql'/)
})

test('vacancy counts and analytics are computed by PostgreSQL', () => {
  assert.match(jobsDb, /WITH filtered AS MATERIALIZED/)
  assert.match(jobsDb, /percentile_cont\(0\.5\)/)
  assert.match(jobsDb, /grouped_source/)
  assert.match(jobsDb, /grouped_country/)
  assert.match(jobsDb, /grouped_profession/)
  assert.match(jobsDb, /language_counts/)
  assert.match(jobsDb, /skill_counts/)
  assert.match(jobsDb, /salaryTrend/)
})

test('vacancy page reads are split from bounded cached analytics', () => {
  assert.match(jobsDb, /const jobStatsCache = new BoundedTtlCache<string, JobStats>/)
  assert.match(jobsDb, /const JOB_STATS_CACHE_TTL_MS = 60_000/)
  assert.match(jobsDb, /function statsCacheKey\(query: JobQuery\): string/)
  assert.match(jobsDb, /jobStatsCache\.clear\(\)/)
  assert.match(jobsDb, /async function queryJobStats\(query: JobQuery\)/)
  assert.match(jobsDb, /SELECT data\s+FROM \$\{schema\(\)\}\.vacancies\s+WHERE \$\{pageWhere\}/u)
  assert.match(jobsDb, /WITH filtered_sources AS/u)
  assert.match(jobsDb, /SELECT\s+source, country, city, posted_at, title, work_mode, relocation,/u)
  assert.doesNotMatch(jobsDb, /WITH filtered AS MATERIALIZED \(\s*SELECT \*/u)
})

test('vacancy salary trend is bounded and stratified instead of serializing every salary row', () => {
  assert.match(jobsDb, /const JOB_SALARY_TREND_MAX_POINTS = 750/)
  assert.match(jobsDb, /PARTITION BY date_trunc\('day', posted_at\), COALESCE\(country, ''\), profession/u)
  assert.match(jobsDb, /WHERE sample_rank <= 3/u)
  assert.match(jobsDb, /LIMIT \$\{JOB_SALARY_TREND_MAX_POINTS\}/u)
})

test('candidate reads use typed indexed columns and PostgreSQL analytics', () => {
  assert.match(hiringDb, /to_regclass\(\$1\)::text AS candidates/)
  assert.match(hiringDb, /Hiring schema \$\{name\} is not migrated/)
  assert.doesNotMatch(hiringDb, /CREATE\s+(?:SCHEMA|TABLE|INDEX)/i)
  assert.doesNotMatch(hiringDb, /ALTER\s+TABLE/i)

  assert.match(hiringMigration, /candidates_active_activity_idx/)
  assert.match(hiringMigration, /candidates_city_lower_idx[\s\S]*LOWER\(canonical_city\)/)
  assert.match(hiringMigration, /candidates_professions_gin_idx[\s\S]*USING GIN\(professions\)/)
  assert.match(hiringMigration, /candidates_search_idx[\s\S]*to_tsvector\('simple', search_text\)/)
  assert.match(hiringMigration, /CREATE TABLE IF NOT EXISTS \{\{schema\}\}\.candidate_current/)

  assert.match(hiringDb, /backfillDbCandidateReadModel/)
  assert.match(hiringDb, /export async function queryDbCandidates/)
  assert.match(hiringDb, /salary_experience/)
  assert.match(hiringDb, /salary_profession/)
  assert.match(hiringDb, /activity_counts/)
  assert.match(hiringFeed, /await queryDbCandidates\(params, offset, limit\)/)
  assert.match(hiringFeed, /engine: 'postgresql'/)
})

test('frontend and jobs worker receive the isolated vacancy schema configuration', () => {
  assert.equal((compose.match(/^\s+JOBS_DATABASE_URL:/gm) || []).length, 2)
  assert.equal((compose.match(/^\s+JOBS_DB_SCHEMA:/gm) || []).length, 2)
})
