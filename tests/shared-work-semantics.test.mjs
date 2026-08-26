import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

import {
  detectEmploymentTypes,
  detectExperienceRequirement,
  detectProbation,
  detectWorkModes,
  detectWorkSchedules,
} from '../server/utils/hiringLexicon.ts'

test('consumer work semantics delegate to the shared package', async () => {
  assert.deepEqual(detectEmploymentTypes('full-time freelance'), ['full_time', 'freelance'])
  assert.deepEqual(detectWorkModes('remote hybrid'), ['remote', 'hybrid'])
  assert.ok(detectWorkSchedules('5/2').includes('fiveTwo'))
  assert.equal(detectProbation('испытательный срок оплачивается'), 'paidProbation')
  assert.equal(detectExperienceRequirement('без опыта'), 'noExperience')

  const facade = await readFile(new URL('../server/utils/hiringLexicon.ts', import.meta.url), 'utf8')
  assert.match(facade, /@whiteslove\/parsing-lexicon\/hiring-work-semantics/u)
  assert.doesNotMatch(facade, /const EMPLOYMENT_VALUE/u)
  assert.doesNotMatch(facade, /for \(const entry of EMPLOYMENT_TYPES\)/u)

  const sources = await readFile(new URL('../server/utils/sourceExpansionJobs.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(sources, /MUK_COUNTRIES/u)
  assert.match(sources, /detectCountryCodeFromText\(raw\)/u)
})
