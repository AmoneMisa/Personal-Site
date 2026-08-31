import assert from 'node:assert/strict'
import test from 'node:test'

import { isJobSourceAvailable } from '../server/utils/jobSourceConfig.ts'

async function withEnv(values, run) {
  const previous = new Map()
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key])
    if (value == null) delete process.env[key]
    else process.env[key] = value
  }

  try {
    await run()
  } finally {
    for (const [key, value] of previous) {
      if (value == null) delete process.env[key]
      else process.env[key] = value
    }
  }
}

test('persisted social rows stay feed-visible even when this process cannot ingest them', async () => {
  await withEnv({
    SOCIAL_JOB_SOURCE: 'on',
    HIRING_SOCIAL_API_URL: null,
    QUEUE_INTERNAL_KEY: null,
  }, () => {
    assert.equal(isJobSourceAvailable('threads', 'feed'), true)
    assert.equal(isJobSourceAvailable('threads', 'ingestion'), false)
    assert.equal(isJobSourceAvailable('facebook', 'feed'), true)
    assert.equal(isJobSourceAvailable('facebook', 'ingestion'), false)
  })
})

test('credential-backed APIs are unavailable in both modes without credentials', async () => {
  await withEnv({ ADZUNA_APP_ID: null, ADZUNA_APP_KEY: null, JOOBLE_KEY: null }, () => {
    assert.equal(isJobSourceAvailable('adzuna', 'feed'), false)
    assert.equal(isJobSourceAvailable('adzuna', 'ingestion'), false)
    assert.equal(isJobSourceAvailable('jooble', 'feed'), false)
    assert.equal(isJobSourceAvailable('jooble', 'ingestion'), false)
  })
})

test('source feature flags are shared by feed and ingestion decisions', async () => {
  await withEnv({ HH_JOB_SOURCE: 'off', TELEGRAM_SOURCE: 'off', OLX_SOURCE: 'off' }, () => {
    assert.equal(isJobSourceAvailable('hh', 'feed'), false)
    assert.equal(isJobSourceAvailable('hh', 'ingestion'), false)
    assert.equal(isJobSourceAvailable('telegram', 'feed'), false)
    assert.equal(isJobSourceAvailable('telegram', 'ingestion'), false)
    assert.equal(isJobSourceAvailable('olx', 'feed'), false)
    assert.equal(isJobSourceAvailable('olx', 'ingestion'), false)
  })
})
