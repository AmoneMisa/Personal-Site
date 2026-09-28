import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { ACCOUNT_LOCAL_KEYS, unionByKey } from '../app/composables/useAccountLists.ts'
import { accountListDomain } from '../server/utils/accountLists.ts'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')
const id = (item) => item.id

test('a first sync is a union: local order first, then what only the account has', () => {
  const local = [{ id: 'a' }, { id: 'b' }]
  const remote = [{ id: 'b' }, { id: 'c' }]
  const { merged, localOnly } = unionByKey(local, remote, id, 10)
  assert.deepEqual(merged.map(id), ['a', 'b', 'c'])
  assert.deepEqual(localOnly.map(id), ['a'])
  assert.deepEqual(unionByKey(local, remote, id, 2).merged.map(id), ['a', 'b'])
})

test('only jobs and cv lists go through the account route', () => {
  assert.equal(accountListDomain('jobs'), 'jobs')
  assert.equal(accountListDomain('cv'), 'cv')
  for (const value of ['flats', '', undefined, 'jobs/../x']) assert.equal(accountListDomain(value), null)
})

test('the account routes never mint an installation or reach the browser with credentials', async () => {
  for (const path of ['server/routes/account-lists.get.ts', 'server/routes/account-lists.post.ts']) {
    const route = await read(path)
    assert.match(route, /existingInstallation\(event\)/u, path)
    assert.doesNotMatch(route, /installationFor\(/u, path)
  }
  const client = await read('app/composables/useAccountLists.ts')
  assert.doesNotMatch(client, /FLAT_API_URL|flat-finder-backend|x-flat-finder-device/iu)
})

test('after the first merge the account is the truth, so removals elsewhere stick', async () => {
  const client = await read('app/composables/useAccountLists.ts')
  assert.match(client, /if \(readStoredValue<boolean>\(marker\)\) \{\s+config\.write\(remote\);\s+return;/u)
  // Merging this browser in only adds; it never overwrites the account.
  assert.match(client, /op: "add" as const/u)
  // Nothing is written while signed out.
  assert.match(client, /if \(!import\.meta\.client \|\| !signedIn\.value \|\| !channel\.live\) return;/u)
})

test('signing out clears every local copy of account data, on any page', async () => {
  const account = await read('app/composables/useSiteAccount.ts')
  assert.match(account, /clearAccountLocalCopies\(\);\s+signedOutAt\.value = Date\.now\(\);/u)
  for (const key of ['jobs:favorites:v1', 'jobs:hidden:v1', 'jobs:seen:v1', 'jobs:recent:v1', 'hiring:favorites:v1', 'hiring:hidden:v1', 'hiring:recent:v1', 'hiring:presets:v1']) {
    assert.ok(ACCOUNT_LOCAL_KEYS.includes(key), key)
  }
})

test('jobs and hiring sync every list the account keeps', async () => {
  const jobs = await read('app/pages/jobs/index.vue')
  assert.match(jobs, /accountSync: \{ domain: "jobs", lists: \["favorites", "hidden"\] \}/u)
  assert.match(jobs, /jobsAccount\.syncList<string>\("seen"/u)
  assert.match(jobs, /jobsAccount\.syncList<RecentJob>\("recent"/u)
  const hiring = await read('app/pages/hiring/index.vue')
  assert.match(hiring, /accountSync: \{ domain: "cv", lists: \["favorites", "hidden", "recent"\] \}/u)
  assert.match(hiring, /accountSync: \{ domain: "cv" \}/u)
})
