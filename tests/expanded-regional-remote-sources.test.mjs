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

test('expanded catalog covers all requested regional and remote markets', () => {
  const markets = new Set(EXPANDED_REGIONAL_REMOTE_COMPANIES.map((company) => company.market))
  assert.deepEqual(
    [...markets].sort(),
    ['CN', 'JP', 'KG', 'KR', 'KZ', 'REMOTE', 'RO', 'UA', 'US', 'UZ'],
  )
  assert.ok(EXPANDED_REGIONAL_REMOTE_COMPANIES.length >= 35)

  for (const [handle, market] of [
    ['ppro', 'CN'],
    ['EnvisionRPO', 'JP'],
    ['cagents', 'JP'],
    ['binance', 'KZ'],
    ['binance', 'JP'],
  ]) {
    assert.ok(EXPANDED_REGIONAL_REMOTE_COMPANIES.some((item) => item.handle === handle && item.market === market))
  }
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

test('Central Asia targets keep Kazakhstan and Kyrgyzstan vacancies scoped', () => {
  const kazakhstan = EXPANDED_REGIONAL_REMOTE_COMPANIES.find((item) => item.handle === 'binance' && item.market === 'KZ')
  const kyrgyzstan = EXPANDED_REGIONAL_REMOTE_COMPANIES.find((item) => item.handle === 'binance' && item.market === 'KG')
  assert.ok(kazakhstan)
  assert.ok(kyrgyzstan)

  assert.equal(mapExpandedLeverPostings([posting('Kazakhstan, Astana')], kazakhstan).length, 1)
  assert.equal(mapExpandedLeverPostings([posting('Kyrgyzstan, Bishkek')], kyrgyzstan).length, 1)
  assert.equal(mapExpandedLeverPostings([posting('Dubai')], kyrgyzstan).length, 0)
})

test('East Asia targets match country and city aliases without cross-market leakage', () => {
  const china = EXPANDED_REGIONAL_REMOTE_COMPANIES.find((item) => item.handle === 'ppro' && item.market === 'CN')
  const japan = EXPANDED_REGIONAL_REMOTE_COMPANIES.find((item) => item.handle === 'EnvisionRPO' && item.market === 'JP')
  const korea = EXPANDED_REGIONAL_REMOTE_COMPANIES.find((item) => item.handle === 'insiderone' && item.market === 'KR')
  assert.ok(china)
  assert.ok(japan)
  assert.ok(korea)

  assert.equal(mapExpandedLeverPostings([posting('Shanghai')], china).length, 1)
  assert.equal(mapExpandedLeverPostings([posting('Tokyo, Japan')], japan).length, 1)
  assert.equal(mapExpandedLeverPostings([posting('Seoul, South Korea')], korea).length, 1)
  assert.equal(mapExpandedLeverPostings([posting('Singapore')], china).length, 0)
})
