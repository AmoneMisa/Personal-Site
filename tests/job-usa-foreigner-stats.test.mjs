import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('../server/routes/jobs-feed.get.ts', import.meta.url), 'utf8')

test('USA foreigner statistics match the evidence-filtered result set', () => {
  assert.match(source, /const result = filterAndPaginate\(searchPool,/)
  assert.match(
    source,
    /if \(usaBroadForeignerFilter\) result\.stats\.foreignerFriendly = result\.total/,
  )
})
