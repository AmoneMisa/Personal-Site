import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const dir = await mkdtemp(join(tmpdir(), 'personal-site-state-'))
process.env.SITE_STATE_DIR = dir

const { useStateStore, stateStoreReady } = await import('../server/utils/stateStore.ts')
const store = useStateStore()

test.after(async () => {
  await rm(dir, { recursive: true, force: true })
})

test('persistent KV supports get/set/delete and exists', async () => {
  assert.equal(await stateStoreReady(), true)
  assert.equal(await store.get('plain'), null)
  assert.equal(await store.set('plain', 'value'), 'OK')
  assert.equal(await store.get('plain'), 'value')
  assert.equal(await store.exists('plain'), 1)
  assert.equal(await store.delete('plain'), 1)
  assert.equal(await store.exists('plain'), 0)
})

test('persistent KV expires TTL entries', async () => {
  const originalNow = Date.now
  let now = originalNow()
  Date.now = () => now

  try {
    await store.set('short', 'value', 'PX', 250)
    assert.equal(await store.get('short'), 'value')
    now += 251
    assert.equal(await store.get('short'), null)
  } finally {
    Date.now = originalNow
  }
})

test('persistent KV preserves NX and compare-and-delete lock semantics', async () => {
  assert.equal(await store.set('lock', 'owner-a', 'PX', 5_000, 'NX'), 'OK')
  assert.equal(await store.set('lock', 'owner-b', 'PX', 5_000, 'NX'), null)
  assert.equal(await store.compareAndDelete('lock', 'owner-b'), false)
  assert.equal(await store.get('lock'), 'owner-a')
  assert.equal(await store.compareAndDelete('lock', 'owner-a'), true)
  assert.equal(await store.get('lock'), null)
})
