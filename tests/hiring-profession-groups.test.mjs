import assert from 'node:assert/strict'
import test from 'node:test'

import {
  collapseHiringProfessionFilterValues,
  expandHiringProfessionFilters,
  hiringProfessionFilterLabel,
} from '../shared/hiringProfessionGroups.ts'

test('obviously adjacent professions collapse to one filter facet', () => {
  assert.deepEqual(
    collapseHiringProfessionFilterValues(['Accountant', 'Chief Accountant', 'Finance / Banking Specialist']),
    ['group:accounting-finance'],
  )
  assert.deepEqual(
    collapseHiringProfessionFilterValues(['Frontend Developer', 'Backend Developer', 'Mobile Developer']),
    ['group:software-development'],
  )
  assert.deepEqual(
    collapseHiringProfessionFilterValues(['Waiter', 'Barista', 'Cook / Chef']),
    ['group:horeca'],
  )
})

test('collapsed facets expand back to all searchable professions', () => {
  const support = expandHiringProfessionFilters(['group:support-contact-center'])
  assert.ok(support.includes('Customer Support'))
  assert.ok(support.includes('Chat Operator'))
  assert.ok(support.includes('Call Center Operator'))

  const logistics = expandHiringProfessionFilters(['group:logistics-warehouse'])
  assert.ok(logistics.includes('Logistics Specialist'))
  assert.ok(logistics.includes('Warehouse Worker'))
  assert.ok(logistics.includes('Driver'))
})

test('group labels are compact and localized', () => {
  assert.equal(hiringProfessionFilterLabel('group:sales-retail', 'ru'), 'Продажи / Ритейл')
  assert.equal(hiringProfessionFilterLabel('group:medicine', 'ru'), 'Медицина / Здравоохранение')
  assert.equal(hiringProfessionFilterLabel('group:software-development', 'en'), 'Software Development')
})

test('unrelated professions are not collapsed into broad catch-all groups', () => {
  assert.deepEqual(collapseHiringProfessionFilterValues(['Architect']), ['Architect'])
  assert.deepEqual(collapseHiringProfessionFilterValues(['Psychologist']), ['Psychologist'])
  assert.deepEqual(collapseHiringProfessionFilterValues(['Project Manager']), ['Project Manager'])
})
