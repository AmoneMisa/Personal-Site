import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const dir = await mkdtemp(join(tmpdir(), 'personal-site-state-'))
process.env.SITE_STATE_DIR = dir

const { useRedis, redisReady } = await import('../server/utils/redis.ts')
const store = useRedis()

test.after(async () => {
  await rm(dir, { recursive: true, force: true })
})

test('persistent KV supports get/set/delete and exists', async () => {
  assert.equal(await redisReady(), true)
  assert.equal(await store.get('plain'), null)
  assert.equal(await store.set('plain', 'value'), 'OK')
  assert.equal(await store.get('plain'), 'value')
  assert.equal(await store.exists('plain'), 1)
  assert.equal(await store.delete('plain'), 1)
  assert.equal(await store.exists('plain'), 0)
})

test('persistent KV expires TTL entries', async () => {
  // Filesystem-backed state performs an atomic write + fsync. A 20ms TTL can
  // legitimately expire before the first read on a busy CI runner, so use a
  // window large enough to test TTL semantics rather than storage latency.
  await store.set('short', 'value', 'PX', 250)
  assert.equal(await store.get('short'), 'value')
  await new Promise((resolve) => setTimeout(resolve, 325))
  assert.equal(await store.get('short'), null)
})

test('persistent KV preserves Redis NX compare-and-delete lock contract', async () => {
  assert.equal(await store.set('lock', 'owner-a', 'PX', 5_000, 'NX'), 'OK')
  assert.equal(await store.set('lock', 'owner-b', 'PX', 5_000, 'NX'), null)
  assert.equal(await store.eval('ignored', 1, 'lock', 'owner-b'), 0)
  assert.equal(await store.get('lock'), 'owner-a')
  assert.equal(await store.eval('ignored', 1, 'lock', 'owner-a'), 1)
  assert.equal(await store.get('lock'), null)
})
