import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

const consumers = [
  'server/hiring/sources/telegramRuntime.ts',
  'server/hiring/sources/ishBorRefresh.ts',
  'server/hiring/sources/webCvRefresh.ts',
  'server/hiring/sources/uzJobsRefresh.ts',
  'server/hiring/sources/web/crawler.ts',
]

test('hiring source modules use the shared cursor contract directly', async () => {
  for (const path of consumers) {
    const source = await read(path)
    assert.match(source, /shared\/hiring\/hiringCursors/u, path)
    assert.doesNotMatch(source, /utils\/hiringCursors/u, path)
  }
})

test('legacy server cursor facade is removed', async () => {
  await assert.rejects(
    access(new URL('../server/utils/hiringCursors.ts', import.meta.url)),
  )
})
