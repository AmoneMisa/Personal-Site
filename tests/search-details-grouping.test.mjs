import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('vacancy and candidate popups reuse the shared three-column grouped table', async () => {
  const [specTable, jobs, hiring] = await Promise.all([
    read('app/components/ui/SpecTable.vue'),
    read('app/pages/jobs/index.vue'),
    read('app/pages/hiring/index.vue'),
  ])

  assert.match(specTable, /const usesGroupedColumns/)
  assert.match(specTable, /const specColumns/)
  assert.match(specTable, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/)
  assert.match(jobs, /overview: \{ column: 1/)
  assert.match(jobs, /compensation: \{ column: 2/)
  assert.match(jobs, /requirements: \{ column: 3/)
  assert.match(hiring, /identity: \{ column: 1/)
  assert.match(hiring, /preferences: \{ column: 2/)
  assert.match(hiring, /qualifications: \{ column: 3/)
  assert.equal((jobs.match(/<UiSpecTable/g) || []).length, 1)
  assert.equal((hiring.match(/<UiSpecTable/g) || []).length, 1)
})

test('search detail popups prefer public IDs supplied by backend cards', async () => {
  const [modal, jobs, hiring] = await Promise.all([
    read('app/components/search/SearchDetailsModal.vue'),
    read('app/pages/jobs/index.vue'),
    read('app/pages/hiring/index.vue'),
  ])

  assert.match(modal, /class="search-details-public-title__id"/)
  assert.match(modal, /color: #fff/)
  assert.match(jobs, /:public-id="jobPublicId\(activeJob\)"/)
  assert.match(hiring, /:public-id="candidatePublicId\(active\)"/)
  assert.match(jobs, /job\.publicId \?\? publicEntityId\("job", job\.source, job\.id\)/)
  assert.match(hiring, /profile\.publicId \?\? publicEntityId\("candidate", profile\.sourceKey \|\| profile\.source, profile\.country, profile\.id\)/)
})
