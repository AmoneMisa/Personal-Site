import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('hiring metadata route does not depend on Telegram crawler internals', async () => {
  const route = await read('server/routes/hiring-meta.get.ts')
  assert.match(route, /shared\/hiring\/hiringMarkets/)
  assert.doesNotMatch(route, /utils\/hiringSources/)
})

test('hiring market metadata stays runtime-neutral', async () => {
  const markets = await read('shared/hiring/hiringMarkets.ts')
  assert.doesNotMatch(markets, /server\/|process\.env|fetch\(/)
  assert.match(markets, /UZ/)
  assert.match(markets, /UA/)
  assert.match(markets, /KZ/)
  assert.match(markets, /KG/)
})
