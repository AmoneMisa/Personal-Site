import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const worker = readFileSync(new URL('../jobs-worker/worker.ts', import.meta.url), 'utf8')
const hiringRuntime = readFileSync(new URL('../jobs-worker/hiringRuntime.ts', import.meta.url), 'utf8')

test('worker orchestration depends on one hiring runtime registry', () => {
  assert.match(worker, /from '\.\/hiringRuntime'/)
  assert.doesNotMatch(worker, /server\/utils\/hiring(?:Sources|Store|WebSources|IshBorSource|SecondaryWebSources|UzJobsSource|SocialSources|LinkedInSources)/)
  assert.match(hiringRuntime, /const refreshAdapters: HiringAdapter\[]/)
  assert.match(hiringRuntime, /export function allHiringTargets/)
  assert.match(hiringRuntime, /export async function refreshHiringTarget/)
})
