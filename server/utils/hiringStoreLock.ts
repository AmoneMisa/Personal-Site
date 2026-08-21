import { randomUUID } from 'node:crypto'
import { useRedis } from '~~/server/utils/redis'

const LOCK_KEY = 'hiring:store:v4:write-lock'
const LOCK_TTL_MS = 60_000
const LOCK_WAIT_MS = 30_000
const RETRY_MS = 40

const RELEASE_SCRIPT = `
  if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('del', KEYS[1])
  end
  return 0
`

/**
 * Every hiring adapter updates one shared JSON snapshot. Queue workers run in
 * parallel, so an unlocked read/merge/write lets the last request erase rows
 * written by another source. Serialize only the short persistence section;
 * network crawling remains concurrent.
 */
export async function withHiringStoreLock<T>(operation: () => Promise<T>): Promise<T> {
  const redis = useRedis()
  const token = randomUUID()
  const deadline = Date.now() + LOCK_WAIT_MS

  while (Date.now() < deadline) {
    const acquired = await redis.set(LOCK_KEY, token, 'PX', LOCK_TTL_MS, 'NX')
    if (acquired === 'OK') {
      try {
        return await operation()
      } finally {
        try {
          await redis.eval(RELEASE_SCRIPT, 1, LOCK_KEY, token)
        } catch (error) {
          console.warn('[hiring] failed to release store lock:', (error as Error).message)
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_MS))
  }

  throw new Error('timed out waiting for hiring store write lock')
}
