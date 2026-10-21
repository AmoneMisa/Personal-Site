import { randomBytes } from 'node:crypto'
import { Pool } from 'pg'

const SCHEMA_RE = /^[a-z_][a-z0-9_]*$/i
const HANDOFF_TTL_MINUTES = 30

let pool: Pool | undefined

function schema(): string {
  const value = String(process.env.SUBSCRIPTIONS_DB_SCHEMA || 'subscriptions').trim()
  return SCHEMA_RE.test(value) ? value : 'subscriptions'
}

function databaseUrl(): string {
  return String(process.env.SUBSCRIPTIONS_DATABASE_URL || '').trim()
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

// The subscriptions schema (handoffs, edit_sessions) is created and migrated by
// the subscription bot in whiteslove.me-backend-platform. The site only reads
// and writes handoff rows, so its database role needs no DDL rights.

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
