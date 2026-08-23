import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('hiring application and extracted sources use canonical infrastructure paths', async () => {
  const files = [
    'server/hiring/application/readSnapshot.ts',
    'server/hiring/application/readWebProfiles.ts',
    'server/hiring/sources/ishBorRefresh.ts',
    'server/hiring/sources/linkedinRefresh.ts',
    'server/hiring/sources/secondaryWebRefresh.ts',
    'server/hiring/sources/socialRefresh.ts',
    'server/hiring/sources/uzJobsRefresh.ts',
    'server/hiring/sources/webCvRefresh.ts',
  ]

  for (const path of files) {
    const source = await read(path)
    assert.doesNotMatch(source, /utils\/hiringDb|utils\/hiringStoreLock/)
  }
})

test('Telegram legacy store stays behind the explicit refresh boundary', async () => {
  const boundary = await read('server/hiring/sources/telegramRefresh.ts')
  const application = await read('server/hiring/application/refreshSources.ts')

  assert.match(boundary, /utils\/hiringStore/)
  assert.doesNotMatch(application, /utils\/hiringStore/)
})

test('legacy store does not export its derivation marker into Nitro auto-imports', async () => {
  const store = await read('server/utils/hiringStore.ts')
  assert.doesNotMatch(store, /export\s+const\s+DERIVED_VERSION/)
})
