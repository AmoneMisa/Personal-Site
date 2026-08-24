import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('hiring feed reads market metadata from the shared domain', async () => {
  const feed = await read('server/routes/hiring-feed.get.ts')
  assert.match(feed, /shared\/hiring\/hiringMarkets/)
  assert.doesNotMatch(feed, /getHiringSourceDiagnostics,\s*HIRING_COUNTRIES|HIRING_COUNTRIES\s*}\s*from\s*['"]\.\.\/utils\/hiringSources/)
})
