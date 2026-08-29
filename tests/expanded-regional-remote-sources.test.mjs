import assert from 'node:assert/strict'
import test from 'node:test'
import {
  EXPANDED_REGIONAL_REMOTE_COMPANIES,
  mapExpandedLeverPostings,
} from '../server/utils/expandedRegionalRemoteSources.ts'

const posting = (location, title = 'Operations Manager', workplaceType = 'remote') => ({
  id: `${location}-${title}`,
  text: title,
  hostedUrl: `https://jobs.lever.co/example/${encodeURIComponent(location)}-${encodeURIComponent(title)}`,
  createdAt: Date.now(),
  descriptionPlain: 'Customer operations, finance, security and service delivery role',
  categories: { location, team: 'Operations', commitment: 'Full-time' },
  workplaceType,
})

test('expanded catalog covers UA, RO, UZ, US and remote', () => {
  const markets = new Set(EXPANDED_REGIONAL_REMOTE_COMPANIES.map((company) => company.market))
  assert.deepEqual([...markets].sort(), ['REMOTE', 'RO', 'UA', 'US', 'UZ'])
  assert.ok(EXPANDED_REGIONAL_REMOTE_COMPANIES.length >= 14)
})

test('US remote mapping keeps US roles and rejects foreign locations', () => {
  const company = EXPANDED_REGIONAL_REMOTE_COMPANIES.find((item) => item.handle === 'pointclickcare')
  assert.ok(company)
  const jobs = mapExpandedLeverPostings([
    posting('Remote - US', 'Customer Support Manager'),
    posting('Toronto, Canada', 'Customer Support Manager'),
  ], company)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'companies')
  assert.equal(jobs[0].employerType, 'direct')
  assert.equal(jobs[0].remote, true)
})

test('Romania and Uzbekistan cross-border aliases remain scoped', () => {
  const romania = EXPANDED_REGIONAL_REMOTE_COMPANIES.find((item) => item.handle === 'tsmg')
  const uzbekistan = EXPANDED_REGIONAL_REMOTE_COMPANIES.find((item) => item.handle === 'remofirst' && item.market === 'UZ')
  assert.ok(romania)
  assert.ok(uzbekistan)

  assert.equal(mapExpandedLeverPostings([posting('Bucharest')], romania).length, 1)
  assert.equal(mapExpandedLeverPostings([posting('Egypt / Kazakhstan / Uzbekistan')], uzbekistan).length, 1)
  assert.equal(mapExpandedLeverPostings([posting('India')], uzbekistan).length, 0)
})
