// Durable candidate storage in the shared Postgres, in its own `hiring` schema
// so the site's tables never collide with flat-finder's public ones.
//
// Redis stays the hot path. Postgres is what survives a Redis flush, a cold
// container restart, or a Telegram worker outage — the board keeps serving the
// candidates it already knows instead of dropping to zero.
//
// Every call here is best-effort: persistence must never take the board down
// with it, so failures are logged and answered with an empty/zero result.

import { Pool } from 'pg'
import { normalizeCandidate } from './hiringNormalize'
import { withProfessionExperience } from './hiringExperience'
import type { CvProfile } from './hiringTypes'
import { runOrigin, type SourceRun } from './hiringDiagnostics'

const HYDRATE_LIMIT = 5_000
const UPSERT_BATCH = 500
const RETENTION_MONTHS = 3
// Identifier, not a bindable value — validated rather than parameterized.
const SCHEMA_RE = /^[a-z_][a-z0-9_]*$/i

let pool: Pool | undefined
let schemaReady: Promise<void> | undefined

function schema(): string {
  const raw = (process.env.HIRING_DB_SCHEMA || 'hiring').trim()
  return SCHEMA_RE.test(raw) ? raw : 'hiring'
}

/** Off unless a connection string is configured (local dev: off). */
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
    // An idle client dying (server restart, network blip) must not take the
    // Nitro process with it: pg emits this on the pool, and an unhandled
    // 'error' event is fatal in Node.
    pool.on('error', (error) => console.error('[hiring:db] idle client error:', error.message))
  }
  return pool
}

/** Creates the schema and tables once per process; safe to call on every query. */
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
    await db().query(`CREATE INDEX IF NOT EXISTS candidates_active_created_idx ON ${name}.candidates(active, created_at DESC);`)
    await db().query(`CREATE INDEX IF NOT EXISTS candidates_country_created_idx ON ${name}.candidates(country, created_at DESC);`)
    await db().query(`CREATE INDEX IF NOT EXISTS candidates_handle_idx ON ${name}.candidates(source_handle);`)
    await db().query(`CREATE INDEX IF NOT EXISTS candidates_data_gin_idx ON ${name}.candidates USING GIN(data jsonb_path_ops);`)
    console.log(`[hiring:db] schema ${name} ready`)
  })().catch((error) => {
    // Let the next call retry: a database that was briefly down must not leave
    // the process permanently convinced the schema is missing.
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
  const normalized = withProfessionExperience(normalizeCandidate(profile))
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
    data: normalized,
  }
}

const UPSERT_SQL = (name: string) => `
  INSERT INTO ${name}.candidates (
    source, country, source_id, source_handle, name, role, city, district,
    remote, experience_years, created_at, url, active, first_seen_at,
    last_seen_at, updated_at, data
  )
  SELECT
    input.source, input.country, input.source_id, input.source_handle,
    input.name, input.role, input.city, input.district, input.remote,
    input.experience_years, input.created_at, input.url, TRUE,
    NOW(), NOW(), NOW(), input.data
  FROM jsonb_to_recordset($1::jsonb) AS input (
    source TEXT, country TEXT, source_id TEXT, source_handle TEXT, name TEXT,
    role TEXT, city TEXT, district TEXT, remote BOOLEAN,
    experience_years DOUBLE PRECISION, created_at TIMESTAMPTZ, url TEXT, data JSONB
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
    data = EXCLUDED.data;
`

/** Every active candidate still inside the retention window, newest first. */
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

/**
 * Upserts one channel's candidates and records that channel's run. An empty
 * list is still worth writing: it records "checked, found nothing", which is
 * how a quiet channel is told apart from a broken one.
 */
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

/** Per-channel run history, including the last time each one actually worked. */
export async function recordDbSourceRun(diagnostic: SourceRun): Promise<void> {
  if (!hiringDbEnabled()) return
  try {
    await ensureSchema()
    await db().query(
      `INSERT INTO ${schema()}.source_runs (
         source, handle, country, status, fetched, candidates, error,
         checked_at, last_success_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz,
         CASE WHEN $4 <> 'error' THEN $8::timestamptz ELSE NULL END, NOW())
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

// Read on every candidate-feed request, and it changes only when a crawl
// finishes. Cached so a slow or unreachable database costs one stalled
// request a minute instead of every one of them.
const SOURCE_RUNS_TTL_MS = 60_000
let sourceRunsCache: Array<SourceRun & { lastSuccessAt?: string | null }> = []
let sourceRunsAt = 0

/** What each channel last did, for diagnostics that outlive a restart. */
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
    // Remember the failure too: retrying a dead database on every request is
    // exactly what made the feed slow.
    sourceRunsAt = Date.now()
    sourceRunsCache = []
    return sourceRunsCache
  }
}

/** Drops rows outside the retention window; mirrors the in-memory prune. */
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