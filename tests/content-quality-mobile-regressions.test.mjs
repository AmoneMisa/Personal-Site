import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

const [
  candidateWriter,
  jobRefresh,
  jobCard,
  pills,
  flatCard,
  flatPresentation,
  flatTypes,
  flatMap,
  detailsModal,
  translateGet,
] = await Promise.all([
  read('../server/hiring/application/candidateSnapshotWriter.ts'),
  read('../server/utils/jobsSourceRefresh.ts'),
  read('../app/components/jobs/JobCard.vue'),
  read('../app/components/ui/DraggablePills.vue'),
  read('../app/components/flats/FlatCard.vue'),
  read('../app/composables/flats/useFlatPresentation.ts'),
  read('../app/types/flats.ts'),
  read('../app/components/flats/FlatMap.client.vue'),
  read('../app/components/search/SearchDetailsModal.vue'),
  read('../server/routes/flats-translate.get.ts'),
])

test('candidate snapshot rejects workshop/event promos instead of turning speakers into CVs', () => {
  assert.match(candidateWriter, /isCandidateEventPromotion/u)
  assert.match(candidateWriter, /воркшоп/u)
  assert.match(candidateWriter, /вебінар/u)
  assert.match(candidateWriter, /signals >= 2/u)
  assert.match(candidateWriter, /isRecruitingOpportunity\(text\) \|\| isCandidateEventPromotion\(text\)/u)
})

test('company names are removed from vacancy tags at storage and card boundaries', () => {
  assert.match(jobRefresh, /function cleanJobTags\(job: Job\)/u)
  assert.match(jobRefresh, /key === company/u)
  assert.match(jobRefresh, /sanitizeFetchedJob\(stored\)/u)
  assert.match(jobCard, /pillKey\(tag\) !== company/u)
})

test('all draggable pills capitalize their visible first character', () => {
  assert.match(pills, /function displayLabel\(value: string\)/u)
  assert.match(pills, /toLocaleUpperCase/u)
  assert.match(pills, /\{\{ displayLabel\(item\.label\) \}\}/u)
})

test('vacancy modal no longer visually duplicates disclosed salary above the spec table', () => {
  assert.match(jobCard, /job-modal__badges > \.job-card__salary/u)
  assert.match(jobCard, /display: none/u)
})

test('flat cards surface AI vision provenance and stay compact on phones', () => {
  assert.match(flatTypes, /vision\?: FlatVisionResult/u)
  assert.match(flatTypes, /visionBadgeLabels: string\[\]/u)
  assert.match(flatPresentation, /listing\.vision\?\.derivedFields/u)
  assert.match(flatPresentation, /visionBadgeLabels/u)
  assert.match(flatCard, /flat-card__badge_vision/u)
  assert.match(flatCard, /grid-template-columns: minmax\(118px, 40%\)/u)
  assert.match(flatCard, /height: 188px/u)
})

test('map cluster browser clamps into the viewport and detail modal wins the z-index stack', () => {
  assert.match(flatMap, /clampRadialCoordinate/u)
  assert.match(flatMap, /window\.innerWidth/u)
  assert.match(flatMap, /window\.innerHeight/u)
  assert.match(flatMap, /mobile \? 72 : 94/u)
  assert.match(detailsModal, /z-\[12000\]/u)
  assert.match(detailsModal, /z-\[12001\]/u)
})

test('translation pending jobs have a GET proxy to the AI worker result endpoint', () => {
  assert.match(translateGet, /translation-\[a-f0-9\]\{32\}/u)
  assert.match(translateGet, /\/ai\/result\//u)
  assert.match(translateGet, /isAiWorkerTransientError/u)
  assert.match(translateGet, /status: 'pending'/u)
})
