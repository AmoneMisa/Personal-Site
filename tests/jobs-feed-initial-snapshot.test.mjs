import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const route = readFileSync(new URL('../server/routes/jobs-feed.get.ts', import.meta.url), 'utf8')

test('jobs feed waits for the persisted snapshot instead of returning a false empty result', () => {
  assert.match(route, /return getStoredJobsSnapshot\(\)/)
  assert.doesNotMatch(route, /Promise\.race\s*\(/)
  assert.doesNotMatch(route, /resolve\(\[\]\)/)
})
