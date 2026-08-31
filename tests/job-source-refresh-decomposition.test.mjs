import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const refresh = await readFile(new URL('../server/utils/jobsSourceRefresh.ts', import.meta.url), 'utf8')
const fetchers = await readFile(new URL('../server/utils/jobSourceFetchers.ts', import.meta.url), 'utf8')
const feed = await readFile(new URL('../server/routes/jobs-feed.get.ts', import.meta.url), 'utf8')

test('source fetching and source availability are owned by dedicated modules', () => {
  assert.match(refresh, /import \{ fetchJobSource \} from '\.\/jobSourceFetchers'/)
  assert.match(refresh, /import \{ isJobSourceAvailable \} from '\.\/jobSourceConfig'/)
  assert.doesNotMatch(refresh, /const FETCHERS:/)
  assert.doesNotMatch(refresh, /COMPANIES_SOURCE_TIMEOUT_MS/)
  assert.match(fetchers, /const FETCHERS: Record<JobSource/)
  assert.match(fetchers, /export async function fetchJobSource/)
})

test('feed and ingestion use the same source-config owner with explicit modes', () => {
  assert.match(feed, /isJobSourceAvailable\(source, 'feed'\)/)
  assert.match(refresh, /isJobSourceAvailable\(source, 'ingestion'\)/)
  assert.doesNotMatch(feed, /function isConfigured/)
  assert.doesNotMatch(refresh, /function isConfigured/)
})
