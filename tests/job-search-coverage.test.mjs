import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const coverage = await readFile(new URL('../server/utils/jobSearchCoverage.ts', import.meta.url), 'utf8')
const linkedin = await readFile(new URL('../server/utils/linkedinSource.ts', import.meta.url), 'utf8')
const social = await readFile(new URL('../server/utils/socialJobSources.ts', import.meta.url), 'utf8')
const sourceFetchers = await readFile(new URL('../server/utils/jobSourceFetchers.ts', import.meta.url), 'utf8')
const sourceRefresh = await readFile(new URL('../server/utils/jobsSourceRefresh.ts', import.meta.url), 'utf8')

const oblastLabels = [
  'Вінницька область', 'Волинська область', 'Дніпропетровська область', 'Донецька область',
  'Житомирська область', 'Закарпатська область', 'Запорізька область', 'Івано-Франківська область',
  'Київська область', 'Кіровоградська область', 'Луганська область', 'Львівська область',
  'Миколаївська область', 'Одеська область', 'Полтавська область', 'Рівненська область',
  'Сумська область', 'Тернопільська область', 'Харківська область', 'Херсонська область',
  'Хмельницька область', 'Черкаська область', 'Чернівецька область', 'Чернігівська область',
]

test('job search coverage includes every Ukrainian oblast', () => {
  assert.equal(oblastLabels.length, 24)
  for (const oblast of oblastLabels) assert.match(coverage, new RegExp(oblast))
  assert.match(coverage, /Робота \$\{place\.label\}/)
  assert.match(coverage, /Вакансії \$\{place\.label\}/)
})

test('priority job coverage includes worldwide remote and USA relocation', () => {
  assert.match(coverage, /remote worldwide/)
  assert.match(coverage, /work from anywhere/)
  assert.match(coverage, /relocation to USA/)
  assert.match(coverage, /US visa sponsorship/)
  assert.match(coverage, /H-1B sponsorship/)
})

test('LinkedIn regional coverage is split into durable shared-crawler targets', () => {
  assert.match(linkedin, /crawlStandardJobBoard/)
  assert.match(linkedin, /linkedinLocationCoverage/)
  assert.match(linkedin, /USA_RELOCATION_QUERIES/)
  assert.match(linkedin, /configuredLinkedInJobTargets/)
  assert.match(linkedin, /fetchLinkedInJobTarget/)
  assert.doesNotMatch(linkedin, /LINKEDIN_MAX_PAGES/)
  assert.doesNotMatch(linkedin, /LINKEDIN_SOURCE_TIMEOUT_MS/)
})

test('Threads jobs expose every coverage query as a queue target and use shared hiring semantics', () => {
  assert.match(social, /threadsJobCoverage\(\)/)
  assert.match(social, /REMOTE_JOB_QUERIES\.map/)
  assert.match(social, /USA_RELOCATION_QUERIES\.map/)
  assert.match(social, /configuredSocialJobTargets/)
  assert.match(social, /classifySharedHiringMessage\(text\)/)
  assert.match(social, /detectHiringIntent\(text\)/)
  assert.doesNotMatch(social, /THREADS_JOB_(?:REGIONAL|PRIORITY)_QUERIES_PER_CYCLE/)
  assert.doesNotMatch(social, /const CANDIDATE_RE\s*=/)
  assert.match(social, /fetched=\$\{items\.length\} recent=\$\{recent\} classified=\$\{jobs\.length\}/)
})

test('LinkedIn and social ingestion is queue-targeted without source-level timeout wrappers', () => {
  assert.match(sourceFetchers, /linkedin:\s*targetizedSource/)
  assert.match(sourceFetchers, /facebook:\s*targetizedSource/)
  assert.match(sourceFetchers, /threads:\s*targetizedSource/)
  assert.doesNotMatch(sourceFetchers, /TIMEOUT(?:_MS)?/)
  assert.match(sourceRefresh, /configuredLinkedInJobTargets/)
  assert.match(sourceRefresh, /configuredSocialJobTargets/)
  assert.match(sourceRefresh, /fetchLinkedInJobTarget/)
  assert.match(sourceRefresh, /fetchSocialJobTarget/)
})
