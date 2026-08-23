import { randomBytes } from 'node:crypto'
import { Pool } from 'pg'

const SCHEMA_RE = /^[a-z_][a-z0-9_]*$/i
const HANDOFF_TTL_MINUTES = 30

let pool: Pool | undefined
let schemaPromise: Promise<void> | undefined

function schema(): string {
  const value = String(process.env.SUBSCRIPTIONS_DB_SCHEMA || 'subscriptions').trim()
  return SCHEMA_RE.test(value) ? value : 'subscriptions'
}

function databaseUrl(): string {
  return String(
    process.env.SUBSCRIPTIONS_DATABASE_URL
      || process.env.HIRING_DATABASE_URL
      || process.env.JOBS_QUEUE_DATABASE_URL
      || '',
  ).trim()
}

function db(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl(),
      max: Number(process.env.SUBSCRIPTIONS_DB_POOL_MAX) || 4,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })
    pool.on('error', (error) => console.error('[subscriptions:handoff] idle client error:', error.message))
  }
  return pool
}

async function ensureSchema(): Promise<void> {
  if (schemaPromise) return schemaPromise
  const name = schema()
  schemaPromise = (async () => {
    await db().query(`CREATE SCHEMA IF NOT EXISTS ${name};`)
    await db().query(`
      CREATE TABLE IF NOT EXISTS ${name}.edit_sessions (
        token VARCHAR(48) PRIMARY KEY,
        subscription_id BIGINT NOT NULL,
        telegram_user_id BIGINT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)
    await db().query(`
      CREATE TABLE IF NOT EXISTS ${name}.handoffs (
        token VARCHAR(48) PRIMARY KEY,
        search_url TEXT NOT NULL,
        edit_token VARCHAR(48),
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)
    await db().query(`CREATE INDEX IF NOT EXISTS handoffs_expiry_idx ON ${name}.handoffs(expires_at);`)
    await db().query(`CREATE INDEX IF NOT EXISTS edit_sessions_expiry_idx ON ${name}.edit_sessions(expires_at);`)
  })().catch((error) => {
    schemaPromise = undefined
    throw error
  })
  return schemaPromise
}

function cleanPath(pathname: string): string {
  return pathname.replace(/^\/(?:ru|en|kk)(?=\/)/, '') || '/'
}

function searchKind(pathname: string): 'flats' | 'jobs' | 'candidates' | null {
  const path = cleanPath(pathname)
  if (path === '/flat-finder') return 'flats'
  if (path === '/jobs') return 'jobs'
  if (path === '/hiring') return 'candidates'
  return null
}

function sanitizeSearchUrl(raw: string): { url: string; editToken: string | null } {
  const publicBase = String(process.env.SITE_PUBLIC_URL || 'https://whiteslove.me').replace(/\/$/, '')
  const expected = new URL(publicBase)
  const url = new URL(raw, publicBase)
  if (url.host !== expected.host || !searchKind(url.pathname)) throw createError({ statusCode: 400, statusMessage: 'Unsupported search URL' })

  const editToken = url.searchParams.get('_tgEdit')?.trim() || null
  url.searchParams.delete('_tgEdit')
  for (const key of ['flat', 'flatSource', 'flatCountry', 'job', 'cv', 'cvSource', 'cvCountry']) {
    url.searchParams.delete(key)
  }
  url.hash = ''
  return { url: url.toString(), editToken }
}

function token(): string {
  return randomBytes(18).toString('base64url')
}

export default defineEventHandler(async (event) => {
  const enabled = String(process.env.TELEGRAM_SUBSCRIPTION_BOT_ENABLED || 'off').toLowerCase() === 'on'
  const botUsername = String(process.env.TELEGRAM_SUBSCRIPTION_BOT_USERNAME || '').trim().replace(/^@/, '')
  if (!enabled || !botUsername || !databaseUrl()) {
    throw createError({ statusCode: 503, statusMessage: 'Telegram subscriptions are not configured' })
  }

  const body = await readBody<{ searchUrl?: string }>(event)
  const { url, editToken } = sanitizeSearchUrl(String(body?.searchUrl || ''))
  await ensureSchema()

  if (editToken) {
    const edit = await db().query(
      `SELECT 1 FROM ${schema()}.edit_sessions
       WHERE token = $1 AND consumed_at IS NULL AND expires_at > NOW();`,
      [editToken],
    )
    if (!edit.rowCount) throw createError({ statusCode: 410, statusMessage: 'Edit session expired' })
  }

  const handoff = token()
  await db().query(
    `INSERT INTO ${schema()}.handoffs (token, search_url, edit_token, expires_at)
     VALUES ($1, $2, $3, NOW() + ($4::int * INTERVAL '1 minute'));`,
    [handoff, url, editToken, HANDOFF_TTL_MINUTES],
  )

  setResponseHeader(event, 'Cache-Control', 'no-store')
  return {
    url: `https://t.me/${botUsername}?start=sub_${handoff}`,
    kind: searchKind(new URL(url).pathname),
    mode: editToken ? 'edit' : 'create',
  }
})
