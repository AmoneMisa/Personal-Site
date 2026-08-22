import { createHash, randomUUID } from 'node:crypto'
import { mkdir, open, readFile, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'

// Compatibility adapter for the old Redis-shaped store API.
//
// Personal-Site runs one Nitro frontend process; queue workers call it over HTTP
// instead of mutating the store themselves. A small persistent file KV is enough
// for the hot JSON snapshots, TTL caches and the short hiring write lock, and it
// removes a whole stateful Redis container from the deployment.
//
// The Docker named volume mounted at SITE_STATE_DIR keeps state across container
// recreation. The filename is a SHA-256 of the logical key so Redis-style keys
// can contain any characters without becoming filesystem paths.

const STATE_DIR = process.env.SITE_STATE_DIR || '/var/app/state/site'

type Entry = {
  value: string
  expiresAt: number | null
}

type SetOption = string | number

type EventHandler = (...args: unknown[]) => void

const keyQueues = new Map<string, Promise<unknown>>()
let dirReady: Promise<void> | undefined

function ensureDir(): Promise<void> {
  if (!dirReady) {
    dirReady = mkdir(STATE_DIR, { recursive: true }).then(() => undefined)
  }
  return dirReady
}

function keyPath(key: string): string {
  const digest = createHash('sha256').update(key).digest('hex')
  return join(STATE_DIR, `${digest}.json`)
}

async function serializeKey<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = keyQueues.get(key) || Promise.resolve()
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  const queued = previous.catch(() => {}).then(() => gate)
  keyQueues.set(key, queued)

  await previous.catch(() => {})
  try {
    return await operation()
  } finally {
    release()
    if (keyQueues.get(key) === queued) keyQueues.delete(key)
  }
}

async function readEntry(key: string): Promise<Entry | null> {
  await ensureDir()
  const path = keyPath(key)
  try {
    const entry = JSON.parse(await readFile(path, 'utf8')) as Entry
    if (!entry || typeof entry.value !== 'string') return null
    if (entry.expiresAt != null && entry.expiresAt <= Date.now()) {
      await rm(path, { force: true }).catch(() => {})
      return null
    }
    return entry
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return null
    throw error
  }
}

async function atomicWrite(key: string, entry: Entry): Promise<void> {
  await ensureDir()
  const path = keyPath(key)
  const tmp = `${path}.${process.pid}.${randomUUID()}.tmp`
  await open(tmp, 'wx').then(async (handle) => {
    try {
      await handle.writeFile(JSON.stringify(entry), 'utf8')
      await handle.sync()
    } finally {
      await handle.close()
    }
  })
  await rename(tmp, path)
}

function parseSetOptions(options: SetOption[]): { expiresAt: number | null; nx: boolean } {
  let expiresAt: number | null = null
  let nx = false

  for (let i = 0; i < options.length; i += 1) {
    const token = String(options[i]).toUpperCase()
    if (token === 'NX') {
      nx = true
      continue
    }
    if (token === 'EX' || token === 'PX') {
      const amount = Number(options[i + 1])
      if (Number.isFinite(amount) && amount > 0) {
        expiresAt = Date.now() + (token === 'EX' ? amount * 1000 : amount)
      }
      i += 1
    }
  }

  return { expiresAt, nx }
}

class PersistentKvCompat {
  // Kept only because redisReady() and a couple of old callers inspect these.
  readonly options = { enableOfflineQueue: false }
  readonly status = 'ready'

  on(_event: string, _handler: EventHandler) { return this }
  once(_event: string, _handler: EventHandler) { return this }
  off(_event: string, _handler: EventHandler) { return this }

  async get(key: string): Promise<string | null> {
    return (await readEntry(key))?.value ?? null
  }

  async set(key: string, value: string, ...options: SetOption[]): Promise<'OK' | null> {
    const parsed = parseSetOptions(options)
    return serializeKey(key, async () => {
      if (parsed.nx && await readEntry(key)) return null
      await atomicWrite(key, {
        value: String(value),
        expiresAt: parsed.expiresAt,
      })
      return 'OK'
    })
  }

  async del(...keys: string[]): Promise<number> {
    let removed = 0
    for (const key of keys) {
      removed += await serializeKey(key, async () => {
        const existed = Boolean(await readEntry(key))
        await rm(keyPath(key), { force: true })
        return existed ? 1 : 0
      })
    }
    return removed
  }

  async delete(...keys: string[]): Promise<number> {
    return this.del(...keys)
  }

  async exists(key: string): Promise<number> {
    return (await readEntry(key)) ? 1 : 0
  }

  // The only Lua call in Personal-Site is compare-and-delete for the hiring
  // write lock. Preserve that Redis contract without embedding a script engine.
  async eval(_script: string, _numKeys: number, key: string, expected: string): Promise<number> {
    return serializeKey(key, async () => {
      const current = await readEntry(key)
      if (!current || current.value !== expected) return 0
      await rm(keyPath(key), { force: true })
      return 1
    })
  }
}

let store: PersistentKvCompat | undefined

export function useRedis(): PersistentKvCompat {
  if (!store) store = new PersistentKvCompat()
  return store
}

/** Compatibility readiness check for callers that used to wait for Redis. */
export async function redisReady(_timeoutMs = 2_000): Promise<boolean> {
  try {
    await ensureDir()
    return true
  } catch (error) {
    console.error('[state] persistent KV unavailable:', (error as Error).message)
    return false
  }
}
