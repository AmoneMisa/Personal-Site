import assert from 'node:assert/strict'
import test from 'node:test'
import { classifySuspicion } from '../server/utils/suspicious.ts'

const centrumAirCases = [
  {
    title: 'ML Engineer',
    description: 'ML Engineer We are looking for a Machine Learning Engineer to develop, deploy, and maintain machine learning models that drive business optimization and operational efficiency. In this role, you will work with large datasets, build scalable ML solutions, and integrate predictive models into the company’s digital ecosystem. Read more',
  },
  {
    title: 'Data Analyst',
    description: 'Data Analyst Centrum Air is looking for a Data Analyst to analyze business performance, prepare reports, and identify opportunities to improve operational efficiency. In this role, you will work with data from various departments and support data-driven decision-making across the organization. Read more',
  },
]

test('substantive Centrum Air snippets are not suspicious without a responsibilities heading', () => {
  for (const vacancy of centrumAirCases) {
    const result = classifySuspicion({ ...vacancy, company: 'Centrum Air' })
    assert.equal(result.riskCategory, null)
    assert.equal(result.suspicious, false)
    assert.doesNotMatch(result.suspicionReasons.join(','), /no-responsibilities/)
  }
})

test('a short vague employer ad still keeps its soft suspicion signals', () => {
  const result = classifySuspicion({
    title: 'Manager',
    company: 'Company',
    description: 'Communication with clients. High income.',
  })
  assert.equal(result.suspicious, true)
  assert.ok(result.suspicionReasons.includes('no-responsibilities'))
  assert.ok(result.suspicionReasons.includes('vague-title'))
  assert.ok(result.suspicionReasons.includes('unclear-employer'))
})
