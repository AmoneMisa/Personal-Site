import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('hiring application and extracted sources use canonical infrastructure paths', async () => {
  const files = [
    'server/hiring/application/readSnapshot.ts',
    'server/hiring/application/readWebProfiles.ts',
    'server/hiring/application/refreshTelegramChannel.ts',
    'server/hiring/sources/ishBorRefresh.ts',
    'server/hiring/sources/linkedInRefresh.ts',
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

test('Telegram per-channel refresh is owned by the application layer', async () => {
  const application = await read('server/hiring/application/refreshSources.ts')
  const channelRefresh = await read('server/hiring/application/refreshTelegramChannel.ts')

  assert.match(application, /\.\/refreshTelegramChannel/)
  assert.doesNotMatch(application, /sources\/telegramRefresh|utils\/hiringStore/)
  assert.doesNotMatch(channelRefresh, /utils\/hiringStore|utils\/hiringDb|utils\/hiringStoreLock/)
})

test('legacy Telegram hiring store and facade are removed', async () => {
  await assert.rejects(read('server/utils/hiringStore.ts'), { code: 'ENOENT' })
  await assert.rejects(read('server/hiring/sources/telegramRefresh.ts'), { code: 'ENOENT' })
})
