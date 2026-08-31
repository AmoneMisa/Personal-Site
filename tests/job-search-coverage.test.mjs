import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const coverage = await readFile(new URL('../server/utils/jobSearchCoverage.ts', import.meta.url), 'utf8')
const linkedin = await readFile(new URL('../server/utils/linkedinSource.ts', import.meta.url), 'utf8')
const social = await readFile(new URL('../server/utils/socialJobSources.ts', import.meta.url), 'utf8')
const sourceFetchers = await readFile(new URL('../server/utils/jobSourceFetchers.ts', import.meta.url), 'utf8')

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

test('LinkedIn paginates public guest search and rotates regional coverage', () => {
  assert.match(linkedin, /page \* 25/)
  assert.match(linkedin, /LINKEDIN_MAX_PAGES/)
  assert.match(linkedin, /linkedinLocationCoverage/)
  assert.match(linkedin, /USA_RELOCATION_QUERIES/)
  assert.match(linkedin, /countryRemotePasses/)
})

test('Threads jobs use bounded regional rotation and reject candidate posts through shared hiring semantics', () => {
  assert.match(social, /THREADS_JOB_REGIONAL_QUERIES_PER_CYCLE/)
  assert.match(social, /THREADS_JOB_PRIORITY_QUERIES_PER_CYCLE/)
  assert.match(social, /classifySharedHiringMessage\(text\)/)
  assert.match(social, /detectHiringIntent\(text\)/)
  assert.doesNotMatch(social, /const CANDIDATE_RE\s*=/)
  assert.match(social, /fetched=\$\{items\.length\} recent=\$\{recent\} classified=\$\{jobs\.length\}/)
})

test('long-running social and LinkedIn sources are not capped at 30 seconds', () => {
  assert.match(sourceFetchers, /LINKEDIN_SOURCE_TIMEOUT_MS/)
  assert.match(sourceFetchers, /SOCIAL_SOURCE_TIMEOUT_MS/)
  assert.match(sourceFetchers, /source === 'linkedin'/)
  assert.match(sourceFetchers, /source === 'facebook' \|\| source === 'threads'/)
})
