import test from 'node:test'
import assert from 'node:assert/strict'

import { publicEntityId } from '../shared/publicEntityId.ts'

test('public entity IDs are stable, numeric, and namespaced away from source IDs', () => {
  const job = publicEntityId('job', 'remotive', 'provider-123')
  const sameJob = publicEntityId('job', 'remotive', 'provider-123')
  const candidate = publicEntityId('candidate', 'remotive', 'provider-123')

  assert.equal(job, sameJob)
  assert.notEqual(job, candidate)
  assert.ok(Number.isSafeInteger(job))
  assert.ok(job >= 100_000_000_000 && job < 1_000_000_000_000)
  assert.notEqual(String(job), 'provider-123')
})
